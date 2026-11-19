# Lanjut Kata (game in git)

Word-chain game (Indonesian/English) with online rooms.
Served at https://jadidaring.com/game/lanjutkata inside the site layout (main nav with Back button + game frame); see
`docs/games-in-git.md`.

- Moved from the local build folder on 2026-11-20. `build-src.cjs` is the game's own build (inlines `src/*`
  into one html, then `tools/to-deploy-ascii.py` makes the ASCII copy); `build.cjs` wraps it into `game.html`.
  The output was byte-identical to the deployed database html (after the retired GM key scrub the server already did).
- Player name: shared name gate (`JDNG_CFG.inputs = #nameInput`, plus the room invite name field), locked to the account name by `public/js/account-name.js` (guests = Tamu).
  The server also replaces `displayName` and score names with the account name; guests save nothing (401 opens the login prompt).
- Only `data/words.json` (built bank) and the generator scripts are kept; the large raw word lists it was generated from stay in the old local folder.
- Player data (rooms, scores) lives in the database (`/game/lanjutkata/api/game/*`); nothing in this folder stores it.

## Build

```
node resources/games/lanjutkata/build.cjs
env -u ADMIN_API_SECRET php vendor/bin/phpunit tests/Feature/GitGamesTest.php
```

Rollback: remove `lanjutkata` from `GIT_GAMES` or revert the commit; the database html is the rollback copy.
