# Portland 2001 UI Brief — Working Notes

## What I'm doing

Six changes. All at once. It's a vibe not a checklist.

### 1. Narrative auto-play

- The narrative DOES auto-play (LocationView line 98-101)
- The UX problem is "click or press space to skip" reads as REQUIRED
- Fix: change to "· space to skip ·" — subtle, clearly optional
- Remove click handler from narrative-log (or keep it but don't advertise it so aggressively)

### 2. Exits → ActionMenu

- LocationView: remove <div class="location-exits"> entirely
- LocationView: keep keyboard handler for exits (letter keys) but move it...
  actually NO — ActionMenu already handles global keydown.
  Keep exit key handling in LocationView BUT also need ActionMenu to show them.

  PLAN:
  - LocationView provides exits via provide('locationExits', exits)
  - ActionMenu injects locationExits and renders them below actions with separator
  - LocationView keeps its keyboard shortcuts for exits (letter keys)
  - ActionMenu shows visual buttons but doesn't duplicate the keyboard handler

### 3. Location pane restructure

- Add location name (prominent header) to LocationView
- Characters: integrate into scene, not separate widget
- Narrative is already auto-playing in NarrativeLog below

### 4. Tabbed sidebar

- GameScreen: replace flat sidebar with tabbed Status / Inventory
- Tab state: ref('status') | ref('inventory')

### 5. Status bars with soul

- Labels: Health, Energy, Mood, Sobriety, Hunger
- Height: 8px (was 4px)
- Colors:
  - Health: green (#7aad5a → #c04040 when low)
  - Energy: blue-ish (#5a8aad → #b8882a when low)
  - Mood: purple/warm (#ad5a8a → grey when low)
  - Sobriety: teal/clear (#5aadad → amber when low — drunk)
  - Hunger: orange (#d4a843 → red when low)
- Emoji icons next to labels

### 6. Atmosphere

- Location name: bigger, warmer, Courier New but treated like a PLACE
- Command panel label: "what now" instead of "actions"
- Exits header: "go" instead of "exits"
- The whole thing: less terminal, more zine

## Key binding rules (DO NOT BREAK)

- Number keys 1-9: actions (ActionMenu handles this)
- Letter keys a-z: exits (LocationView handles this)
- Arrow keys + Enter: keyboard nav in ActionMenu
- Space/Enter: skip narrative (NarrativeLog handles this)

## Files I'm changing

- NarrativeLog.vue — skip hint text
- LocationView.vue — remove exits div, add location name, characters as scene
- ActionMenu.vue — inject & render exits, add separator
- GameScreen.vue — tabbed sidebar, stat labels, stat bar sizing
- variables.scss — maybe tweak accent colours slightly for warmth
- typography.scss — narrative text gets more love
- layout.scss — action column maybe gets more breathing room
