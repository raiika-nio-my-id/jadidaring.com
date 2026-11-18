<?php

namespace App\Models;

use Database\Factories\GameScoreFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['company_profile_id', 'name', 'score', 'user_id'])]
class GameScore extends Model
{
    /** @use HasFactory<GameScoreFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'score' => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function shownName(): string
    {
        return $this->user_id !== null && $this->user !== null && $this->user->name !== '' ? $this->user->name : $this->name;
    }

    public function profile(): BelongsTo
    {
        return $this->belongsTo(CompanyProfile::class, 'company_profile_id');
    }
}
