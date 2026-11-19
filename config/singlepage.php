<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Published profile base domain
    |--------------------------------------------------------------------------
    |
    | Game pages are https://www.{base_domain}/{subdomain}/. The stored label
    | is still the company subdomain. {subdomain}.{base_domain}/... answers
    | 301 to that path and keeps the suffix and query string. The admin host
    | is never a tenant. GET / on the apex and on www is the marketing
    | homepage served by this app. Local default is jadidaring.test;
    | production is jadidaring.com.
    |
    */

    'base_domain' => env('APP_BASE_DOMAIN', 'jadidaring.test'),

    /*
    |--------------------------------------------------------------------------
    | Admin CMS host
    |--------------------------------------------------------------------------
    |
    | Must be a single host (not a wildcard). Session cookies are host-only
    | and must never be issued with Domain=.jadidaring.com / .jadidaring.test.
    |
    */

    'admin_domain' => env('ADMIN_DOMAIN', 'admin.jadidaring.test'),

    /*
    | Games where creating/drawing needs a logged-in member (comma separated
    | subdomains). Empty disables the rule.
    */
    'members_only_games' => env('GAME_MEMBERS_ONLY', '*'),

    // Games served from resources/games/{slug}/game.html inside the site layout (docs/games-in-git.md). Empty = all games use their database html.
    'git_games' => env('GIT_GAMES', 'langitbersama,drawquarium,coratcoret,anomaliminimarket,bajajdrift,rebutbendera,ogohogoharak,monyetuluwatu,penaltitimnas,tamiyalintasan,mandarinharian,kopisenja,whoosh,ttskilat,ikanrakus,drag201,malampendakian,cukurkekinian,pawanghujan,mudikmacet,gasingarena,dapurpadang3d,benteng,bumerangsakti,dapurpadang,duelular,gelembung'),

    'subscription_years' => (int) env('SUBSCRIPTION_YEARS', 1),

    /*
    |--------------------------------------------------------------------------
    | Platform legal notice
    |--------------------------------------------------------------------------
    |
    | Injected on every live tenant site. Users can change their HTML, but
    | they cannot remove this provider disclaimer from the public response.
    |
    */

    'platform_name' => env('PLATFORM_NAME', 'Jadidaring'),

    'marketing_url' => env('PLATFORM_MARKETING_URL', 'https://jadidaring.com/'),

    'terms_updated_on' => '2026-09-20',

    /*
    |--------------------------------------------------------------------------
    | GameHub path
    |--------------------------------------------------------------------------
    |
    | The directory used to be the tenant host gamehub.{base_domain}. It is
    | a path on the host this app already serves, and every other game uses
    | that same host under /{subdomain}. GET / on the apex and on
    | www.{base_domain} is the marketing homepage. www is the public
    | game host unless GAMEHUB_HOST is set.
    |
    | Hub HTML stays on the live CompanyProfile whose subdomain is gamehub.
    | Game cards are not edited there: GameHubCatalog lists every other live
    | profile (path, title, description, cover) and sorts by newest or views.
    | That label is reserved. Dedicated /gamehub routes win over the generic
    | game path, so a profile named gamehub stays the directory.
    | gamehub.{base_domain}/... answers 301 to {host}/{path}/... and keeps
    | the path suffix and query string. Other games redirect the same way.
    |
    */

    'gamehub' => [
        'subdomain' => 'gamehub',
        'path' => 'gamehub',
        'host' => env('GAMEHUB_HOST'),
    ],

    /*
    | Labels that are not game paths. gamehub is the directory. app, apps,
    | and reverb belong to the websocket proxy (nginx claims /app and /apps
    | before PHP). up is the Laravel health route. www is the public host.
    | marketing is the homepage asset prefix (public/marketing). The apex
    | domain has no label. Admin settings can add more names; the built-in
    | list is always reserved even when the saved setting omits it.
    */

    'reserved_subdomains' => [
        'admin',
        'www',
        'game',
        'berita',
        'komunitas',
        'masuk',
        'daftar',
        'keluar',
        'akun',
        'auth',
        'lupa-password',
        'reset-password',
        'gamehub',
        'mail',
        'api',
        'app',
        'apps',
        'static',
        'assets',
        'reverb',
        'up',
        'marketing',
        'u',
        'a',
    ],

    /*
    | Rust realtime engine. Games listed here use it while it is healthy; every
    | other game stays on Reverb. REALTIME_ENABLED=false forces Reverb everywhere.
    */
    'realtime_enabled' => (bool) env('REALTIME_ENABLED', env('APP_ENV') === 'production'),
    'realtime_host' => env('REALTIME_HOST', 'singlepage-realtime:9000'),
    'rust_games' => env('GAME_RUST_GAMES', 'benteng,coratcoret,dapurpadang,dapurpadang3d,drag201,drawquarium,duelular,explodingkitten,gambletogether,gasingarena,gelembung,langitbersama,lanjutkata,mahjong,mahjong-master,malampendakian,ogohogoharak,pedangsihir,penaltitimnas,rebutbendera,sambungcoret,skalateman,tamiyalintasan,ulartangga'),

    /*
    | Isolated origin for member pages (e.g. u.jadidaring.com). Empty = serve the
    | same sandboxed content from the main host under /u/{username}/konten.
    */
    'sandbox_domain' => env('SANDBOX_DOMAIN', env('APP_ENV') === 'production' ? 'u.'.env('APP_BASE_DOMAIN', 'jadidaring.test') : null),

    /*
    |--------------------------------------------------------------------------
    | Machine-to-machine admin API
    |--------------------------------------------------------------------------
    |
    | POST/PATCH /api/admin/clients on the admin host. Callers must send
    | ADMIN_API_SECRET as the X-Admin-Api-Key header. An empty secret
    | rejects every request (fail closed).
    |
    */

    'admin_api' => [
        'secret' => env('ADMIN_API_SECRET'),
        'header' => 'X-Admin-Api-Key',
    ],

];
