<?php

namespace App\Http\Controllers;

use App\Models\MemberDraftKey;
use App\Models\MemberPage;
use App\Models\MemberPageDraft;
use App\Models\MemberPageComment;
use App\Models\User;
use App\Services\MemberFrameToken;
use App\Services\EmbedExtractor;
use App\Services\MemberPageSanitizer;
use App\Services\ProfileConfig;
use App\Services\ProfilePayload;
use App\Services\TenantPath;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Illuminate\View\View;

class CommunityController extends Controller
{
    public function index(Request $request): View
    {
        $sort = in_array($request->query('urut'), ['baru', 'populer', 'update', 'mengikuti'], true) ? $request->query('urut') : 'update';
        $q = strtolower(trim((string) $request->query('q', '')));
        $q = preg_replace('/[^a-z0-9_]/', '', $q) ?? '';

        if ($sort === 'mengikuti' && ! auth()->check()) {
            $sort = 'update';
        }

        $pages = MemberPage::query()->where('status', 'published')
            ->where(fn ($w) => $w->whereNotNull('config')->orWhere('html', '!=', ''))
            ->with('user:id,username,name')->select('member_pages.*')->addSelect(['followers_count' => DB::table('member_follows')->selectRaw('count(*)')->whereColumn('followed_id', 'member_pages.user_id')])
            ->when($q !== '', fn ($w) => $w->whereHas('user', fn ($u) => $u->where('username', 'like', '%'.$q.'%')))
            ->when($sort === 'populer', fn ($w) => $w->orderByRaw('(select count(*) from member_follows where followed_id = member_pages.user_id) desc')->orderByDesc('views')->orderByDesc('id'))
            ->when($sort === 'mengikuti', fn ($w) => $w->whereIn('user_id', DB::table('member_follows')->where('follower_id', auth()->id())->select('followed_id'))->orderByDesc('updated_at')->orderByDesc('id'))
            ->when($sort === 'baru', fn ($w) => $w->orderByDesc('created_at')->orderByDesc('id'))
            ->when($sort === 'update', fn ($w) => $w->orderByDesc('updated_at')->orderByDesc('id'))
            ->simplePaginate(24)->withQueryString();

        return view('clay.komunitas-jelajah', [
            'metaTitle' => 'Komunitas: Jelajahi Profil Member — Jadidaring',
            'metaDescription' => 'Jelajahi profil member Jadidaring ala Friendster: latar unik, musik, galeri, dan komentar. Cari berdasarkan nama pengguna.',
            'canonicalUrl' => 'https://'.TenantPath::host().'/komunitas',
            'pages' => $pages, 'sort' => $sort, 'q' => $q,
        ]);
    }

    public function prompt(): View
    {
        return view('clay.komunitas-prompt', [
            'metaTitle' => 'Buat / Edit Profil dengan AI — Jadidaring',
            'metaDescription' => 'Buat profil ala Friendster dengan bantuan AI: latar, tema, musik, dan widget. Pakai prompt siap pakai untuk ChatGPT atau Gemini.',
            'canonicalUrl' => 'https://'.TenantPath::host().'/komunitas/buat',
            'mine' => auth()->check() ? MemberPage::query()->where('user_id', auth()->id())->first() : null,
            'savedForm' => auth()->check() ? json_decode((string) DB::table('prompt_form_states')->where('user_id', auth()->id())->value('data'), true) : null,
            'currentConfig' => auth()->check() ? (MemberPageDraft::query()->where('user_id', auth()->id())->first()?->profileConfig() ?? MemberPage::query()->where('user_id', auth()->id())->first()?->profileConfig() ?? ProfileConfig::defaults()) : null,
        ]);
    }

