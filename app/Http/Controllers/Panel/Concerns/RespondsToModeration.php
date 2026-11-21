<?php

namespace App\Http\Controllers\Panel\Concerns;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

/**
 * Panel moderation actions answer the panel's plain form posts with a redirect + toast, and the public site's
 * admin '⋯' menu (fetch with Accept: application/json) with JSON. Same route, middleware, CSRF and logic either way.
 */
trait RespondsToModeration
{
    /** Target state for a hide/unhide toggle: an explicit `hidden` field wins (idempotent for the public menu), otherwise flip. */
    protected function wantHidden(Request $request, bool $current): bool
    {
        return $request->has('hidden') ? $request->boolean('hidden') : ! $current;
    }

    /** @param array<string, mixed> $extra */
    protected function moderated(Request $request, string $message, array $extra = []): JsonResponse|RedirectResponse
    {
        if ($request->expectsJson()) {
            return response()->json(['ok' => true, 'message' => $message] + $extra, 200, ['Cache-Control' => 'no-store']);
        }

        return back()->with('toast', $message);
    }
}
