<?php

namespace App\Http\Middleware;

use App\Models\CompanyProfile;
use App\Models\CompanyProfileAlias;
use App\Services\GameHub;
use App\Services\TenantPath;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Resolve /{tenant} on the public host to a live company profile.
 *
 * The GameHub label is not a normal tenant: if it reaches this middleware
 * (any case other than the dedicated /gamehub routes) it 301s to the hub path.
 * Reserved system labels are never tenants.
 */
class ResolveTenantPath
{
    /**
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $subdomain = strtolower((string) $request->route('tenant'));

        if (! TenantPath::isHostLabel($subdomain)) {
            abort(404);
        }

        if (GameHub::isSubdomain($subdomain)) {
            abort(404);
        }

        if (TenantPath::isBlockedLabel($subdomain)) {
            abort(404);
        }

        $isApi = str_contains($request->path(), 'api/game') || $request->is('api/*');

        $profile = CompanyProfile::query()
            ->live()
            ->where('subdomain', $subdomain)
            ->first();

        if ($profile instanceof CompanyProfile) {
            if (! $isApi && $profile->is_game) {
                abort(404);
            }

            // Own-host pages: the bare path (/andika, /andika/) 301s to https://andika.{base}/ (query kept).
            if (! $isApi && $request->isMethod('GET') && trim($request->path(), '/') === $subdomain && ($own = TenantPath::ownHostUrl($subdomain)) !== null) {
                $qs = $request->getQueryString();

                return redirect()->away($own.($qs !== null && $qs !== '' ? '?'.$qs : ''), 301);
            }

            $request->attributes->set('tenantProfile', $profile);

            return $next($request);
        }

        $alias = CompanyProfileAlias::query()
            ->with('companyProfile')
            ->where('subdomain', $subdomain)
            ->whereHas('companyProfile', fn ($query) => $query->live())
            ->first();

        if ($alias instanceof CompanyProfileAlias && $alias->companyProfile instanceof CompanyProfile) {
            if (! $isApi && $alias->companyProfile->is_game) {
                abort(404);
            }

            return redirect()->away(TenantPath::redirectTarget($request, $alias->companyProfile->subdomain), 301);
        }

        abort(404);
    }
}
