<?php

namespace App\Services;

use App\Http\Controllers\ClayController;
use App\Models\Article;
use App\Models\NewsTopic;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * One way to create a news article, shared by the bot API (POST /api/admin/news/articles)
 * and the /admin "Tulis berita" form: same field rules, same source check, same enabled-topic check (no per-topic daily limit).
 */
final class NewsArticleCreator
{
    /** @return array<string, mixed> */
    public static function rules(): array
    {
        return [
            'topic' => ['required', 'string', Rule::in(array_keys(ClayController::TOPICS))],
            'title' => ['required', 'string', 'min:10', 'max:200'],
            'summary' => ['required', 'string', 'min:20', 'max:400'],
            'body' => ['required', 'string', 'min:200', 'max:60000'],
            'slug' => ['nullable', 'string', 'max:100', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/'],
            'status' => ['sometimes', Rule::in(['draft', 'published'])],
            'published_at' => ['nullable', 'date'],
            'sources' => ['required', 'array', 'min:1', 'max:10'],
        ];
    }

    /**
     * @param  array<string, mixed>  $data  validated with rules()
     *
     * @throws ValidationException on bad sources or when publishing is not allowed
     */
    public static function create(array $data): Article
    {
        $topic = NewsTopic::query()->findOrFail($data['topic']);
        $checked = NewsSources::normalize($data['sources'], $topic->min_sources);

        if ($checked['error'] !== null) {
            throw ValidationException::withMessages(['sources' => $checked['error']]);
        }

        $status = $data['status'] ?? 'draft';

        if ($status === 'published' && ($problem = self::publishProblem($topic)) !== null) {
            throw ValidationException::withMessages(['status' => $problem]);
        }

        $article = Article::query()->create([
            'topic' => $topic->slug,
            'slug' => NewsSlug::unique($data['slug'] ?? $data['title']),
            'title' => $data['title'],
            'summary' => $data['summary'],
            'body' => $data['body'],
            'image_url' => $data['image_url'] ?? null,
            'sources' => $checked['sources'],
            'status' => $status,
            'published_at' => $status === 'published' ? ($data['published_at'] ?? now()) : null,
        ]);
        NewsCache::bump();

        return $article;
    }

    public static function publishProblem(NewsTopic $topic): ?string
    {
        if (! $topic->enabled) {
            return 'Topic is disabled.';
        }

        return null;
    }
}
