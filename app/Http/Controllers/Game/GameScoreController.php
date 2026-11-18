<?php

namespace App\Http\Controllers\Game;

use App\Exceptions\GameRoomException;
use App\Http\Controllers\Controller;
use App\Models\CompanyProfile;
use App\Services\GameScoreService;
use App\Services\MembersOnlyGames;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GameScoreController extends Controller
{
    public function __construct(private readonly GameScoreService $scores) {}

    public function index(Request $request): JsonResponse
    {
        return $this->respond(
            fn (): array => $this->scores->list($this->profile($request), $request->integer('limit', GameScoreService::DEFAULT_LIMIT)),
        );
    }

    public function store(Request $request): JsonResponse
    {
        $user = MembersOnlyGames::user();

        if ($user === null && MembersOnlyGames::applies($this->profile($request)->subdomain)) {
            return response()->json(['error' => 'Masuk dulu untuk menyimpan skormu.', 'login' => '/masuk'], 401);
        }

        return $this->respond(fn (): array => $this->scores->submit($this->profile($request), $request->all(), $user));
    }

    private function profile(Request $request): CompanyProfile
    {
        $profile = $request->attributes->get('tenantProfile');

        abort_unless($profile instanceof CompanyProfile, 404);

        $tenant = $request->route('tenant');

        abort_unless(! is_string($tenant) || strtolower($tenant) === strtolower($profile->subdomain), 404);

        return $profile;
    }

    /**
     * @param  callable(): array<string, mixed>  $callback
     */
    private function respond(callable $callback): JsonResponse
    {
        try {
            return response()->json($callback());
        } catch (GameRoomException $exception) {
            return response()->json([
                'error' => $exception->getMessage(),
            ], $exception->status);
        }
    }
}
