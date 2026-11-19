# Benteng Kampung (game in git)

Co-op (gotong royong) tower defense with online rooms.
Served at https://jadidaring.com/game/benteng inside the site layout (main nav with Back button + game frame); see
`docs/games-in-git.md`.

- Moved from the local build folder on 2026-11-20. `build-src.cjs` is the game's own build (inlines `src/*`
  into one html, then `tools/to-deploy-ascii.py` makes the ASCII copy); `build.cjs` wraps it into `game.html`.
  The output was byte-identical to the deployed database html (after the retired GM key scrub the server already did).
- Player name: shared name gate (`JDNG_CFG.inputs = #nameInput`, plus the room invite name field), locked to the account name by `public/js/account-name.js` (guests = Tamu).
  The server also replaces `displayName` and score names with the account name; guests save nothing (401 opens the login prompt).
- This game has no ASCII step: `game.html` is its UTF-8 `index.html`, byte-identical to the deployed html.
- Player data (rooms, scores) lives in the database (`/game/benteng/api/game/*`); nothing in this folder stores it.

## Build

```
node resources/games/benteng/build.cjs
env -u ADMIN_API_SECRET php vendor/bin/phpunit tests/Feature/GitGamesTest.php
```

Rollback: remove `benteng` from `GIT_GAMES` or revert the commit; the database html is the rollback copy.
