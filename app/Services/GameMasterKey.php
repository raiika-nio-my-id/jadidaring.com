<?php

namespace App\Services;

/**
 * Old game clients hardcode the retired shared GM key (for the #key hash and
 * ?gm= lobby list). Game master is now the logged-in admin, so the key means
 * nothing, but it must not be served. Replace it with a neutral word: the hash
 * becomes #gamemaster and the server ignores whatever ?gm= carries.
 */
class GameMasterKey
{
    /** @var list<string> */
    private const RETIRED = ['gmjd1212', 'gamemasterjd'];

    public static function scrub(string $html): string
    {
        return str_ireplace(self::RETIRED, 'gamemaster', $html);
    }
}
