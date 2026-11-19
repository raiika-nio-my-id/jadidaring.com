<?php

namespace App\Http\Controllers;

use App\Models\CompanyProfile;
use App\Services\GameHub;
use App\Services\GameHubCatalog;
use App\Services\GitGames;
use App\Services\JaRingMark;
use App\Services\LegalNoticeInjector;
use App\Services\MembersOnlyGames;
use App\Services\PlayerNameBridge;
use App\Services\RealtimeBridge;
use App\Services\SeoInjector;
use App\Services\TenantPath;
use Illuminate\Contracts\View\View;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class TenantController extends Controller
{
    /** User-agent fragments that indicate known bots / automated tools. */
    private const BOT_UA_PATTERNS = [
        'bot', 'crawler', 'spider', 'scraper', 'slurp', 'facebookexternalhit',
        'wget', 'curl/', 'python-requests', 'go-http-client', 'libwww', 'okhttp',
        'headlesschrome', 'phantomjs', 'selenium',
    ];

    public function show(Request $request, LegalNoticeInjector $legalInjector, SeoInjector $seoInjector, GameHubCatalog $catalog, PlayerNameBridge $names): Response
    {
        $profile = $this->profile($request);
        $html = $profile->html;

        if (GameHub::isProfile($profile)) {
            $html = $catalog->apply($html, $request);
        }

        $html = TenantPath::rewriteHtml(\App\Services\GameMasterKey::scrub((string) $html), $profile->subdomain);
        $html = $profile->hide_footer
            ? $html
            : $legalInjector->inject($html, $this->termsUrl($request, $profile));

        $html = $seoInjector->inject($html, $this->canonicalUrl($request, $profile), $this->ogImageUrl($request, $profile));
        $html = $names->inject($html, MembersOnlyGames::user());

        if (GameHub::isProfile($profile)) {
            $html = JaRingMark::apply($html);
        }

        // trackVisit() runs only for the main page response; /robots.txt and
        // /sitemap.xml are handled by separate route closures and never reach here.
        $this->trackVisit($profile, $request);

        return response($html, 200, [
            'Content-Type' => 'text/html; charset=UTF-8',
            'X-Content-Type-Options' => 'nosniff',
            'Referrer-Policy' => 'strict-origin-when-cross-origin',
            'Permissions-Policy' => 'camera=(), microphone=(self), geolocation=()',
            'Cache-Control' => 'private, no-cache',
        ]);
    }

    public function showGame(Request $request, string $slug): Response
    {
        $profile = $this->liveGame($slug);

        if (GitGames::enabled($profile->subdomain)) {
            return $this->gitGameShell($request, $profile);
        }

        $html = $this->gameDocument($request, $profile, (string) $profile->html, false);
        $this->trackVisit($profile, $request);

        return $this->gameResponse($html);
    }

    /**
     * The game document of a git game (resources/games/{slug}/game.html), loaded by the shell page in a
     * same-origin frame. Same injections as the database version; only same-origin framing is allowed.
     */
    public function playGame(Request $request, string $slug): Response
    {
        $profile = $this->liveGame($slug);

        abort_unless(GitGames::enabled($profile->subdomain), 404);

        $html = $this->gameDocument($request, $profile, GitGames::html($profile->subdomain), true);

        return $this->gameResponse($html, [
            'X-Frame-Options' => 'SAMEORIGIN',
            'Content-Security-Policy' => "frame-ancestors 'self'",
            'X-Robots-Tag' => 'noindex',
        ]);
    }

    private function gitGameShell(Request $request, CompanyProfile $profile): Response
    {
        $slug = $profile->subdomain;
        $meta = GitGames::meta(GitGames::html($slug));
        $canonical = rtrim(TenantPath::gameHomeUrl($request, $slug), '/');
        $query = $request->getQueryString();
        $this->trackVisit($profile, $request);

        return response()->view('clay.game-play', [
            'slug' => $slug,
            'game' => $meta,
            'playUrl' => '/game/'.TenantPath::segment($slug).'/play'.($query !== null && $query !== '' ? '?'.$query : ''),
            'termsUrl' => TenantPath::gameTermsUrl($request, $slug),
            'metaTitle' => $meta['title'] !== '' ? $meta['title'] : 'Jadidaring',
            'metaDescription' => $meta['description'],
            'canonicalUrl' => $canonical,
        ], 200, [
            'X-Content-Type-Options' => 'nosniff',
            'Referrer-Policy' => 'strict-origin-when-cross-origin',
            'Permissions-Policy' => 'camera=(), microphone=(self), geolocation=()',
            'Cache-Control' => 'private, no-cache',
        ]);
    }

    private function liveGame(string $slug): CompanyProfile
    {
        $slug = strtolower(trim($slug));

        if (! TenantPath::isHostLabel($slug) || GameHub::isSubdomain($slug)) {
            abort(404);
        }

        $profile = CompanyProfile::query()
            ->live()
            ->games()
            ->where('subdomain', $slug)
            ->first();

        abort_unless($profile instanceof CompanyProfile, 404);

        return $profile;
    }

    /** Server-side injections shared by database and git game documents. $framed = loaded inside the git game shell. */
    private function gameDocument(Request $request, CompanyProfile $profile, string $source, bool $framed): string
    {
        $slug = $profile->subdomain;
        $html = TenantPath::rewriteHtml(\App\Services\GameMasterKey::scrub($source), $slug);
        $html = $profile->hide_footer
            ? $html
            : app(LegalNoticeInjector::class)->inject($html, TenantPath::gameTermsUrl($request, $slug));

        $seo = app(SeoInjector::class);
        $html = $seo->inject($html, rtrim(TenantPath::gameHomeUrl($request, $slug), '/'));
        $html = $seo->normalizeGame($html);
        $html = app(PlayerNameBridge::class)->inject($html, MembersOnlyGames::user());
        $html = app(RealtimeBridge::class)->inject($html, $slug);
        $html = $framed ? GitGames::frame($html, $slug) : app(\App\Services\GameAnalytics::class)->inject($html, $slug);

        if (MembersOnlyGames::applies($slug) && ! MembersOnlyGames::allows($request)) {
            $banner = MembersOnlyGames::banner('/masuk');
            $html = str_contains($html, '</body>') ? str_replace('</body>', $banner.'</body>', $html) : $html.$banner;
        }

        return $html;
    }

    /** @param  array<string, string>  $extra */
    private function gameResponse(string $html, array $extra = []): Response
    {
        return response($html, 200, [
            'Content-Type' => 'text/html; charset=UTF-8',
            'X-Content-Type-Options' => 'nosniff',
            'Referrer-Policy' => 'strict-origin-when-cross-origin',
            'Permissions-Policy' => 'camera=(), microphone=(self), geolocation=()',
            'Cache-Control' => 'private, no-cache',
        ] + $extra);
    }

    public function gameTerms(Request $request, string $slug): View
    {
        $slug = strtolower(trim($slug));

        if (! TenantPath::isHostLabel($slug) || GameHub::isSubdomain($slug)) {
            abort(404);
        }

        $profile = CompanyProfile::query()
            ->live()
            ->games()
            ->where('subdomain', $slug)
            ->first();

        abort_unless($profile instanceof CompanyProfile, 404);

        return view('tenant.terms', [
            'platformName' => (string) config('singlepage.platform_name', 'Jadidaring'),
            'updatedOn' => Carbon::parse((string) config('singlepage.terms_updated_on'))
                ->locale('id')
                ->translatedFormat('d F Y'),
            'siteHost' => TenantPath::host().'/game/'.$profile->subdomain,
            'homeUrl' => TenantPath::gameHomeUrl($request, $profile->subdomain),
        ]);
    }

    public function terms(Request $request): View
    {
        $profile = $this->profile($request);

        return view('tenant.terms', [
            'platformName' => (string) config('singlepage.platform_name', 'Jadidaring'),
            'updatedOn' => Carbon::parse((string) config('singlepage.terms_updated_on'))
                ->locale('id')
                ->translatedFormat('d F Y'),
            'siteHost' => $profile->publicLabel(),
            'homeUrl' => $this->canonicalUrl($request, $profile),
        ]);
    }

    private function profile(Request $request): CompanyProfile
    {
        $profile = $request->attributes->get('tenantProfile');

        abort_unless($profile instanceof CompanyProfile, 404);

        return $profile;
    }

    private function canonicalUrl(Request $request, CompanyProfile $profile): string
    {
        if ($profile->is_game) {
            return TenantPath::gameHomeUrl($request, $profile->subdomain);
        }

        return TenantPath::homeUrl($request, $profile->subdomain);
    }

    private function termsUrl(Request $request, CompanyProfile $profile): string
    {
        if ($profile->is_game) {
            return TenantPath::gameTermsUrl($request, $profile->subdomain);
        }

        return TenantPath::termsUrl($request, $profile->subdomain);
    }

    private function ogImageUrl(Request $request, CompanyProfile $profile): ?string
    {
        if (! GameHub::isProfile($profile)) {
            return null;
        }

        return GameHub::ogImageUrl($request);
    }

    private function trackVisit(CompanyProfile $profile, Request $request): void
    {
        // Game popularity now comes from Google Analytics; the old counter is frozen (data kept for rollback).
        if ($profile->is_game) {
            return;
        }

        $ua = strtolower($request->userAgent() ?? '');

        foreach (self::BOT_UA_PATTERNS as $pattern) {
            if (str_contains($ua, $pattern)) {
                return;
            }
        }

        $hash = hash('sha256', implode('|', [
            $request->ip() ?? '',
            $request->userAgent() ?? '',
            now()->toDateString(),
            (string) config('app.key'),
        ]));

        $profileId = $profile->id;
        $today = now()->toDateString();

        // Defer the DB write until after the response is sent so it never
        // adds latency to page serving. Swallow all exceptions so that a
        // tracking failure can never break the tenant page.
        defer(function () use ($profileId, $today, $hash): void {
            try {
                DB::table('page_view_records')->insertOrIgnore([
                    'company_profile_id' => $profileId,
                    'viewed_on' => $today,
                    'visitor_hash' => $hash,
                    'created_at' => now(),
                ]);
            } catch (\Throwable) {
                // Intentionally silent — tracking must never break page delivery.
            }
        });
    }
}
