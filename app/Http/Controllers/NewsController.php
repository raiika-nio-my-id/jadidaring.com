<?php

namespace App\Http\Controllers;

use App\Models\Article;
use App\Models\ArticleComment;
use App\Services\NewsCache;
use App\Services\NewsImage;
use App\Services\TenantPath;
use App\Support\BadWords;
use Illuminate\Contracts\View\View;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;

class NewsController extends Controller
{
    public function index(Request $request): View
    {
        $q = trim(mb_substr((string) $request->query('q', ''), 0, 80));
        $noindex = false;
        $pg = $q === '' ? self::pageData($request, null) : ['page' => 1, 'pages' => 1];
        $articles = $q === '' ? NewsCache::page(null, $pg['page']) : [];

        if ($q !== '') {
            $like = '%'.addcslashes($q, '%_\\').'%';
            $articles = Article::query()->visible()
                ->where(fn ($w) => $w->where('title', 'like', $like)->orWhere('summary', 'like', $like))
                ->orderByDesc('published_at')->limit(24)
                ->get(['id', 'topic', 'slug', 'title', 'summary', 'image_path', 'image_alt', 'image_credit', 'image_source_url', 'image_license', 'image_updated_at', 'published_at', 'updated_at'])
                ->map(fn (Article $a): array => ['id' => $a->id, 'topic' => $a->topic, 'slug' => $a->slug, 'title' => $a->title, 'summary' => $a->summary,
                    'img' => NewsImage::meta($a), 'published_at' => $a->published_at?->toIso8601String(), 'url' => $a->url()])->all();
            $noindex = true;
        }

        return view('clay.berita-index', [
            'q' => $q,
            'noindex' => $noindex,
            'pagination' => $q === '' ? $pg + ['base' => '/berita'] : null,
            'relPrev' => $q === '' ? self::pageUrl('/berita', $pg['page'] - 1, $pg['page'] > 1) : null,
            'relNext' => $q === '' ? self::pageUrl('/berita', $pg['page'] + 1, $pg['page'] < $pg['pages']) : null,
            'metaTitle' => 'Berita Terkini Hari Ini: Politik, Saham, Teknologi'.($pg['page'] > 1 ? ' — Halaman '.$pg['page'] : '').' — Jadidaring',
            'metaDescription' => 'Berita terkini hari ini seputar politik, IHSG & harga emas, game, gempa dan bencana, teknologi, serta kabar baik Indonesia. Setiap berita minimal dua sumber.',
            'canonicalUrl' => 'https://'.TenantPath::host().self::pageUrl('/berita', $pg['page']),
            'topics' => ClayController::TOPICS,
            'articles' => $articles,
        ]);
    }

    /** @return array{page: int, pages: int} */
    private static function pageData(Request $request, ?string $topic): array
    {
        $raw = $request->query('page', '1');
        abort_unless(is_string($raw) && ctype_digit($raw) && (int) $raw >= 1, 404);
        $page = (int) $raw;
        $pages = max(1, (int) ceil(NewsCache::total($topic) / NewsCache::PER_PAGE));
        abort_if($page > $pages, 404);

        return ['page' => $page, 'pages' => $pages];
    }

    private static function pageUrl(string $base, int $page, bool $show = true): ?string
    {
        if (! $show) {
            return null;
        }

        return $page <= 1 ? $base : $base.'?page='.$page;
    }

