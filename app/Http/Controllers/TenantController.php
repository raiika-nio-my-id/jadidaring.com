<?php

namespace App\Http\Controllers;

use App\Models\CompanyProfile;
use App\Services\GameHub;
use App\Services\GameHubCatalog;
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

    public function showGame(Request $request, string $slug, LegalNoticeInjector $legalInjector, SeoInjector $seoInjector, PlayerNameBridge $names, RealtimeBridge $realtime, \App\Services\GameAnalytics $ga): Response
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

        $html = TenantPath::rewriteHtml(\App\Services\GameMasterKey::scrub((string) $profile->html), $profile->subdomain);
        $html = $profile->hide_footer
            ? $html
            : $legalInjector->inject($html, TenantPath::gameTermsUrl($request, $profile->subdomain));

        $html = $seoInjector->inject($html, rtrim(TenantPath::gameHomeUrl($request, $profile->subdomain), '/'));
        $html = $seoInjector->normalizeGame($html);
        $html = $names->inject($html, MembersOnlyGames::user());
        $html = $realtime->inject($html, $profile->subdomain);
        $html = $ga->inject($html, $profile->subdomain);

        if (MembersOnlyGames::applies($profile->subdomain) && ! MembersOnlyGames::allows($request)) {
            $banner = MembersOnlyGames::banner('/masuk');
            $html = str_contains($html, '</body>') ? str_replace('</body>', $banner.'</body>', $html) : $html.$banner;
        }

        $this->trackVisit($profile, $request);

        return response($html, 200, [
            'Content-Type' => 'text/html; charset=UTF-8',
            'X-Content-Type-Options' => 'nosniff',
            'Referrer-Policy' => 'strict-origin-when-cross-origin',
            'Permissions-Policy' => 'camera=(), microphone=(self), geolocation=()',
            'Cache-Control' => 'private, no-cache',
        ]);
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
