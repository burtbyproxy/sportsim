# Phase 3: Bring Kenton to Life — Characters, Locations, Actions

**From:** Kirk
**Priority:** high
**Type:** task

---

## Summary

You are writing the people and places of Kenton, Portland, circa 2001. This is your debut. Everything you write goes in `content/` as JSON. Read `comms/docs/content-structure.md` for the directory structure. Read `comms/docs/narrative-voice.md` — that is your bible. Read `comms/docs/data-contracts.md` for the exact data shapes.

You workshop with the Admiral on creative direction. If you're unsure about a character's voice, a location's feel, or the tone of a moment — ask the Admiral. That's what he's there for.

## Prerequisites

- Read `comms/docs/narrative-voice.md` — memorize it
- Read `comms/docs/data-contracts.md` — Character contract, Location contract, Action contract
- Read `comms/docs/content-structure.md` — where things go and why

## Deliverables

### 1. Kenton Characters (`content/characters/`)

Write 8-10 characters. One JSON file per character. Mix of simulation tiers:

**Must-have characters:**

- **Bartender at Mock's Crest** (`routine`) — the anchor of Kenton nightlife. After shift, walks to Plaid Pantry for cigarettes, then home. Knows every regular by name and drink. Has been behind that bar long enough to have opinions about everything. Schedule: 11am-11pm at Mock's, then routine stops.

- **Bartender at the Blue Parrot** (`fixed`) — seedier bar, seedier bartender. Has seen everything. Is done being surprised. Doesn't talk unless talked to. Schedule: 4pm-2am.

- **Park regular at Columbia Park** (`fixed`) — there every day. Bench. Same bench. Rain or shine. Nobody knows where they go at night. Has a story nobody asks about. Schedule: 7am-7pm.

- **Convenience store clerk** (`fixed`) — works at one of the Plaid Pantrys. Bored out of their mind. Has noticed you shoplifting. Hasn't said anything. Yet. Schedule: night shift, 10pm-6am.

- **Bar regular at the Mouse Trap** (`routine`) — comes with the furniture. Hits the Mouse Trap, then Mock's, then staggers to Arby's at closing. Has a tab everywhere and pays none of them. Schedule: 5pm-2am rotating between bars.

- **Church person at Abundant Life** (`fixed`) — there during church hours. Genuine warmth or genuine hustle. Wants to save you. From what, exactly, is unclear. Schedule: 8am-6pm.

**Should-have:**

- **Someone at the Dancin' Bare** (`fixed`) — bouncer or regular. The door presence. Decides if you're getting in tonight.

- **A full-sim character** (`full`) — one person who's living a real parallel life. They have status, mood, wants driving their behavior. You might see them at the bar one night and the church the next morning. They're on their own journey. This is the character the player will feel is most real. Make them someone worth knowing.

**For each character, follow the Character contract exactly:**

- `id`, `name`, `description`, `habit`, `voice`
- `simulation` tier
- `stats` — basic stats for contested rolls
- `status` — null for fixed, basic for routine, full for full-sim
- `psyche` — at least one trait (trauma, obsession, or quirk)
- `schedule` — per simulation tier requirements
- `relationshipScore` — starting relationship (most at 0)
- `want`, `fear` — internal motivations
- `dialogueTreeIds` — empty array (dialogue is Phase 4+)
- `level`
- `decisionWeights` — only for full-sim characters

### 2. Migrate & Rewrite Kenton Locations (`content/maps/kenton/locations/`)

The 17 Kenton locations currently live in `src/data/locations/kenton/index.js` as JavaScript. Migrate them to individual JSON files in `content/maps/kenton/locations/`.

For each location:

- Migrate existing data (id, type, variant, display, exits, availability)
- **Rewrite descriptions.** The existing ones are placeholder quality. Write real descriptions per the narrative voice guide:
  - `default` — first/typical visit, neutral state
  - `night` — nighttime variant
  - `drunk` — how it reads when you're hammered
  - `repeat` — subsequent visits (the description should evolve)
  - `exhausted` — how it reads when you're running on empty
  - `starving` — desperation colors everything
- Add one specific sensory detail per location that nobody else would think to include
- Populate `npcSlots` with the character IDs you created

### 3. Kenton Actions (`content/maps/kenton/actions/`)

Migrate and expand the existing actions from `src/data/actions/kenton.js`. Write as JSON.

- Keep the existing actions (raid fridge, order beer, etc.) but rewrite the narratives with real voice
- Add NPC interaction actions:
  - "Talk to [name]" for every character — charm check, relationship effect, narrative
  - 1-2 character-specific actions (ask bartender for a tab, sit with the park regular, listen to the church pitch)
- NPC actions need an `npcId` field so the engine knows they're only available when that character is present
- Every action needs `success` and `failure` narrative text that sounds like Portland, not like a video game

### 4. Starting Items (`content/items/`)

Write a few basic items the player might encounter in Phase 3:

- Tallboy of PBR
- Pack of cigarettes
- Loose change
- Bus token (for future cross-neighborhood travel)
- Whatever else feels right for a broke person in Kenton in 2001

## Notes

- You do not write code. You write JSON. If you're unsure about a data shape, ask Spock — he validates your files against the contracts.
- Kirk commits your content files. You don't touch git.
- When your content is ready, notify Kirk. He'll commit and notify the crew.
- Workshop with the Admiral on character voices and Portland authenticity. He lived it. You're writing his memory.

## Acceptance Criteria

1. 8-10 characters in `content/characters/`, all conforming to Character contract
2. Mix of simulation tiers (majority fixed, a few routine, at least one full)
3. All 17 Kenton locations migrated to `content/maps/kenton/locations/` with rewritten descriptions
4. Actions migrated and expanded with NPC interactions in `content/maps/kenton/actions/`
5. Basic items defined in `content/items/`
6. All content follows the narrative voice guide
7. All JSON is valid and contract-compliant
