# Phase 1: Models, Data Layer, Test Harness

**From:** Kirk
**Priority:** high
**Type:** task

---

## Summary

Build the data models and migrate the Kenton location data. You own everything in `src/models/` and `src/data/`. Your models are pure JavaScript classes/functions with ZERO Vue dependency — they must be buildable and testable in complete isolation. You also own the Vitest test harness.

## Prerequisites

- Read `comms/docs/data-contracts.md` — build to these interfaces exactly.
- The existing models in `src/models/` are riddled with syntax errors and wrong patterns. Do NOT attempt to fix them. Rebuild from scratch per the contracts.

## Deliverables

### 1. Player Model (`models/player.js`)

Factory function or class that creates a `Player` per the data contract.

- `createPlayer(name)` — returns a new Player with default starting stats (all ~10-20, randomized slightly), empty inventory, zero money, starting status (hunger 50, sobriety 80, energy 70, mood 40, health 100), empty psyche, currentLocationId = "moms_house".
- `getEffectiveStat(player, statName)` — returns base + sum of modifiers. This is what the dice engine uses.
- `tickModifiers(player)` — decrement modifier durations, remove expired ones. Called every game tick.
- `addModifier(player, statName, modifier)` — add a temporary modifier to a stat.
- `addItem(player, item)` — add to inventory (handle stacking).
- `removeItem(player, itemId)` — remove from inventory.
- `hasItem(player, itemId)` — boolean check.
- `adjustStatus(player, statusName, delta)` — change a status value, clamp to valid range.
- `adjustMoney(player, delta)` — can go negative (debt).
- `addTrauma(player, trauma)` — add to psyche.traumas.
- `feedObsession(player, obsessionId, amount)` — increase obsession strength.
- `updateArchetypeScore(player, archetypeId, delta)` — update invisible identity tracking.
- `incrementCounter(player, counterName, delta)` — for unlock triggers.

All functions should be pure where possible (return new state) or clearly mutative (documented).

### 2. Location Model (`models/location.js`)

- `createLocation(data)` — takes raw JSON data, returns a `Location` per contract.
- `getDescription(location, context)` — returns the appropriate description string based on context object `{ timeOfDay, playerStatus, visitCount }`. Falls back to "default" if no specific variant exists.
- `getAvailableExits(location)` — returns exits array.
- `isOpen(location, hour)` — checks availability window.
- `incrementVisitCount(location)` — mutates visitCount.

### 3. NPC Model (`models/npc.js`)

- `createNPC(data)` — takes raw JSON data, returns an `NPC` per contract.
- `getScheduledLocation(npc, hour, dayOfWeek)` — returns the locationId where this NPC should be, based on schedule entries and probability. Does NOT roll dice — just returns the candidate. The simulation Worker rolls.
- `adjustRelationship(npc, delta)` — adjust relationship score with player, clamp -100 to 100.

### 4. Item Model (`models/item.js`)

- `createItem(data)` — takes raw JSON, returns `Item` per contract.
- `applyEffects(item, player)` — returns the stat/status changes that would result from using this item (does not mutate player — that's the engine's job).

### 5. Kenton Location Data (`data/locations/kenton/`)

Migrate the 17 locations from `src/data/maps/north/kenton.json` to the new format. One file per location.

Each location needs at minimum:
- `id`, `type`, `variant`, `display` (from existing data)
- `descriptions.default` — write a placeholder description (2-3 sentences, can be improved later by Kirk's content pass). Reference `comms/docs/narrative-voice.md` for tone.
- `exits` — define connections between Kenton locations with travel times. Use your judgment on adjacency — these are real Portland locations. Walking between nearby spots = 1 tick (15 min). Across the neighborhood = 2-3 ticks.
- `availability` — set reasonable hours. Bars: 11am-2am. Markets: 6am-midnight. Church: 8am-8pm. Park: always. Home: always. School: closed to player.
- `npcSlots` — empty array for now (NPCs come in Phase 3)
- `actionIds` — empty array for now (actions come in Phase 2)

Export as a single object keyed by location ID.

### 6. Vitest Test Harness

- Configure Vitest in the project
- Write unit tests for EVERY public function in every model
- Test edge cases: stat clamping, modifier expiration, empty inventory operations, time boundary checks
- Test location description fallback logic
- Test NPC schedule resolution
- **Minimum 80% coverage on models from day one**

## The 17 Kenton Locations (for reference)

| ID | Type | Display |
|---|---|---|
| moms_house | home | Mom's House |
| blue_parrot | bar/tavern | The Blue Parrot |
| mocks_crest | bar/tavern | Mock's Crest Tavern |
| columbia_park | park | Columbia Park |
| mouse_trap | bar/tavern | The Mouse Trap |
| arbys | restaurant | Arby's |
| toads_express | fuel/convenience | Toad's Express |
| ainsworth_plaid | market/convenience | Plaid Pantry |
| denver_711 | market/convenience | 7-11 |
| greeley_711 | market/convenience | 7-11 |
| greeley_plaid | market/convenience | Plaid Pantry |
| glitters | market/pawn | All That Glitters |
| dancin_bare | bar/exotic | The Dancin' Bare |
| liquor | market/liquor | Kenton Liquor Store |
| lombard_dental | clinic/dental | Lombard Dental |
| chief_joseph | school/elementary | Chief Joseph Elementary |
| abundant_life | church | Abundant Life Church |

## Notes

- Your code has ZERO Vue imports. It's pure JavaScript. Scotty imports your models into Vue components and Pinia stores.
- Bones' engines (dice, actions, events) will call your model functions. Make sure the interfaces are clean.
- If you spot something wrong or missing in the data contracts, drop a message in Kirk's inbox. Don't guess.
- Favor factory functions over classes unless there's a clear reason for classes. Simpler, more testable, better for serialization to localStorage.

## Acceptance Criteria

1. All model functions implemented per data contracts
2. All 17 Kenton locations migrated to new format with descriptions, exits, and availability
3. Vitest passes with 80%+ coverage on all models
4. Zero Vue dependencies in any model file
5. All models serialize cleanly to JSON (for localStorage saves)