    public function topic(Request $request, string $topik): View
    {
        $topik = strtolower(trim($topik));
        abort_unless(array_key_exists($topik, ClayController::TOPICS), 404);
        $name = ClayController::TOPICS[$topik];
        $base = '/berita/'.$topik;
        $pg = self::pageData($request, $topik);

        return view('clay.berita-topik', [
            'pagination' => $pg + ['base' => $base],
            'relPrev' => self::pageUrl($base, $pg['page'] - 1, $pg['page'] > 1),
            'relNext' => self::pageUrl($base, $pg['page'] + 1, $pg['page'] < $pg['pages']),
            'metaTitle' => 'Berita '.$name.' Terbaru Hari Ini'.($pg['page'] > 1 ? ' — Halaman '.$pg['page'] : '').' — Jadidaring',
            'metaDescription' => 'Berita '.$name.' terbaru hari ini di Jadidaring, ditulis ringkas dengan minimal dua sumber yang bisa diperiksa.',
            'canonicalUrl' => 'https://'.TenantPath::host().self::pageUrl($base, $pg['page']),
            'currentTopic' => $topik,
            'topicName' => $name,
            'topics' => ClayController::TOPICS,
            'articles' => NewsCache::page($topik, $pg['page']),
        ]);
    }

    public function show(string $topik, string $slug): View|RedirectResponse|Response
    {
        $data = NewsCache::remember('article:'.$slug, function () use ($slug): ?array {
            $article = Article::query()->visible()->where('slug', $slug)->first();

            if (! $article instanceof Article) {
                return null;
            }

            return [
                'id' => $article->id, 'topic' => $article->topic, 'slug' => $article->slug, 'title' => $article->title,
                'summary' => $article->summary, 'img' => NewsImage::meta($article), 'sources' => $article->sources,
                'published_at' => $article->published_at?->toIso8601String(),
                'updated_at' => $article->updated_at?->toIso8601String(),
                'paragraphs' => self::paragraphs((string) $article->body),
            ];
        });

        if ($data === null) {
            $redirect = DB::table('article_slug_redirects')->where('old_slug', $slug)->value('article_id');
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

        return response()->view('clay.berita-artikel', [
            'metaTitle' => $data['title'].' — Jadidaring',
            'metaDescription' => $data['summary'],
            'canonicalUrl' => $url,
            'ogType' => 'article',
            'ogImage' => NewsImage::absolute($data['id'], 1200, $data['img']['v']),
            'ogImageAlt' => $data['img']['alt'],
            'lastModified' => $data['updated_at'],
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
                'image' => [NewsImage::absolute($data['id'], 1200, $data['img']['v'])],
                'articleSection' => ClayController::TOPICS[$data['topic']],
                'inLanguage' => 'id-ID',
                'author' => ['@type' => 'Organization', 'name' => 'Redaksi Jaring', 'url' => 'https://'.TenantPath::host().'/tentang'],
                'publisher' => self::publisher(),
                'citation' => array_map(fn (array $s): string => $s['url'], $data['sources']),
            ],
        ])->header('Last-Modified', Carbon::parse($data['updated_at'])->toRfc7231String());
    }

    /** @return array<string, mixed> */
    public static function publisher(): array
    {
        return ['@type' => 'Organization', 'name' => 'Jadidaring', 'url' => 'https://'.TenantPath::host().'/',
            'logo' => ['@type' => 'ImageObject', 'url' => 'https://'.TenantPath::host().'/marketing/images/logo-512.png', 'width' => 512, 'height' => 512]];
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

        $comment = ArticleComment::query()->create(['article_id' => $article->id, 'user_id' => $user->id, 'body' => BadWords::clean(Str::limit($body, 1000, ''))]);

        return response()->json(['comment' => [
            'id' => $comment->id, 'user' => $user->username ?? $user->name, 'body' => $comment->body, 'at' => $comment->created_at?->toIso8601String(),
        ]], 201);
    }

    private function articleFor(string $slug): Article
    {
        return Article::query()->visible()->where('slug', $slug)->firstOrFail();
    }

    /** @return list<string> */
    private static function paragraphs(string $body): array
    {
        $parts = array_values(array_filter(array_map('trim', preg_split('/\\R{2,}/', $body) ?: [])));

        // Bodies written with single line breaks still get one paragraph per line.
        if (count($parts) <= 1) {
            $parts = array_values(array_filter(array_map('trim', preg_split('/\\R/', $body) ?: [])));
        }

        return $parts;
    }
}
