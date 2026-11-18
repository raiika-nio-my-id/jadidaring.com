<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MemberPageDraft extends Model
{
    /** Offset so a draft frame token can never be valid for a published page id. */
    public const TOKEN_OFFSET = 900_000_000_000;

    protected $fillable = ['user_id', 'title', 'html', 'source'];

    public function tokenId(): int
    {
        return self::TOKEN_OFFSET + $this->id;
    }
}
