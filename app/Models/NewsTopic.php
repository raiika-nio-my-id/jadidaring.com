<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class NewsTopic extends Model
{
    protected $primaryKey = 'slug';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = ['slug', 'name', 'enabled', 'articles_per_day', 'min_sources'];

    protected function casts(): array
    {
        return ['enabled' => 'boolean', 'articles_per_day' => 'integer', 'min_sources' => 'integer'];
    }
}
