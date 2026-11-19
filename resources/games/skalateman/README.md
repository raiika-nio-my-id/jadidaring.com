# Skala Teman (game in git)

Party game: guess where your friends land on a 1-10 scale, 2-8 players.
Served at https://jadidaring.com/game/skalateman inside the site layout (main nav with Back button + game frame); see
`docs/games-in-git.md`.

- Moved from the local build folder on 2026-11-20. `build-src.cjs` is the game's own build (inlines `src/*`
  into one html, then `tools/to-deploy-ascii.py` makes the ASCII copy); `build.cjs` wraps it into `game.html`.
  The output was byte-identical to the deployed database html (after the retired GM key scrub the server already did).
- Player name: shared name gate (`JDNG_CFG.inputs = #nameInput`, plus the room invite name field), locked to the account name by `public/js/account-name.js` (shown as a plain "Main sebagai" chip; guests = Tamu).
  The server also replaces `displayName` and score names with the account name; guests save nothing (401 opens the login prompt).
- Player data (rooms, scores) lives in the database (`/game/skalateman/api/game/*`); nothing in this folder stores it.

## Build

```
node resources/games/skalateman/build.cjs
env -u ADMIN_API_SECRET php vendor/bin/phpunit tests/Feature/GitGamesTest.php
```

Rollback: remove `skalateman` from `GIT_GAMES` or revert the commit; the database html is the rollback copy.
