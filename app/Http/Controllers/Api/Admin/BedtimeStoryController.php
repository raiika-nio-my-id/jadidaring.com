<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\BedtimeStory;
use App\Services\BedtimeCache;
use App\Services\BedtimeImage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * Secret-authenticated admin API for Bed Time Stories (X-Admin-Api-Key).
 */
class BedtimeStoryController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $status = $request->query('status');
        $q = trim((string) $request->query('q', ''));
        $perPage = min(100, max(1, $request->integer('per_page', 20)));

        $paginator = BedtimeStory::query()
            ->when($status !== null && in_array($status, BedtimeStory::STATUSES, true), fn ($w) => $w->where('status', $status))
            ->when($q !== '', fn ($w) => $w->where(fn ($x) => $x->where('title', 'like', '%'.$q.'%')->orWhere('slug', 'like', '%'.$q.'%')->orWhere('author', 'like', '%'.$q.'%')))
            ->orderByDesc('id')
            ->paginate($perPage);

        return response()->json([
            'stories' => $paginator->getCollection()->map(fn (BedtimeStory $s): array => $this->present($s))->all(),
            'total' => $paginator->total(),
            'current_page' => $paginator->currentPage(),
            'last_page' => $paginator->lastPage(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'min:3', 'max:160'],
            'slug' => ['nullable', 'string', 'max:160', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/'],
            'author' => ['required', 'string', 'min:2', 'max:120'],
            'author_origin' => ['nullable', 'string', 'max:120'],
            'adapter' => ['nullable', 'string', 'max:120'],
            'language' => ['nullable', 'string', 'max:5'],
            'summary' => ['nullable', 'string', 'max:300'],
            'body' => ['required', 'string', 'max:20000'],
            'moral' => ['nullable', 'string', 'max:2000'],
            'status' => ['nullable', Rule::in(BedtimeStory::STATUSES)],
            'published_at' => ['nullable', 'date'],
            'image_url' => ['nullable', 'url:https', 'max:500'],
            'image_credit' => ['nullable', 'string', 'max:200'],
            'image_alt' => ['nullable', 'string', 'max:200'],
            'image_license' => ['nullable', 'string', 'max:100'],
            'image_source_url' => ['nullable', 'url:https', 'max:500'],
        ]);

        if (strip_tags($data['body']) !== $data['body']) {
            return response()->json(['message' => 'HTML tags are not allowed in body.'], 422);
        }

        if (! empty($data['image_url']) && empty($data['image_credit'])) {
            return response()->json([
                'message' => 'Image credit is required when image_url is provided.',
                'errors' => ['image_credit' => ['Required with image_url.']],
            ], 422);
        }

        $slug = ! empty($data['slug']) ? $data['slug'] : Str::slug($data['title']);

        // IDEMPOTENT on slug: return 200 with existing story if already exists
        $existing = BedtimeStory::query()->where('slug', $slug)->first();

        if ($existing instanceof BedtimeStory) {
            return response()->json([
                'story' => $this->present($existing),
                'existing' => true,
            ], 200);
        }

        $status = $data['status'] ?? 'published';
        $publishedAt = $status === 'published' ? ($data['published_at'] ?? now()) : null;
        $adapter = ! empty($data['adapter']) ? $data['adapter'] : 'Dongeng Anak Kecil';
        $language = ! empty($data['language']) ? $data['language'] : 'en';

        $story = BedtimeStory::query()->create([
            'title' => $data['title'],
            'slug' => $slug,
            'author' => $data['author'],
            'author_origin' => $data['author_origin'] ?? null,
            'adapter' => $adapter,
            'language' => $language,
            'summary' => $data['summary'] ?? null,
            'body' => $data['body'],
            'moral' => $data['moral'] ?? null,
            'status' => $status,
            'published_at' => $publishedAt,
        ]);

        $extra = [];

        if (! empty($data['image_url'])) {
            try {
                $binary = BedtimeImage::download($data['image_url']);
                BedtimeImage::storePhoto($story, $binary, [
                    'alt' => $data['image_alt'] ?? $story->title,
                    'credit' => (string) $data['image_credit'],
                    'source_url' => $data['image_source_url'] ?? $data['image_url'],
                    'license' => $data['image_license'] ?? null,
                ]);
            } catch (\InvalidArgumentException $e) {
                $extra['image_error'] = $e->getMessage();
            }
        }

        BedtimeCache::bump();

        return response()->json([
            'story' => $this->present($story->fresh()),
            'existing' => false,
        ] + $extra, 201);
    }

    public function update(Request $request, int $bedtimeStory): JsonResponse
    {
        $story = BedtimeStory::query()->find($bedtimeStory);

        if (! $story instanceof BedtimeStory) {
            return response()->json(['message' => 'Story not found.'], 404);
        }

        $data = $request->validate([
            'title' => ['sometimes', 'string', 'min:3', 'max:160'],
            'slug' => ['sometimes', 'string', 'max:160', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/', 'unique:bedtime_stories,slug,'.$story->id],
            'author' => ['sometimes', 'string', 'min:2', 'max:120'],
            'author_origin' => ['sometimes', 'nullable', 'string', 'max:120'],
            'adapter' => ['sometimes', 'nullable', 'string', 'max:120'],
            'language' => ['sometimes', 'string', 'max:5'],
            'summary' => ['sometimes', 'nullable', 'string', 'max:300'],
            'body' => ['sometimes', 'string', 'max:20000'],
            'moral' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'status' => ['sometimes', Rule::in(BedtimeStory::STATUSES)],
            'published_at' => ['sometimes', 'nullable', 'date'],
            'image_url' => ['sometimes', 'nullable', 'url:https', 'max:500'],
            'image_credit' => ['sometimes', 'nullable', 'string', 'max:200'],
            'image_alt' => ['sometimes', 'nullable', 'string', 'max:200'],
            'image_license' => ['sometimes', 'nullable', 'string', 'max:100'],
            'image_source_url' => ['sometimes', 'nullable', 'url:https', 'max:500'],
        ]);

        if (isset($data['body']) && strip_tags($data['body']) !== $data['body']) {
            return response()->json(['message' => 'HTML tags are not allowed in body.'], 422);
        }

        if (! empty($data['image_url']) && empty($data['image_credit']) && empty($story->image_credit)) {
            return response()->json([
                'message' => 'Image credit is required when image_url is provided.',
                'errors' => ['image_credit' => ['Required with image_url.']],
            ], 422);
        }

        if (($data['status'] ?? null) === 'published' && $story->status !== 'published') {
            $story->published_at ??= now();
        }

        $story->fill($data)->save();

        if (! empty($data['image_url'])) {
            try {
                $binary = BedtimeImage::download($data['image_url']);
                BedtimeImage::storePhoto($story, $binary, [
                    'alt' => $data['image_alt'] ?? $story->title,
                    'credit' => (string) ($data['image_credit'] ?? $story->image_credit),
                    'source_url' => $data['image_source_url'] ?? $data['image_url'],
                    'license' => $data['image_license'] ?? $story->image_license,
                ]);
            } catch (\InvalidArgumentException $e) {
                // Ignore download error on update
            }
        }

        BedtimeCache::bump();

        return response()->json(['story' => $this->present($story->fresh())]);
    }

    public function destroy(int $bedtimeStory): JsonResponse
    {
        $story = BedtimeStory::query()->find($bedtimeStory);

        if (! $story instanceof BedtimeStory) {
            return response()->json(['message' => 'Story not found.'], 404);
        }

        BedtimeImage::clearPhoto($story);
        $story->delete();
        BedtimeCache::bump();

        return response()->json(['deleted' => true]);
    }

    /**
     * @return array<string, mixed>
     */
    private function present(BedtimeStory $s): array
    {
        return [
            'id' => $s->id,
            'title' => $s->title,
            'slug' => $s->slug,
            'author' => $s->author,
            'author_origin' => $s->author_origin,
            'adapter' => $s->adapter,
            'language' => $s->language,
            'summary' => $s->summary ?: BedtimeStory::deriveSummary((string) $s->body),
            'body' => $s->body,
            'moral' => $s->moral,
            'status' => $s->status,
            'published_at' => $s->published_at?->toIso8601String(),
            'image_path' => $s->image_path,
            'image_credit' => $s->image_credit,
            'url' => $s->url(),
            'created_at' => $s->created_at?->toIso8601String(),
            'updated_at' => $s->updated_at?->toIso8601String(),
        ];
    }
}
