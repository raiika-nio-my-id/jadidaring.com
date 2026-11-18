<?php

namespace App\Services;

use App\Enums\UserRole;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/**
 * Games where creating or drawing needs a logged-in member. Viewing, listing,
 * watching and joining stay open, so existing drawings and nicknames remain visible.
 */
class MembersOnlyGames
{
    public static function applies(string $subdomain): bool
    {
        $list = array_filter(array_map('trim', explode(',', strtolower((string) config('singlepage.members_only_games')))));

        return in_array(strtolower($subdomain), $list, true);
    }

    public static function allows(Request $request): bool
    {
        $user = Auth::guard('web')->user();

        return $user !== null && in_array($user->role, [UserRole::Member, UserRole::Client, UserRole::Admin], true);
    }

    public static function banner(string $loginUrl): string
    {
        $url = e($loginUrl);

        return '<div style="position:fixed;left:0;right:0;bottom:0;z-index:2147483000;padding:10px 14px;background:#2B2440;color:#fff;font:600 14px/1.4 system-ui,sans-serif;text-align:center">'
            .'Untuk membuat gambar baru, <a href="'.$url.'" style="color:#FDD9BF">masuk</a> atau <a href="/daftar" style="color:#FDD9BF">daftar</a> dulu. Gambar yang sudah ada tetap bisa dilihat.</div>';
    }
}