    public function edit(Request $request): View
    {
        $user = $request->user();
        $page = MemberPage::query()->where('user_id', $user->id)->first();
        $draft = MemberPageDraft::query()->where('user_id', $user->id)->first();
        $config = $draft ? $draft->profileConfig() : ($page?->profileConfig() ?? ProfileConfig::defaults());
        $html = $draft ? (string) $draft->html : (string) ($page?->html ?? '');

        return view('clay.komunitas-buat', [
            'metaTitle' => 'Edit Profil — Jadidaring',
            'metaDescription' => 'Atur tampilan profilmu.',
            'noindex' => true,
            'page' => $page,
            'draft' => $draft,
            'draftFrame' => $draft && trim((string) $draft->html) !== '' ? $this->draftFrame($request, $user, $draft) : null,
            'draftConfig' => $draft?->profileConfig(),
            'config' => $config,
            'customHtml' => $html,
            'friendPages' => $this->friendPages($draft ? $draft->profileConfig() : $config),
            'owner' => $user,
        ]);
    }

    /** @return array<string, true> usernames of published member profiles referenced by the friends widget */
    private function friendPages(array $config): array
    {
        $names = [];
        foreach ($config['widgets'] ?? [] as $w) {
            foreach (($w['type'] ?? '') === 'friends' ? ($w['items'] ?? []) : [] as $it) {
                $names[] = $it['username'];
            }
        }
        if ($names === []) {
            return [];
        }

        return User::query()->whereIn('username', $names)->whereHas('memberPage', fn ($q) => $q->where('status', 'published'))
            ->pluck('username')->mapWithKeys(fn ($u) => [$u => true])->all();
    }

    /** Live preview: trusted server render of a posted config (validated first). */
    public function preview(Request $request): Response
    {
        $user = $request->user();
        $raw = $request->json('config');
        $hasHtml = (bool) $request->json('has_html');
        $config = ProfileConfig::validate(is_array($raw) ? $raw : [], $hasHtml);

        return response(view('clay._profile', [
            'owner' => $user, 'config' => $config, 'views' => (int) MemberPage::query()->where('user_id', $user->id)->value('views'),
            'customHtml' => $hasHtml ? 'x' : '', 'frameSrc' => null, 'friendPages' => $this->friendPages($config),
        ])->render(), 200, ['Content-Type' => 'text/html; charset=utf-8', 'Cache-Control' => 'no-store']);
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
        $isProfile = is_array($json) && array_key_exists('config', $json);
        $html = is_array($json) && isset($json['html']) ? $json['html'] : (empty($json) ? ($request->input('html') ?? $request->getContent()) : '');
        $configIn = $isProfile ? $json['config'] : null;
        $title = is_array($json) && isset($json['title']) ? (string) $json['title'] : (string) $request->input('title', '');

        $record = $key !== '' && str_starts_with($key, 'jdk_') ? MemberDraftKey::query()->where('key_hash', MemberDraftKey::hash($key))->first() : null;

        if (! $record || $record->used_at !== null || $record->expires_at->isPast()) {
            return response()->json(['error' => 'Kunci tidak valid, kedaluwarsa, atau sudah dipakai. Buat prompt baru di jadidaring.com/komunitas.'], 401, $cors);
        }

        if (! is_string($html) || (trim($html) === '' && ! $isProfile)) {
            return response()->json(['error' => 'Konten kosong.'], 422, $cors);
        }

        try {
            [$clean, $extra, $notices] = $this->prepareHtml(is_string($html) ? $html : '');
            $configOut = $isProfile ? $this->normalizeConfig($configIn, $clean, $extra) : null;
        } catch (ValidationException $e) {
            return response()->json(['error' => collect($e->errors())->flatten()->first()], 422, $cors);
        }

        if ($title === '' && ! $isProfile && preg_match('~<title[^>]*>(.*?)</title>~is', $html, $m) === 1) {
            $title = html_entity_decode($m[1]);
        }
        $title = mb_substr(trim(strip_tags($title)) ?: 'Profil', 0, 120);

        $ownerId = $record->user_id;
        $ok = DB::transaction(function () use ($record, $ownerId, $clean, $title, $configOut): bool {
            $claimed = MemberDraftKey::query()->whereKey($record->id)->whereNull('used_at')->update(['used_at' => now()]);
            if ($claimed !== 1) {
                return false;
            }
            MemberPageDraft::query()->updateOrCreate(['user_id' => $ownerId], ['title' => $title, 'html' => $clean, 'source' => 'api', 'config' => $configOut]);

            return true;
        });

        if (! $ok) {
            return response()->json(['error' => 'Kunci sudah dipakai.'], 401, $cors);
        }

        return response()->json(['ok' => true, 'status' => 'draft', 'review_url' => 'https://'.TenantPath::host().'/komunitas/halamanku', 'notices' => $notices ?? [], 'message' => 'Draft tersimpan. Buka review_url (masuk sebagai pemilik) untuk meninjau, lalu Terbitkan atau Batal.'], 201, $cors);
    }

