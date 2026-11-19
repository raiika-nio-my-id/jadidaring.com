<?php

namespace App\Services;

/**
 * Decodes a profile config sent in a link's query string. Accepted forms (auto-detected):
 *  - plain JSON, URL-encoded (what AIs reliably produce): ?json={...}
 *  - base64url of the JSON, or base64url of zlib/deflate-compressed JSON: ?d=...
 * The result is only a candidate: callers must run it through ProfileConfig::validate().
 */
class ProfilePayload
{
    public const MAX_JSON = 100000;

    /** @return array<string, mixed> */
    public static function decode(string $raw): array
    {
        $raw = trim($raw);

        if ($raw === '') {
            throw new \InvalidArgumentException('Tautan tidak berisi data profil.');
        }

        $json = null;

        if ($raw[0] === '{' || stripos($raw, '%7B') === 0) {
            $json = $raw[0] === '{' ? $raw : rawurldecode($raw);
        } else {
            $b64 = strtr(rtrim($raw, '='), '-_ ', '+/+');
            $bin = base64_decode($b64.str_repeat('=', (4 - strlen($b64) % 4) % 4), true);

            if ($bin === false || $bin === '') {
                throw new \InvalidArgumentException('Data pada tautan tidak bisa dibaca (rusak atau terpotong).');
            }

            $json = $bin;

            if ($bin[0] !== '{') {
                $json = @gzuncompress($bin, self::MAX_JSON * 4) ?: @gzinflate($bin, self::MAX_JSON * 4) ?: @gzdecode($bin, self::MAX_JSON * 4);

                if (! is_string($json)) {
                    throw new \InvalidArgumentException('Data pada tautan tidak bisa dibaca (bukan JSON atau kompresi tidak dikenal).');
                }
            }
        }

        if (strlen($json) > self::MAX_JSON) {
            throw new \InvalidArgumentException('Data terlalu besar.');
        }

        $data = json_decode($json, true);

        if (! is_array($data)) {
            throw new \InvalidArgumentException('JSON pada tautan tidak valid (mungkin terpotong). Pakai kotak "Tempel JSON dari AI" di editor.');
        }

        // Accept {"config":{...}} wrappers too.
        if (isset($data['config']) && is_array($data['config']) && ! isset($data['theme'])) {
            $data = $data['config'];
        }

        return $data;
    }
}
