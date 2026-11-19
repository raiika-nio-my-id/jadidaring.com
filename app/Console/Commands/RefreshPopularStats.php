<?php

namespace App\Console\Commands;

use App\Services\GoogleStats\GoogleStats;
use App\Services\GoogleStats\GoogleStatsException;
use App\Services\PopularStats;
use Illuminate\Console\Command;

class RefreshPopularStats extends Command
{
    protected $signature = 'stats:refresh-popular';

    protected $description = 'Fetch Google Analytics page views for the Populer rankings (games 30d, news 7d) into the cache';

    public function handle(GoogleStats $stats): int
    {
        if (! $stats->isConfigured()) {
            $this->warn('Google Analytics belum dikonfigurasi; Populer memakai urutan terbaru.');

            return self::SUCCESS;
        }

        try {
            $n = PopularStats::refresh($stats);
        } catch (GoogleStatsException $e) {
            $this->error('Gagal: '.$e->friendlyMessage());

            return self::FAILURE;
        }

        $this->info("OK: {$n['games']} game, {$n['news']} berita punya data tayang.");
        foreach (array_slice(PopularStats::gameViews() ?? [], 0, 5, true) as $slug => $v) {
            $this->line("game  {$slug}: {$v}");
        }
        foreach (array_slice(PopularStats::newsViews() ?? [], 0, 5, true) as $slug => $v) {
            $this->line("berita {$slug}: {$v}");
        }

        return self::SUCCESS;
    }
}