    /** GET never writes: renders a validated preview of the link's payload; every value is auto-fixed, never a dead end. */
    public function importForm(Request $request): View
    {
        $user = $request->user();
        $raw = (string) ($request->query('d') ?? $request->query('json') ?? '');
        $config = null;
        $error = null;
        $fixes = [];

        try {
            $candidate = ProfilePayload::decode($raw);
            $config = ProfileConfig::validate($candidate, false);
            $fixes = $this->fixes($candidate, $config);
        } catch (\InvalidArgumentException $e) {
            $error = $e->getMessage();
        } catch (ValidationException $e) {
            $error = (string) collect($e->errors())->flatten()->first();
        }

        return view('clay.komunitas-import', [
            'metaTitle' => 'Pratinjau dari AI — Jadidaring', 'metaDescription' => 'Tinjau profil dari AI sebelum disimpan atau diterbitkan.',
            'noindex' => true, 'owner' => $user, 'config' => $config, 'error' => $error, 'fixes' => $fixes,
            'friendPages' => $config ? $this->friendPages($config) : [],
            'views' => (int) MemberPage::query()->where('user_id', $user->id)->value('views'),
        ]);
    }

    /**
     * Lists values the validator changed or dropped, so the preview can highlight them.
     *
     * @return list<array{path: string, from: string, to: string}>
     */
    private function fixes(array $raw, array $clean): array
    {
        $flat = static function (array $a, string $p = '') use (&$flat): array {
            $o = [];
            foreach ($a as $k => $v) {
                $key = $p === '' ? (string) $k : $p.'.'.$k;
                is_array($v) ? $o += $flat($v, $key) : $o[$key] = $v;
            }

            return $o;
        };
        $r = $flat($raw);
        $c = $flat($clean);
        $show = static fn ($v): string => is_bool($v) ? ($v ? 'ya' : 'tidak') : mb_substr((string) $v, 0, 60);
        $out = [];

        foreach ($r as $path => $v) {
            if (str_starts_with($path, 'widgets.')) {
                continue;
            }
            if (! array_key_exists($path, $c)) {
                $out[] = ['path' => $path, 'from' => $show($v), 'to' => 'dibuang (tidak dikenal)'];
            } elseif (is_numeric($v) && is_numeric($c[$path]) ? abs((float) $v - (float) $c[$path]) > 0.0001 : (is_string($v) && is_string($c[$path]) && strcasecmp($v, $c[$path]) !== 0)) {
                $out[] = ['path' => $path, 'from' => $show($v), 'to' => $show($c[$path])];
            }
        }

        $rw = count($raw['widgets'] ?? []);
        $cw = count($clean['widgets'] ?? []);
        if ($rw !== $cw) {
            $out[] = ['path' => 'widgets', 'from' => $rw.' widget', 'to' => $cw.' widget (yang tidak valid dibuang)'];
        }

        return array_slice($out, 0, 20);
    }

