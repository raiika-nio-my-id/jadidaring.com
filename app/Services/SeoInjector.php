<?php

namespace App\Services;

class SeoInjector
{
    /**
     * Inject SEO head tags (canonical, favicon links, optional og:image) into raw HTML.
     *
     * Only injects tags that are not already present so existing meta is never overwritten.
     * Inserts before </head>; if no </head> is found the HTML is returned unchanged.
     */
    public function inject(string $html, string $canonicalUrl, ?string $ogImageUrl = null): string
    {
        $tags = '';

        if (! $this->hasCanonical($html)) {
            $tags .= '<link rel="canonical" href="'.e($canonicalUrl).'">'."\n";
        }

        if (! $this->hasFaviconLink($html)) {
            $tags .= trim(view('partials.favicons')->render())."\n";
        }

        if ($ogImageUrl !== null && ! $this->hasOgImage($html)) {
            $tags .= '<meta property="og:image" content="'.e($ogImageUrl).'">'."\n";
            $tags .= '<meta property="og:image:width" content="1200">'."\n";
            $tags .= '<meta property="og:image:height" content="630">'."\n";
            $tags .= '<meta name="twitter:card" content="summary_large_image">'."\n";
            $tags .= '<meta name="twitter:image" content="'.e($ogImageUrl).'">'."\n";
        }

        if ($tags === '') {
            return $html;
        }

        $replaced = preg_replace('/<\/head>/i', $tags.'</head>', $html, 1, $count);

        if (is_string($replaced) && $count > 0) {
            return $replaced;
        }

        return $html;
    }

    /**
     * Game pages: canonical without trailing slash (matches the sitemap), html lang=id when it is
     * missing or en. Only the first <html> tag and the canonical link are touched.
     */
    public function normalizeGame(string $html): string
    {
        $html = preg_replace_callback('/(<link[^>]*rel=["\']canonical["\'][^>]*href=["\'])([^"\']*\/game\/[^"\'?#]*?)\/(["\'])/i', fn ($m) => $m[1].$m[2].$m[3], $html, 1) ?? $html;

        $html = preg_replace_callback('/<html\b([^>]*)>/i', function ($m) {
            $attrs = $m[1];

            if (preg_match('/\blang\s*=\s*["\']?([a-zA-Z-]+)["\']?/', $attrs)) {
                $attrs = preg_replace('/\blang\s*=\s*["\']?en(?:-[a-zA-Z]+)?["\']?/i', 'lang="id"', $attrs, 1);
            } else {
                $attrs .= ' lang="id"';
            }

            return '<html'.$attrs.'>';
        }, $html, 1) ?? $html;

        return $html;
    }

    private function hasCanonical(string $html): bool
    {
        return (bool) preg_match('/rel=["\']canonical["\']/', $html);
    }

    private function hasFaviconLink(string $html): bool
    {
        return (bool) preg_match('/rel=["\']icon["\']/', $html);
    }

    private function hasOgImage(string $html): bool
    {
        return (bool) preg_match('/property=["\']og:image["\']/', $html);
    }
}
