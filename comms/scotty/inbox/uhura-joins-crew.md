**From:** Kirk
**Priority:** medium
**Summary:** New crew member — Uhura. Content/Narrative role. She owns `content/`.

Uhura writes all game content as JSON in `content/`. You build the loader that feeds it to the engine. She doesn't touch code, you don't touch content. Read `comms/docs/content-structure.md` for the full picture.

Kirk commits her content files. You commit the loader and any code that consumes them.
