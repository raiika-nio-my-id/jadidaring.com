<?php

namespace App\Services;

use Illuminate\Validation\ValidationException;

/**
 * Strict schema for the fixed, server-rendered member profile. Everything a member
 * can customise is data: unknown keys are dropped, colours/numbers/enums are
 * range-checked, URLs must be https without CSS/HTML-breaking characters, and the
 * parent page only ever receives whitelisted CSS variables built from this output.
 */
class ProfileConfig
{
    public const FONTS = ['Nunito', 'Baloo 2', 'Poppins', 'Inter', 'Lora', 'Playfair Display', 'Pacifico', 'Space Grotesk', 'Comic Neue', 'Press Start 2P'];

    public const WIDGETS = ['about', 'status', 'gallery', 'links', 'counter', 'music', 'friends', 'quote', 'youtube', 'custom_html'];

    public const PATTERNS = ['none', 'dots', 'grid', 'stripes'];

    public const BG_TYPES = ['color', 'gradient', 'image', 'pattern'];

    public const MAX_WIDGETS = 14;

    /** @return array<string, mixed> */
    public static function defaults(): array
    {
        return [
            'profile' => ['tagline' => '', 'status' => '', 'about' => '', 'avatar' => ''],
            'theme' => [
                'bg' => ['type' => 'gradient', 'color' => '#ede7ff', 'color2' => '#ffd9ec', 'angle' => 135, 'image' => '', 'pattern' => 'dots', 'fixed' => true, 'overlay' => 0],
                'colors' => ['text' => '#2b2440', 'accent' => '#7c5cff', 'card' => '#ffffff', 'link' => '#5a3fa0'],
                'font' => 'Nunito',
                'card' => ['radius' => 24, 'opacity' => 0.88, 'blur' => 8],
                'cursor' => ['url' => '', 'size' => 32],
            ],
            'music' => ['url' => '', 'title' => ''],
            'widgets' => [['type' => 'status'], ['type' => 'about'], ['type' => 'counter'], ['type' => 'links']],
        ];
    }

    /** Config for pages stored before the fixed profile existed: the old full page becomes a Custom HTML widget. */
    public static function legacy(): array
    {
        $c = self::defaults();
        $c['widgets'] = [['type' => 'counter'], ['type' => 'custom_html']];

        return $c;
    }

    /**
     * @param  array<string, mixed>  $in
     * @return array<string, mixed>
     */
    public static function validate(array $in, bool $hasHtml = false): array
    {
        $d = self::defaults();
        $p = is_array($in['profile'] ?? null) ? $in['profile'] : [];
        $t = is_array($in['theme'] ?? null) ? $in['theme'] : [];
        $bg = is_array($t['bg'] ?? null) ? $t['bg'] : [];
        $co = is_array($t['colors'] ?? null) ? $t['colors'] : [];
        $cd = is_array($t['card'] ?? null) ? $t['card'] : [];
        $cu = is_array($t['cursor'] ?? null) ? $t['cursor'] : [];
        $m = is_array($in['music'] ?? null) ? $in['music'] : [];

        $out = [
            'profile' => [
                'tagline' => self::text($p['tagline'] ?? '', 80),
                'status' => self::text($p['status'] ?? '', 140),
                'about' => self::text($p['about'] ?? '', 1200, true),
                'avatar' => self::url($p['avatar'] ?? ''),
            ],
            'theme' => [
                'bg' => [
                    'type' => self::enum($bg['type'] ?? null, self::BG_TYPES, $d['theme']['bg']['type']),
                    'color' => self::color($bg['color'] ?? null, $d['theme']['bg']['color']),
                    'color2' => self::color($bg['color2'] ?? null, $d['theme']['bg']['color2']),
                    'angle' => self::num($bg['angle'] ?? null, 0, 360, 135),
                    'image' => self::url($bg['image'] ?? ''),
                    'pattern' => self::enum($bg['pattern'] ?? null, self::PATTERNS, 'none'),
                    'fixed' => filter_var($bg['fixed'] ?? true, FILTER_VALIDATE_BOOLEAN),
                    'overlay' => self::num($bg['overlay'] ?? 0, 0, 0.8, 0),
                ],
                'colors' => [
                    'text' => self::color($co['text'] ?? null, $d['theme']['colors']['text']),
                    'accent' => self::color($co['accent'] ?? null, $d['theme']['colors']['accent']),
                    'card' => self::color($co['card'] ?? null, $d['theme']['colors']['card']),
                    'link' => self::color($co['link'] ?? null, $d['theme']['colors']['link']),
                ],
                'font' => self::enum($t['font'] ?? null, self::FONTS, 'Nunito'),
                'card' => [
                    'radius' => (int) self::num($cd['radius'] ?? null, 0, 40, 24),
                    'opacity' => self::num($cd['opacity'] ?? null, 0.3, 1, 0.88),
                    'blur' => (int) self::num($cd['blur'] ?? null, 0, 24, 8),
                ],
                'cursor' => ['url' => self::url($cu['url'] ?? ''), 'size' => (int) self::num($cu['size'] ?? null, 16, 48, 32)],
            ],
            'music' => ['url' => self::url($m['url'] ?? ''), 'title' => self::text($m['title'] ?? '', 80)],
            'widgets' => [],
        ];

        $seen = [];
        $widgets = is_array($in['widgets'] ?? null) ? $in['widgets'] : [];
        foreach ($widgets as $w) {
            if (! is_array($w) || ! is_string($w['type'] ?? null) || ! in_array($w['type'], self::WIDGETS, true)) {
                continue;
            }
            $type = $w['type'];
            if (isset($seen[$type]) && ! in_array($type, ['quote', 'youtube', 'links'], true)) {
                continue;
            }
            if ($type === 'custom_html' && ! $hasHtml) {
                continue;
            }
            $seen[$type] = ($seen[$type] ?? 0) + 1;
            if ($seen[$type] > 3 || count($out['widgets']) >= self::MAX_WIDGETS) {
                continue;
            }
            $out['widgets'][] = self::widget($type, $w);
        }

        return $out;
    }

