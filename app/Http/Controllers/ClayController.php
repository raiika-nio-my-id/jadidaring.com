<?php

namespace App\Http\Controllers;

use App\Models\CompanyProfile;
use App\Services\GameHubCatalog;
use App\Services\TenantPath;
use Illuminate\Contracts\View\View;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class ClayController extends Controller
{
    /**
     * @var array<string, string>
     */
    public const TOPICS = [
        'politik' => 'Politik',
        'gaming' => 'Gaming',
        'saham' => 'Saham',
        'indonesia' => 'Indonesia',
        'musibah' => 'Musibah',
        'teknologi' => 'Teknologi',
    ];

    public function home(Request $request): View
    {
        $views = DB::table('page_view_records')
            ->selectRaw('company_profile_id, COUNT(*) as views_count')
            ->where('viewed_on', '>=', now()->subDays(30)->toDateString())
            ->groupBy('company_profile_id');

        $profiles = CompanyProfile::query()
            ->live()
            ->games()
            ->with('user:id,name')
            ->where('company_profiles.subdomain', '!=', 'gamehub')
            ->select('company_profiles.*')
            ->selectRaw('COALESCE(game_views.views_count, 0) as views_count')
            ->leftJoinSub($views, 'game_views', 'game_views.company_profile_id', '=', 'company_profiles.id')
            ->orderByDesc('company_profiles.is_pinned')
            ->orderByDesc('views_count')
            ->orderByDesc('company_profiles.created_at')
            ->limit(6)
            ->get();

        $games = $this->formatGames($profiles);

        return view('clay.home', [
            'metaTitle' => 'Jadidaring — Main Game Daring, Berita & Komunitas',
            'metaDescription' => 'Platform hiburan web Indonesia. Mainkan game seru gratis tanpa unduh, baca berita harian pilihan, dan bergabung dengan komunitas.',
            'canonicalUrl' => 'https://'.TenantPath::host().'/',
            'games' => $games,
            'articles' => \App\Services\NewsCache::latest(null, 6),
        ]);
    }

    public function game(Request $request): View
    {
        $sort = strtolower((string) $request->query('sort', 'views'));

        if (! in_array($sort, ['views', 'new', 'az'], true)) {
            $sort = 'views';
        }

        $query = CompanyProfile::query()
            ->live()
            ->games()
            ->with('user:id,name')
            ->where('company_profiles.subdomain', '!=', 'gamehub');

        if ($sort === 'views') {
            $views = DB::table('page_view_records')
                ->selectRaw('company_profile_id, COUNT(*) as views_count')
                ->where('viewed_on', '>=', now()->subDays(30)->toDateString())
                ->groupBy('company_profile_id');

            $query->select('company_profiles.*')
                ->selectRaw('COALESCE(game_views.views_count, 0) as views_count')
                ->leftJoinSub($views, 'game_views', 'game_views.company_profile_id', '=', 'company_profiles.id')
                ->orderByDesc('views_count')
                ->orderByDesc('company_profiles.created_at')
                ->orderByDesc('company_profiles.id');
        } elseif ($sort === 'az') {
            $query->orderBy('company_profiles.subdomain');
        } else {
            $query->orderByDesc('company_profiles.created_at')
                ->orderByDesc('company_profiles.id');
        }

        $profiles = $query->get();
        $games = $this->formatGames($profiles);

        return view('clay.game-index', [
            'metaTitle' => 'Game — Jadidaring',
            'metaDescription' => 'Katalog game web ringan karya kreator tanah air. Mainkan langsung di peramban tanpa instalasi.',
            'canonicalUrl' => 'https://'.TenantPath::host().'/game',
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
            ."Disallow: /_boost/\n\n"
            ."Sitemap: {$host}/sitemap.xml\n";

        return response($content, 200, [
            'Content-Type' => 'text/plain; charset=utf-8',
        ]);
    }

    public function sitemap(Request $request): Response
    {
        $host = 'https://'.TenantPath::host();
        $today = now()->toDateString();

        $urls = [
            $host.'/',
            $host.'/berita',
        ];

        foreach (array_keys(self::TOPICS) as $topic) {
            $urls[] = $host.'/berita/'.$topic;
        }

        $urls[] = $host.'/game';

        foreach (\App\Services\NewsCache::latest(null, 500) as $article) {
            $urls[] = $host.$article['url'];
        }

        $gameProfiles = CompanyProfile::query()
            ->live()
            ->games()
            ->where('subdomain', '!=', 'gamehub')
            ->orderBy('subdomain')
            ->get();

        foreach ($gameProfiles as $profile) {
            $urls[] = $host.'/game/'.$profile->subdomain;
        }

        $urls[] = $host.'/komunitas';

        $xml = '<?xml version="1.0" encoding="UTF-8"?>'."\n"
            .'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'."\n";

        foreach ($urls as $url) {
            $xml .= '  <url><loc>'.e($url).'</loc><lastmod>'.$today.'</lastmod></url>'."\n";
        }

        $xml .= '</urlset>';

        return response($xml, 200, [
            'Content-Type' => 'application/xml; charset=utf-8',
        ]);
    }

    /**
     * @param  Collection<int, CompanyProfile>  $profiles
     * @return Collection<int, array{subdomain: string, title: string, description: string, image: string, avatar: string, views: int}>
     */
    private function formatGames(Collection $profiles): Collection
    {
        return $profiles->map(function (CompanyProfile $profile): array {
            $meta = GameHubCatalog::pageMetadata((string) $profile->html);
            $subdomain = strtolower($profile->subdomain);

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
                'views' => (int) $profile->getAttribute('views_count'),
            ];
        });
    }
}
