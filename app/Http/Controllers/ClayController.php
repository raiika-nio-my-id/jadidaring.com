<?php

namespace App\Http\Controllers;

use App\Models\CompanyProfile;
use App\Models\MemberPage;
use App\Services\GameHubCatalog;
use App\Services\GitGames;
use App\Services\NewsCache;
use App\Services\PopularStats;
use App\Services\TenantPath;
use App\Support\Infinite;
use Illuminate\Contracts\View\View;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

class ClayController extends Controller
{
    /**
     * @var array<string, string>
     */
    /** Cards per infinite-scroll batch on /game. */
    public const GAMES_PER_PAGE = 9;

    public const TOPICS = [
        'politik' => 'Politik',
        'gaming' => 'Gaming',
        'saham' => 'Saham',
        'ekonomi' => 'Ekonomi',
        'indonesia' => 'Indonesia',
        'musibah' => 'Musibah',
        'teknologi' => 'Teknologi',
        'sosmed' => 'Tren Sosial Media',
    ];

    public function home(Request $request): View
    {
        $profiles = CompanyProfile::query()
            ->live()
            ->games()
            ->listed()
            ->with('user:id,name')
            ->where('company_profiles.subdomain', '!=', 'gamehub')
            ->orderByDesc('company_profiles.is_pinned')
            ->orderByDesc('company_profiles.created_at')
            ->orderByDesc('company_profiles.id')
            ->get();

        $views = PopularStats::gameViews();
        $pinned = $profiles->filter(fn (CompanyProfile $p): bool => (bool) $p->is_pinned);
        $rest = $profiles->reject(fn (CompanyProfile $p): bool => (bool) $p->is_pinned);
        $profiles = collect([...$pinned, ...PopularStats::rank($rest, fn (CompanyProfile $p): string => $p->subdomain, $views)])->take(6);

        $games = $this->formatGames($profiles);

        return view('clay.home', [
            'metaTitle' => 'Jadidaring — Game Gratis Online, Berita Terkini Hari Ini & Komunitas',
            'metaDescription' => 'Main game gratis online tanpa unduh, baca berita terkini hari ini: politik, saham & harga emas, gempa, teknologi, dan kabar baik Indonesia.',
            'canonicalUrl' => 'https://'.TenantPath::host().'/',
            'ogImage' => 'https://'.TenantPath::host().'/og-home-v2.webp?v=2',
            'ogImageType' => 'image/webp',
            'ogImageAlt' => 'Jadidaring: game web gratis, berita, dan komunitas Indonesia',
            'games' => $games,
            'articles' => NewsCache::latest(null, 11),
        ]);
    }

    public function game(Request $request): View|Response
    {
        $sort = strtolower((string) $request->query('sort', 'views'));

        if (! in_array($sort, ['views', 'new', 'az'], true)) {
            $sort = 'views';
        }

        $query = CompanyProfile::query()
            ->live()
            ->games()
            ->listed()
            ->with('user:id,name')
            ->where('company_profiles.subdomain', '!=', 'gamehub');

        if ($sort === 'views') {
            $query->orderByDesc('company_profiles.created_at')
                ->orderByDesc('company_profiles.id');
        } elseif ($sort === 'az') {
            $query->orderBy('company_profiles.subdomain');
        } else {
            $query->orderByDesc('company_profiles.created_at')
                ->orderByDesc('company_profiles.id');
        }

        $profiles = $query->get();

        if ($sort === 'views') {
            $profiles = collect(PopularStats::rank($profiles, fn (CompanyProfile $p): string => $p->subdomain, PopularStats::gameViews()));
        }

        $pages = max(1, (int) ceil($profiles->count() / self::GAMES_PER_PAGE));
        $page = Infinite::page($request);
        abort_if($page > $pages, 404);
        $games = $this->formatGames($profiles->slice(($page - 1) * self::GAMES_PER_PAGE, self::GAMES_PER_PAGE)->values());
        $inf = Infinite::data($request, 'game', $page, $pages);

        if ($request->boolean('partial')) {
            return response()->view('clay._inf-frag', ['kind' => 'game', 'games' => $games, 'sort' => $sort, 'inf' => $inf])->header('X-Robots-Tag', 'noindex');
        }

        return view('clay.game-index', [
            'inf' => $inf,
            'relPrev' => $inf['prev'],
            'relNext' => $inf['next'],
            'metaTitle' => 'Game Gratis Online Tanpa Unduh — Jadidaring',
            'metaDescription' => 'Main game online gratis di HP atau laptop tanpa instalasi. Game multiplayer dan game santai karya kreator Indonesia, langsung dari peramban.',
            'canonicalUrl' => 'https://'.TenantPath::host().'/game'.($page > 1 ? '?page='.$page : ''),
            'games' => $games,
            'sort' => $sort,
        ]);
    }

