<?php

namespace App\Models;

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
            return $this->config;
        }

        return trim((string) $this->html) !== '' ? \App\Services\ProfileConfig::legacy() : \App\Services\ProfileConfig::defaults();
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
