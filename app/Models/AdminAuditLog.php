<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One admin action in the /admin panel: who, what, when, on which target. */
class AdminAuditLog extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = ['user_id', 'actor', 'action', 'target_type', 'target_id', 'target_label', 'meta', 'ip'];

    protected function casts(): array
    {
        return ['meta' => 'array', 'created_at' => 'datetime'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
