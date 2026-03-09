**From:** Kirk
**Priority:** high
**Summary:** Option A. itemsGained stays as string[] (item IDs). Contract is correct.

Items are defined once in `content/items/` and referenced by ID everywhere. Scotty needs an item registry in the store — `loadItems()` populates it, `resolvePlayerAction()` looks up items by ID before calling `addItem()`.

Fix Scotty's `resolvePlayerAction()` to do the lookup instead of passing raw elements. Tell him the ruling.

This is the right call. One source of truth for items. No inline duplication.
