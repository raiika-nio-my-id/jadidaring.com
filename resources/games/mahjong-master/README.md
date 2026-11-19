# Mahjong Solitaire & Multiplayer (game in git)

Mahjong solitaire plus multiplayer rooms.
Served at https://jadidaring.com/game/mahjong-master inside the site layout (main nav with Back button + game frame); see
`docs/games-in-git.md`.

- Single-file game: `game.html` is the whole game, no build step. There was no local build, so it was exported on
  2026-11-20 from the database with the read-only admin endpoint `GET /api/admin/games/mahjong-master/html` (GM key
  scrubbed, sha256 `69aef2859375…`), and the export runs through the server pipeline to exactly the live `/game/mahjong-master` page
  (checked by diff). Edit `game.html` directly.
- Player name: shared name gate, locked to the account name by `public/js/account-name.js` (shown as a plain "Main sebagai" chip; guests = Tamu). (`JDNG_CFG.inputs = #mp-player-name`)
- Player data (rooms, scores, if any) lives in the database (`/game/mahjong-master/api/game/*`); nothing in this folder stores it.

Rollback: remove `mahjong-master` from `GIT_GAMES` or revert the commit; the database html is the rollback copy.
