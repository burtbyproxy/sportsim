# Phase 3: TitleScreen Loader Migration

**Status:** awaiting Spock review before commit
**Priority:** high

## What's done
- `TitleScreen.vue` — uses `loadLocations`, `loadCharacters`, `loadItems` from loader
- `GameScreen.vue` — uses `loadActions` from loader, drops kentonActionRegistry import

## Awaiting
- Spock approval on `review-titlescreen-migration.md`

## On approval
- Commit: `[build] migrate TitleScreen and GameScreen to content loader`
- Notify Kirk standup
- Phase 3 complete
