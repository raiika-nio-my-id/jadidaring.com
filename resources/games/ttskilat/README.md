# TTS Kilat (game in git)

Quick Indonesian crosswords: daily TTS, leaderboard, and a maker for shareable puzzles.
Served at https://jadidaring.com/game/ttskilat inside the site layout (main nav with Back button + game frame); see
`docs/games-in-git.md`.

- Moved from the local build folder on 2026-11-20. `build-src.cjs` is the game's own build (inlines `src/*`
  into one html, then `tools/to-deploy-ascii.py` makes the ASCII copy); `build.cjs` wraps it into `game.html`.
  The output was byte-identical to the deployed database html (after the retired GM key scrub the server already did).
- Player name: shared name gate (`JDNG_CFG.inputs = #nameIn, #nameIn2`), locked to the account name by `public/js/account-name.js` (guests = Tamu).
  The server also replaces `displayName` and score names with the account name; guests save nothing (401 opens the login prompt).
- Only source change vs the deployed html: the TTS maker author field (`#mkAuthor`) now carries `data-jd-account-name`, so it is locked to the account name too.
- Player data (rooms, scores) lives in the database (`/game/ttskilat/api/game/*`); nothing in this folder stores it.

## Build

```
node resources/games/ttskilat/build.cjs
env -u ADMIN_API_SECRET php vendor/bin/phpunit tests/Feature/GitGamesTest.php
```

Rollback: remove `ttskilat` from `GIT_GAMES` or revert the commit; the database html is the rollback copy.
