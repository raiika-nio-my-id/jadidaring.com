<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\GoogleStats\GoogleStats;
use App\Services\GoogleStats\GoogleStatsException;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

/** Read-only Google Analytics 4 + Search Console overview for admins. Never shows sample data. */
class StatistikController extends Controller
{
    public function index(Request $request, GoogleStats $stats): View
    {
        $days = $stats->normalizeRange($request->query('days'));
        $missing = $stats->missingSetup();

        return view('admin.statistik', [
            'days' => $days,
            'ranges' => GoogleStats::RANGES,
            'missing' => $missing,
            'ga4' => $missing['ga4'] === [] ? $this->attempt(fn (): array => $stats->ga4($days)) : null,
            'gsc' => $missing['gsc'] === [] ? $this->attempt(fn (): array => $stats->gsc($days)) : null,
        ]);
    }

    public function refresh(Request $request, GoogleStats $stats): RedirectResponse
    {
        $days = $stats->normalizeRange($request->input('days'));
        $stats->forget($days);

        return redirect()->route('admin.statistik', ['days' => $days])->with('success', 'Data diambil ulang dari Google.');
    }

    /**
     * @param  callable(): array<string, mixed>  $fetch
     * @return array{data?: array<string, mixed>, error?: string, category?: string}
     */
    private function attempt(callable $fetch): array
    {
        try {
            return ['data' => $fetch()];
        } catch (GoogleStatsException $e) {
            return ['error' => $e->friendlyMessage(), 'category' => $e->category];
        }
    }
}