    /** POST: action=draft saves a draft; action=publish goes live. Config is re-validated server-side. */
    public function importSave(Request $request): RedirectResponse
    {
        $user = $request->user();
        $data = $request->validate(['config' => ['required', 'string', 'max:120000'], 'action' => ['nullable', 'in:draft,publish']]);

        try {
            $config = $this->normalizeConfig(ProfilePayload::decode($data['config']), '');
        } catch (\InvalidArgumentException $e) {
            return redirect('/komunitas/halamanku')->withErrors(['config' => $e->getMessage()]);
        }

        if (($data['action'] ?? 'draft') === 'publish') {
            $existing = MemberPage::query()->where('user_id', $user->id)->first();
            MemberPage::query()->updateOrCreate(
                ['user_id' => $user->id],
                ['title' => $existing?->title ?: $this->titleFor('', $user), 'html' => (string) ($existing?->html ?? ''), 'config' => $config, 'status' => $this->keepHidden($user->id)],
            );
            MemberPageDraft::query()->where('user_id', $user->id)->delete();

            return redirect('/u/'.$user->username)->with('status', 'Profil diperbarui.');
        }

        $existing = MemberPageDraft::query()->where('user_id', $user->id)->first();
        MemberPageDraft::query()->updateOrCreate(
            ['user_id' => $user->id],
            ['title' => $this->titleFor('', $user), 'html' => '', 'source' => 'paste', 'config' => $config],
        );

        return redirect('/komunitas/halamanku')->with('status', 'Draft dari AI tersimpan. Belum tayang sampai kamu menekan Terbitkan.'.($existing ? ' (Draft sebelumnya diganti.)' : ''));
    }

    /** Remembers the prompt generator form per member. */
    public function promptSave(Request $request): \Illuminate\Http\JsonResponse
    {
        $data = $request->validate(['data' => ['required', 'array'], 'data.*' => ['nullable']]);
        $json = json_encode($data['data'], JSON_UNESCAPED_UNICODE);
        abort_if(strlen((string) $json) > 20000, 422);
        $now = now();
        DB::table('prompt_form_states')->upsert([['user_id' => $request->user()->id, 'data' => $json, 'created_at' => $now, 'updated_at' => $now]], ['user_id'], ['data', 'updated_at']);

        return response()->json(['ok' => true]);
    }

    public function promptReset(Request $request): \Illuminate\Http\JsonResponse
    {
        DB::table('prompt_form_states')->where('user_id', $request->user()->id)->delete();

        return response()->json(['ok' => true]);
    }

    public function publishDraft(Request $request): RedirectResponse
    {
        $user = $request->user();
        $draft = MemberPageDraft::query()->where('user_id', $user->id)->first();
        abort_unless($draft instanceof MemberPageDraft, 404);

        MemberPage::query()->updateOrCreate(
            ['user_id' => $user->id],
            ['title' => $draft->title, 'html' => $draft->html, 'config' => $draft->config, 'status' => $this->keepHidden($user->id)],
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
            'config' => ['nullable', 'string', 'max:120000'],
            'custom_html' => ['nullable', 'string', 'max:400000'],
            'html' => ['nullable', 'string', 'max:400000'],
            'title' => ['nullable', 'string', 'max:120'],
            'file' => ['nullable', 'file', 'max:300', 'mimes:html,htm,txt'],
        ]);

        $raw = (string) ($data['custom_html'] ?? $data['html'] ?? '');
        if ($request->hasFile('file')) {
            $raw = (string) file_get_contents($request->file('file')->getRealPath());
        }

        [$clean, $extra, $notices] = $this->prepareHtml($raw);
        $config = $this->normalizeConfig($data['config'] ?? null, $clean, $extra);

        MemberPageDraft::query()->updateOrCreate(
            ['user_id' => $user->id],
            ['title' => $this->titleFor($data['title'] ?? '', $user), 'html' => $clean, 'source' => 'paste', 'config' => $config],
        );

        $back = redirect('/komunitas/halamanku')->with('status', 'Draft siap ditinjau. Belum tayang sampai kamu menekan Terbitkan.');

