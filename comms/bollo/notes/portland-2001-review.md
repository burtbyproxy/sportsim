# Portland 2001 Review Notes

## What Vince did

- Exits moved from LocationView into ActionMenu (amber colour, below separator)
- Location name now h1, amber, 22px
- Characters as scene-people buttons, not a widget
- Status bars: full names, per-stat colours, 7px height, danger/warning thresholds
- Tabbed sidebar: Status and Inventory tabs (in GameScreen.vue, not a component)
- Footer carries keyboard hint: 1–9 actions · a–z go · space skip
- Header shows current location
- Skip hint changed to ghost text "space to skip"
- Line-height 1.85 on narrative text
- Colour palette warmed (no more pure black)

## Things Bollo found

### 1. DUPLICATE canTravel / travel logic (not dangerous but not good)

- LocationView.vue: canTravel(), travel(), exits computed — used ONLY by letter-key handler
- ActionMenu.vue: canTravel(), travel(), exits computed — used by button rendering + click
- Both components register document keydown listeners
  - LocationView: handles letter keys (a-z) for exits
  - ActionMenu: handles number keys (1-9) for actions
  - These don't conflict on key type, but the canTravel/travel implementation is duplicated
- TODO: extract into a useTravel() composable in a future cleanup pass

### 2. DEAD CSS removed

- typography.scss had global .action-item (block/100% width) — ActionMenu now has its own
  scoped flex version. Global one was orphaned. Removed.
- typography.scss had .exit-link — exits now in ActionMenu, no template uses exit-link. Removed.

### 3. Keyboard shortcuts — WORKING

- Letter keys a-z: LocationView.vue handleGlobalKeydown — tested against exits array
- Number keys 1-9: ActionMenu.vue handleGlobalKeydown — tested against sortedActions
- No conflict. Both guard against input/textarea focus.
- ActionMenu shortcut display: i < 9 ? i+1+'.' : ' ' — correct

### 4. Component interfaces — CLEAN

- NarrativeLog: props (log, isAnimating, currentTokenProgress, activeEntry), emits (skip) — unchanged
- ActionMenu: no props, uses inject (gameLoop, selectedCharacterId) — unchanged
- LocationView: no props, uses inject (narrative, gameLoop, selectedCharacterId) — unchanged
- GameScreen: provides narrative, gameLoop, selectedCharacterId — unchanged
- GameHeader: no props, reads game store directly
- GameFooter: no props, reads game store directly

### 5. Accessibility — GOOD

- NarrativeLog: role="log", aria-live="polite", aria-label="Game narrative", tabindex="0" — all present

### 6. save.test.js — 61 tests Bollo didn't know about

- Appeared in test run. All pass. Howard should know this exists.
- Tests save/load round trip, validation, MAX_SAVES limit.

## Tests added

- tests/ui-logic.test.js — 56 tests covering:
  - Status bar label correctness (full words, not abbreviations)
  - barFillClass() threshold logic for all 5 stats
  - Exit key mapping (a-z, overflow to ?)
  - ActionMenu empty state logic
  - ActionMenu separator visibility logic
  - Action number shortcut display (1-9, blank beyond)
  - NarrativeLog accessibility spec
  - GameFooter keyboard hint content

## Final count

507 (before) → 624 (after) — 117 new tests total across session
Bollo added 56. The others were already there (save.test.js was untracked, Bollo didn't add those).
