<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\ClayController;
use App\Http\Controllers\Controller;
use App\Models\Article;
use App\Models\ArticleComment;
use App\Models\NewsTopic;
use App\Services\NewsCache;
use App\Services\NewsSources;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * Secret-authenticated bot API (X-Admin-Api-Key = ADMIN_API_SECRET, env only).
 */
class NewsController extends Controller
{
    public function topics(): JsonResponse
    {
        return response()->json(['topics' => NewsTopic::query()->orderBy('slug')->get()]);
    }

    public function updateTopic(Request $request, string $slug): JsonResponse
    {
        $topic = NewsTopic::query()->find($slug);

        if (! $topic instanceof NewsTopic) {
            return response()->json(['message' => 'Topic not found.'], 404);
        }

        $data = $request->validate([
            'enabled' => ['sometimes', 'boolean'],
            'articles_per_day' => ['sometimes', 'integer', 'min:0', 'max:50'],
            'min_sources' => ['sometimes', 'integer', 'min:2', 'max:10'],
        ]);

        $topic->update($data);
        NewsCache::bump();

        return response()->json(['topic' => $topic->fresh()]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'topic' => ['required', 'string', Rule::in(array_keys(ClayController::TOPICS))],
            'title' => ['required', 'string', 'min:10', 'max:200'],
            'summary' => ['required', 'string', 'min:20', 'max:400'],
            'body' => ['required', 'string', 'min:200', 'max:60000'],
            'image_url' => ['nullable', 'url:https', 'max:500'],
            'slug' => ['nullable', 'string', 'max:100', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/'],
            'status' => ['sometimes', Rule::in(['draft', 'published'])],
            'published_at' => ['nullable', 'date'],
            'sources' => ['required', 'array', 'min:2', 'max:10'],
        ]);

        $topic = NewsTopic::query()->findOrFail($data['topic']);
        $checked = NewsSources::normalize($data['sources'], $topic->min_sources);

        if ($checked['error'] !== null) {
            return response()->json(['message' => $checked['error'], 'errors' => ['sources' => [$checked['error']]]], 422);
        }

        $status = $data['status'] ?? 'draft';

        if ($status === 'published' && ($problem = $this->publishProblem($topic)) !== null) {
            return response()->json(['message' => $problem], 422);
        }

        $article = Article::query()->create([
            'topic' => $topic->slug,
            'slug' => $this->uniqueSlug($data['slug'] ?? $data['title']),
            'title' => $data['title'],
            'summary' => $data['summary'],
            'body' => $data['body'],
            'image_url' => $data['image_url'] ?? null,
            'sources' => $checked['sources'],
            'status' => $status,
            'published_at' => $status === 'published' ? ($data['published_at'] ?? now()) : null,
        ]);
        NewsCache::bump();

        return response()->json(['article' => $this->present($article)], 201);
    }

    public function update(Request $request, int $article): JsonResponse
    {
        $model = Article::query()->find($article);

        if (! $model instanceof Article) {
            return response()->json(['message' => 'Article not found.'], 404);
        }

        $data = $request->validate([
            'title' => ['sometimes', 'string', 'min:10', 'max:200'],
            'summary' => ['sometimes', 'string', 'min:20', 'max:400'],
            'body' => ['sometimes', 'string', 'min:200', 'max:60000'],
            'image_url' => ['sometimes', 'nullable', 'url:https', 'max:500'],
            'status' => ['sometimes', Rule::in(Article::STATUSES)],
            'sources' => ['sometimes', 'array', 'min:2', 'max:10'],
        ]);

        $topic = NewsTopic::query()->findOrFail($model->topic);

        if (isset($data['sources'])) {
            $checked = NewsSources::normalize($data['sources'], $topic->min_sources);

            if ($checked['error'] !== null) {
                return response()->json(['message' => $checked['error'], 'errors' => ['sources' => [$checked['error']]]], 422);
            }

            $data['sources'] = $checked['sources'];
        }

        if (($data['status'] ?? null) === 'published' && $model->status !== 'published') {
            if (($problem = $this->publishProblem($topic)) !== null) {
                return response()->json(['message' => $problem], 422);
            }

            $model->published_at ??= now();
        }

        $model->fill($data)->save();
        NewsCache::bump();

        return response()->json(['article' => $this->present($model->fresh())]);
    }

    public function index(Request $request): JsonResponse
    {
        $status = $request->query('status');

        $items = Article::query()
            ->when(in_array($status, Article::STATUSES, true), fn ($q) => $q->where('status', $status))
            ->orderBy('id')->limit(500)
            ->get(['id', 'topic', 'slug', 'title', 'status', 'published_at', 'created_at'])
            ->map(fn (Article $a): array => [
                'id' => $a->id, 'topic' => $a->topic, 'slug' => $a->slug, 'title' => $a->title, 'status' => $a->status,
                'published_at' => $a->published_at?->toIso8601String(), 'created_at' => $a->created_at?->toIso8601String(),
            ]);

        return response()->json(['articles' => $items]);
    }

    public function destroy(int $article): JsonResponse
    {
        $model = Article::query()->find($article);

        if (! $model instanceof Article) {
            return response()->json(['message' => 'Article not found.'], 404);
        }

        $model->delete();
        NewsCache::bump();

        return response()->json(['deleted' => $article]);
    }

    public function moderateComment(Request $request, int $comment): JsonResponse
    {
        $model = ArticleComment::query()->find($comment);

        if (! $model instanceof ArticleComment) {
            return response()->json(['message' => 'Comment not found.'], 404);
        }

        $data = $request->validate(['is_hidden' => ['required', 'boolean']]);
        $model->update($data);

        return response()->json(['comment' => ['id' => $model->id, 'is_hidden' => $model->is_hidden]]);
    }

    private function publishProblem(NewsTopic $topic): ?string
    {
        if (! $topic->enabled) {
            return 'Topic is disabled.';
        }

        $today = Article::query()
            ->where('topic', $topic->slug)
            ->where('status', 'published')
            ->where('published_at', '>=', now()->startOfDay())
            ->count();

        return $today >= $topic->articles_per_day
            ? "Daily limit reached for {$topic->slug} ({$topic->articles_per_day}/day)."
            : null;
    }

    private function uniqueSlug(string $seed): string
    {
        return \App\Services\NewsSlug::unique($seed);
    }

    /**
     * @return array<string, mixed>
     */
    private function present(Article $article): array
    {
        return [
            'id' => $article->id, 'topic' => $article->topic, 'slug' => $article->slug,
            'status' => $article->status, 'url' => 'https://'.\App\Services\GameHub::host().$article->url(),
            'published_at' => $article->published_at?->toIso8601String(),
            'sources' => $article->sources,
        ];
    }
}
