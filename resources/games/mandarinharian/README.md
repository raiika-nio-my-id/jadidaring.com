# Mandarin Harian (game in git)

One Mandarin word a day (WITA): listen + match quiz, progress in localStorage, daily "sudah belajar" list.
Served at https://jadidaring.com/game/mandarinharian inside the site layout (main nav with Back button + game frame); see
`docs/games-in-git.md`.

- Moved from the local build folder on 2026-11-20. `build-src.cjs` is the game's own build (inlines `src/*`
  into one html, then `tools/to-deploy-ascii.py` makes the ASCII copy); `build.cjs` wraps it into `game.html`.
  The output was byte-identical to the deployed database html (after the retired GM key scrub the server already did).
- Player name: name gate only (`JDNG_CFG.inputs = []`): the gate field `#jdngN` and `JDNG.name` are set to the account name by `public/js/account-name.js` (guests = Tamu); the daily list send uses `JDNG.name`.
  The server also replaces `displayName` and score names with the account name; guests save nothing (401 opens the login prompt).
- The client subdomain mandarinharian.jadidaring.com keeps answering 301 to https://jadidaring.com/game/mandarinharian (old subdomain redirect, unchanged). `data/audio` (mp3 source for `tools/mkbank.py --bank`) was not copied; `src/bank.js` already holds the built bank.
- Player data (rooms, scores) lives in the database (`/game/mandarinharian/api/game/*`); nothing in this folder stores it.

## Build

```
node resources/games/mandarinharian/build.cjs
env -u ADMIN_API_SECRET php vendor/bin/phpunit tests/Feature/GitGamesTest.php
```

Rollback: remove `mandarinharian` from `GIT_GAMES` or revert the commit; the database html is the rollback copy.
