# Anomali Mini Market (game in git)

Single-player 24-hour minimarket cashier with anomalies (Latihan / Shift Biasa / Malam Anomali, folklore packs).
Served at https://jadidaring.com/game/anomaliminimarket inside the site layout; see `docs/games-in-git.md`.

- Moved from the local build folder on 2026-11-20; `build.cjs` output is byte-identical to the deployed database
  html. `src/ship/*.js` is the shipped terser copy of `src/{game,render,app}.js` (rebuild it with `SHIP=squeeze`
  or `SHIP=terser` after editing the readable files). The shared kit (name gate, hub snippet, base css, kit.js) is
  vendored in `resources/games/_jdkit/` (from the old local jdkit), so later jdkit games can reuse it.
- Player name: shared name gate (`JDNG_CFG.inputs = #nameInput`), locked to the account name by
  `public/js/account-name.js` (guests = Tamu). No server player data: progress (endings, best, tutorial) stays in
  `localStorage` keys `anomaliminimarket.*`, unchanged by the move (same origin, same keys).

## Build

```
node resources/games/anomaliminimarket/build.cjs
env -u ADMIN_API_SECRET php vendor/bin/phpunit tests/Feature/GitGamesTest.php
```

Rollback: remove `anomaliminimarket` from `GIT_GAMES` or revert the commit; the database html is the rollback copy.