    /** @param array<string, mixed> $w @return array<string, mixed> */
    private static function widget(string $type, array $w): array
    {
        $o = ['type' => $type];
        $title = self::text($w['title'] ?? '', 60);
        if ($title !== '') {
            $o['title'] = $title;
        }

        if ($type === 'gallery') {
            $o['items'] = [];
            foreach (array_slice(is_array($w['items'] ?? null) ? $w['items'] : [], 0, 12) as $it) {
                $u = self::url(is_array($it) ? ($it['url'] ?? '') : '');
                if ($u !== '') {
                    $o['items'][] = ['url' => $u, 'caption' => self::text(is_array($it) ? ($it['caption'] ?? '') : '', 80)];
                }
            }
        } elseif ($type === 'links') {
            $o['items'] = [];
            foreach (array_slice(is_array($w['items'] ?? null) ? $w['items'] : [], 0, 10) as $it) {
                $u = self::url(is_array($it) ? ($it['url'] ?? '') : '');
                $label = self::text(is_array($it) ? ($it['label'] ?? '') : '', 60);
                if ($u !== '' && $label !== '') {
                    $o['items'][] = ['label' => $label, 'url' => $u];
                }
            }
        } elseif ($type === 'friends') {
            $o['items'] = [];
            foreach (array_slice(is_array($w['items'] ?? null) ? $w['items'] : [], 0, 8) as $it) {
                $n = strtolower(trim((string) (is_array($it) ? ($it['username'] ?? '') : $it)));
                if (preg_match('/^[a-z0-9_]{3,20}$/', $n) === 1) {
                    $o['items'][] = ['username' => $n];
                }
            }
        } elseif ($type === 'quote') {
            $o['text'] = self::text($w['text'] ?? '', 300);
            $o['author'] = self::text($w['author'] ?? '', 60);
        } elseif ($type === 'youtube') {
            $id = self::youtubeId((string) ($w['id'] ?? $w['url'] ?? ''));
            $o['id'] = $id;
            if ($id === '') {
                $o['id'] = '';
            }
        }

        return $o;
    }

    public static function youtubeId(string $v): string
    {
        $v = trim($v);
        if (preg_match('/^[A-Za-z0-9_-]{11}$/', $v) === 1) {
            return $v;
        }
        if (preg_match('~^https://(?:www\.|m\.)?(?:youtube\.com/(?:watch\?(?:.*&)?v=|embed/|shorts/)|youtu\.be/)([A-Za-z0-9_-]{11})~', $v, $m) === 1) {
            return $m[1];
        }

        return '';
    }

