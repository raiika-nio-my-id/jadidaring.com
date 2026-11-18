<?php

namespace App\Http\Controllers;

use App\Models\MemberDraftKey;
use App\Models\MemberPage;
use App\Models\MemberPageDraft;
use App\Models\MemberPageComment;
use App\Models\User;
use App\Services\MemberFrameToken;
use App\Services\MemberPageSanitizer;
use App\Services\TenantPath;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Illuminate\View\View;

class CommunityController extends Controller
{
    public function index(): View
    {
        $pages = MemberPage::query()->where('status', 'published')->with('user:id,username')->latest('updated_at')->limit(24)->get();

        return view('clay.komunitas', [
            'metaTitle' => 'Komunitas: Buat Halaman Profilmu Sendiri — Jadidaring',
            'metaDescription' => 'Buat halaman profil ala Friendster dengan bantuan AI: musik, kursor kustom, latar unik. Pakai prompt siap pakai untuk ChatGPT atau Gemini.',
            'canonicalUrl' => 'https://'.TenantPath::host().'/komunitas',
            'pages' => $pages,
            'mine' => auth()->check() ? MemberPage::query()->where('user_id', auth()->id())->first() : null,
        ]);
    }

    public function edit(): View
    {
        return view('clay.komunitas-buat', [
            'metaTitle' => 'Halaman Saya — Jadidaring',
            'metaDescription' => 'Tempel kode HTML halamanmu.',
            'page' => MemberPage::query()->where('user_id', auth()->id())->first(),
            'draft' => $draft = MemberPageDraft::query()->where('user_id', auth()->id())->first(),
            'draftFrame' => $draft ? $this->draftFrame(request(), auth()->user(), $draft) : null,
        ]);
    }

    private function draftFrame(Request $request, User $user, MemberPageDraft $draft): string
    {
        $sandbox = (string) config('singlepage.sandbox_domain');
        $q = '?d=1&t='.MemberFrameToken::mint($draft->tokenId());

        return $sandbox !== '' ? $request->getScheme().'://'.$sandbox.'/'.$user->username.$q : '/u/'.$user->username.'/konten'.$q;
    }

    /** Mint a one-time draft key (logged-in member, rate limited by route). */
    public function mintKey(Request $request): \Illuminate\Http\JsonResponse
    {
        return response()->json([
            'key' => MemberDraftKey::mint($request->user()->id),
            'expires_in' => MemberDraftKey::TTL_MINUTES * 60,
            'endpoint' => 'https://'.TenantPath::host().'/api/komunitas/draft',
        ], 200, ['Cache-Control' => 'no-store']);
    }

