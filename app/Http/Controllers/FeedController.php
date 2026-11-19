<?php

namespace App\Http\Controllers;

use App\Models\Article;
use App\Services\NewsCache;
use App\Services\NewsImage;
use App\Services\TenantPath;
use Illuminate\Http\Response;

class FeedController extends Controller
{
    public function rss(): Response
    {
        $host = 'https://'.TenantPath::host();
        $items = NewsCache::latest(null, 30);
        $last = $items === [] ? now() : \Illuminate\Support\Carbon::parse($items[0]['published_at']);

        $xml = '<?xml version="1.0" encoding="UTF-8"?>'."\n"
            .'<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel>'."\n"
            .'<title>Berita Jadidaring</title><link>'.$host.'/berita</link><description>Berita terkini Indonesia: politik, saham, gaming, teknologi, bencana dan kabar baik, minimal dua sumber per berita.</description>'
            .'<language>id-id</language><lastBuildDate>'.$last->toRfc2822String().'</lastBuildDate>'
            .'<atom:link href="'.$host.'/berita/rss.xml" rel="self" type="application/rss+xml"/>'."\n";

        foreach ($items as $a) {
            $url = $host.$a['url'];
            $img = NewsImage::absolute($a['id'], 1200, $a['img']['v']);
            $xml .= '<item><title>'.e($a['title']).'</title><link>'.e($url).'</link><guid isPermaLink="true">'.e($url).'</guid>'
                .'<pubDate>'.\Illuminate\Support\Carbon::parse($a['published_at'])->toRfc2822String().'</pubDate>'
                .'<category>'.e(ClayController::TOPICS[$a['topic']] ?? $a['topic']).'</category><dc:creator>Redaksi Jaring</dc:creator>'
                .'<description>'.e($a['summary']).'</description>'
                .'<enclosure url="'.e($img).'" length="0" type="image/webp"/><media:content url="'.e($img).'" medium="image" type="image/webp" width="1200" height="630"/></item>'."\n";
        }

        return response($xml.'</channel></rss>', 200, ['Content-Type' => 'application/rss+xml; charset=utf-8', 'Last-Modified' => $last->toRfc7231String()]);
    }

    public function newsSitemap(): Response
    {
        $host = 'https://'.TenantPath::host();
        $rows = Article::query()->visible()->where('published_at', '>=', now()->subDays(2))->orderByDesc('published_at')->limit(1000)
            ->get(['id', 'topic', 'slug', 'title', 'published_at']);

        $xml = '<?xml version="1.0" encoding="UTF-8"?>'."\n"
            .'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">'."\n";

        foreach ($rows as $a) {
            $xml .= '  <url><loc>'.e($host.$a->url()).'</loc><news:news><news:publication><news:name>Jadidaring</news:name><news:language>id</news:language></news:publication>'
                .'<news:publication_date>'.$a->published_at->toW3cString().'</news:publication_date><news:title>'.e($a->title).'</news:title></news:news></url>'."\n";
        }

        return response($xml.'</urlset>', 200, ['Content-Type' => 'application/xml; charset=utf-8']);
    }
}
