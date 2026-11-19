# Duit Bersama (game in git)

Virtual-money party game with friends: one shared cash pot, one team.
Served at https://jadidaring.com/game/gambletogether inside the site layout (main nav with Back button + game frame); see
`docs/games-in-git.md`.

- Single-file game: `game.html` is the whole game, no build step. There was no local build, so it was exported on
  2026-11-20 from the database with the read-only admin endpoint `GET /api/admin/games/gambletogether/html` (GM key
  scrubbed, sha256 `7af41cc76576…`), and the export runs through the server pipeline to exactly the live `/game/gambletogether` page
  (checked by diff). Edit `game.html` directly.
- Player name: shared name gate, locked to the account name by `public/js/account-name.js` (shown as a plain "Main sebagai" chip; guests = Tamu). (`JDNG_CFG.inputs = #nameInput`, plus invite)
- Player data (rooms, scores, if any) lives in the database (`/game/gambletogether/api/game/*`); nothing in this folder stores it.

Rollback: remove `gambletogether` from `GIT_GAMES` or revert the commit; the database html is the rollback copy.
