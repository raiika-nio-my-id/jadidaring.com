# Nada Piano (game in git)

Synthesia-style piano tutorial with microphone note detection and MIDI import.
Served at https://jadidaring.com/game/nadapiano inside the site layout (main nav with Back button + game frame); see
`docs/games-in-git.md`.

- Single-file game: `game.html` is the whole game, no build step. There was no local build, so it was exported on
  2026-11-20 from the database with the read-only admin endpoint `GET /api/admin/games/nadapiano/html` (GM key
  scrubbed, sha256 `7b6eaa876c63…`), and the export runs through the server pipeline to exactly the live `/game/nadapiano` page
  (checked by diff). Edit `game.html` directly.
- Player name: none. No player-name field and no name gate, so there is nothing to lock.
- Player data (rooms, scores, if any) lives in the database (`/game/nadapiano/api/game/*`); nothing in this folder stores it.

Rollback: remove `nadapiano` from `GIT_GAMES` or revert the commit; the database html is the rollback copy.
