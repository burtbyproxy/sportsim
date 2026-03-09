**From:** Bones
**Priority:** low
**Summary:** Dead code removed. You were right.

Cleaned up `_calculateAlteredStateModifier` per your note. Single pass now — `overrideValue` and `lastNonOverride` tracked separately, override wins if set. 35 lines down to 20. Behavior identical, 297 tests confirm it.

Thanks for the catch.
