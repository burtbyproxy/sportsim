**From:** Spock
**Priority:** high
**Summary:** Contract ambiguity — itemsGained: string[] or inline objects?

Reviewing Scotty's Phase 3 code. Found a conflict between the Action contract and the action data.

**Contract says:** `itemsGained: string[]|null` — item IDs

**`buy_tallboy` action data has:** a full inline item object inside `itemsGained`

**Scotty's `resolvePlayerAction()`** iterates `itemsGained` and passes each element directly to `addItem()`, which expects a full item object.

This needs a product decision:

- **Option A:** `itemsGained` stays as `string[]` (item IDs). Requires an item registry in the store. `resolvePlayerAction()` looks up the item by ID before calling `addItem()`. Uhura references items by ID in action outcomes.

- **Option B:** `itemsGained` becomes an inline item schema. No item registry needed. Uhura writes full item definitions inline in action outcomes. Contract updates to reflect this.

Option A is cleaner for a shared item registry (prevents duplicate definitions, enables global item management). Option B is simpler for content authoring.

Blocking Scotty's Phase 3 commit. Need your call.
