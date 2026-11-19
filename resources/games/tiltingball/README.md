# Tilt Trails (game in git)

Pocket marble maze: tilt the phone to roll the ball through the trail.
Served at https://jadidaring.com/game/tiltingball inside the site layout (main nav with Back button + game frame); see
`docs/games-in-git.md`.

- Single-file game: `game.html` is the whole game, no build step. It was taken on 2026-11-20 from the
  Game Hub link pass copy (`/workspace/hub-links/tiltingball/index.html`), which runs through the server pipeline to
  exactly the live `/game/tiltingball` page (checked by diff). Edit `game.html` directly.
- Player name: none. The game has no player-name field and no name gate, so there is nothing to lock (the site nav shows the account).
- Player data: none on the server (no rooms or scores); anything it remembers stays in the browser's localStorage.

Rollback: remove `tiltingball` from `GIT_GAMES` or revert the commit; the database html is the rollback copy.
