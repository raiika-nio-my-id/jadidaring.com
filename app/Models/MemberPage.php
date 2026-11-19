<?php

namespace App\Models;

use App\Services\ProfileConfig;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MemberPage extends Model
{
    public const AUTO_HIDE_REPORTS = 3;

    protected $fillable = ['user_id', 'title', 'html', 'status', 'views', 'reports_count', 'config'];

    protected function casts(): array
    {
        return ['config' => 'array'];
    }

    /** Stored config, or a legacy wrapper that keeps an old full page as a Custom HTML widget. */
    public function profileConfig(): array
    {
        if (is_array($this->config)) {
            // Re-validated on read so configs saved before newer fields existed always have every key.
            return ProfileConfig::validate($this->config, trim((string) $this->html) !== '');
        }

        return trim((string) $this->html) !== '' ? ProfileConfig::legacy() : ProfileConfig::defaults();
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isPublished(): bool
    {
        return $this->status === 'published';
    }
}
