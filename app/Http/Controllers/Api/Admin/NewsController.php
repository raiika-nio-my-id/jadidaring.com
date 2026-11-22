<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\ClayController;
use App\Http\Controllers\Controller;
use App\Models\Article;
use App\Models\ArticleComment;
use App\Models\NewsTopic;
use App\Services\NewsCache;
use App\Services\NewsImage;
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
            'min_sources' => ['sometimes', 'integer', 'min:1', 'max:10'],
        ]);

        $topic->update($data);
        NewsCache::bump();

        return response()->json(['topic' => $topic->fresh()]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate(\App\Services\NewsArticleCreator::rules() + [
            'image_url' => ['nullable', 'url:https', 'max:500'],
            'image' => ['sometimes', 'array'],
            'image.url' => ['required_with:image', 'url:https', 'max:500'],
            'image.alt' => ['required_with:image', 'string', 'min:5', 'max:200'],
            'image.credit' => ['required_with:image', 'string', 'min:2', 'max:200'],
            'image.source_url' => ['required_with:image', 'url:https', 'max:500'],
            'image.license' => ['required_with:image', 'string', 'min:2', 'max:100'],
        ]);

        try {
            $article = \App\Services\NewsArticleCreator::create($data);
        } catch (\Illuminate\Validation\ValidationException $e) {
            $errors = $e->errors();
            $message = (string) (collect($errors)->flatten()->first() ?? $e->getMessage());

            // keep the old response shapes: sources errors carry "errors", publish problems only "message"
            return response()->json(isset($errors['sources']) ? ['message' => $message, 'errors' => ['sources' => $errors['sources']]] : ['message' => $message], 422);
        }

        $extra = [];

        if (isset($data['image'])) {
            try {
                NewsImage::storePhoto($article, NewsImage::download($data['image']['url']), \Illuminate\Support\Arr::only($data['image'], ['alt', 'credit', 'source_url', 'license']));
                NewsCache::bump();
            } catch (\InvalidArgumentException $e) {
                $extra['image_error'] = $e->getMessage();
            }
        }

        return response()->json(['article' => $this->present($article->fresh())] + self::formatWarnings($data['body']) + $extra, 201);
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

    /** POST /news/articles/{id}/image: multipart `image` file or `image_url` (https), plus alt/credit/source_url/license. */
    public function setImage(Request $request, int $article): JsonResponse
    {
        $model = Article::query()->find($article);

        if (! $model instanceof Article) {
            return response()->json(['message' => 'Article not found.'], 404);
        }

        $data = $request->validate([
            'image' => ['nullable', 'file', 'max:12288'],
            'image_url' => ['nullable', 'url:https', 'max:500'],
            'alt' => ['required', 'string', 'min:5', 'max:200'],
            'credit' => ['required', 'string', 'min:2', 'max:200'],
            'source_url' => ['required', 'url:https', 'max:500'],
            'license' => ['required', 'string', 'min:2', 'max:100'],
        ]);

        if (! $request->hasFile('image') && empty($data['image_url'])) {
            return response()->json(['message' => 'Send an image file (field "image") or an https "image_url".', 'errors' => ['image' => ['Required.']]], 422);
        }

        try {
            $binary = $request->hasFile('image') ? (string) file_get_contents($request->file('image')->getRealPath()) : NewsImage::download($data['image_url']);
            NewsImage::storePhoto($model, $binary, \Illuminate\Support\Arr::only($data, ['alt', 'credit', 'source_url', 'license']));
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage(), 'errors' => ['image' => [$e->getMessage()]]], 422);
        }

        NewsCache::bump();

        return response()->json(['article' => $this->present($model->fresh())]);
    }

    /** DELETE /news/articles/{id}/image: back to the generated title card. */
    public function clearImage(int $article): JsonResponse
    {
        $model = Article::query()->find($article);

        if (! $model instanceof Article) {
            return response()->json(['message' => 'Article not found.'], 404);
        }

        NewsImage::clearPhoto($model);
        NewsCache::bump();

        return response()->json(['article' => $this->present($model->fresh())]);
    }

    public function index(Request $request): JsonResponse
    {
        $status = $request->query('status');

        $items = Article::query()
            ->when(in_array($status, Article::STATUSES, true), fn ($q) => $q->where('status', $status))
            ->orderBy('id')->limit(500)
            ->get(array_merge(['id', 'topic', 'slug', 'title', 'status', 'published_at', 'created_at', 'image_path'], $request->boolean('full') ? ['body', 'summary'] : []))
            ->map(fn (Article $a): array => ($request->boolean('full') ? ['body' => $a->body, 'summary' => $a->summary] : []) + [
                'id' => $a->id, 'topic' => $a->topic, 'slug' => $a->slug, 'title' => $a->title, 'status' => $a->status,
                'published_at' => $a->published_at?->toIso8601String(), 'created_at' => $a->created_at?->toIso8601String(),
                'has_photo' => (bool) $a->image_path,
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
        return \App\Services\NewsArticleCreator::publishProblem($topic);
    }

    private function uniqueSlug(string $seed): string
    {
        return \App\Services\NewsSlug::unique($seed);
    }

    /** Soft check: published bodies should have a key-points box and at least one "## " heading. */
    private static function formatWarnings(string $body): array
    {
        $w = [];

        if (! preg_match('/^## \S/m', $body)) {
            $w[] = 'Body has no "## " section heading.';
        }

        if (! preg_match('/^Poin penting\s*\R- /mi', $body)) {
            $w[] = 'Body has no "Poin penting" key-points box.';
        }

        return $w === [] ? [] : ['warnings' => $w];
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
            'image' => NewsImage::meta($article) + ['url' => NewsImage::absolute($article->id, 1200, ($article->image_updated_at ?? $article->updated_at)?->timestamp)],
        ];
    }
}
