# Bumerang Sakti (game in git)

Boomerang throwing arcade with a global leaderboard.
Served at https://jadidaring.com/game/bumerangsakti inside the site layout (main nav with Back button + game frame); see
`docs/games-in-git.md`.

- Moved from the local build folder on 2026-11-20. `build-src.cjs` is the game's own build (inlines `src/*`
  into one html, then `tools/to-deploy-ascii.py` makes the ASCII copy); `build.cjs` wraps it into `game.html`.
  The output was byte-identical to the deployed database html (after the retired GM key scrub the server already did).
- Player name: name gate (`JDNG_CFG.inputs = []`) plus its own name screen; `#nameIn` is marked `data-jd-account-name`, so `public/js/account-name.js` fills it with the account name read-only (guests = Tamu).
  The server also replaces `displayName` and score names with the account name; guests save nothing (401 opens the login prompt).
- Only source change vs the deployed html: `data-jd-account-name` on `#nameIn` in `src/template.html`.
- Player data (rooms, scores) lives in the database (`/game/bumerangsakti/api/game/*`); nothing in this folder stores it.

## Build

```
node resources/games/bumerangsakti/build.cjs
env -u ADMIN_API_SECRET php vendor/bin/phpunit tests/Feature/GitGamesTest.php
```

Rollback: remove `bumerangsakti` from `GIT_GAMES` or revert the commit; the database html is the rollback copy.