    public function komunitas(Request $request): View
    {
        return view('clay.komunitas', [
            'metaTitle' => 'Komunitas — Jadidaring',
            'metaDescription' => 'Ruang komunitas pemain game dan pembaca berita Jadidaring di Indonesia.',
            'canonicalUrl' => 'https://'.TenantPath::host().'/komunitas',
        ]);
    }

    public function terms(Request $request): View
    {
        return view('clay.terms', [
            'metaTitle' => 'Syarat & Ketentuan — Jadidaring',
            'metaDescription' => 'Syarat dan ketentuan penggunaan platform Jadidaring.',
            'canonicalUrl' => 'https://'.TenantPath::host().'/syarat-ketentuan',
        ]);
    }

    public function robots(Request $request): Response
    {
        $host = 'https://'.TenantPath::host();

        $content = "User-agent: *\n"
            ."Allow: /\n"
            ."Disallow: /api/\n"
            ."Disallow: /*/api/\n"
            ."Disallow: /game/*/api/\n"
            ."Disallow: /_boost/\n"
            ."Disallow: /admin\n\n"
            ."Sitemap: {$host}/sitemap.xml\n"
            ."Sitemap: {$host}/news-sitemap.xml\n";

        return response($content, 200, [
            'Content-Type' => 'text/plain; charset=utf-8',
        ]);
    }

    public function sitemap(Request $request): Response
    {
        $host = 'https://'.TenantPath::host();
        $articles = NewsCache::latest(null, 500);
        $newest = $articles === [] ? null : max(array_map(fn (array $a): string => $a['updated_at'] ?? $a['published_at'], $articles));
        $topicNewest = [];

        foreach ($articles as $a) {
            $t = $a['updated_at'] ?? $a['published_at'];
            $topicNewest[$a['topic']] = max($topicNewest[$a['topic']] ?? '', $t);
        }

        // [url, lastmod|null]. lastmod is the real last change; unknown dates are left out, never faked.
        $urls = [[$host.'/', $newest], [$host.'/berita', $newest]];

        foreach (array_keys(self::TOPICS) as $topic) {
            $urls[] = [$host.'/berita/'.$topic, $topicNewest[$topic] ?? null];
        }

        $gameProfiles = CompanyProfile::query()->live()->games()->where('subdomain', '!=', 'gamehub')->orderBy('subdomain')->get();
        $gamesNewest = $gameProfiles->max('updated_at');
        $urls[] = [$host.'/game', $gamesNewest?->toIso8601String()];

        foreach ($articles as $article) {
            $urls[] = [$host.$article['url'], $article['updated_at'] ?? $article['published_at']];
        }

        foreach ($gameProfiles as $profile) {
            $urls[] = [$host.'/game/'.$profile->subdomain, $profile->updated_at?->toIso8601String()];
        }

        $urls[] = [$host.'/komunitas', MemberPage::query()->max('updated_at') ? Carbon::parse(MemberPage::query()->max('updated_at'))->toIso8601String() : null];

        foreach (PageController::PAGES as $path => $updated) {
            $urls[] = [$host.'/'.$path, $updated];
        }

        $urls[] = [$host.'/syarat-ketentuan', (string) config('singlepage.terms_updated_on') ?: null];

        $xml = '<?xml version="1.0" encoding="UTF-8"?>'."\n"
            .'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'."\n";

        foreach ($urls as [$url, $mod]) {
            $xml .= '  <url><loc>'.e($url).'</loc>'.($mod ? '<lastmod>'.e(Carbon::parse($mod)->toW3cString()).'</lastmod>' : '').'</url>'."\n";
        }

        return response($xml.'</urlset>', 200, ['Content-Type' => 'application/xml; charset=utf-8']);
    }

    /**
     * @param  Collection<int, CompanyProfile>  $profiles
     * @return Collection<int, array{subdomain: string, title: string, description: string, image: string, avatar: string}>
     */
    private function formatGames(Collection $profiles): Collection
    {
        return $profiles->map(function (CompanyProfile $profile): array {
            $subdomain = strtolower($profile->subdomain);
            // Git games (docs/games-in-git.md) read their card text from the repo file, not the rollback html column.
            $meta = GameHubCatalog::pageMetadata(GitGames::enabled($subdomain) ? GitGames::html($subdomain) : (string) $profile->html);

            $title = $meta['title'] !== ''
                ? $meta['title']
                : ($profile->user?->name ?: $subdomain);

            $description = $meta['description'];
            $image = $meta['image'];
            $avatar = '🎮';

            if ($image === '' && $title !== '') {
                $avatar = mb_strtoupper(mb_substr($title, 0, 1));
            }

            return [
                'subdomain' => $subdomain,
                'title' => $title,
                'description' => $description,
                'image' => $image,
                'avatar' => $avatar,
            ];
        });
    }
}
