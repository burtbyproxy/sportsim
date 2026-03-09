# Phase 3: NPC Data, Model Extensions, Tests

**From:** Kirk
**Priority:** high
**Type:** task

---

## Summary

Write the people of Kenton. Build NPC data for 6-8 characters, extend the NPC model if needed, write NPC interaction action data, and test everything. You also review Scotty's code before he commits — that's mandatory now.

## Prerequisites

- Your `models/npc.js` already has `createNPC`, `getScheduledLocation`, `adjustRelationship`. Extend if needed.
- Read `comms/docs/narrative-voice.md` — every NPC is the main character of their own story. No cardboard cutouts.
- Coordinate with Bones on the simulation engine — he consumes your NPC data.

## Deliverables

### 1. Kenton NPC Data (`data/npcs/kenton.js`)

Write 6-8 NPCs. These are the people who make Kenton feel alive. Each one per the NPC contract:

**Required characters (minimum):**

- **A bartender at Mock's Crest** — the anchor. Always there during open hours. Knows everyone. Has opinions. The kind of bartender who remembers your drink and your mistakes.
- **A bartender at the Blue Parrot** — different vibe. The Parrot is seedier, darker. This bartender has seen everything and is done being surprised.
- **A park regular at Columbia Park** — there every day, rain or shine. Bench sitter. Has a story nobody asks about.
- **A convenience store clerk** — works at one of the Plaid Pantrys or 7-11s. Bored. Judgmental. Has seen you shoplift and hasn't said anything yet.
- **A bar regular at the Mouse Trap** — the kind of regular who comes with the furniture. Talks too much or not at all.
- **A church person at Abundant Life** — genuine believer or genuine hustler. Maybe both. Wants to save your soul or your wallet.

**Optional (if time allows):**

- Someone at the Dancin' Bare — bouncer, performer, or regular
- A street presence — someone you run into between locations, not tied to one place

**For each NPC, define:**

- `id`, `name`, `description` (physical, specific — per narrative voice guide)
- `habit` — one tic or repeated behavior
- `voice` — how they talk
- `schedule` — where they are and when, with probabilities
- `relationshipScore` — starting relationship with player (most start 0, some start slightly positive or negative)
- `want` — what they want (internal, may never surface)
- `fear` — what they fear (internal)
- `dialogueTreeIds` — empty array for now (real dialogue is Phase 4+)
- `stats` — basic NPC stats (doesn't need to be elaborate — just enough for contested rolls)
- `status` — default NPC status
- `psyche` — at least one trait per NPC (a trauma, obsession, or quirk)
- `level` — 1-3 for normals, higher for special characters

### 2. NPC Interaction Actions (`data/actions/npc-interactions.js`)

Write actions that appear when an NPC is present:

- "Talk to [name]" — generic interaction for every NPC. Charm check. Success: relationship +, narrative snippet. Failure: awkward, relationship neutral or slightly negative.
- 1-2 NPC-specific actions per character. Examples:
  - Mock's bartender: "Ask for a tab" (relationship check, money effect)
  - Park regular: "Sit with them" (no check, mood effect, slow relationship build)
  - Store clerk: "Make small talk" (charm check, low stakes)
  - Church person: "Listen to the pitch" (no check, karma effect, they like you more)

Each action follows the Action contract. Include success/failure narratives using `toNarrativeText()` — placeholder quality is fine, Kirk will do a content pass.

**Important:** These actions need to be discoverable by the action engine. Define how NPC-contextual actions get into the registry:

- Option A: Actions reference an `npcId` field — engine filters by NPCs present
- Option B: Actions are keyed to location + NPC presence
- Pick whichever is cleaner and document your choice. Notify Bones so his engine can filter correctly.

### 3. Wire `npcSlots` in Location Data

The Kenton location data has empty `npcSlots` arrays. Fill them with the NPC IDs you create. Each location should list which NPCs CAN appear there (the simulation decides who IS there).

### 4. NPC Model Extensions (if needed)

Review `models/npc.js` against the data you're writing. If you need functions that don't exist:

- `getNPCDescription(npc, context)` — context-sensitive description (like location descriptions — drunk variant, night variant, repeat visit)
- Any helper for NPC action generation

Add to the model. Test it.

### 5. Tests

- Unit tests for all new NPC model functions
- Data validation tests: every NPC in kenton.js conforms to contract
- Every NPC interaction action conforms to Action contract
- Schedule coverage: verify every NPC has at least one schedule entry that puts them somewhere during the game's active hours
- Integration: `getScheduledLocation` returns valid location IDs that exist in Kenton data

### 6. Review Scotty's Code

When Scotty reports Phase 3 code ready:

- Review the simulation worker integration
- Review NPC display in LocationView
- Review NPC interaction wiring in the action pipeline
- Review legacy cleanup (make sure nothing alive got killed)
- Approve or send back with specifics

## Notes

- Write these people like they're real. The bartender at Mock's Crest isn't "Bartender NPC #1." He's a specific human being with a name, a face, a bad habit, and a reason he's behind that bar instead of anywhere else in the world. Read the narrative voice guide. Then read it again.
- Don't over-engineer the schedules. Most NPCs are in one place most of the time with occasional variation. The bartender is at the bar during open hours. The park regular is at the park during the day. Keep it simple.
- NPC stats don't need to be balanced. The bartender is tougher than you. The church person has more charm. That's life.

## Acceptance Criteria

1. 6-8 NPCs defined with full contract compliance
2. NPC interaction actions written for all characters
3. `npcSlots` populated on all relevant Kenton locations
4. All tests pass, NPC data validated
5. Scotty's Phase 3 code reviewed before commit
