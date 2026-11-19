# Drawquarium (game in git)

Shared drawing aquarium: draw a fish (or other creature), it swims in one public tank with everyone else.
Langit Bersama is its fork (same net/rules/codec). Served at https://jadidaring.com/game/drawquarium inside
the site layout (main nav + game frame). See `docs/games-in-git.md` for the pattern.

- Source moved from the local build folder on 2026-11-20. Verified before the move: `build.cjs` output is
  byte-identical to the deployed database html (after the retired GM key scrub the server already applied).
- Player name follows the Jadidaring account (`window.__JD_ME`, injected by `PlayerNameBridge`). The gate
  (opened from the name chip) still picks avatar and language, but the name field is read-only. Guests play
  as "Tamu"; saving (join, draw, chat) answers 401 and the shared login prompt opens. The server also replaces
  `displayName` with the account name on create/join/match/watch.
- Player data (rooms, creatures, chat, residents) lives in the database, reached through
  `/game/drawquarium/api/game/*`. Nothing in this folder stores player data.

## Build / deploy

```
node resources/games/drawquarium/build.cjs
env -u ADMIN_API_SECRET php vendor/bin/phpunit tests/Feature/GitGamesTest.php
git commit && git push   # push to main deploys
```

Rollback: remove `drawquarium` from `GIT_GAMES` (server `.env` or `config/singlepage.php`), or revert the
commit; `/game/drawquarium` then serves the database html again (kept as the rollback copy).
