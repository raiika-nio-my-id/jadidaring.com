<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class BedtimeStory extends Model
{
    use HasFactory;

    public const STATUSES = ['draft', 'published'];

    protected $fillable = [
        'title',
        'slug',
        'author',
        'author_origin',
        'adapter',
        'language',
        'summary',
        'body',
        'moral',
        'image_url',
        'image_path',
        'image_alt',
        'image_credit',
        'image_source_url',
        'image_license',
        'image_updated_at',
        'status',
        'published_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'published_at' => 'datetime',
            'image_updated_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::saving(function (BedtimeStory $story): void {
            if ($story->summary === null || trim((string) $story->summary) === '') {
                $story->summary = self::deriveSummary((string) $story->body);
            }
        });
    }

    public static function deriveSummary(string $body): string
    {
        $clean = preg_replace('/\s+/', ' ', trim(strip_tags($body))) ?? '';

        return Str::limit($clean, 160, '…');
    }

    public function scopeVisible(Builder $query): Builder
    {
        return $query->where('status', 'published')->where('published_at', '<=', now());
    }

    public function url(): string
    {
        return '/bed-time-stories/'.$this->slug;
    }

    /**
     * @return list<string>
     */
    public function paragraphs(): array
    {
        $parts = array_values(array_filter(array_map('trim', preg_split('/\R{2,}/', (string) $this->body) ?: [])));

        if (count($parts) <= 1) {
            $parts = array_values(array_filter(array_map('trim', preg_split('/\R/', (string) $this->body) ?: [])));
        }

        return $parts;
    }
}
