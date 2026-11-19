<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MemberPostComment extends Model
{
    public const MAX_CHARS = 300;

    protected $fillable = ['member_post_id', 'user_id', 'body', 'is_hidden', 'reports_count'];

    protected function casts(): array
    {
        return ['is_hidden' => 'boolean'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function post(): BelongsTo
    {
        return $this->belongsTo(MemberPost::class, 'member_post_id');
    }
}
