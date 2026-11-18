<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MemberPage extends Model
{
    public const AUTO_HIDE_REPORTS = 3;

    protected $fillable = ['user_id', 'title', 'html', 'status', 'views', 'reports_count'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isPublished(): bool
    {
        return $this->status === 'published';
    }
}
