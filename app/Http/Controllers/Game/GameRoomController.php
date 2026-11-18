<?php

namespace App\Http\Controllers\Game;

use App\Exceptions\GameRoomException;
use App\Http\Controllers\Controller;
use App\Models\CompanyProfile;
use App\Services\GameRoomService;
use App\Services\MembersOnlyGames;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GameRoomController extends Controller
{
    public function __construct(private readonly GameRoomService $rooms) {}

    public function config(Request $request): JsonResponse
    {
        return response()->json($this->rooms->describe($request, $this->profile($request)));
    }

    public function index(Request $request): JsonResponse
    {
        return $this->respond(fn (): array => $this->rooms->list(
            $this->profile($request),
            $this->rooms->isGameMaster($request),
        ));
    }

    public function store(Request $request): JsonResponse
    {
        if ($denied = $this->requireMember($request)) {
            return $denied;
        }

        return $this->respond(fn (): array => $this->rooms->actingAs($this->actorId())->create($this->profile($request), $this->payload($request)));
    }

    public function join(Request $request): JsonResponse
    {
        if ($denied = $this->requireMember($request)) {
            return $denied;
        }

        return $this->respond(fn (): array => $this->rooms->actingAs($this->actorId())->join($this->profile($request), $this->payload($request)));
    }

    public function match(Request $request): JsonResponse
    {
        if ($denied = $this->requireMember($request)) {
            return $denied;
        }

        return $this->respond(fn (): array => $this->rooms->actingAs($this->actorId())->match($this->profile($request), $this->payload($request)));
    }

    public function show(Request $request, string $tenant, string $code): JsonResponse
    {
        $since = $request->query('since');

        return $this->respond(fn (): array => $this->rooms->show(
            $this->profile($request, $tenant),
            $code,
            $this->rooms->token($request),
            is_numeric($since) ? (int) $since : null,
        ));
    }

    public function watch(Request $request, string $tenant, string $code): JsonResponse
    {
        return $this->respond(fn (): array => $this->rooms->actingAs($this->actorId())->watch($this->profile($request, $tenant), $code, $this->payload($request)));
    }

    public function act(Request $request, string $tenant, string $code): JsonResponse
    {
        if ($denied = $this->requireMember($request, $tenant)) {
            return $denied;
        }

        return $this->respond(fn (): array => $this->rooms->act(
            $this->profile($request, $tenant),
            $code,
            $this->rooms->token($request),
            $request->all(),
        ));
    }

    public function input(Request $request, string $tenant, string $code): JsonResponse
    {
        if ($denied = $this->requireMember($request, $tenant)) {
            return $denied;
        }

        return $this->respond(fn (): array => $this->rooms->input(
            $this->profile($request, $tenant),
            $code,
            $this->rooms->token($request),
            $request->all(),
        ), 202);
    }

    public function leave(Request $request, string $tenant, string $code): JsonResponse
    {
        return $this->respond(fn (): array => $this->rooms->leave(
            $this->profile($request, $tenant),
            $code,
            $this->rooms->token($request),
        ));
    }

    public function gamemaster(Request $request, string $tenant, string $code): JsonResponse
    {
        return $this->respond(fn (): array => $this->rooms->claimGameMaster(
            $this->profile($request, $tenant),
            $code,
            $this->rooms->token($request),
            $request->all(),
        ));
    }

    private function requireMember(Request $request, ?string $tenant = null): ?JsonResponse
    {
        $profile = $this->profile($request, $tenant);

        if (! MembersOnlyGames::applies($profile->subdomain) || MembersOnlyGames::allows($request)) {
            return null;
        }

        return response()->json(['error' => 'Masuk dulu untuk menyimpan data mainmu.', 'login' => '/masuk'], 401);
    }

    private function actorId(): ?int
    {
        return MembersOnlyGames::user()?->id;
    }

    /**
     * The account name replaces any typed name, so saved player data always follows the account.
     *
     * @return array<string, mixed>
     */
    private function payload(Request $request): array
    {
        $input = $request->all();
        $user = MembersOnlyGames::user();

        if ($user !== null) {
            $input['displayName'] = mb_substr($user->name, 0, 40);
        }

        return $input;
    }

    private function profile(Request $request, ?string $tenant = null): CompanyProfile
    {
        $profile = $request->attributes->get('tenantProfile');

        abort_unless($profile instanceof CompanyProfile, 404);
        abort_unless($tenant === null || strtolower($tenant) === strtolower($profile->subdomain), 404);

        return $profile;
    }

    /**
     * @param  callable(): array<string, mixed>  $callback
     */
    private function respond(callable $callback, int $status = 200): JsonResponse
    {
        try {
            return response()->json($callback(), $status);
        } catch (GameRoomException $exception) {
            return response()->json([
                'error' => $exception->getMessage(),
            ], $exception->status);
        }
    }
}
