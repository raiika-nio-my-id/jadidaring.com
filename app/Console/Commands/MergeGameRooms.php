<?php

namespace App\Console\Commands;

use App\Models\CompanyProfile;
use App\Models\GameRoom;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Additive merge of drawn creations (cr) and comments (cm) from the other rooms of a shared-sky game into one
 * target room. Nothing is deleted; existing entries in the target win. Dry run unless --apply, and --apply
 * needs a verified JSON backup of every room it reads or writes.
 */
class MergeGameRooms extends Command
{
    protected $signature = 'games:merge-rooms {subdomain} {target} {--apply}';

    protected $description = 'Copy missing creations/comments from sibling rooms into a target room (additive, backed up first)';

    public function handle(): int
    {
        $profile = CompanyProfile::query()->where('subdomain', (string) $this->argument('subdomain'))->first();

        if (! $profile instanceof CompanyProfile) {
            $this->error('Unknown game.');

            return self::FAILURE;
        }

        $rooms = GameRoom::query()->where('company_profile_id', $profile->id)->orderBy('id')->get();
        $target = $rooms->firstWhere('code', strtoupper((string) $this->argument('target')));

        if (! $target instanceof GameRoom) {
            $this->error('Target room not found.');

            return self::FAILURE;
        }

        $state = $this->normalize($target->state);
        $before = [count($state['cr']), count($state['cm']), count($state['del'])];
        $crIds = array_flip(array_column($state['cr'], 'id'));
        $cmIds = array_flip(array_column($state['cm'], 'i'));
        $cmKeys = [];
        foreach ($state['cm'] as $m) {
            $cmKeys[($m['at'] ?? '').'|'.($m['t'] ?? '')] = true;
        }

        foreach ($rooms as $room) {
            $s = $this->normalize($room->state);
            $this->line(sprintf('room %s v%d: %d creations, %d comments, %d tombstones', $room->code, $room->version, count($s['cr']), count($s['cm']), count($s['del'])));
            if ($room->id === $target->id) {
                continue;
            }
            foreach ($s['cr'] as $c) {
                if (isset($c['id']) && ! isset($crIds[$c['id']])) {
                    $state['cr'][] = $c;
                    $crIds[$c['id']] = true;
                }
            }
            foreach ($s['cm'] as $m) {
                $key = ($m['at'] ?? '').'|'.($m['t'] ?? '');
                if (isset($cmKeys[$key]) || (isset($m['i']) && isset($cmIds[$m['i']]))) {
                    continue;
                }
                $state['cm'][] = $m;
                $cmKeys[$key] = true;
                if (isset($m['i'])) {
                    $cmIds[$m['i']] = true;
                }
            }
            $state['del'] = array_values(array_unique(array_merge($state['del'], $s['del'])));
            $state['n'] = max((int) ($state['n'] ?? 0), (int) ($s['n'] ?? 0));
        }

        usort($state['cm'], fn ($a, $b) => ($a['at'] ?? 0) <=> ($b['at'] ?? 0));
        $this->info(sprintf('Target %s: creations %d -> %d, comments %d -> %d, tombstones %d -> %d', $target->code, $before[0], count($state['cr']), $before[1], count($state['cm']), $before[2], count($state['del'])));

        if (! $this->option('apply')) {
            $this->line('Dry run: nothing written.');

            return self::SUCCESS;
        }

        $rows = $rooms->map(fn (GameRoom $r) => $r->only(['id', 'code', 'status', 'visibility', 'max_players', 'version', 'state', 'updated_at']))->all();
        $dir = storage_path('app/backups');
        @mkdir($dir, 0775, true);
        $file = $dir.'/game-rooms-'.$profile->subdomain.'-'.date('Ymd-His').'.json';
        file_put_contents($file, json_encode($rows));
        $back = json_decode((string) file_get_contents($file), true);

        if (! is_array($back) || count($back) !== count($rows) || $back !== json_decode(json_encode($rows), true)) {
            $this->error('Backup verification failed; nothing changed.');

            return self::FAILURE;
        }

        $this->info('Backup verified: '.basename($file).' ('.count($rows).' rooms)');

        DB::transaction(function () use ($target, $state): void {
            $locked = GameRoom::query()->whereKey($target->id)->lockForUpdate()->firstOrFail();
            $live = $this->normalize($locked->state);
            // Re-apply on top of whatever changed since the read: keep anything new in the live row.
            foreach (['cr' => 'id', 'cm' => 'i'] as $k => $idKey) {
                $have = array_flip(array_column($state[$k], $idKey));
                foreach ($live[$k] as $e) {
                    if (! isset($have[$e[$idKey] ?? null])) {
                        $state[$k][] = $e;
                    }
                }
            }
            $live = array_merge($live, ['cr' => $state['cr'], 'cm' => $state['cm'], 'del' => $state['del'], 'n' => $state['n']]);
            $locked->state = $live;
            $locked->version = $locked->version + 1;
            $locked->save();
        });

        $this->info('Merged into '.$target->code.'.');

        return self::SUCCESS;
    }

    /** @return array<string, mixed> */
    private function normalize(mixed $state): array
    {
        $s = is_array($state) && ! array_is_list($state) ? $state : [];

        return $s + ['n' => 0, 'v' => 1, 'ci' => 0, 'cm' => [], 'cr' => [], 'gm' => [], 'pr' => [], 'sd' => 1, 'del' => []];
    }
}
