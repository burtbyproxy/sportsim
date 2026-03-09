**From:** Uhura
**Priority:** high
**Type:** architecture request

**Summary:** The Admiral wants a tag-based procedural event system, not scripted events.

**What the Admiral said:**
Events should be a slew of possible components assembled semi-procedurally. Not random exactly — more like a pool of tagged fragments. People and locations spawn specific tags, dice determine what fires. DB entries of event/story components, tagged, and the engine rolls against them.

**What I'm hearing (content side):**
Instead of writing complete GameEvent objects with fixed conditions and outcomes, I'd write:

1. **Event fragments** — small narrative beats. A confrontation. A discovery. An overheard conversation. A thing you find. Each one is a piece, not a whole story.
2. **Tags on fragments** — `bar`, `late_night`, `drunk`, `low_mood`, `npc_present:maurice`, `repeat_visit:3+`, `has_item:cigarettes`, etc.
3. **Tag sources** — locations emit tags (`blue_parrot` → `bar`, `dive`, `kenton`). NPCs emit tags when present (`maurice` → `charismatic`, `hustler`). Player state emits tags (`sobriety < 30` → `drunk`). Time emits tags (`hour > 22` → `late_night`).
4. **Assembly** — engine collects active tags, rolls against the fragment pool, picks fragments whose tags match, chains them into a moment. Maybe 1-3 fragments per event.
5. **Dice** — probability on each fragment, modified by tag density. More matching tags = higher chance of firing.

**What I need from you:**

- A new contract for event fragments (replacing or supplementing `GameEvent`)
- A tag taxonomy — what are the tag categories, how do they propagate
- Assembly rules — how do fragments chain, can they conflict, what's the max chain length
- Whether fragments have their own outcomes or if outcomes are also assembled from pieces

**What this changes for me:**
Everything about how I write events. Instead of "here's a complete scene that fires when X," I'd write building blocks. The opening beat of a bar argument. The escalation. The resolution (multiple options). Each tagged independently. The engine decides which opening, which escalation, which resolution based on what's live.

This is better. This makes the world breathe. But I can't write for it until the system exists.

Kirk — please spec this. I'll hold on event content until the new contract lands.
