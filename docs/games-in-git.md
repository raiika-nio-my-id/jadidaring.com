# Games in git

Pilot: **Langit Bersama** (`/game/langitbersama`), moved 2026-11-20. Other games move one per commit; see the inventory below.

## Before: game as content

- Every game is a `company_profiles` row (`is_game = 1`, `subdomain` = slug). The whole game is one
  self-contained HTML document in the `html` column (Langit Bersama: ~410 KB ASCII, built from a local
  `src/` folder and uploaded with `PATCH /api/admin/clients/subdomain/{slug}`).
- `TenantController::showGame` serves that column at `/game/{slug}` and injects, at request time:
  root-path and identity rewrites (`TenantPath::rewriteHtml`, so `/api/game/...` becomes
  `/game/{slug}/api/game/...`), retired GM key scrub, legal footer (unless `hide_footer`), canonical and
  favicons (`SeoInjector`), the shared player-name bridge, the realtime (SSE) bridge, GA4 consent plus
  `game_start` / `post_score` hooks, and the members-only banner for guests (commit e3bddfb).
- Player data never lived in the HTML. Rooms, room state (kites, chat, permanent residents), players and
  scores are database rows reached through `/game/{slug}/api/game/*` (`routes/game.php`), isolated by the
  profile id. Drawquarium works the same way.
- No version history, no review, and the page was the bare game: no site nav.

<!-- inventory:start -->
## Player name: always the account

Andika's rule (2026-11-20): the nickname is never edited inside a game, it comes from the logged-in Jadidaring
account (`users.name`, changed only at `/akun`).

- Server: `GameRoomController::payload()` replaces `displayName` with the account name on create, join, match
  and watch; `GameScoreService` stores scores under the account. Never trust a typed name.
- Client: `PlayerNameBridge` injects `window.__JD_ME = {in, name, login}` in front of every game that has a name
  gate. Git games read it directly: the name field is read-only and shows the account name; the gate keeps only
  avatar/language. Old per-game nicknames in `localStorage` are ignored.
- Guests (not logged in): they can open, watch and try the game under the name **Tamu**. Anything that saves
  (rooms, drawings, chat, scores) gets 401 from the server and the shared "Masuk dulu ya" prompt opens
  (`GAME_MEMBERS_ONLY=*`, commit e3bddfb). The gate shows a "Masuk" link instead of a name field.
- Known gap: shared room *state* documents (chat lines, creature author names) are written by the client, so a
  modified client could still put another name inside the state blob. The player row and scores are server-set.

## Inventory (all games, popularity order = /game listing)

Source check: the local build file was run through the same server pipeline and diffed against the live
`/game/{slug}` response (equal = safe source for the move). Games without a local copy need their database html
exported first (no admin GET endpoint exists yet).

| # | Game | Status | Source for the move | Name gate | Uses game API |
|---|---|---|---|---|---|
| 1 | `langitbersama` | in git (pilot 822b191; account name lock 2026-11-20) | repo | yes, account name | yes |
| 2 | `drawquarium` | in git (50a0ece) | local build, verified = live (`index.deploy.html`) | yes | yes |
| 3 | `coratcoret` | in git (fab7dfb) | local build, verified = live (`index.deploy.html`) | yes | yes |
| 4 | `anomaliminimarket` | in git (6846a4d) | local build, verified = live (`index.deploy.html`) | yes | no |
| 5 | `bajajdrift` | in git (9d9ed7c) | local build, verified = live (`index.deploy.html`) | yes | yes |
| 6 | `rebutbendera` | in git | local build, verified = live (`index.deploy.html`) | yes | yes |
| 7 | `ogohogoharak` | database | local build, verified = live (`index.deploy.html`) | yes | yes |
| 8 | `monyetuluwatu` | database | local build, verified = live (`index.deploy.html`) | yes | no |
| 9 | `penaltitimnas` | database | local build, verified = live (`index.deploy.html`) | yes | yes |
| 10 | `tamiyalintasan` | database | local build, verified = live (`index.deploy.html`) | yes | yes |
| 11 | `kopisenja` | database | local build, verified = live (`index.deploy.html`) | yes | no |
| 12 | `mandarinharian` | database | local build, verified = live (`index.deploy.html`) | yes | yes |
| 13 | `whoosh` | database | local build, verified = live (`index.deploy.html`) | yes | no |
| 14 | `ttskilat` | database | local build, verified = live (`index.deploy.html`) | yes | yes |
| 15 | `ikanrakus` | database | local build, verified = live (`index.deploy.html`) | yes | yes |
| 16 | `drag201` | database | local build, verified = live (`index.deploy.html`) | yes | yes |
| 17 | `malampendakian` | database | local build, verified = live (`index.deploy.html`) | yes | yes |
| 18 | `cukurkekinian` | database | local build, verified = live (`index.deploy.html`) | no | no |
| 19 | `pawanghujan` | database | local build, verified = live (`index.deploy.html`) | no | no |
| 20 | `mudikmacet` | database | local build, verified = live (`index.deploy.html`) | no | no |
| 21 | `gasingarena` | database | local build, verified = live (`index.deploy.html`) | yes | yes |
| 22 | `dapurpadang3d` | database | local build, verified = live (`index.deploy.html`) | yes | yes |
| 23 | `dapurpadang` | database | local build, verified = live (`index.deploy.html`) | yes | yes |
| 24 | `skalateman` | database | local build, verified = live (`index.deploy.html`) | yes | yes |
| 25 | `duelular` | database | local build, verified = live (`index.deploy.html`) | yes | yes |
| 26 | `sambungcoret` | database | local build, verified = live (`index.deploy.html`) | yes | yes |
| 27 | `lanjutkata` | database | local build, verified = live (`index.deploy.html`) | yes | yes |
| 28 | `nadapiano` | database | no local copy: export the database html first | no | no |
| 29 | `gambletogether` | database | no local copy: export the database html first | yes | yes |
| 30 | `bumerangsakti` | database | local build, verified = live (`index.deploy.html`) | yes | yes |
| 31 | `gamelanhero` | database | no local copy: export the database html first | no | no |
| 32 | `pedangsihir` | database | local build, verified = live (`index.html`) | yes | yes |
| 33 | `gelembung` | database | local build, verified = live (`index.html`) | yes | yes |
| 34 | `benteng` | database | local build, verified = live (`index.html`) | yes | yes |
| 35 | `ulartangga` | database | local build, verified = live (`index.html`) | yes | yes |
| 36 | `mahjong-master` | database | no local copy: export the database html first | yes | yes |
| 37 | `explodingkitten` | database | no local copy: export the database html first | yes | yes |
| 38 | `mahjong` | database | no local copy: export the database html first | yes | yes |
| 39 | `tiltingball` | database | no local copy: export the database html first | no | no |
| 40 | `boxing` | database | no local copy: export the database html first | no | no |
| 41 | `spiderman` | database | no local copy: export the database html first | no | no |
| 42 | `kehidupankonoha` | database | no local copy: export the database html first | yes | yes |
| 43 | `mlbbpicker` | database | no local copy: export the database html first | no | no |
| 44 | `clubgame` | database | no local copy: export the database html first | no | no |
| 45 | `idle-game` | database | no local copy: export the database html first | no | no |
<!-- inventory:end -->

