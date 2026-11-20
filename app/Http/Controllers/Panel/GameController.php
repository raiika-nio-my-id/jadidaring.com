<?php

namespace App\Http\Controllers\Panel;

use App\Http\Controllers\Controller;
use App\Models\CompanyProfile;
use App\Models\GameEvent;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameScore;
use App\Services\Admin\AdminAudit;
use App\Services\Admin\AdminBackup;
use App\Services\PopularStats;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\View\View;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * /admin Game: the game list (show/hide from /game and the home page) and per-game data
 * (leaderboard scores and multiplayer rooms with their players and events): search, view as JSON,
 * edit a score, delete one entry, clear a leaderboard or rooms (typed confirmation), JSON export.
 * Every delete writes a JSON backup first. Old client/HTML management is intentionally not here (games live in git).
 */
class GameController extends Controller
{
    public function index(Request $request): View
    {
        $q = trim((string) $request->query('q', ''));
        $f = in_array($request->query('f'), ['tampil', 'tersembunyi'], true) ? (string) $request->query('f') : '';

        $games = CompanyProfile::query()->games()
            ->where('subdomain', '!=', 'gamehub')
            ->withCount(['scores' => fn ($w) => $w, 'rooms' => fn ($w) => $w])
            ->when($q !== '', fn ($w) => $w->where('subdomain', 'like', '%'.$q.'%'))
            ->when($f === 'tampil', fn ($w) => $w->where('hidden_from_listing', false))
            ->when($f === 'tersembunyi', fn ($w) => $w->where('hidden_from_listing', true))
            ->orderBy('subdomain')
            ->get(['id', 'subdomain', 'status', 'expires_at', 'hidden_from_listing', 'is_pinned', 'created_at', 'updated_at']);

        return view('panel.games.index', ['games' => $games, 'q' => $q, 'f' => $f, 'views' => PopularStats::gameViews() ?? []]);
    }

    public function listing(Request $request, int $game): RedirectResponse
    {
        $model = $this->game($game);
        $model->forceFill(['hidden_from_listing' => ! $model->hidden_from_listing])->save();
        AdminAudit::log($request, $model->hidden_from_listing ? 'game.hide' : 'game.show', 'game', $model->id, $model->subdomain);

        return back()->with('toast', $model->hidden_from_listing ? $model->subdomain.' disembunyikan dari daftar game (halamannya tetap bisa dibuka).' : $model->subdomain.' tampil lagi di daftar game.');
    }

    public function show(Request $request, int $game): View
    {
        $model = $this->game($game);
        $tab = $request->query('tab') === 'room' ? 'room' : 'skor';
        $q = trim((string) $request->query('q', ''));

        $scores = null;
        $rooms = null;

        if ($tab === 'skor') {
            $sort = $request->query('sort') === 'baru' ? 'baru' : 'skor';
            $scores = GameScore::query()->where('company_profile_id', $model->id)->with('user:id,username')
                ->when($q !== '', fn ($w) => $w->where('name', 'like', '%'.$q.'%'))
                ->when($sort === 'skor', fn ($w) => $w->orderByDesc('score')->orderBy('created_at'), fn ($w) => $w->orderByDesc('id'))
                ->paginate(30)->withQueryString();
        } else {
            $status = (string) $request->query('status', '');
            $rooms = GameRoom::query()->where('company_profile_id', $model->id)
                ->withCount(['players' => fn ($w) => $w->whereNull('left_at'), 'events' => fn ($w) => $w])
                ->when($q !== '', fn ($w) => $w->where('code', 'like', '%'.strtoupper($q).'%'))
                ->when($status !== '', fn ($w) => $w->where('status', $status))
                ->orderByDesc('updated_at')->orderByDesc('id')
                ->paginate(30, ['id', 'company_profile_id', 'code', 'visibility', 'status', 'max_players', 'version', 'created_at', 'updated_at'])->withQueryString();
        }

        // Daily unique visitors (page_view_records), ported from the old per-client analytics page.
        $from = now()->subDays(29)->toDateString();
        $rows = DB::table('page_view_records')->selectRaw('viewed_on, COUNT(*) as n')
            ->where('company_profile_id', $model->id)->where('viewed_on', '>=', $from)
            ->groupBy('viewed_on')->pluck('n', 'viewed_on');
        $series = [];
        for ($i = 29; $i >= 0; $i--) {
            $d = now()->subDays($i)->toDateString();
            $series[$d] = (int) ($rows[$d] ?? 0);
        }

        return view('panel.games.show', [
            'game' => $model, 'tab' => $tab, 'q' => $q, 'scores' => $scores, 'rooms' => $rooms, 'series' => $series,
            'totals' => [
                'scores' => GameScore::query()->where('company_profile_id', $model->id)->count(),
                'rooms' => GameRoom::query()->where('company_profile_id', $model->id)->count(),
                'oldRooms' => GameRoom::query()->where('company_profile_id', $model->id)->where('updated_at', '<', now()->subDay())->count(),
            ],
            'roomStatuses' => GameRoom::query()->where('company_profile_id', $model->id)->distinct()->orderBy('status')->pluck('status'),
            'sort' => $request->query('sort') === 'baru' ? 'baru' : 'skor',
            'status' => (string) $request->query('status', ''),
        ]);
    }

