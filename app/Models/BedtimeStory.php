<?php

namespace App\Models;

use DateTimeInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;
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

    /** Timezone assumed for a published_at value written without an offset (admin form, API). */
    public const INPUT_TIMEZONE = 'Asia/Makassar';

    /**
     * Store published_at in the app timezone, honouring any ISO 8601 offset ("+08:00", "Z").
     * Values without an offset are read as WITA.
     */
    protected function publishedAt(): Attribute
    {
        return Attribute::make(
            set: fn (mixed $value): ?string => self::normalizeTime($value)?->format('Y-m-d H:i:s'),
        );
    }

    public static function normalizeTime(mixed $value): ?Carbon
    {
        if ($value === null || $value === '') {
            return null;
        }

        $time = $value instanceof DateTimeInterface
            ? Carbon::instance($value)
            : Carbon::parse((string) $value, self::INPUT_TIMEZONE);

        return $time->setTimezone((string) config('app.timezone'));
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
