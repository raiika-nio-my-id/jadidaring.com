<?php

namespace App\Support;

/**
 * Masks Indonesian + English profanity and slurs in member text (Curhatan posts and all member comments).
 * Whole words are compared after lower-casing, undoing simple leetspeak (4→a, 1→i, 0→o, 3→e, 5/$→s, @→a, 7→t)
 * and collapsing repeated letters ("anjiiing"); a few strong roots are also caught inside longer words.
 * Masked words keep their first letter: "anjing" → "a*****".
 */
class BadWords
{
    /** Exact words (already collapsed: no doubled letters). */
    private const WORDS = [
        // Indonesian / regional
        'anjing', 'anjeng', 'anjg', 'ajg', 'bangsat', 'bgst', 'kontol', 'kntl', 'memek', 'mmk', 'ngentot', 'ngentod', 'entot', 'ngewe',
        'jancok', 'jancuk', 'jancik', 'dancok', 'goblok', 'goblog', 'tolol', 'kampret', 'bajingan', 'keparat', 'perek', 'lonte',
        'pelacur', 'pantek', 'puki', 'pukimak', 'kimak', 'taik', 'tai', 'peler', 'jembut', 'itil', 'coli', 'asu', 'bencong',
        'ngacen', 'sundal', 'tempik', 'titit', 'kntol', 'bacot', 'jablay',
        // English
        'fuck', 'fck', 'fuk', 'fucker', 'fucking', 'motherfucker', 'shit', 'bulshit', 'bitch', 'asshole', 'ashole', 'bastard', 'cunt',
        'dickhead', 'pusy', 'whore', 'slut', 'niger', 'niga', 'fagot', 'fag', 'retard', 'wanker', 'twat',
    ];

    /** Roots caught inside longer words too (e.g. "fuckboy", "kontolnya"). */
    private const ROOTS = ['fuck', 'kontol', 'ngentot', 'memek', 'jancok', 'jancuk', 'bangsat', 'pukimak', 'motherfuck', 'niger', 'bajingan'];

    public static function clean(string $text): string
    {
        return (string) preg_replace_callback('/[\p{L}\p{N}@$]+/u', static function (array $m): string {
            $word = $m[0];

            return self::isBad($word) ? mb_substr($word, 0, 1).str_repeat('*', max(1, mb_strlen($word) - 1)) : $word;
        }, $text);
    }

    public static function contains(string $text): bool
    {
        return self::clean($text) !== $text;
    }

    private static function isBad(string $word): bool
    {
        $w = (string) preg_replace('/(?<=\p{L}{3})\d+$/u', '', mb_strtolower($word));
        $w = strtr($w, ['4' => 'a', '@' => 'a', '1' => 'i', '!' => 'i', '0' => 'o', '3' => 'e', '5' => 's', '$' => 's', '7' => 't']);
        $w = (string) preg_replace('/(.)\1+/u', '$1', $w);
        if ($w === '' || preg_match('/^[a-z]+$/', $w) !== 1) {
            return false;
        }
        if (in_array($w, self::WORDS, true)) {
            return true;
        }
        // Plural / suffix forms: "anjingnya", "goblokk", "fuckers".
        foreach (['nya', 'lah', 'an', 's', 'mu', 'ku'] as $suffix) {
            if (str_ends_with($w, $suffix) && in_array(substr($w, 0, -strlen($suffix)), self::WORDS, true) && strlen($w) - strlen($suffix) >= 4) {
                return true;
            }
        }
        foreach (self::ROOTS as $root) {
            if (str_contains($w, $root)) {
                return true;
            }
        }

        return false;
    }
}