    public function score(int $game, int $score): View
    {
        $model = $this->game($game);
        $entry = GameScore::query()->where('company_profile_id', $model->id)->with('user:id,username')->findOrFail($score);

        return view('panel.games.entry', ['game' => $model, 'kind' => 'skor', 'entry' => $entry, 'json' => $entry->toArray()]);
    }

    public function updateScore(Request $request, int $game, int $score): RedirectResponse
    {
        $model = $this->game($game);
        $entry = GameScore::query()->where('company_profile_id', $model->id)->findOrFail($score);
        $data = $request->validate([
            'name' => ['required', 'string', 'min:1', 'max:16'],
            'score' => ['required', 'integer', 'min:0', 'max:4294967295'],
        ]);
        $before = $entry->only(['name', 'score']);
        $entry->update($data);
        AdminAudit::log($request, 'game.score.update', 'game_score', $entry->id, $model->subdomain.' · '.$entry->name, ['before' => $before, 'after' => $data]);

        return back()->with('toast', 'Skor disimpan.');
    }

    public function destroyScore(Request $request, int $game, int $score): RedirectResponse
    {
        $model = $this->game($game);
        $entry = GameScore::query()->where('company_profile_id', $model->id)->findOrFail($score);
        $file = AdminBackup::write('game-'.$model->subdomain.'-score-'.$entry->id, $entry->toArray());
        $entry->delete();
        AdminAudit::log($request, 'game.score.delete', 'game_score', $score, $model->subdomain.' · '.$entry->name.' ('.$entry->score.')', ['backup' => basename($file)]);

        return redirect()->route('panel.games.show', ['game' => $model->id, 'tab' => 'skor'])->with('toast', 'Skor dihapus. Backup: '.basename($file));
    }

    public function clearScores(Request $request, int $game): RedirectResponse
    {
        $model = $this->game($game);
        $request->validate(['confirm' => ['required', 'in:'.$model->subdomain]], ['confirm.in' => 'Nama game yang diketik tidak cocok.']);

        $rows = GameScore::query()->where('company_profile_id', $model->id)->orderBy('id')->get();
        $file = AdminBackup::write('game-'.$model->subdomain.'-scores', ['game' => $model->subdomain, 'scores' => $rows->toArray()]);
        $deleted = GameScore::query()->where('company_profile_id', $model->id)->whereIn('id', $rows->pluck('id'))->delete();
        AdminAudit::log($request, 'game.scores.clear', 'game', $model->id, $model->subdomain, ['deleted' => $deleted, 'backup' => basename($file)]);

        return redirect()->route('panel.games.show', ['game' => $model->id, 'tab' => 'skor'])->with('toast', $deleted.' skor dihapus. Backup: '.basename($file));
    }

    public function room(int $game, int $room): View
    {
        $model = $this->game($game);
        $entry = GameRoom::query()->where('company_profile_id', $model->id)->findOrFail($room);

        return view('panel.games.entry', ['game' => $model, 'kind' => 'room', 'entry' => $entry, 'json' => $this->roomData($entry, 100)]);
    }

