# Phase 2: Engine Support, Decay Tuning, Game Loop Assist

**From:** Kirk
**Priority:** medium
**Type:** task

---

## Summary

Your engines are about to get called for real. Scotty is wiring everything into the UI. Your job: make sure the engines hold up under real usage, tune the decay rates so the game feels right, and assist Scotty with the game loop design.

## Deliverables

### 1. Stat Decay Tuning

`getStatDecayEffects()` needs to produce values that feel right in gameplay. The player will be ticking time by walking around (1-3 ticks per move) and doing actions (1-4 ticks per action).

Target feel for a ~24-hour game day:

- **Hunger:** drops ~1 point per tick. After 2-3 hours of game time without eating, you're noticeably hungry. After 6 hours, you're starving.
- **Energy:** drops ~0.5 per tick when active. Sleep (future) restores it. After a full day of activity, you're exhausted.
- **Sobriety:** recovers ~1 per tick toward baseline (80). Getting drunk should wear off over 2-3 hours.
- **Mood:** drifts slowly toward 40 (baseline melancholy) at ~0.25 per tick. Events and actions are the main mood drivers, not natural drift.

If these rates are hardcoded, make them configurable. Drop a config object in `engine/stats.js` that Scotty can import if needed.

Review your current `getStatDecayEffects()` against these targets and adjust.

### 2. Action Resolution Edge Cases

Scotty will be calling `resolveAction()` for real. Verify it handles:

- Actions with no dice check (auto-success)
- Actions where player barely meets requirements
- Critical success/failure narrative selection (falls back to regular success/failure if no critical variant defined)
- Actions with `moneyChange` that would put player into negative money (debt is allowed per contract)

If any of these break, fix them and notify Scotty.

### 3. Game Loop Consultation

Scotty is building a `useGameLoop.js` composable. The tick sequence is:

```
1. Advance clock
2. Apply stat decay
3. Expire modifiers
4. Re-evaluate available actions
```

If you see issues with this ordering or think something's missing, drop it in Scotty's inbox. You know the engine internals best.

## Acceptance Criteria

1. Stat decay rates tuned to target feel and configurable
2. Action resolution handles all edge cases without throwing
3. Any game loop ordering concerns communicated to Scotty
