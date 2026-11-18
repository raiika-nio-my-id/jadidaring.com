<?php

namespace App\Http\Controllers;

use App\Models\Article;
use App\Models\ArticleComment;
use App\Services\NewsCache;
use App\Services\TenantPath;
use Illuminate\Contracts\View\View;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;

class NewsController extends Controller
{
    public function index(): View
    {
        return view('clay.berita-index', [
            'metaTitle' => 'Berita Terkini Hari Ini: Politik, Saham, Teknologi — Jadidaring',
            'metaDescription' => 'Berita terkini hari ini seputar politik, IHSG & harga emas, game, gempa dan bencana, teknologi, serta kabar baik Indonesia. Setiap berita minimal dua sumber.',
            'canonicalUrl' => 'https://'.TenantPath::host().'/berita',
            'topics' => ClayController::TOPICS,
            'articles' => NewsCache::latest(null, 24),
        ]);
    }

    public function topic(string $topik): View
    {
        $topik = strtolower(trim($topik));
        abort_unless(array_key_exists($topik, ClayController::TOPICS), 404);
        $name = ClayController::TOPICS[$topik];

        return view('clay.berita-topik', [
            'metaTitle' => 'Berita '.$name.' Terbaru Hari Ini — Jadidaring',
            'metaDescription' => 'Berita '.$name.' terbaru hari ini di Jadidaring, ditulis ringkas dengan minimal dua sumber yang bisa diperiksa.',
            'canonicalUrl' => 'https://'.TenantPath::host().'/berita/'.$topik,
            'currentTopic' => $topik,
            'topicName' => $name,
            'topics' => ClayController::TOPICS,
            'articles' => NewsCache::latest($topik, 24),
        ]);
    }

    public function show(string $topik, string $slug): View|RedirectResponse
    {
        $data = NewsCache::remember('article:'.$slug, function () use ($slug): ?array {
            $article = Article::query()->visible()->where('slug', $slug)->first();

            if (! $article instanceof Article) {
                return null;
            }

            return [
                'id' => $article->id, 'topic' => $article->topic, 'slug' => $article->slug, 'title' => $article->title,
                'summary' => $article->summary, 'image_url' => $article->image_url, 'sources' => $article->sources,
                'published_at' => $article->published_at?->toIso8601String(),
                'updated_at' => $article->updated_at?->toIso8601String(),
                'paragraphs' => array_values(array_filter(array_map('trim', preg_split('/\R{2,}/', (string) $article->body) ?: []))),
            ];
        });

        if ($data === null) {
            $redirect = \Illuminate\Support\Facades\DB::table('article_slug_redirects')->where('old_slug', $slug)->value('article_id');
            $target = $redirect ? Article::query()->visible()->find($redirect) : null;

            if ($target instanceof Article) {
                return redirect($target->url(), 301);
            }
        }

        abort_if($data === null || ! array_key_exists($data['topic'], ClayController::TOPICS), 404);

        if ($data['topic'] !== strtolower($topik)) {
            return redirect('/berita/'.$data['topic'].'/'.$data['slug'], 301);
        }

        $url = 'https://'.TenantPath::host().'/berita/'.$data['topic'].'/'.$data['slug'];

        return view('clay.berita-artikel', [
            'metaTitle' => $data['title'].' — Jadidaring',
            'metaDescription' => $data['summary'],
            'canonicalUrl' => $url,
            'ogType' => 'article',
            'ogImage' => $data['image_url'],
            'article' => $data,
            'topicName' => ClayController::TOPICS[$data['topic']],
            'jsonLd' => [
                '@context' => 'https://schema.org',
                '@type' => 'NewsArticle',
                'headline' => $data['title'],
                'description' => $data['summary'],
                'mainEntityOfPage' => $url,
                'datePublished' => $data['published_at'],
                'dateModified' => $data['updated_at'],
                'image' => $data['image_url'] ? [$data['image_url']] : [],
                'publisher' => ['@type' => 'Organization', 'name' => 'Jadidaring'],
                'citation' => array_map(fn (array $s): string => $s['url'], $data['sources']),
            ],
        ]);
    }

    public function comments(string $topik, string $slug): JsonResponse
    {
        $article = $this->articleFor($slug);

        $comments = ArticleComment::query()
            ->with('user:id,username,name')
            ->where('article_id', $article->id)->where('is_hidden', false)
            ->orderByDesc('id')->limit(50)->get()
            ->map(fn (ArticleComment $c): array => [
                'id' => $c->id,
                'user' => $c->user?->username ?? $c->user?->name ?? 'anon',
                'body' => $c->body,
                'at' => $c->created_at?->toIso8601String(),
            ]);

        return response()->json(['comments' => $comments])->header('Cache-Control', 'no-store');
    }

    public function postComment(Request $request, string $topik, string $slug): JsonResponse
    {
        $article = $this->articleFor($slug);
        $user = $request->user();

        $key = 'comment:'.$user->id;

        if (RateLimiter::tooManyAttempts($key, 5)) {
            return response()->json(['message' => 'Terlalu cepat. Coba lagi sebentar lagi.'], 429);
        }

        $data = $request->validate(['body' => ['required', 'string', 'min:2', 'max:1000']]);
        $body = trim(strip_tags($data['body']));

        if ($body === '' || preg_match_all('#https?://|www\.#i', $body) > 2) {
            return response()->json(['message' => 'Komentar tidak valid (maksimal 2 tautan).'], 422);
        }

        RateLimiter::hit($key, 60);

        $comment = ArticleComment::query()->create(['article_id' => $article->id, 'user_id' => $user->id, 'body' => Str::limit($body, 1000, '')]);

        return response()->json(['comment' => [
            'id' => $comment->id, 'user' => $user->username ?? $user->name, 'body' => $comment->body, 'at' => $comment->created_at?->toIso8601String(),
        ]], 201);
    }

    private function articleFor(string $slug): Article
    {
        return Article::query()->visible()->where('slug', $slug)->firstOrFail();
    }
}