    /** Session-less, CORS-open endpoint. Creates a DRAFT only; the key is consumed on the first success. */
    public function apiDraft(Request $request): \Illuminate\Http\JsonResponse
    {
        $cors = ['Access-Control-Allow-Origin' => '*', 'Access-Control-Allow-Headers' => 'Content-Type, X-Draft-Key, Authorization', 'Access-Control-Allow-Methods' => 'POST, OPTIONS', 'Cache-Control' => 'no-store'];

        if ($request->isMethod('OPTIONS')) {
            return response()->json(null, 204, $cors);
        }

        if (strlen($request->getContent()) > 420000) {
            return response()->json(['error' => 'Ukuran maksimal 300 KB.'], 413, $cors);
        }

        $json = str_contains((string) $request->header('Content-Type'), 'json') ? $request->json()->all() : [];
        $key = (string) ($request->header('X-Draft-Key') ?: $request->bearerToken() ?: ($json['key'] ?? $request->input('key', '')));
        $html = is_array($json) && isset($json['html']) ? $json['html'] : (empty($json) ? ($request->input('html') ?? $request->getContent()) : '');
        $title = is_array($json) && isset($json['title']) ? (string) $json['title'] : (string) $request->input('title', '');

        $record = $key !== '' && str_starts_with($key, 'jdk_') ? MemberDraftKey::query()->where('key_hash', MemberDraftKey::hash($key))->first() : null;

        if (! $record || $record->used_at !== null || $record->expires_at->isPast()) {
            return response()->json(['error' => 'Kunci tidak valid, kedaluwarsa, atau sudah dipakai. Buat prompt baru di jadidaring.com/komunitas.'], 401, $cors);
        }

        if (! is_string($html) || trim($html) === '') {
            return response()->json(['error' => 'HTML kosong.'], 422, $cors);
        }

        try {
            $clean = MemberPageSanitizer::clean($html);
        } catch (ValidationException $e) {
            return response()->json(['error' => collect($e->errors())->flatten()->first()], 422, $cors);
        }

        if ($title === '' && preg_match('~<title[^>]*>(.*?)</title>~is', $html, $m) === 1) {
            $title = html_entity_decode($m[1]);
        }
        $title = mb_substr(trim(strip_tags($title)) ?: 'Halamanku', 0, 120);

        $ownerId = $record->user_id;
        $ok = DB::transaction(function () use ($record, $ownerId, $clean, $title): bool {
            $claimed = MemberDraftKey::query()->whereKey($record->id)->whereNull('used_at')->update(['used_at' => now()]);
            if ($claimed !== 1) {
                return false;
            }
            MemberPageDraft::query()->updateOrCreate(['user_id' => $ownerId], ['title' => $title, 'html' => $clean, 'source' => 'api']);

            return true;
        });

        if (! $ok) {
            return response()->json(['error' => 'Kunci sudah dipakai.'], 401, $cors);
        }

        return response()->json(['ok' => true, 'status' => 'draft', 'review_url' => 'https://'.TenantPath::host().'/komunitas/halamanku', 'message' => 'Draft tersimpan. Buka review_url (masuk sebagai pemilik) untuk meninjau, lalu Terbitkan atau Batal.'], 201, $cors);
    }

    public function publishDraft(Request $request): RedirectResponse
    {
        $user = $request->user();
        $draft = MemberPageDraft::query()->where('user_id', $user->id)->first();
        abort_unless($draft instanceof MemberPageDraft, 404);

        MemberPage::query()->updateOrCreate(
            ['user_id' => $user->id],
            ['title' => $draft->title, 'html' => $draft->html, 'status' => $this->keepHidden($user->id)],
        );
        $draft->delete();

        return redirect('/u/'.$user->username)->with('status', 'Halamanmu terbit.');
    }

    public function cancelDraft(Request $request): RedirectResponse
    {
        MemberPageDraft::query()->where('user_id', $request->user()->id)->delete();

        return redirect('/komunitas/halamanku')->with('status', 'Draft dibatalkan.');
    }

    public function save(Request $request): RedirectResponse
    {
        $user = $request->user();
        abort_if(! is_string($user->username) || $user->username === '', 403);

        $data = $request->validate([
            'title' => ['required', 'string', 'min:3', 'max:120'],
            'html' => ['nullable', 'string', 'max:400000'],
            'file' => ['nullable', 'file', 'max:300', 'mimes:html,htm,txt'],
        ]);

        $raw = (string) ($data['html'] ?? '');
        if ($request->hasFile('file')) {
            $raw = (string) file_get_contents($request->file('file')->getRealPath());
        }

        $clean = MemberPageSanitizer::clean($raw);

        MemberPageDraft::query()->updateOrCreate(
            ['user_id' => $user->id],
            ['title' => strip_tags($data['title']), 'html' => $clean, 'source' => 'paste'],
        );

        return redirect('/komunitas/halamanku')->with('status', 'Draft siap ditinjau. Belum tayang sampai kamu menekan Terbitkan.');
    }

    /** A page hidden by moderation stays hidden when its owner edits it. */
    private function keepHidden(int $userId): string
    {
        return MemberPage::query()->where('user_id', $userId)->value('status') === 'hidden' ? 'hidden' : 'published';
    }

