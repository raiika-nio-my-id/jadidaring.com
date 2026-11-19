# Whoosh Atur Rel (game in git)

Rail-switching puzzle with the Whoosh train: daily and endless modes with leaderboards.
Served at https://jadidaring.com/game/whoosh inside the site layout (main nav with Back button + game frame); see
`docs/games-in-git.md`.

- Moved from the local build folder on 2026-11-20. `build-src.cjs` is the game's own build (inlines `src/*`
  into one html, then `tools/to-deploy-ascii.py` makes the ASCII copy); `build.cjs` wraps it into `game.html`.
  The output was byte-identical to the deployed database html (after the retired GM key scrub the server already did).
- Player name: shared name gate (`JDNG_CFG.inputs = #nmIn`, the record-save field), locked to the account name by `public/js/account-name.js` (guests = Tamu).
  The server also replaces `displayName` and score names with the account name; guests save nothing (401 opens the login prompt).
- Player data (rooms, scores) lives in the database (`/game/whoosh/api/game/*`); nothing in this folder stores it.

## Build

```
node resources/games/whoosh/build.cjs
env -u ADMIN_API_SECRET php vendor/bin/phpunit tests/Feature/GitGamesTest.php
```

Rollback: remove `whoosh` from `GIT_GAMES` or revert the commit; the database html is the rollback copy.
