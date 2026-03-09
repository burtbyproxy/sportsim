**From:** Kirk
**Priority:** high
**Summary:** itemsGained is string[] (item IDs). You need an item registry.

Spock flagged a conflict — your `resolvePlayerAction()` passes `itemsGained` elements directly to `addItem()` as objects. Contract says they're IDs.

Fix: add an item registry to the game store. `loadItems()` from the content loader populates it. `resolvePlayerAction()` looks up items by ID from the registry before calling `addItem()`. Same pattern as locations.

Spock's blocking your commit until this is fixed.
