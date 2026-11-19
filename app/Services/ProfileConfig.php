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

    public const WIDGETS = ['about', 'status', 'gallery', 'links', 'counter', 'music', 'friends', 'quote', 'youtube', 'spotify', 'custom_html'];

    public const PATTERNS = ['none', 'dots', 'grid', 'stripes', 'checker', 'polka', 'diagonal', 'zigzag', 'waves', 'diamonds', 'plaid', 'hearts', 'stars', 'confetti'];

    public const INKS = ['dark', 'light'];

    /** Widget widths in percent of the widget area; 'auto' keeps the original behaviour (wide types full, others half). */
    public const WIDTHS = ['auto', '20', '25', '33', '50', '66', '75', '100'];

    public const JUSTIFY = ['start', 'center', 'end', 'between', 'evenly', 'around'];

    public const ALIGN = ['top', 'center', 'bottom', 'stretch'];

    public const GAPS = ['tight', 'normal', 'loose'];

    public const WIDE_TYPES = ['gallery', 'youtube', 'spotify', 'custom_html'];

    /** id => [label, hotspot x, hotspot y] at 32px; PNGs live in public/kursor/{id}-{24|32|48}.png (drawn in-house). */
    public const CURSORS = [
        'panah' => ['Panah ungu', 2, 1], 'neon' => ['Panah neon', 3, 2], 'pixel' => ['Piksel 8-bit', 2, 2],
        'hati' => ['Hati', 16, 16], 'bintang' => ['Bintang', 16, 16], 'cakar' => ['Cakar kucing', 16, 16],
        'sakura' => ['Sakura', 16, 16], 'pedang' => ['Pedang', 2, 2], 'daun' => ['Daun', 3, 3],
    ];

    /**
     * "Preset gaya": surface style tokens (see public/css/clay.css [data-pfst]). id => [label, hint, forced palette?, heading font, body font].
     * 'bawaan' is the current look. Forced-palette styles bring their own surface and text colours so they stay readable.
     */
    public const STYLES = [
        'bawaan' => ['Bawaan', 'Tampilan standar profilmu.', false, null, null],
        'clay' => ['Claymorphism', 'Gembung lembut seperti tanah liat.', false, 'Baloo 2', null],
        'glass' => ['Glassbox', 'Kaca buram dengan tepi bercahaya.', false, null, null],
        'flat' => ['Flat UI', 'Datar, bersih, tanpa bayangan.', false, 'Poppins', null],
        'cartoon' => ['Cartoon', 'Garis tebal dan bayangan ala kartun.', false, 'Baloo 2', 'Comic Neue'],
        'neubrutal' => ['Neubrutalism', 'Border hitam tebal, bayangan keras.', false, 'Space Grotesk', null],
        'neumorph' => ['Neumorphism', 'Timbul tenggelam lembut (soft UI).', false, null, null],
        'bento' => ['Bento', 'Kotak rapi bergaris tipis ala bento.', false, 'Inter', null],
        'aurora' => ['Aurora', 'Gradasi mengalir bak aurora.', false, 'Poppins', null],
        'y2k' => ['Y2K Chrome', 'Krom mengilap awal 2000-an.', true, 'Space Grotesk', null],
        'pixel' => ['Pixel 8-bit', 'Piksel tegas ala game retro.', false, 'Press Start 2P', null],
        'mono' => ['Minimal Mono', 'Garis tipis, huruf monospace.', false, null, null],
        'neon' => ['Neon Siber', 'Gelap dengan garis neon menyala.', true, 'Space Grotesk', null],
        'skeuo' => ['Skeuomorphic', 'Tombol dan panel terasa nyata.', false, null, null],
        'paper' => ['Kertas Coret', 'Garis tangan ala buku catatan.', false, 'Pacifico', null],
        'kawaii' => ['Pastel Kawaii', 'Manis, bulat, dan ceria.', false, 'Baloo 2', null],
        'liquid' => ['Liquid Glass', 'Kaca cair ala Apple.', false, null, null],
        'editorial' => ['Editorial', 'Tata letak majalah, huruf serif.', false, 'Playfair Display', 'Lora'],
        'terminal' => ['Terminal', 'Layar hitam-hijau monospace.', true, null, null],
        'vapor' => ['Vaporwave', 'Pink-biru senja ala 80-an.', true, 'Space Grotesk', null],
        'earthy' => ['Organik Earthy', 'Bentuk organik, warna tanah.', false, 'Lora', null],
    ];

    public const BG_TYPES = ['color', 'gradient', 'image', 'pattern'];

    public const MAX_WIDGETS = 14;

    /**
     * Widgets members can add from "+ Tambah kotak". The profile header and the comment wall are fixed (always
     * present, never in this list); custom_html is the one custom widget.
     *
     * @return list<array{type: string, label: string, hint: string, icon: string, kind: string, multi: bool}>
     */
    public static function catalog(): array
    {
        $multi = ['quote', 'youtube', 'spotify', 'links'];
        $rows = [
            ['about', 'Tentang aku', 'Cerita singkat tentang dirimu.', '📝', 'predefined'],
            ['status', 'Status', 'Kabar atau mood hari ini.', '💬', 'predefined'],
            ['counter', 'Penghitung pengunjung', 'Angka pengunjung unik gaya retro.', '🔢', 'predefined'],
            ['gallery', 'Galeri', 'Sampai 12 foto dengan keterangan.', '🖼️', 'predefined'],
            ['links', 'Tautan', 'Daftar link ke sosmed atau karyamu.', '🔗', 'predefined'],
            ['spotify', 'Spotify', 'Tempel link lagu, album, atau playlist.', '🎧', 'predefined'],
            ['youtube', 'YouTube', 'Tempel link video YouTube.', '▶️', 'predefined'],
            ['music', 'Musik', 'Pemutar lagu dari link mp3. Tidak autoplay.', '🎵', 'predefined'],
            ['quote', 'Kutipan', 'Kalimat favorit dan penulisnya.', '❝', 'predefined'],
            ['friends', 'Teman', 'Sampai 8 teman favoritmu di Jadidaring.', '👯', 'predefined'],
            ['custom_html', 'HTML kustom', 'Untuk yang jago: HTML/CSS/JS sendiri di kotak terisolasi.', '🧩', 'custom'],
        ];

        return array_map(fn (array $r): array => ['type' => $r[0], 'label' => $r[1], 'hint' => $r[2], 'icon' => $r[3], 'kind' => $r[4], 'multi' => in_array($r[0], $multi, true)], $rows);
    }

    /** @return array<string, string> */
    public static function patternLabels(): array
    {
        return [
            'none' => 'Tanpa pola', 'dots' => 'Titik', 'grid' => 'Kotak', 'stripes' => 'Garis miring', 'checker' => 'Catur',
            'polka' => 'Polkadot', 'diagonal' => 'Anyaman', 'zigzag' => 'Zigzag', 'waves' => 'Ombak', 'diamonds' => 'Wajik',
            'plaid' => 'Kotak-kotak', 'hearts' => 'Hati', 'stars' => 'Bintang', 'confetti' => 'Konfeti',
        ];
    }

    /** @return array<string, string> inline CSS for the small swatches in the picker */
    public static function patternSwatches(): array
    {
        $out = [];
        foreach (self::PATTERNS as $id) {
            $layer = self::patternLayer($id, 'dark');
            $out[$id] = $layer === null ? 'background:#ede7ff' : 'background:'.$layer.',#ede7ff';
        }

        return $out;
    }

    /** CSS background layer(s) for a pattern id (constants only, never member input), or null for none. */
    public static function patternLayer(string $id, string $ink): ?string
    {
        $c = $ink === 'light' ? '255,255,255' : '0,0,0';
        $k = $ink === 'light' ? 1.6 : 1.0;
        $a = static fn (float $v): string => 'rgba('.$c.','.preg_replace('/^0\./', '.', rtrim(rtrim(number_format(min(.6, $v * $k), 3, '.', ''), '0'), '.')).')';
        $svg = static function (string $body, int $size) use ($c, $k): string {
            $svg = "<svg xmlns='http://www.w3.org/2000/svg' width='{$size}' height='{$size}' viewBox='0 0 {$size} {$size}'><g fill='rgba({$c},".(0.13 * $k).")'>{$body}</g></svg>";

            return 'url("data:image/svg+xml,'.rawurlencode($svg)."\") 0 0/{$size}px {$size}px";
        };

        return match ($id) {
            'dots' => 'radial-gradient('.$a(.14).' 1.5px,transparent 1.5px) 0 0/22px 22px',
            'grid' => 'linear-gradient('.$a(.08).' 1px,transparent 1px) 0 0/26px 26px,linear-gradient(90deg,'.$a(.08).' 1px,transparent 1px) 0 0/26px 26px',
            'stripes' => 'repeating-linear-gradient(45deg,'.$a(.07).' 0 8px,transparent 8px 18px)',
            'checker' => 'conic-gradient('.$a(.07).' 25%,transparent 0 50%,'.$a(.07).' 0 75%,transparent 0) 0 0/36px 36px',
            'polka' => 'radial-gradient('.$a(.1).' 6px,transparent 6.5px) 0 0/40px 40px,radial-gradient('.$a(.1).' 6px,transparent 6.5px) 20px 20px/40px 40px',
            'diagonal' => 'repeating-linear-gradient(45deg,'.$a(.06).' 0 2px,transparent 2px 14px),repeating-linear-gradient(-45deg,'.$a(.06).' 0 2px,transparent 2px 14px)',
            'zigzag' => 'linear-gradient(135deg,'.$a(.08).' 25%,transparent 25%) -12px 0/24px 24px,linear-gradient(225deg,'.$a(.08).' 25%,transparent 25%) -12px 0/24px 24px,linear-gradient(315deg,'.$a(.08).' 25%,transparent 25%) 0 0/24px 24px,linear-gradient(45deg,'.$a(.08).' 25%,transparent 25%) 0 0/24px 24px',
            'waves' => 'radial-gradient(circle at 50% 100%,transparent 9px,'.$a(.08).' 10px 12px,transparent 13px) 0 0/28px 14px',
            'diamonds' => 'linear-gradient(45deg,transparent 46%,'.$a(.09).' 47% 53%,transparent 54%) 0 0/30px 30px,linear-gradient(-45deg,transparent 46%,'.$a(.09).' 47% 53%,transparent 54%) 0 0/30px 30px',
            'plaid' => 'repeating-linear-gradient(0deg,'.$a(.06).' 0 10px,transparent 10px 40px),repeating-linear-gradient(90deg,'.$a(.06).' 0 10px,transparent 10px 40px),repeating-linear-gradient(0deg,'.$a(.04).' 0 2px,transparent 2px 20px),repeating-linear-gradient(90deg,'.$a(.04).' 0 2px,transparent 2px 20px)',
            'hearts' => $svg("<path d='M16 25c-6-4.4-9-7.7-9-11a4.6 4.6 0 0 1 9-1.5A4.6 4.6 0 0 1 25 14c0 3.3-3 6.6-9 11z'/><path d='M40 47c-3-2.2-4.5-3.9-4.5-5.5a2.3 2.3 0 0 1 4.5-.8 2.3 2.3 0 0 1 4.5.8c0 1.6-1.5 3.3-4.5 5.5z'/>", 52),
            'stars' => $svg("<path d='M14 4l2.6 6 6.4.6-4.9 4.3 1.5 6.3L14 17.9l-5.6 3.3 1.5-6.3L5 10.6l6.4-.6z'/><path d='M40 30l1.4 3.2 3.4.3-2.6 2.3.8 3.4-3-1.8-3 1.8.8-3.4-2.6-2.3 3.4-.3z'/>", 52),
            'confetti' => $svg("<rect x='6' y='8' width='8' height='3' rx='1.5' transform='rotate(30 10 9.5)'/><rect x='34' y='12' width='8' height='3' rx='1.5' transform='rotate(-40 38 13.5)'/><circle cx='22' cy='30' r='2.2'/><rect x='10' y='40' width='7' height='3' rx='1.5' transform='rotate(-15 13.5 41.5)'/><circle cx='44' cy='42' r='1.8'/><rect x='26' y='4' width='3' height='3'/>", 52),
            default => null,
        };
    }

    /**
     * One-click themes: fill background, colours, font, card and cursor (never profile text or widgets).
     *
     * @return list<array{id: string, label: string, hint: string, swatch: string, theme: array<string, mixed>}>
     */
    public static function presets(): array
    {
        $p = static fn (string $id, string $label, string $hint, array $bg, array $colors, string $font, array $card, string $cursor): array => [
            'id' => $id, 'label' => $label, 'hint' => $hint,
            'theme' => ['bg' => $bg + ['angle' => 135, 'image' => '', 'fixed' => true, 'overlay' => 0, 'ink' => 'dark', 'color2' => $bg['color']], 'colors' => $colors, 'font' => $font, 'card' => $card, 'cursor' => ['preset' => $cursor, 'url' => '', 'size' => 32]],
        ];
        $list = [
            $p('retro', 'Retro Friendster', 'Biru langit, kotak-kotak, huruf jadul.', ['type' => 'gradient', 'color' => '#9ec9ff', 'color2' => '#e6f1ff', 'angle' => 180, 'pattern' => 'plaid'], ['text' => '#1d2b4f', 'accent' => '#ff6a00', 'card' => '#ffffff', 'link' => '#1a4fd6'], 'Comic Neue', ['radius' => 6, 'opacity' => 0.95, 'blur' => 0], 'pixel'),
            $p('neon', 'Neon Malam', 'Gelap dengan cahaya neon.', ['type' => 'gradient', 'color' => '#0f0c29', 'color2' => '#302b63', 'angle' => 160, 'pattern' => 'grid', 'ink' => 'light'], ['text' => '#e8f9ff', 'accent' => '#22f3ff', 'card' => '#12102a', 'link' => '#ff5cf4'], 'Space Grotesk', ['radius' => 18, 'opacity' => 0.78, 'blur' => 10], 'neon'),
            $p('pastel', 'Pastel', 'Lembut, manis, dan ceria.', ['type' => 'gradient', 'color' => '#fbc2eb', 'color2' => '#a6c1ee', 'pattern' => 'polka', 'ink' => 'light'], ['text' => '#3d2c5a', 'accent' => '#b25ad8', 'card' => '#fffaff', 'link' => '#7a3fc0'], 'Baloo 2', ['radius' => 28, 'opacity' => 0.86, 'blur' => 8], 'hati'),
            $p('minimal', 'Minimal', 'Bersih, putih, tanpa hiasan.', ['type' => 'color', 'color' => '#f5f5f4', 'pattern' => 'none'], ['text' => '#1c1917', 'accent' => '#1c1917', 'card' => '#ffffff', 'link' => '#2563eb'], 'Inter', ['radius' => 12, 'opacity' => 1, 'blur' => 0], ''),
            $p('gamer', 'Gamer', 'Hitam-hijau ala layar game.', ['type' => 'gradient', 'color' => '#050a05', 'color2' => '#0f2a14', 'angle' => 200, 'pattern' => 'diagonal', 'ink' => 'light'], ['text' => '#d7ffd9', 'accent' => '#39ff14', 'card' => '#0b140c', 'link' => '#7dff6a'], 'Press Start 2P', ['radius' => 0, 'opacity' => 0.9, 'blur' => 0], 'pedang'),
            $p('anime', 'Anime', 'Sakura, merah muda, dan bintang.', ['type' => 'gradient', 'color' => '#ffe0ef', 'color2' => '#ffc2dc', 'angle' => 150, 'pattern' => 'stars'], ['text' => '#4a1d3a', 'accent' => '#ff4d8d', 'card' => '#fff5fa', 'link' => '#c2185b'], 'Nunito', ['radius' => 22, 'opacity' => 0.9, 'blur' => 6], 'sakura'),
            $p('alam', 'Alam', 'Hijau segar ala hutan.', ['type' => 'gradient', 'color' => '#d7f5e3', 'color2' => '#a8e6c1', 'angle' => 170, 'pattern' => 'waves'], ['text' => '#14382a', 'accent' => '#2f9e6b', 'card' => '#fbfffc', 'link' => '#1f7a52'], 'Lora', ['radius' => 18, 'opacity' => 0.9, 'blur' => 4], 'daun'),
            $p('senja', 'Senja', 'Jingga hangat matahari terbenam.', ['type' => 'gradient', 'color' => '#f6d365', 'color2' => '#fd6e6a', 'angle' => 160, 'pattern' => 'none'], ['text' => '#3b1d0f', 'accent' => '#d9480f', 'card' => '#fff8f0', 'link' => '#b02a37'], 'Playfair Display', ['radius' => 20, 'opacity' => 0.88, 'blur' => 8], 'bintang'),
        ];
        foreach ($list as &$item) {
            $item['theme'] = self::validate(['theme' => $item['theme']])['theme'];
            unset($item['theme']['style']); // colour presets never change the surface style
            $item['swatch'] = 'background:'.self::bgLayers($item['theme']['bg']);
        }

        return $list;
    }

    /** @return list<array{id: string, label: string, src: string}> */
    public static function cursorPresets(): array
    {
        $out = [];
        foreach (self::CURSORS as $id => [$label]) {
            $out[] = ['id' => $id, 'label' => $label, 'src' => '/kursor/'.$id.'-32.png'];
        }

        return $out;
    }

    /** https URL or one of our own upload references; nothing else. */
    public static function image(mixed $v): string
    {
        if (is_string($v) && preg_match(ProfileImage::REF, trim($v)) === 1) {
            return trim($v);
        }

        return self::url($v);
    }

    /** @return array<string, mixed> */
    public static function defaults(): array
    {
        return [
            'profile' => ['name' => '', 'tagline' => '', 'status' => '', 'about' => '', 'avatar' => ''],
            'theme' => [
                'bg' => ['type' => 'gradient', 'color' => '#ede7ff', 'color2' => '#ffd9ec', 'angle' => 135, 'image' => '', 'pattern' => 'dots', 'fixed' => true, 'overlay' => 0, 'ink' => 'dark'],
                'colors' => ['text' => '#2b2440', 'accent' => '#7c5cff', 'card' => '#ffffff', 'link' => '#5a3fa0'],
                'font' => 'Nunito',
                'style' => 'bawaan',
                'card' => ['radius' => 24, 'opacity' => 0.88, 'blur' => 8],
                'cursor' => ['url' => '', 'preset' => '', 'size' => 32],
            ],
            'music' => ['url' => '', 'title' => '', 'autoplay' => false],
            'layout' => ['justify' => 'start', 'align' => 'top', 'gap' => 'normal'],
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
        $l = is_array($in['layout'] ?? null) ? $in['layout'] : [];

        $out = [
            'profile' => [
                'name' => self::text($p['name'] ?? '', 60),
                'tagline' => self::text($p['tagline'] ?? '', 80),
                'status' => self::text($p['status'] ?? '', 140),
                'about' => self::text($p['about'] ?? '', 1200, true),
                'avatar' => self::image($p['avatar'] ?? ''),
            ],
            'theme' => [
                'bg' => [
                    'type' => self::enum($bg['type'] ?? null, self::BG_TYPES, $d['theme']['bg']['type']),
                    'color' => self::color($bg['color'] ?? null, $d['theme']['bg']['color']),
                    'color2' => self::color($bg['color2'] ?? null, $d['theme']['bg']['color2']),
                    'angle' => self::num($bg['angle'] ?? null, 0, 360, 135),
                    'image' => self::image($bg['image'] ?? ''),
                    'pattern' => self::enum($bg['pattern'] ?? null, self::PATTERNS, 'none'),
                    'fixed' => filter_var($bg['fixed'] ?? true, FILTER_VALIDATE_BOOLEAN),
                    'overlay' => self::num($bg['overlay'] ?? 0, 0, 0.8, 0),
                    'ink' => self::enum($bg['ink'] ?? null, self::INKS, 'dark'),
                ],
                'colors' => [
                    'text' => self::color($co['text'] ?? null, $d['theme']['colors']['text']),
                    'accent' => self::color($co['accent'] ?? null, $d['theme']['colors']['accent']),
                    'card' => self::color($co['card'] ?? null, $d['theme']['colors']['card']),
                    'link' => self::color($co['link'] ?? null, $d['theme']['colors']['link']),
                ],
                'font' => self::enum($t['font'] ?? null, self::FONTS, 'Nunito'),
                'style' => self::enum($t['style'] ?? null, array_keys(self::STYLES), 'bawaan'),
                'card' => [
                    'radius' => (int) self::num($cd['radius'] ?? null, 0, 40, 24),
                    'opacity' => self::num($cd['opacity'] ?? null, 0.3, 1, 0.88),
                    'blur' => (int) self::num($cd['blur'] ?? null, 0, 24, 8),
                ],
                'cursor' => [
                    'url' => self::image($cu['url'] ?? ''),
                    'preset' => is_string($cu['preset'] ?? null) && isset(self::CURSORS[$cu['preset']]) ? $cu['preset'] : '',
                    'size' => (int) self::num($cu['size'] ?? null, 16, 48, 32),
                ],
            ],
            'music' => ['url' => self::url($m['url'] ?? ''), 'title' => self::text($m['title'] ?? '', 80), 'autoplay' => filter_var($m['autoplay'] ?? false, FILTER_VALIDATE_BOOLEAN)],
            'layout' => [
                'justify' => self::enum($l['justify'] ?? null, self::JUSTIFY, 'start'),
                'align' => self::enum($l['align'] ?? null, self::ALIGN, 'top'),
                'gap' => self::enum($l['gap'] ?? null, self::GAPS, 'normal'),
            ],
            'widgets' => [],
        ];

        $seen = [];
        $widgets = is_array($in['widgets'] ?? null) ? $in['widgets'] : [];
        foreach ($widgets as $w) {
            if (! is_array($w) || ! is_string($w['type'] ?? null) || ! in_array($w['type'], self::WIDGETS, true)) {
                continue;
            }
            $type = $w['type'];
            if (isset($seen[$type]) && ! in_array($type, ['quote', 'youtube', 'spotify', 'links'], true)) {
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
        $width = is_scalar($w['width'] ?? null) ? (string) $w['width'] : 'auto';
        $width = rtrim($width, '%');
        if (in_array($width, self::WIDTHS, true) && $width !== 'auto') {
            $o['width'] = $width;
        }
        $title = self::text($w['title'] ?? '', 60);
        if ($title !== '') {
            $o['title'] = $title;
        }

        if ($type === 'gallery') {
            $o['items'] = [];
            foreach (array_slice(is_array($w['items'] ?? null) ? $w['items'] : [], 0, 12) as $it) {
                $u = self::image(is_array($it) ? ($it['url'] ?? '') : '');
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
        } elseif ($type === 'spotify') {
            $sp = self::spotify(trim((string) ($w['url'] ?? '')) !== '' ? (string) $w['url'] : (isset($w['kind'], $w['id']) && is_scalar($w['kind']) && is_scalar($w['id']) ? 'https://open.spotify.com/'.$w['kind'].'/'.$w['id'] : (string) ($w['id'] ?? '')));
            $o['kind'] = $sp['kind'] ?? '';
            $o['id'] = $sp['id'] ?? '';
            $o['compact'] = $o['kind'] === 'track' && ! empty($w['compact']);
        }

        return $o;
    }

    /**
     * Strict Spotify parser. Accepts an open.spotify.com link (optionally /embed/ and /intl-xx/) or a pasted embed iframe.
     * Nothing else (other hosts, javascript:, odd ids) is accepted.
     *
     * @return array{kind: string, id: string}|null
     */
    public static function spotify(string $v): ?array
    {
        $v = trim($v);
        if (stripos($v, '<iframe') !== false) {
            if (preg_match('/\ssrc\s*=\s*(?:"([^"]*)"|\'([^\']*)\')/i', $v, $m) !== 1) {
                return null;
            }
            $v = trim(html_entity_decode($m[1] !== '' ? $m[1] : ($m[2] ?? ''), ENT_QUOTES));
        }
        if (preg_match('~^https://open\.spotify\.com/(?:intl-[a-z]{2,5}/)?(?:embed/)?(track|album|playlist|episode|show|artist)/([A-Za-z0-9]{22})(?:[?#/][^\s]*)?$~', $v, $m) === 1) {
            return ['kind' => $m[1], 'id' => $m[2]];
        }

        return null;
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

    /** Effective width (percent) of a validated widget. */
    public static function widthOf(array $w): int
    {
        return isset($w['width']) ? (int) $w['width'] : (in_array($w['type'], self::WIDE_TYPES, true) ? 100 : 50);
    }

    /** @return string inline CSS variables for the widget area (constants from validated enums only) */
    public static function layoutCss(array $c): string
    {
        $l = $c['layout'] ?? self::defaults()['layout'];
        $j = ['start' => 'flex-start', 'center' => 'center', 'end' => 'flex-end', 'between' => 'space-between', 'evenly' => 'space-evenly', 'around' => 'space-around'][$l['justify']] ?? 'flex-start';
        $a = ['top' => 'flex-start', 'center' => 'center', 'bottom' => 'flex-end', 'stretch' => 'stretch'][$l['align']] ?? 'flex-start';
        $g = ['tight' => 8, 'normal' => 16, 'loose' => 28][$l['gap']] ?? 16;

        return sprintf('--pf-justify:%s;--pf-align:%s;--pf-gap:%dpx;', $j, $a, $g);
    }

    /** @param array<string, mixed> $b validated theme.bg */
    public static function bgLayers(array $b): string
    {
        $layers = [];
        if ($b['overlay'] > 0) {
            $layers[] = sprintf('linear-gradient(rgba(0,0,0,%s),rgba(0,0,0,%s))', $b['overlay'], $b['overlay']);
        }
        if ($b['pattern'] !== 'none' && $b['type'] !== 'image') {
            $layers[] = (string) self::patternLayer($b['pattern'], $b['ink'] ?? 'dark');
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
        return implode(',', $layers);
    }

    /** @return list<array{id: string, label: string, hint: string, forced: bool}> */
    public static function styleCatalog(): array
    {
        $o = [];
        foreach (self::STYLES as $id => $v) {
            $o[] = ['id' => $id, 'label' => $v[0], 'hint' => $v[1], 'forced' => $v[2]];
        }

        return $o;
    }

    /** @return array{vars: string, bg: string, font: string, cursor: string, style: string, styleFonts: list<string>} inline-CSS strings built only from validated values */
    public static function css(array $c): array
    {
        $t = $c['theme'];
        $rgb = static function (string $hex): string {
            return hexdec(substr($hex, 1, 2)).','.hexdec(substr($hex, 3, 2)).','.hexdec(substr($hex, 5, 2));
        };
        $vars = sprintf(
            '--pf-text:%s;--pf-accent:%s;--pf-link:%s;--pf-card-solid:%s;--pf-card:rgba(%s,%s);--pf-radius:%dpx;--pf-blur:%dpx;--pf-font:\'%s\',system-ui,sans-serif;',
            $t['colors']['text'], $t['colors']['accent'], $t['colors']['link'], $t['colors']['card'], $rgb($t['colors']['card']), $t['card']['opacity'], $t['card']['radius'], $t['card']['blur'], $t['font']
        );

        $bg = 'background:'.self::bgLayers($t['bg']).';';

        $cursor = '';
        $cu = $t['cursor'];
        $size = $cu['size'] <= 26 ? 24 : ($cu['size'] >= 40 ? 48 : 32);
        if ($cu['url'] !== '') {
            $u = preg_match(ProfileImage::REF, $cu['url']) === 1 ? (string) preg_replace('/-c\d\d\.png$/', '-c'.$size.'.png', $cu['url']) : $cu['url'];
            $cursor = 'cursor:url("'.$u.'") 0 0,auto;';
        } elseif ($cu['preset'] !== '') {
            [, $hx, $hy] = self::CURSORS[$cu['preset']];
            $cursor = sprintf('cursor:url("/kursor/%s-%d.png") %d %d,auto;', $cu['preset'], $size, (int) round($hx * $size / 32), (int) round($hy * $size / 32));
        }

        $st = self::STYLES[$t['style'] ?? 'bawaan'] ?? self::STYLES['bawaan'];

        return ['vars' => $vars, 'bg' => $bg, 'font' => $t['font'], 'cursor' => $cursor, 'style' => $t['style'] ?? 'bawaan', 'styleFonts' => array_values(array_filter([$st[3], $st[4]]))];
    }
}
