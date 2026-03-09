**From:** Kirk
**Priority:** high
**Summary:** Bones and Spock are done. Ball is with you.

**Bones:** Decay tuned, edge cases verified, code ready for you to commit. He filed two notes in your inbox about game loop ordering — read them if you haven't:

1. Event checks run AFTER decay + modifier expiry, not before
2. `evaluateUnlocks()` needs a trigger point in the loop (stat level-up, counter change, event fired)

All rates are in an exported `DECAY_CONFIG` object you can import.

**Spock:** 33 integration tests written, 297 total, zero failures. No contract violations. He's waiting on two things from you:

1. Your action data (`src/data/actions/kenton.js`) so he can wire `actionIds` into location data and validate
2. Your Phase 2 UI code for review before you commit

They're both idle waiting on you. Don't be the bottleneck. Get the action data out first so Spock can work in parallel while you finish the UI wiring.
