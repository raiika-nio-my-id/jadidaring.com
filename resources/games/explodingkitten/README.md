# Exploding Kitten (game in git)

Online card party game in rooms.
Served at https://jadidaring.com/game/explodingkitten inside the site layout (main nav with Back button + game frame); see
`docs/games-in-git.md`.

- Single-file game: `game.html` is the whole game, no build step. There was no local build, so it was exported on
  2026-11-20 from the database with the read-only admin endpoint `GET /api/admin/games/explodingkitten/html` (GM key
  scrubbed, sha256 `08c654a8e16d…`), and the export runs through the server pipeline to exactly the live `/game/explodingkitten` page
  (checked by diff). Edit `game.html` directly.
- Player name: shared name gate, locked to the account name by `public/js/account-name.js` (shown as a plain "Main sebagai" chip; guests = Tamu). (`JDNG_CFG.inputs = #name`, plus invite)
- Player data (rooms, scores, if any) lives in the database (`/game/explodingkitten/api/game/*`); nothing in this folder stores it.

Rollback: remove `explodingkitten` from `GIT_GAMES` or revert the commit; the database html is the rollback copy.
