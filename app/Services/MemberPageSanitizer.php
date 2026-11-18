<?php

namespace App\Services;

use Dom\Element;
use Dom\HTMLDocument;
use Illuminate\Validation\ValidationException;

/**
 * Defence-in-depth cleaner for member-supplied pages. The real isolation is the
 * sandboxed iframe + CSP on the response; this removes what should never ship.
 * Member HTML is always treated as hostile.
 */
class MemberPageSanitizer
{
    public const MAX_BYTES = 307200; // 300 KB

    private const DROP_TAGS = ['iframe', 'frame', 'frameset', 'object', 'embed', 'applet', 'base', 'portal', 'dialog'];

    /** Hosts allowed for external stylesheets, fonts and scripts (also used by the content CSP). */
    public const CDN_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net', 'cdnjs.cloudflare.com', 'unpkg.com', 'cdn.tailwindcss.com'];

    public static function cdnAllowed(string $url): bool
    {
        $u = trim($url);
        if (! str_starts_with(strtolower($u), 'https://')) {
            return false;
        }
        $parts = parse_url($u);

        return is_array($parts) && ! isset($parts['user']) && isset($parts['host']) && in_array(strtolower($parts['host']), self::CDN_HOSTS, true);
    }

    private const URL_ATTRS = ['href', 'src', 'action', 'formaction', 'poster', 'data', 'xlink:href', 'background', 'ping', 'cite'];

    private const CRED_NAME = '/pass(word|wd)?|sandi|otp|cvv|cvc|kartu|card|\bpin\b|ssn|token|secret/i';

    /** @return string sanitized full HTML document */
    public static function clean(string $raw): string
    {
        $raw = trim($raw);
        $raw = preg_replace('/^```[a-z]*\s*\R/i', '', $raw) ?? $raw;
        $raw = preg_replace('/\R```\s*$/', '', $raw) ?? $raw;

        if ($raw === '' || ! preg_match('/<\s*(html|body|div|section|main|h1|p)\b/i', $raw)) {
            throw ValidationException::withMessages(['html' => 'Isi HTML tidak ditemukan. Tempel seluruh kode HTML hasil AI.']);
        }

        if (strlen($raw) > self::MAX_BYTES) {
            throw ValidationException::withMessages(['html' => 'Ukuran HTML maksimal 300 KB.']);
        }

        $doc = HTMLDocument::createFromString($raw, LIBXML_NOERROR);

        // Reject, not silently fix, anything that looks like credential harvesting.
        foreach ($doc->querySelectorAll('input, textarea') as $field) {
            /** @var Element $field */
            $type = strtolower((string) $field->getAttribute('type'));
            $ident = ($field->getAttribute('name') ?? '').' '.($field->getAttribute('id') ?? '').' '.($field->getAttribute('autocomplete') ?? '').' '.($field->getAttribute('placeholder') ?? '');

            if ($type === 'password' || $type === 'file' || preg_match(self::CRED_NAME, $ident) === 1) {
                throw ValidationException::withMessages(['html' => 'Halaman tidak boleh berisi kolom password, kartu, PIN/OTP, atau unggah file.']);
            }
        }

        foreach (self::DROP_TAGS as $tag) {
            foreach (iterator_to_array($doc->querySelectorAll($tag)) as $el) {
                $el->remove();
            }
        }

        foreach (iterator_to_array($doc->querySelectorAll('link')) as $el) {
            $rel = strtolower(trim((string) $el->getAttribute('rel')));
            $href = (string) $el->getAttribute('href');
            $okRel = in_array($rel, ['stylesheet', 'preconnect', 'dns-prefetch'], true);

            if (! $okRel || ! self::cdnAllowed($href)) {
                $el->remove();
            }
        }

        foreach (iterator_to_array($doc->querySelectorAll('script')) as $el) {
            if ($el->hasAttribute('href') || $el->hasAttribute('xlink:href')) {
                $el->remove();
            } elseif ($el->hasAttribute('src') && ! self::cdnAllowed((string) $el->getAttribute('src'))) {
                $el->remove();
            }
        }

        foreach (iterator_to_array($doc->querySelectorAll('meta')) as $el) {
            $he = strtolower((string) $el->getAttribute('http-equiv'));
            if ($he !== '' || $el->hasAttribute('content') && preg_match('/url\s*=/i', (string) $el->getAttribute('content')) === 1) {
                $el->remove();
            }
        }

        foreach (iterator_to_array($doc->querySelectorAll('style')) as $el) {
            $el->textContent = self::css($el->textContent);
        }

        foreach ($doc->querySelectorAll('*') as $el) {
            /** @var Element $el */
            foreach (iterator_to_array($el->attributes) as $attr) {
                $name = strtolower($attr->nodeName);
                $value = (string) $attr->nodeValue;

                if ($name === 'autoplay' || $name === 'srcset' || $name === 'srcdoc' || $name === 'is' || $name === 'nonce') {
                    $el->removeAttribute($attr->nodeName);
                } elseif ($name === 'style') {
                    $el->setAttribute('style', self::css($value));
                } elseif (in_array($name, self::URL_ATTRS, true)) {
                    $safe = self::url($value, $el->localName, $name);
                    $safe === null ? $el->removeAttribute($attr->nodeName) : $el->setAttribute($attr->nodeName, $safe);
                }
            }

            if (strtolower($el->localName) === 'form') {
                $el->removeAttribute('action');
                $el->removeAttribute('method');
                $el->removeAttribute('target');
            }

            if (strtolower($el->localName) === 'a' && $el->hasAttribute('href') && ! str_starts_with((string) $el->getAttribute('href'), '#')) {
                $el->setAttribute('target', '_blank');
                $el->setAttribute('rel', 'noopener noreferrer nofollow ugc');
            }
        }

        $head = $doc->querySelector('head');
        if ($head instanceof Element) {
            $robots = $doc->createElement('meta');
            $robots->setAttribute('name', 'robots');
            $robots->setAttribute('content', 'noindex,nofollow');
            $head->appendChild($robots);
        }

        $html = $doc->saveHtml();

        if (strlen($html) > self::MAX_BYTES + 4096) {
            throw ValidationException::withMessages(['html' => 'Ukuran HTML maksimal 300 KB.']);
        }

        return $html;
    }