    public static function text(mixed $v, int $max, bool $multiline = false): string
    {
        if (! is_scalar($v)) {
            return '';
        }
        $s = strip_tags((string) $v);
        $s = preg_replace($multiline ? '/[^\P{C}\n]+/u' : '/\p{C}+/u', ' ', $s) ?? '';
        if (! $multiline) {
            $s = preg_replace('/\s+/u', ' ', $s) ?? '';
        } else {
            $s = preg_replace("/\n{3,}/", "\n\n", $s) ?? '';
        }

        return mb_substr(trim($s), 0, $max);
    }

    /** https URL only; no characters that could escape an HTML attribute or a CSS url(). */
    public static function url(mixed $v): string
    {
        if (! is_string($v)) {
            return '';
        }
        $u = trim($v);
        if ($u === '' || strlen($u) > 500 || preg_match('{^https://[A-Za-z0-9.-]+(?::\d+)?(?:[/?#][A-Za-z0-9\-._~:/?#\[\]@!$&*+,;=%]*)?$}', $u) !== 1) {
            return '';
        }

        return $u;
    }

    private static function color(mixed $v, string $fallback): string
    {
        return is_string($v) && preg_match('/^#[0-9a-fA-F]{6}$/', $v) === 1 ? strtolower($v) : $fallback;
    }

    private static function num(mixed $v, float $min, float $max, float $fallback): float|int
    {
        if (! is_numeric($v)) {
            return $fallback;
        }

        return max($min, min($max, round((float) $v, 2)));
    }

    /** @param list<string> $allowed */
    private static function enum(mixed $v, array $allowed, string $fallback): string
    {
        return is_string($v) && in_array($v, $allowed, true) ? $v : $fallback;
    }

    /** Parse a JSON string from an AI into a validated config; throws a friendly validation error. */
    public static function fromJson(string $json, bool $hasHtml): array
    {
        $data = json_decode($json, true);
        if (! is_array($data)) {
            throw ValidationException::withMessages(['config' => 'JSON konfigurasi tidak valid.']);
        }

        return self::validate($data, $hasHtml);
    }

    /** @return array{vars: string, bg: string, font: string, cursor: string} inline-CSS strings built only from validated values */
    public static function css(array $c): array
    {
        $t = $c['theme'];
        $rgb = static function (string $hex): string {
            return hexdec(substr($hex, 1, 2)).','.hexdec(substr($hex, 3, 2)).','.hexdec(substr($hex, 5, 2));
        };
        $vars = sprintf(
            '--pf-text:%s;--pf-accent:%s;--pf-link:%s;--pf-card:rgba(%s,%s);--pf-radius:%dpx;--pf-blur:%dpx;--pf-font:\'%s\',system-ui,sans-serif;',
            $t['colors']['text'], $t['colors']['accent'], $t['colors']['link'], $rgb($t['colors']['card']), $t['card']['opacity'], $t['card']['radius'], $t['card']['blur'], $t['font']
        );

        $b = $t['bg'];
        $layers = [];
        if ($b['overlay'] > 0) {
            $layers[] = sprintf('linear-gradient(rgba(0,0,0,%s),rgba(0,0,0,%s))', $b['overlay'], $b['overlay']);
        }
        if ($b['pattern'] !== 'none' && in_array($b['type'], ['pattern', 'gradient', 'color'], true)) {
            $layers[] = match ($b['pattern']) {
                'dots' => 'radial-gradient(rgba(0,0,0,.14) 1.5px,transparent 1.5px) 0 0/22px 22px',
                'grid' => 'linear-gradient(rgba(0,0,0,.08) 1px,transparent 1px) 0 0/26px 26px,linear-gradient(90deg,rgba(0,0,0,.08) 1px,transparent 1px) 0 0/26px 26px',
                default => 'repeating-linear-gradient(45deg,rgba(0,0,0,.07) 0 8px,transparent 8px 18px)',
            };
        }
        if ($b['type'] === 'image' && $b['image'] !== '') {
            $layers[] = 'url("'.$b['image'].'") center/cover no-repeat';
            $layers[] = $b['color'];
        } elseif ($b['type'] === 'gradient') {
            $layers[] = sprintf('linear-gradient(%ddeg,%s,%s)', $b['angle'], $b['color'], $b['color2']);
        } else {
            $layers[] = $b['color'];
        }
        // A colour layer must be last; background shorthand with multiple layers.
        $bg = 'background:'.implode(',', $layers).';';

        $cursor = '';
        if ($t['cursor']['url'] !== '') {
            $cursor = 'cursor:url("'.$t['cursor']['url'].'") 0 0,auto;';
        }

        return ['vars' => $vars, 'bg' => $bg, 'font' => $t['font'], 'cursor' => $cursor];
    }
}
