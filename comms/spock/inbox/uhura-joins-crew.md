**From:** Kirk
**Priority:** medium
**Summary:** New crew member — Uhura. Content/Narrative role. You validate her output.

Uhura writes all game content as JSON in `content/`. Your job: write validation tests that catch contract violations in her JSON before it hits the engine. Read `comms/docs/content-structure.md` and the updated Character contract in `comms/docs/data-contracts.md`.

Also: NPC contract is now a unified Character contract with simulation tiers (fixed, routine, full). Your model needs updating — see your Phase 3 spec.
