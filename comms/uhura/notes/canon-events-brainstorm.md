# Canon Events — Kenton Story Beats (Brainstorm)

Per Kirk: start thinking about these for Phase 4. Trigger conditions TBD once I know the full system, but here's what I'm hearing.

## Character Canon Events

**Tina's Last Shift**

- Tina stops appearing at the Blue Parrot. Greg is working alone now. Nobody explains it. If you ask Greg, he says "she doesn't work here anymore" and that's it. If your relationship with Tina was high enough, she left a note under a barstool with her pager number.
- Trigger: day count (early-mid game), automatic

**Vernon Says Your Name**

- You've sat near Vernon enough times. He's never spoken first. Today he does. He says your name. You never told him your name.
- Trigger: vernon_conversations >= 5

**Maurice Disappears**

- Maurice is gone. Not at any bar. Not in the park. Nobody's seen him. For a full in-game week, he doesn't exist. When he comes back, he doesn't explain. He has a new jacket. He does a card trick.
- Trigger: maurice_conversations >= 8, day count mid-game

**Dennis Walks Into the Blue Parrot**

- You're at the Parrot. Dennis walks in. Freezes. Looks around. Walks right back out. If your relationship is high enough, you see him outside on the sidewalk a minute later, smoking, staring at nothing.
- Trigger: player at blue_parrot, dennis scheduled at mocks_crest but mocks is closed (holiday/random closure), low probability roll

**Maurice Gets Hired (and Quits)**

- You witness Maurice's hustle in real time. He runs up a tab, can't pay, offers to clean. The bartender says no. Maurice cleans anyway. By the end of the night he's behind the bar. By the next night he's gone.
- Trigger: maurice at any bar, maurice_debt counter > threshold

## Location Canon Events

**The Park at Night**

- You go to the park after midnight. Something happens. Not violence — something stranger. The swing is spinning. There's nobody on it. You hear a voice but there's nobody there. Or there is. The game doesn't confirm.
- Trigger: columbia_park, hour > 0 and hour < 4, visit_count >= 3

**Blue Parrot Closes Early**

- You show up to the Parrot and it's dark. Hours early. No sign. No explanation. The neon parrot is off for the first time. Something happened. Nobody will tell you what.
- Trigger: mid-game, one-time, unlocks follow-up events

**The Arby's Incident**

- 2am Arby's. Someone is crying in a booth. Not drunk crying — real crying. You can sit with them or leave. If you sit, you learn something about Kenton you didn't know.
- Trigger: arbys, hour >= 1 and hour <= 3, luck roll

## Player State Canon Events

**First Blackout**

- Sobriety hits zero. You lose time. The game skips forward. You wake up somewhere you don't recognize. Your inventory has changed. Something is missing. Something else is there that wasn't before.
- Trigger: sobriety == 0, first time only

**First Time Broke**

- Money hits zero. The narrator acknowledges it. Not with sympathy. Just a fact. "You have no money. This is the situation." Opens up new desperate-tier actions.
- Trigger: money <= 0, first time only

**The Church Bag**

- You're starving. You go to Abundant Life. They hand you a bag. No sermon. No pitch. Just food. The narrator lets this sit.
- Trigger: hunger <= 10, abundant_life, first time only
