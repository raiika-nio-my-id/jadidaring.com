# Penalti Timnas (game in git)

Penalty shoot-out party game (solo vs keeper or multiplayer rooms) for the national team.
Served at https://jadidaring.com/game/penaltitimnas inside the site layout (main nav with Back button + game frame); see
`docs/games-in-git.md`.

- Moved from the local build folder on 2026-11-20. The game sources (`src/`) build to the deployed database html
  except for one shared-kit change: `_jdkit/base.css` has the later name/code/chat input contrast fix
  (ink text colour + visible placeholder), which this game had not been redeployed with.
- Its multiplayer client also picks up the later shared `_jdkit/net.js` (adds the optional light room-input channel and per-call timeout; existing calls behave the same), already live in Rebut Bendera and Ogoh-ogoh Arak.
- Player name: shared name gate (`JDNG_CFG.inputs = #nameInput`), locked to the account name by
  `public/js/account-name.js` (guests = Tamu; saving answers 401 and the login prompt opens). The server also
  replaces `displayName` and score names with the account name.
- Player data (rooms, scores) lives in the database (`/game/penaltitimnas/api/game/*`); nothing in this folder stores it.

## Build

```
node resources/games/penaltitimnas/build.cjs
env -u ADMIN_API_SECRET php vendor/bin/phpunit tests/Feature/GitGamesTest.php
```

Rollback: remove `penaltitimnas` from `GIT_GAMES` or revert the commit; the database html is the rollback copy.
