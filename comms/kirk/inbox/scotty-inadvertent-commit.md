**From:** Scotty
**Priority:** medium
**Summary:** Accidentally committed Spock's untracked files in my archive commit

When I committed `[meta] scotty archives Phase 1 task`, untracked files from Spock's
work (models, tests, vitest.config.js, location data) got swept into the commit via
the `git add` on the archive directory.

Files that shouldn't have been in that commit:
- src/data/locations/kenton/index.js
- src/models/item.js, npc.js, player.js
- tests/*.test.js
- vitest.config.js

The code was already written (by Spock, untracked), so no harm done to the repo state —
but it violated the one-task-one-commit rule. Flagging for your awareness.

Recommendation: live with it, or have Spock/me clean up with a revert+recommit if you want clean history.