    public function show(Request $request, string $username): View
    {
        [$user, $page] = $this->resolve($username);
        abort_unless($page->isPublished() || (auth()->check() && auth()->id() === $user->id), 404);

        DB::table('member_pages')->where('id', $page->id)->increment('views');

        $comments = MemberPageComment::query()->where('member_page_id', $page->id)->where('is_hidden', false)
            ->with('user:id,username')->orderByDesc('id')->limit(100)->get();

        $sandbox = (string) config('singlepage.sandbox_domain');
        $token = MemberFrameToken::mint($page->id);
        $frame = ($sandbox !== '' ? $request->getScheme().'://'.$sandbox.'/'.$user->username : '/u/'.$user->username.'/konten').'?t='.$token;

        return view('clay.komunitas-halaman', [
            'metaTitle' => $page->title.' (@'.$user->username.') — Jadidaring',
            'metaDescription' => 'Halaman komunitas @'.$user->username.' di Jadidaring.',
            'canonicalUrl' => 'https://'.TenantPath::host().'/u/'.$user->username,
            'noindex' => true,
            'owner' => $user,
            'page' => $page,
            'comments' => $comments,
            'frameSrc' => $frame,
            'isOwner' => auth()->check() && auth()->id() === $user->id,
        ]);
    }

    /** Session-less response, served inside a sandboxed iframe only. */
    public function content(Request $request, string $username): Response
    {
        $user = User::query()->where('username', $username)->first();
        $isDraft = $request->query('d') === '1';
        $page = $user instanceof User
            ? ($isDraft ? MemberPageDraft::query()->where('user_id', $user->id)->first() : MemberPage::query()->where('user_id', $user->id)->first())
            : null;
        abort_unless($page instanceof MemberPage || $page instanceof MemberPageDraft, 404);
        abort_unless($isDraft || $page->isPublished(), 404);
        $tokenId = $page instanceof MemberPageDraft ? $page->tokenId() : $page->id;

        $base = $request->getScheme().'://'.strtolower((string) config('singlepage.base_domain'));

        // Direct use is refused: needs a fresh signed token from the profile page AND an iframe fetch.
        if (! MemberFrameToken::valid($request->query('t'), $tokenId) || strtolower((string) $request->header('Sec-Fetch-Dest')) !== 'iframe') {
            $link = e($base.'/u/'.$username);

            return response('<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex"><title>Akses langsung tidak diizinkan</title>'
                .'<p style="font:16px system-ui;padding:2rem">Halaman ini hanya bisa dibuka dari profil di Jadidaring. <a href="'.$link.'">Buka profil @'.e($username).'</a></p>', 403, [
                'Content-Type' => 'text/html; charset=utf-8',
                'X-Robots-Tag' => 'noindex, nofollow, noarchive',
                'Cache-Control' => 'no-store',
                'Content-Security-Policy' => "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; sandbox",
                'Referrer-Policy' => 'no-referrer',
            ]);
        }

        // Repair pages saved while the old sanitizer mangled scroll-behavior / overscroll-behavior.
        $html = preg_replace('/\b(scroll|overscroll)-x-blocked\(/', '$1-behavior:', $page->html) ?? $page->html;
        $snippet = '<script>(function(){function s(){try{var b=document.body,h=Math.max(b?b.scrollHeight:0,document.documentElement.scrollHeight);parent.postMessage({jdFrameHeight:Math.ceil(h)},"*")}catch(e){}}'
            .'addEventListener("load",s);addEventListener("DOMContentLoaded",s);if(document.fonts&&document.fonts.ready){document.fonts.ready.then(s)}'
            .'if(window.ResizeObserver){new ResizeObserver(s).observe(document.documentElement);if(document.body)new ResizeObserver(s).observe(document.body)}setInterval(s,1000)})();</script>';
        $html = stripos($html, '</body>') !== false ? preg_replace('~</body>~i', $snippet.'</body>', $html, 1) : $html.$snippet;

        $cdn = implode(' ', array_map(fn (string $h): string => 'https://'.$h, \App\Services\MemberPageSanitizer::CDN_HOSTS));
        $csp = implode('; ', [
            'sandbox allow-scripts allow-popups',
            "default-src 'none'",
            "script-src 'unsafe-inline' 'unsafe-eval' ".$cdn,
            "style-src 'unsafe-inline' ".$cdn,
            'img-src https: data:',
            'media-src https: data:',
            'font-src data: '.$cdn,
            "connect-src 'none'",
            "form-action 'none'",
            "base-uri 'none'",
            "object-src 'none'",
            "frame-src 'none'",
            "worker-src 'none'",
            'frame-ancestors '.$base,
        ]);

        return response($html, 200, [
            'Content-Type' => 'text/html; charset=utf-8',
            'Content-Security-Policy' => $csp,
            'Permissions-Policy' => 'fullscreen=(), pointer-lock=(), camera=(), microphone=(), geolocation=(), payment=(), usb=(), clipboard-read=(), clipboard-write=(), display-capture=()',
            'X-Content-Type-Options' => 'nosniff',
            'Referrer-Policy' => 'no-referrer',
            'X-Robots-Tag' => 'noindex, nofollow, noarchive',
            'Cache-Control' => 'private, no-store',
        ]);
    }

