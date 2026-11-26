<?php

namespace App\Http\Controllers;

use App\Models\BedtimeStory;
use App\Services\BedtimeCache;
use App\Services\BedtimeImage;
use App\Services\TenantPath;
use App\Support\Infinite;
use Illuminate\Contracts\View\View;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Carbon;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class BedtimeStoryController extends Controller
{
    public function index(Request $request): View|Response
    {
        $page = Infinite::page($request);
        $total = BedtimeCache::total();
        $pages = max(1, (int) ceil($total / BedtimeCache::PER_PAGE));
        abort_if($page > $pages, 404);

        $stories = BedtimeCache::page($page);
        $inf = Infinite::data($request, 'bedtime', $page, $pages);

        if ($request->boolean('partial')) {
            return response()
                ->view('clay._inf-frag', ['kind' => 'bedtime', 'stories' => $stories, 'inf' => $inf])
                ->header('X-Robots-Tag', 'noindex');
        }

        $base = 'https://'.TenantPath::host();
        $canonical = $base.($page <= 1 ? '/bed-time-stories' : '/bed-time-stories?page='.$page);

        $collectionLd = [
            '@context' => 'https://schema.org',
            '@type' => 'CollectionPage',
            'name' => 'Bed Time Stories',
            'description' => 'Dongeng klasik pengantar tidur dari penulis aslinya, diceritakan ulang oleh Dongeng Anak Kecil.',
            'url' => $canonical,
            'mainEntity' => [
                '@type' => 'ItemList',
                'itemListElement' => array_map(function (array $s, int $i) use ($base): array {
                    return [
                        '@type' => 'ListItem',
                        'position' => $i + 1,
                        'name' => $s['title'],
                        'url' => $base.$s['url'],
                    ];
                }, $stories, array_keys($stories)),
            ],
        ];

        return view('clay.bedtime-index', [
            'inf' => $inf,
            'stories' => $stories,
            'pagination' => ['page' => $page, 'pages' => $pages, 'base' => '/bed-time-stories'],
            'relPrev' => $inf['prev'],
            'relNext' => $inf['next'],
            'metaTitle' => 'Bed Time Stories'.($page > 1 ? ' — Halaman '.$page : '').' — Jadidaring',
            'metaDescription' => 'Dongeng klasik pengantar tidur dari penulis aslinya, diceritakan ulang oleh Dongeng Anak Kecil di Jadidaring.',
            'canonicalUrl' => $canonical,
            'collectionLd' => $collectionLd,
        ]);
    }

    public function show(string $slug): View|Response
    {
        $story = BedtimeCache::find($slug);
        abort_if($story === null, 404);

        $pub = Carbon::parse($story['published_at']);
        abort_if($pub->isFuture(), 404);

        $base = 'https://'.TenantPath::host();
        $url = $base.'/bed-time-stories/'.$story['slug'];
        $wita = fn (?string $iso): ?string => $iso === null ? null : Carbon::parse($iso)->setTimezone('Asia/Makassar')->toIso8601String();

        $others = BedtimeStory::query()->visible()
            ->where('id', '!=', $story['id'])
            ->orderByDesc('published_at')
            ->limit(3)
            ->get()
            ->map(fn (BedtimeStory $s): array => [
                'id' => $s->id,
                'title' => $s->title,
                'author' => $s->author,
                'author_origin' => $s->author_origin,
                'summary' => $s->summary ?: BedtimeStory::deriveSummary((string) $s->body),
                'img' => BedtimeImage::meta($s),
                'url' => $s->url(),
            ])->all();

        $pubLocal = $pub->copy()->setTimezone((string) config('app.timezone'));

        $prev = BedtimeStory::query()->visible()
            ->where('published_at', '<', $pubLocal)
            ->orderByDesc('published_at')
            ->first();

        $next = BedtimeStory::query()->visible()
            ->where('published_at', '>', $pubLocal)
            ->orderBy('published_at')
            ->first();

        $jsonLd = [
            '@context' => 'https://schema.org',
            '@type' => 'CreativeWork',
            'headline' => $story['title'],
            'name' => $story['title'],
            'description' => $story['summary'],
            'inLanguage' => $story['language'] ?: 'en',
            'url' => $url,
            'mainEntityOfPage' => $url,
            'datePublished' => $wita($story['published_at']),
            'dateModified' => $wita($story['updated_at']),
            'isAccessibleForFree' => true,
            'author' => [
                '@type' => 'Person',
                'name' => $story['author'],
            ],
            'image' => [
                [
                    '@type' => 'ImageObject',
                    'url' => BedtimeImage::absolute($story['id'], 1200, $story['img']['v']),
                    'width' => 1200,
                    'height' => 630,
                ],
            ],
            'publisher' => NewsController::publisher(),
        ];

        if (! empty($story['adapter'])) {
            $jsonLd['creditText'] = 'Diceritakan ulang oleh '.$story['adapter'];
            $jsonLd['isBasedOn'] = $story['author'].(! empty($story['author_origin']) ? ' ('.$story['author_origin'].')' : '');
        }

        $breadcrumbLd = [
            '@context' => 'https://schema.org',
            '@type' => 'BreadcrumbList',
            'itemListElement' => [
                ['@type' => 'ListItem', 'position' => 1, 'name' => 'Beranda', 'item' => $base.'/'],
                ['@type' => 'ListItem', 'position' => 2, 'name' => 'Bed Time Stories', 'item' => $base.'/bed-time-stories'],
                ['@type' => 'ListItem', 'position' => 3, 'name' => $story['title']],
            ],
        ];

        return response()->view('clay.bedtime-show', [
            'story' => $story,
            'others' => $others,
            'prev' => $prev,
            'next' => $next,
            'publishedWita' => $wita($story['published_at']),
            'modifiedWita' => $wita($story['updated_at']),
            'metaTitle' => $story['title'].' — Bed Time Stories — Jadidaring',
            'metaDescription' => $story['summary'],
            'canonicalUrl' => $url,
            'ogType' => 'article',
            'ogImage' => BedtimeImage::absolute($story['id'], 1200, $story['img']['v']),
            'ogImageAlt' => $story['img']['alt'],
            'jsonLd' => $jsonLd,
            'breadcrumbLd' => $breadcrumbLd,
        ])->header('Last-Modified', Carbon::parse($story['updated_at'])->toRfc7231String());
    }

    public function image(Request $request, int $id, int $width): BinaryFileResponse
    {
        $story = BedtimeStory::query()->visible()->findOrFail($id);
        $file = BedtimeImage::file($story, $width);
        abort_if($file === null || ! is_file($file), 404);

        $response = new BinaryFileResponse($file, 200, [
            'Content-Type' => 'image/webp',
            'X-Content-Type-Options' => 'nosniff',
        ]);
        $response->setAutoEtag()->setAutoLastModified();
        $response->headers->set('Cache-Control', 'public, max-age=2592000, s-maxage=2592000, stale-while-revalidate=86400');
        $response->isNotModified($request);

        return $response;
    }
}
