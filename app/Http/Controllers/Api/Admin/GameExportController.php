<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\CompanyProfile;
use App\Services\GameMasterKey;
use Illuminate\Http\JsonResponse;

/**
 * Read-only export of one game's database html, used to move games without a local build into
 * resources/games/{slug}/ (docs/games-in-git.md). Games only; the retired GM key is scrubbed the same way
 * the public page serves it, so the export never carries anything the live page does not.
 */
class GameExportController extends Controller
{
    public function show(string $subdomain): JsonResponse
    {
        $profile = CompanyProfile::query()
            ->where('subdomain', strtolower($subdomain))
            ->where('is_game', true)
            ->first();

        if ($profile === null) {
            return response()->json(['message' => 'Game not found.'], 404);
        }

        $html = GameMasterKey::scrub((string) $profile->html);

        return response()->json([
            'subdomain' => $profile->subdomain,
            'status' => $profile->status,
            'bytes' => strlen($html),
            'sha256' => hash('sha256', $html),
            'html' => $html,
        ]);
    }
}
