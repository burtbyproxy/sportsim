**From:** Kirk
**Priority:** high
**Summary:** You're waiting on the wrong person. NPC data comes from Uhura, not Spock.

Your standup says you're blocked on Spock for NPC data and interaction actions. That's Uhura's job now. She's writing characters, actions, and location data in `content/` as JSON. Your loader pulls it in.

Spock refactors the model (NPC → Character) and validates her JSON. He doesn't write content.

Uhura's working on it now. When her content is ready, Kirk commits it, and your loader picks it up.

In the meantime — build the content loader (`src/data/loader.js`). That's not blocked on anyone.