    /** Only https:, mailto:, tel: and in-page anchors survive. data: only for small raster images. */
    private static function url(string $value, string $tag, string $attr): ?string
    {
        $v = trim($value);
        $probe = strtolower(preg_replace('/[\x00-\x20]+/', '', $v) ?? '');

        if ($probe === '' || str_starts_with($probe, '#')) {
            return $probe === '' ? null : $v;
        }

        if (str_starts_with($probe, 'https://')) {
            return $v;
        }

        if (in_array($attr, ['href'], true) && (str_starts_with($probe, 'mailto:') || str_starts_with($probe, 'tel:'))) {
            return $v;
        }

        if (str_starts_with($probe, 'data:image/png;') || str_starts_with($probe, 'data:image/jpeg;') || str_starts_with($probe, 'data:image/gif;') || str_starts_with($probe, 'data:image/webp;')) {
            return in_array($attr, ['src', 'poster'], true) && strlen($v) < 120000 ? $v : null;
        }

        return null;
    }

    /** Strip @import, expression(), behaviors and non-https url(). */
    public static function css(string $css): string
    {
        $css = preg_replace_callback('/@import\s+(?:url\(\s*)?([\'"]?)([^\'")\s;]+)\1\s*\)?[^;]*;?/i', static fn (array $m): string => self::cdnAllowed($m[2]) ? $m[0] : '', $css) ?? $css;
        $css = preg_replace('/expression\s*\(|(?<![\w-])behaviou?r\s*:|-moz-binding\s*:|javascript\s*:/i', 'x-blocked(', $css) ?? $css;

        return preg_replace_callback('/url\(\s*([\'"]?)(.*?)\1\s*\)/is', static function (array $m): string {
            $u = strtolower(preg_replace('/[\x00-\x20]+/', '', $m[2]) ?? '');
            $ok = str_starts_with($u, 'https://') || preg_match('#^data:image/(png|jpeg|gif|webp);#', $u) === 1 || str_starts_with($u, '#');

            return $ok ? $m[0] : 'none';
        }, $css) ?? $css;
    }
}
