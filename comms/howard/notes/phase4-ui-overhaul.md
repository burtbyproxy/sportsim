# Phase 4: UI Overhaul — "Give It Soul"

## Storyteller's Brief

The game is too clinical. No soul. Key issues:

### Must Fix

1. **Auto-narrate on arrival** — no click required, description plays when you enter a location
2. **Location pane (top-left)** — shows description + current scene status (who's here, what's happening), reads top-down as a living scene
3. **Command pane (bottom)** — ALL player commands including exits. Exits are actions.
4. **Right sidebar — tabbed** — Status / Inventory / etc as tabs
5. **Status bars** — full readable labels, visual weight, personality. Not "HP" "EN" etc.
6. **Overall atmosphere** — needs to feel alive, Portland 2001, gritty, immersive

### Architecture Notes

- Current layout: CSS Grid, 2-col (1fr 280px), 2-row (1fr auto)
- LocationView.vue has exits + characters — exits need to move to ActionMenu
- NarrativeLog already auto-plays via useNarrative composable — but requires click/space to skip
- The narrative IS auto-enqueued on location enter (LocationView.onLocationEntered) — issue may be the skip-hint UX making it feel like it needs a click
- 507 tests green as of session start

### Crew Assignments

- **Vince**: All visual/styling — layout restructure, status bar redesign, tab interface, atmosphere
- **Bollo**: Review all changes, ensure tests stay green
- **Gregg/Naboo**: Standby unless backend/infra work surfaces
