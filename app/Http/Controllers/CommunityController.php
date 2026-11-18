<?php

namespace App\Http\Controllers;

use App\Models\MemberPage;
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
        ]);
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

        MemberPage::query()->updateOrCreate(
            ['user_id' => $user->id],
            ['title' => strip_tags($data['title']), 'html' => $clean, 'status' => $this->keepHidden($user->id)],
        );

        return redirect('/u/'.$user->username)->with('status', 'Halamanmu tersimpan.');
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
        $page = $user instanceof User ? MemberPage::query()->where('user_id', $user->id)->first() : null;
        abort_unless($page instanceof MemberPage && $page->isPublished(), 404);

        $base = $request->getScheme().'://'.strtolower((string) config('singlepage.base_domain'));

        // Direct use is refused: needs a fresh signed token from the profile page AND an iframe fetch.
        if (! MemberFrameToken::valid($request->query('t'), $page->id) || strtolower((string) $request->header('Sec-Fetch-Dest')) !== 'iframe') {
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

        $html = $page->html;
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