    public function destroyRoom(Request $request, int $game, int $room): RedirectResponse
    {
        $model = $this->game($game);
        $entry = GameRoom::query()->where('company_profile_id', $model->id)->findOrFail($room);
        $file = AdminBackup::write('game-'.$model->subdomain.'-room-'.$entry->code, $this->roomData($entry, null));
        $entry->delete();
        AdminAudit::log($request, 'game.room.delete', 'game_room', $room, $model->subdomain.' · '.$entry->code, ['backup' => basename($file)]);

        return redirect()->route('panel.games.show', ['game' => $model->id, 'tab' => 'room'])->with('toast', 'Room '.$entry->code.' dihapus. Backup: '.basename($file));
    }

    public function clearRooms(Request $request, int $game): RedirectResponse
    {
        $model = $this->game($game);
        $data = $request->validate([
            'confirm' => ['required', 'in:'.$model->subdomain],
            'scope' => ['required', 'in:lama,semua'],
        ], ['confirm.in' => 'Nama game yang diketik tidak cocok.']);

        $rooms = GameRoom::query()->where('company_profile_id', $model->id)
            ->when($data['scope'] === 'lama', fn ($w) => $w->where('updated_at', '<', now()->subDay()))
            ->orderBy('id')->get();
        $file = AdminBackup::write('game-'.$model->subdomain.'-rooms', ['game' => $model->subdomain, 'scope' => $data['scope'], 'rooms' => $rooms->map(fn (GameRoom $r): array => $this->roomData($r, null))->all()]);
        $deleted = GameRoom::query()->whereIn('id', $rooms->pluck('id'))->delete();
        AdminAudit::log($request, 'game.rooms.clear', 'game', $model->id, $model->subdomain, ['scope' => $data['scope'], 'deleted' => $deleted, 'backup' => basename($file)]);

        return redirect()->route('panel.games.show', ['game' => $model->id, 'tab' => 'room'])->with('toast', $deleted.' room dihapus. Backup: '.basename($file));
    }

    public function export(Request $request, int $game): StreamedResponse
    {
        $model = $this->game($game);
        $type = in_array($request->query('type'), ['skor', 'room'], true) ? (string) $request->query('type') : 'semua';
        AdminAudit::log($request, 'game.export', 'game', $model->id, $model->subdomain, ['type' => $type]);
        $name = 'jadidaring-'.$model->subdomain.'-'.$type.'-'.now()->format('Ymd-His').'.json';

        return response()->streamDownload(function () use ($model, $type): void {
            $flags = JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE;
            echo '{"game":'.json_encode($model->subdomain, $flags).',"exported_at":'.json_encode(now()->toIso8601String());

            if ($type !== 'room') {
                echo ',"scores":[';
                $first = true;
                foreach (GameScore::query()->where('company_profile_id', $model->id)->orderBy('id')->lazyById(500) as $s) {
                    echo ($first ? '' : ',').json_encode($s->toArray(), $flags);
                    $first = false;
                }
                echo ']';
            }

            if ($type !== 'skor') {
                echo ',"rooms":[';
                $first = true;
                foreach (GameRoom::query()->where('company_profile_id', $model->id)->orderBy('id')->lazyById(100) as $r) {
                    echo ($first ? '' : ',').json_encode($this->roomData($r, null), $flags);
                    $first = false;
                }
                echo ']';
            }

            echo '}';
        }, $name, ['Content-Type' => 'application/json; charset=utf-8']);
    }

    private function game(int $id): CompanyProfile
    {
        return CompanyProfile::query()->games()->findOrFail($id);
    }

    /**
     * A room with its players (never the token hash) and events; $eventLimit null = all events.
     *
     * @return array<string, mixed>
     */
    private function roomData(GameRoom $room, ?int $eventLimit): array
    {
        $players = GamePlayer::query()->where('game_room_id', $room->id)->orderBy('id')->get()
            ->map(fn (GamePlayer $p): array => $p->makeVisible('private_state')->makeHidden('token_hash')->toArray())->all();
        $events = GameEvent::query()->where('game_room_id', $room->id)->orderByDesc('id')
            ->when($eventLimit !== null, fn ($w) => $w->limit($eventLimit))->get()->reverse()->values()->toArray();

        return ['room' => $room->toArray(), 'players' => $players, 'events' => $events, 'events_total' => GameEvent::query()->where('game_room_id', $room->id)->count()];
    }
}
