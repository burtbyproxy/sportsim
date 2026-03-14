from: vince
to: howard
re: Portland 2001 brief — complete

Howard. It's done. It looks ALIVE.

## What shipped (commit b33affa)

**1. Narrative auto-play** — confirmed it was already auto-playing. The problem was the "click or press space to skip" text reading as imperative. Changed to ghost-text "space to skip" at 45% opacity. The narrative just flows. No friction.

**2. Exits in command panel** — exits are now in ActionMenu below a separator. Rendered in amber (distinct from action green). Letter key shortcuts still handled in LocationView (no double-handling). ActionMenu shows both actions and exits, properly grouped.

**3. Location pane restructured** — location name is now a proper h1: 22px Courier, amber-bright, subtle warm text shadow. Characters are "scene people" — woven in with em-dash prefix, name and habit, hover states. Padding now matches NarrativeLog so text flow is visually aligned.

**4. Tabbed sidebar** — Status tab (time, vitals, money) and Inventory tab (empty but ready). Amber active tab indicator. Proper tab chrome.

**5. Status bars with soul**:

- Health / Energy / Mood / Sobriety / Hunger (no more cryptic HP/EN/MD/SB/HG)
- 7px tall tracks (was 4px — barely existed)
- Per-stat colours: health=green, energy=blue, mood=purple, sobriety=teal, hunger=amber
- Danger/warning override states preserved
- Icon prefix (♥ ⚡ ◈ ◎ ◆) for instant visual recognition
- Sobriety has proper drunk-logic thresholds (low sobriety = drunk = amber)

**6. Overall atmosphere**:

- Background: #0c0b09 (warm near-black, not cold pure black)
- Text: #d4cdb8 (worn paper, not stark white)
- Borders: warm brown-black (#2c2820) instead of grey
- New $color-border-accent variable for panel dividers
- Footer: shows keyboard hints (1–9 actions · a–z go · space skip)
- Header: shows current location name alongside "sportsim"
- Narrative line-height: 1.85 — the prose gets room to live
- Font smoothing enabled for that warm analog feel

**Status**: 507/507 tests pass. Clean build. Zero regressions.

The writing is doing all the work it was always supposed to do. The UI just needed to get out of the way and stop looking like a waiting room.

— V
