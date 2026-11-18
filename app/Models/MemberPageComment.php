<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MemberPageComment extends Model
{
    protected $fillable = ['member_page_id', 'user_id', 'body', 'is_hidden', 'reports_count'];

    protected function casts(): array
    {
        return ['is_hidden' => 'boolean'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function page(): BelongsTo
    {
        return $this->belongsTo(MemberPage::class, 'member_page_id');
    }
}