## After: game as code

```
resources/games/{slug}/
  src/            editable sources (template.html, style.css, app.js, net.js, rules.js, config.json, snippets/)
  build.cjs       node build: inlines src/ into game.html (ASCII-only, fails on non-ASCII or the retired GM key)
  game.html       built document that Laravel serves; commit together with src/
  README.md       game notes and change log
```

| URL | What |
|---|---|
| `/game/{slug}` | `clay.game-play` view on the site layout: main nav (slim on game pages) with a Back button on the left (to `/game`; `history.back()` only when the previous page is the game list), fullscreen button, SEO title/description from the game's own `<head>`, VideoGame + BreadcrumbList JSON-LD, and a same-origin `<iframe>` that fills the rest of the screen. Query string and `#hash` are passed to the frame. |
| `/game/{slug}/play` | `game.html` with exactly the same injections as before (shared `gameDocument()` pipeline), plus `GitGames::frame()` (also drops the floating Game Hub link snippet `jr-hub`, the nav Back button replaces it): opened top-level it bounces to `/game/{slug}` (except `?wallpaper`), links that leave the game open in the whole tab, and GA events go to the shell page's `jdTrack` (one consent banner, one page view). Headers: `X-Frame-Options: SAMEORIGIN`, `frame-ancestors 'self'`, `X-Robots-Tag: noindex`. |
| `/{slug}[/...]` | 301 to `/game/{slug}` (old bare path). `{slug}.jadidaring.com` already 301s via `config/old_subdomains.php`. |

Why a frame and not inlining the game into the Blade page: game CSS/JS assume they own `html`, `body`
and the viewport, and the site CSS would collide with theirs. A same-origin frame keeps the game
untouched while sharing cookies, session, `localStorage` and `sessionStorage` with the site, so names,
login, rooms and the API behave exactly as before. It is our own code, so the frame has no `sandbox`
(member pages keep their sandbox without `allow-same-origin`; nothing there changed).

The database row still matters: it decides whether the game is live (published, not expired), feeds the
catalogue and sitemap, and keeps the old `html` as the **rollback copy**. Do not delete it.

## Switch and rollback

- `config('singlepage.git_games')` = env `GIT_GAMES`, comma list, default `langitbersama`.
- Rollback without a deploy: `GIT_GAMES=` (empty) in the server `.env`, then `php artisan config:cache`
  if config is cached. `/game/{slug}` serves the database html again and `/play` returns 404.
- Or revert the commit.

## Moving another game

1. Get its current source. Easiest: the database `html` (or the local build folder). Verify it equals the
   live page minus the server injections (diff the live response against the pipeline output).
2. Add `resources/games/{slug}/` with `src/` + `build.cjs` (or just `game.html` if there is no source
   tree), run the build, and check `game.html` is ASCII and has no `gmjd1212` / `gamemasterjd`.
3. Add the slug to the `GIT_GAMES` default in `config/singlepage.php` (and the server env, if it is set there).
4. Extend `tests/Feature/GitGamesTest.php` (shell, play, rollback, redirect).
5. Deploy, then check desktop and phone portrait/landscape: nav visible, game fits, no console errors,
   rooms/scores load, fullscreen works.

Games that need the full screen on phones in landscape (racing, platformers) should get the slim nav
plus the fullscreen button; check the game reads its size from its own window (`innerWidth/innerHeight`,
`100dvh`), not `screen.*`.
