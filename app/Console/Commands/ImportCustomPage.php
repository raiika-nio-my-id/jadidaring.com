<?php

namespace App\Console\Commands;

use App\Enums\ProfileStatus;
use App\Models\CompanyProfile;
use Illuminate\Console\Command;

/**
 * Seeds a Custom Page from an HTML file in the repo (e.g. resources/pages/andika.html).
 * Idempotent: an existing page is left untouched (admin edits in /admin/custom-page win) unless --force.
 */
class ImportCustomPage extends Command
{
    protected $signature = 'pages:import-custom {slug} {file} {--name=} {--force : overwrite the HTML of an existing Custom Page}';

    protected $description = 'Create (or with --force update) a Custom Page from an HTML file';

    public function handle(): int
    {
        $slug = strtolower((string) $this->argument('slug'));
        $file = base_path((string) $this->argument('file'));

        if (preg_match('/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/', $slug) !== 1 || ! is_file($file) || ! str_starts_with((string) realpath($file), base_path('resources/pages/'))) {
            $this->error('Invalid slug or file (must live under resources/pages/).');

            return self::FAILURE;
        }

        $html = (string) file_get_contents($file);
        $page = CompanyProfile::query()->where('subdomain', $slug)->first();

        if ($page instanceof CompanyProfile && $page->is_game) {
            $this->error("{$slug} is a game; refusing.");

            return self::FAILURE;
        }

        if ($page instanceof CompanyProfile && ! $this->option('force')) {
            $this->info("exists: {$slug} (id {$page->id}), kept as is");

            return self::SUCCESS;
        }

        if ($page instanceof CompanyProfile) {
            $page->update(['html' => $html]);
            $this->info("updated: {$slug} (id {$page->id}), ".strlen($html).' bytes');

            return self::SUCCESS;
        }

        $page = CompanyProfile::query()->create([
            'user_id' => null, 'subdomain' => $slug, 'name' => (string) ($this->option('name') ?: $slug), 'html' => $html,
            'status' => ProfileStatus::Published, 'hide_footer' => true, 'is_game' => false, 'is_pinned' => false,
            'sort_order' => (int) CompanyProfile::query()->where('is_game', false)->max('sort_order') + 1,
        ]);
        $this->info("created: {$slug} (id {$page->id}), ".strlen($html).' bytes');

        return self::SUCCESS;
    }
}
