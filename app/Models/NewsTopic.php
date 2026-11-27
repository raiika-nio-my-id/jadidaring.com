<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class NewsTopic extends Model
{
    protected $primaryKey = 'slug';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = ['slug', 'name', 'enabled', 'min_sources'];

    /** Legacy column, no longer enforced (no per-topic daily cap); hidden from API output. */
    protected $hidden = ['articles_per_day'];

    protected function casts(): array
    {
        return ['enabled' => 'boolean', 'min_sources' => 'integer'];
    }
}
