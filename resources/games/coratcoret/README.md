# Corat-Coret (game in git)

Draw-and-guess party game (2-16 players online, plus offline practice / doodle / one-phone party modes).
Served at https://jadidaring.com/game/coratcoret inside the site layout (main nav + game frame); see
`docs/games-in-git.md`. Former local project name: drawguess (the name gate still uses `jdng.drawguess`).

- Source moved from the local build folder on 2026-11-20; `build.cjs` output is byte-identical to the deployed
  database html (after the retired GM key scrub the server already applied).
- Player name follows the Jadidaring account: `GitGames::frame()` adds `public/js/account-name.js` after the
  player-name bridge. It fills `#nameInput` (listed in `JDNG_CFG.inputs`) and the invite gate field with the
  account name, makes them read-only and overwrites `dg.name`. Guests are "Tamu"; online play needs login
  (401 -> login prompt). The one-phone party mode player names (`#pn0..`) are local labels and stay editable.
- Rooms and scores live in the database (`/game/coratcoret/api/game/*`); nothing here stores player data.

## Build

```
node resources/games/coratcoret/build.cjs     # tools/inline.cjs -> tools/shrink-pack.py (zopfli, optional) -> tools/to-deploy-ascii.py
env -u ADMIN_API_SECRET php vendor/bin/phpunit tests/Feature/GitGamesTest.php
```

Rollback: remove `coratcoret` from `GIT_GAMES` or revert the commit; the database html is the rollback copy.
