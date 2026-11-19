# Gamelan Hero (game in git)

Rhythm game with gamelan bonang, kendang and gong.
Served at https://jadidaring.com/game/gamelanhero inside the site layout (main nav with Back button + game frame); see
`docs/games-in-git.md`.

- Single-file game: `game.html` is the whole game, no build step. There was no local build, so it was exported on
  2026-11-20 from the database with the read-only admin endpoint `GET /api/admin/games/gamelanhero/html` (GM key
  scrubbed, sha256 `c32293a38ea9…`), and the export runs through the server pipeline to exactly the live `/game/gamelanhero` page
  (checked by diff). Edit `game.html` directly.
- Player name: none. No player-name field and no name gate, so there is nothing to lock.
- Player data (rooms, scores, if any) lives in the database (`/game/gamelanhero/api/game/*`); nothing in this folder stores it.

Rollback: remove `gamelanhero` from `GIT_GAMES` or revert the commit; the database html is the rollback copy.
