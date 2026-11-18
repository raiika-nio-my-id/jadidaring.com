<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Article extends Model
{
    public const STATUSES = ['draft', 'published', 'hidden'];

    protected $fillable = ['topic', 'slug', 'title', 'summary', 'body', 'image_url', 'sources', 'status', 'published_at'];

    protected function casts(): array
    {
        return ['sources' => 'array', 'published_at' => 'datetime'];
    }

    public function comments(): HasMany
    {
        return $this->hasMany(ArticleComment::class);
    }

    public function scopeVisible(Builder $query): Builder
    {
        return $query->where('status', 'published')->where('published_at', '<=', now());
    }

    public function url(): string
    {
        return '/berita/'.$this->topic.'/'.$this->slug;
    }
}
