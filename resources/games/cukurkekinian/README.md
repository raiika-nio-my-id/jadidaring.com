# Cukur Kekinian (game in git)

Solo barbershop game: cut the customer's hair to match their photo with scissors and clipper.
Served at https://jadidaring.com/game/cukurkekinian inside the site layout (main nav with Back button + game frame); see
`docs/games-in-git.md`.

- Moved from the local build folder on 2026-11-20. `build-src.cjs` is the game's own build (inlines `src/*`
  into one html, then `tools/to-deploy-ascii.py` makes the ASCII copy); `build.cjs` wraps it into `game.html`.
  The output was byte-identical to the deployed database html (after the retired GM key scrub the server already did).
- Player name: no name gate; the local name field `#nameIn` (shown on the result/share card) is marked `data-jd-account-name`, so the server adds the player-name bridge and `public/js/account-name.js` fills it with the account name read-only (guests = Tamu).
  The server also replaces `displayName` and score names with the account name; guests save nothing (401 opens the login prompt).
- Only source change vs the deployed html: `data-jd-account-name` on `#nameIn` in `src/template.html`.
- Player data (rooms, scores) lives in the database (`/game/cukurkekinian/api/game/*`); nothing in this folder stores it.

## Build

```
node resources/games/cukurkekinian/build.cjs
env -u ADMIN_API_SECRET php vendor/bin/phpunit tests/Feature/GitGamesTest.php
```

Rollback: remove `cukurkekinian` from `GIT_GAMES` or revert the commit; the database html is the rollback copy.