        return $notices !== [] ? $back->with('warn', $notices) : $back;
    }

    /** @return array<string, mixed>|null null keeps the legacy wrapper (old full page as one Custom HTML widget) */
    /**
     * Moves Spotify/YouTube iframes out of the HTML into widgets, then sanitizes what is left.
     *
     * @return array{0: string, 1: list<array<string, mixed>>, 2: list<string>}
     */
    private function prepareHtml(string $raw): array
    {
        if (trim($raw) === '') {
            return ['', [], []];
        }
        $x = EmbedExtractor::extract($raw);
        $rest = $x['html'];
        $hasContent = preg_match('/<\s*(html|body|div|section|main|h[1-6]|p|span|a|ul|img|style|script)\b/i', $rest) === 1
            && trim(strip_tags(preg_replace('~<(style|script)\b.*?</\1>~is', '', $rest) ?? $rest)) !== '' || preg_match('/<\s*(img|canvas|svg|video|audio)\b/i', $rest) === 1;
        if ($x['widgets'] !== [] && ! $hasContent) {
            return ['', $x['widgets'], $x['notices']];
        }

        return [MemberPageSanitizer::clean($rest), $x['widgets'], $x['notices']];
    }

    /**
     * @param list<array<string, mixed>> $extra widgets converted from embeds, inserted where the Custom HTML widget sits
     * @return array<string, mixed>|null
     */
    private function normalizeConfig(mixed $config, string $html, array $extra = []): ?array
    {
        if ($extra !== [] && ($config === null || $config === '')) {
            $config = $html !== '' ? ProfileConfig::defaults() : ProfileConfig::defaults();
            $config['widgets'] = array_values(array_filter($config['widgets'], fn ($w) => $w['type'] !== 'custom_html'));
            if ($html !== '') {
                $config['widgets'][] = ['type' => 'custom_html'];
            }
        }
        if ($extra !== []) {
            $data = is_array($config) ? $config : json_decode((string) $config, true);
            if (is_array($data)) {
                $ws = is_array($data['widgets'] ?? null) ? array_values($data['widgets']) : [];
                $pos = null;
                foreach ($ws as $i => $w) {
                    if (is_array($w) && ($w['type'] ?? '') === 'custom_html') {
                        $pos = $i;
                        break;
                    }
                }
                $drop = $html === '' && $pos !== null ? 1 : 0;
                array_splice($ws, $pos ?? count($ws), $drop, $extra);
                $data['widgets'] = $ws;
                $config = $data;
            }
        }
        if ($config === null || $config === '') {
            return $html !== '' ? null : ProfileConfig::defaults();
        }

        $data = is_array($config) ? $config : json_decode((string) $config, true);
        if (! is_array($data)) {
            throw ValidationException::withMessages(['config' => 'Konfigurasi tidak valid.']);
        }
        $out = ProfileConfig::validate($data, $html !== '');
        if ($html !== '' && ! in_array('custom_html', array_column($out['widgets'], 'type'), true)) {
            $out['widgets'][] = ['type' => 'custom_html'];
        }

        return $out;
    }

    private function titleFor(string $title, User $user): string
    {
        $t = mb_substr(trim(strip_tags($title)), 0, 120);

        return $t !== '' ? $t : 'Profil '.$user->name;
    }

    /** A page hidden by moderation stays hidden when its owner edits it. */
    private function keepHidden(int $userId): string
    {
        return MemberPage::query()->where('user_id', $userId)->value('status') === 'hidden' ? 'hidden' : 'published';
    }

    public function show(Request $request, string $username): View
    {
        $user = User::query()->where('username', $username)->first();
        abort_unless($user instanceof User, 404);
        $page = MemberPage::query()->where('user_id', $user->id)->first();
        $isOwner = auth()->check() && auth()->id() === $user->id;

        if (! $page instanceof MemberPage && $isOwner) {
            $page = MemberPage::query()->create(['user_id' => $user->id, 'title' => 'Profil '.$user->name, 'html' => '', 'status' => 'published']);
        }
        abort_unless($page instanceof MemberPage, 404);
        abort_unless($page->isPublished() || $isOwner, 404);

        $this->recordVisit($request, $page, $user);

        $comments = MemberPageComment::query()->where('member_page_id', $page->id)->where('is_hidden', false)
            ->with('user:id,username,name')->orderByDesc('id')->limit(100)->get();

        $config = $page->profileConfig();
        $hasFrame = trim((string) $page->html) !== '' && in_array('custom_html', array_column($config['widgets'], 'type'), true);
        $sandbox = (string) config('singlepage.sandbox_domain');
        $frame = null;
        if ($hasFrame) {
            $token = MemberFrameToken::mint($page->id);
            $frame = ($sandbox !== '' ? $request->getScheme().'://'.$sandbox.'/'.$user->username : '/u/'.$user->username.'/konten').'?t='.$token;
        }

        $followersCount = DB::table('member_follows')->where('followed_id', $user->id)->count();
        $followingCount = DB::table('member_follows')->where('follower_id', $user->id)->count();
        $isFollowing = auth()->check() && ! $isOwner
            && DB::table('member_follows')->where('follower_id', auth()->id())->where('followed_id', $user->id)->exists();

        return view('clay.komunitas-halaman', [
            'followersCount' => $followersCount, 'followingCount' => $followingCount, 'isFollowing' => $isFollowing,
            'metaTitle' => $user->name.' (@'.$user->username.') — Profil Jadidaring',
            'metaDescription' => 'Profil komunitas @'.$user->username.' di Jadidaring.',
            'canonicalUrl' => 'https://'.TenantPath::host().'/u/'.$user->username,
            'noindex' => true,
            'owner' => $user,
            'page' => $page,
            'config' => $config,
            'customHtml' => (string) $page->html,
            'views' => (int) $page->views,
            'friendPages' => $this->friendPages($config),
            'comments' => $comments,
            'frameSrc' => $frame,
            'isOwner' => $isOwner,
        ]);
    }

    /** Unique visitors only: one row per (profile, visitor). Owner, bots and repeat loads are not counted. */
    private function recordVisit(Request $request, MemberPage $page, User $owner): void
    {
        $ua = (string) $request->userAgent();

        if (! $request->isMethod('GET') || $ua === '' || preg_match('/bot|crawl|spider|slurp|curl|wget|python|httpclient|headless|facebookexternalhit|preview|monitor|uptime|lighthouse|scanner/i', $ua) === 1) {
            return;
        }
        if (auth()->check() && auth()->id() === $owner->id) {
            return;
        }

        $key = auth()->check()
            ? 'u:'.auth()->id()
            : 'g:'.$request->ip().'|'.$ua.'|'.now()->format('Y-m-d').'|'.config('app.key');

        $inserted = DB::table('member_page_visitors')->insertOrIgnore([
            'member_page_id' => $page->id, 'visitor_hash' => hash('sha256', $key), 'first_seen' => now(),
        ]);

        if ($inserted) {
            DB::table('member_pages')->where('id', $page->id)->increment('views');
            $page->views++;
        }
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
        // A page that draws its own cursor (a small fixed element following the mouse) must not
        // also show the OS cursor: hide it page-wide, but keep the text caret in form fields.
        $cursorFix = '<script>(function(){if(matchMedia("(pointer:coarse)").matches)return;var x=0,y=0,n=0,done=0;'
            .'function hide(){if(done)return;done=1;var st=document.createElement("style");st.textContent="html,html *,html *::before,html *::after{cursor:none!important}input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=button]):not([type=submit]),textarea,[contenteditable=true],[contenteditable=\"\"]{cursor:text!important}";(document.head||document.documentElement).appendChild(st)}'
            .'function scan(){if(done)return;var b=document.body;if(b&&getComputedStyle(b).cursor==="none"&&getComputedStyle(document.documentElement).cursor==="none"){}'
            .'var els=document.body?document.body.getElementsByTagName("*"):[];var lim=Math.min(els.length,2500);for(var i=0;i<lim;i++){var e=els[i];var c=getComputedStyle(e);var pos=c.position;if(pos!=="fixed"&&pos!=="absolute")continue;if(pos==="absolute"&&c.pointerEvents!=="none")continue;if(c.display==="none"||c.visibility==="hidden")continue;'
            .'var r=e.getBoundingClientRect();if(r.width<2||r.height<2||r.width>120||r.height>120)continue;var cx=r.left+r.width/2,cy=r.top+r.height/2;if(Math.abs(cx-x)<=60&&Math.abs(cy-y)<=60&&(Math.abs(cx-x)>0||Math.abs(cy-y)>0||c.pointerEvents==="none")){hide();return}}}'
            .'addEventListener("mousemove",function(ev){x=ev.clientX;y=ev.clientY;n++;if(n===4||n===40||n===200)setTimeout(scan,120)},{passive:true})})();</script>';
        $snippet .= $cursorFix;
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