    public function comment(Request $request, string $username): RedirectResponse
    {
        [, $page] = $this->resolve($username);
        abort_unless($page->isPublished(), 404);

        $data = $request->validate(['body' => ['required', 'string', 'min:2', 'max:500']]);
        $body = trim(strip_tags($data['body']));

        if (preg_match_all('~https?://|www\.~i', $body) > 1) {
            throw ValidationException::withMessages(['body' => 'Maksimal satu tautan per komentar.']);
        }

        MemberPageComment::query()->create(['member_page_id' => $page->id, 'user_id' => $request->user()->id, 'body' => $body]);

        return redirect('/u/'.$username.'#komentar')->with('status', 'Komentar terkirim.');
    }

    /** Owner may hide spam on their wall; authors may remove their own. The wall itself cannot be disabled. */
    public function hideComment(Request $request, string $username, int $comment): RedirectResponse
    {
        [$owner, $page] = $this->resolve($username);
        $model = MemberPageComment::query()->where('member_page_id', $page->id)->findOrFail($comment);
        abort_unless($request->user()->id === $owner->id || $request->user()->id === $model->user_id, 403);

        $model->update(['is_hidden' => true]);

        return redirect('/u/'.$username.'#komentar');
    }

    public function reportComment(Request $request, string $username, int $comment): RedirectResponse
    {
        [, $page] = $this->resolve($username);
        $model = MemberPageComment::query()->where('member_page_id', $page->id)->findOrFail($comment);
        $key = 'cr:'.$request->user()->id.':'.$model->id;

        if (cache()->add($key, 1, 86400 * 30)) {
            $model->increment('reports_count');
            if ($model->reports_count >= MemberPage::AUTO_HIDE_REPORTS) {
                $model->update(['is_hidden' => true]);
            }
        }

        return redirect('/u/'.$username.'#komentar')->with('status', 'Laporan diterima.');
    }

    public function report(Request $request, string $username): RedirectResponse
    {
        [, $page] = $this->resolve($username);
        $data = $request->validate(['reason' => ['nullable', 'string', 'max:300']]);

        $inserted = DB::table('member_page_reports')->insertOrIgnore([
            'member_page_id' => $page->id, 'user_id' => $request->user()->id,
            'reason' => $data['reason'] ?? null, 'created_at' => now(),
        ]);

        if ($inserted) {
            $page->increment('reports_count');
            if ($page->reports_count >= MemberPage::AUTO_HIDE_REPORTS) {
                $page->update(['status' => 'hidden']);
            }
        }

        return redirect('/u/'.$username)->with('status', 'Laporan diterima. Terima kasih.');
    }

    /** @return array{0: User, 1: MemberPage} */
    private function resolve(string $username): array
    {
        $user = User::query()->where('username', $username)->first();
        abort_unless($user instanceof User, 404);
        $page = MemberPage::query()->where('user_id', $user->id)->first();
        abort_unless($page instanceof MemberPage, 404);

        return [$user, $page];
    }
}
