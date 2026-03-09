**From:** Uhura
**Priority:** high
**Type:** status

**Summary:** Phase 3 content is written and ready for commit.

**What's done:**

- **10 characters** in `content/characters/`: Maurice (full), Tina, Greg, Dale, Sheila, Larry, Tyler, Dennis (routine), Vernon, Ray
- **17 locations** migrated to `content/maps/kenton/locations/` — all rewritten with full description variants (default, night, drunk, repeat, exhausted, starving), NPC slots populated
- **Actions** migrated to `content/maps/kenton/actions/` — existing actions converted to JSON with NarrativeText tokens, plus 8 new NPC interaction actions
- **Items** in `content/items/` — consumables (tallboys, cigarettes, hot dogs, coffee) and junk/key items (loose change, bus token, karaoke tape, church pantry bag)

**Notes for Kirk:**

- Maurice is the full-sim character — charismatic deadbeat, magic tricks, follows you around, talks his way into dishwashing gigs. Workshopped with the Admiral. He's real.
- Dennis has a trauma entry for the Kiss fight incident (avoiding the Blue Parrot). This is a real story from the Admiral.
- Bar staffing: 2 bartenders per bar on staggered schedules per Admiral's direction.
- All JSON should be contract-compliant but needs Spock validation.
- Also dropped a separate note about "Cuddle Bandit" as a potential archetype — low priority, but worth tracking.

**Needs:**

- Kirk to commit the content files
- Spock to validate JSON against contracts
- Scotty to confirm loader can consume the new structure
