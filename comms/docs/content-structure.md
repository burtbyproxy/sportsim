# Content Structure

**Maintained by:** Kirk
**Status:** Active — Uhura authors content, Scotty builds the loader, Spock validates

---

## Overview

All game content lives in `content/` at the repo root. This is a data layer — pure JSON, no code. The engine consumes it through a loader that Scotty maintains in `src/data/loader.js`.

Uhura owns `content/`. Nobody else writes content files. Spock validates them against data contracts. Scotty loads them into the engine.

## Directory Structure

```
content/
  maps/
    kenton/
      locations/        <- one JSON per location
        moms_house.json
        blue_parrot.json
        mocks_crest.json
        ...
      actions/          <- actions available at locations in this map
        moms_house.json
        bars.json       <- can group by type if it makes sense
        ...
      events/           <- events that fire in this map
        random.json
        triggered.json
        ...
    downtown/
      locations/
      actions/
      events/
    ...
  characters/           <- ALL characters, regardless of where they appear
    carl.json
    bartender_mocks.json
    clerk_plaid.json
    ...
  items/
    consumables.json
    junk.json
    ...
```

## Organizing Principle

**Maps organize places. Characters are people.**

- Locations, actions, and events are scoped to a map (neighborhood). Everything about Kenton's places lives under `maps/kenton/`.
- Characters are NOT scoped to a map. A bartender who works in Kenton and walks home through downtown is one person, not two half-people in two directories. All characters live in `content/characters/`.
- Items are global. A tallboy is a tallboy.

## Character Simulation Tiers

Every character has a `simulation` field that tells the engine how much work to do:

### `fixed`

Cheapest simulation. Character is at their post during scheduled hours, gone otherwise. One or two schedule entries. No status tracking, no decision-making.

**Use for:** Clerks, bouncers, bartenders who never leave their bar, the church greeter.

```json
{
  "simulation": "fixed",
  "schedule": [
    {
      "locationId": "blue_parrot",
      "startHour": 16,
      "endHour": 2,
      "probability": 0.95,
      "days": ["all"]
    }
  ]
}
```

### `routine`

Medium simulation. Character follows a predictable multi-stop schedule. They move through the world on a fixed path. No decision-making, but they're visible in transit.

**Use for:** Bartender who goes to Plaid Pantry after work then home. Regular who hits three bars in a night. The jogger in the park every morning.

```json
{
  "simulation": "routine",
  "schedule": [
    {
      "locationId": "mocks_crest",
      "startHour": 11,
      "endHour": 23,
      "probability": 0.9,
      "days": ["all"]
    },
    {
      "locationId": "ainsworth_plaid",
      "startHour": 23,
      "endHour": 0,
      "probability": 0.7,
      "days": ["all"]
    },
    {
      "locationId": "home_carl",
      "startHour": 0,
      "endHour": 11,
      "probability": 0.95,
      "days": ["all"]
    }
  ]
}
```

### `full`

Expensive simulation. Character has wants, status tracking, and decision-making. Their mood affects where they go. They cross neighborhood boundaries. They're playing the same game the player is.

**Use for:** Key characters with arcs. The rival. The mentor. The love interest. The person whose story intersects with yours in ways that matter.

```json
{
  "simulation": "full",
  "wants": "recognition",
  "fear": "irrelevance",
  "status": { "hunger": 50, "sobriety": 70, "energy": 60, "mood": 45, "health": 90 },
  "decisionWeights": {
    "low_sobriety": { "bias": "bar", "weight": 0.7 },
    "low_hunger": { "bias": "food", "weight": 0.8 },
    "low_mood": { "bias": "alone", "weight": 0.5 }
  }
}
```

### Promotion

A character can be promoted from `fixed` to `routine` to `full` by adding more data to their JSON. The engine scales its effort per character. No code changes, no file moves.

## JSON Conventions

- One character per file. File name = character ID (e.g., `carl.json` → id: `carl`)
- One location per file under `maps/<map>/locations/`
- Actions and events can be grouped by file however makes sense (per location, per type, etc.)
- All JSON must be valid against the data contracts in `comms/docs/data-contracts.md`
- Spock runs validation tests against every JSON file in `content/`

## Boundaries

| Who    | Can do                                                               |
| ------ | -------------------------------------------------------------------- |
| Uhura  | Write/edit any file in `content/`                                    |
| Spock  | Read and validate `content/` — files issues in Uhura's inbox         |
| Scotty | Read `content/` through the loader — never edits directly            |
| Kirk   | Reviews content for product/creative alignment — edits through Uhura |
| Bones  | Does not touch `content/` — consumes through the engine              |

## Loader

Scotty builds and maintains `src/data/loader.js`. It:

- Reads JSON files from `content/`
- Validates basic structure
- Feeds objects to the game store and simulation engine
- Is the ONLY code that imports from `content/`

The loader is code. The content is data. The boundary is clean.
