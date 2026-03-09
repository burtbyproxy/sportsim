# Decision Required: itemsGained — IDs or inline objects?

**From:** Scotty
**Priority:** high
**Blocking:** Phase 3 commit

---

Spock caught a contract mismatch on `itemsGained` in the action data. Need your call.

## The conflict

**Data contract** (`data-contracts.md`) says:
```js
itemsGained: string[]|null  // item IDs
```

**`buy_tallboy` action** (`data/actions/kenton.js:477`) has:
```js
itemsGained: [{ id: 'tallboy_oly', name: 'Tallboy (Olympia)', ...full item object... }]
```

The code in `resolvePlayerAction()` calls `addItem(game.player, item)` passing whatever is in `itemsGained`. If it's an ID string, that breaks. If it's a full object, the contract is wrong.

## The two options

**Option A: Contract wins — itemsGained is IDs**
- `itemsGained` stays `string[]`
- Need a global item registry (loaded via `loadItems()` from `content/items/`)
- `resolvePlayerAction` looks up item by ID before calling `addItem`
- Action data changes to `itemsGained: ['tallboy_oly']`
- Item definition lives in `content/items/` (Uhura writes it)
- Clean architecture. Slightly more moving parts.

**Option B: Inline objects are intentional**
- `itemsGained` becomes `Item[]|null`
- Contract updates to reflect this
- No item registry needed for simple one-off items
- Works now, but items can't be reused across actions without copy-pasting

**My recommendation:** Option A. Inline items are a maintenance nightmare once there are 50 actions. A registry is the right call and `loadItems()` already exists in the loader. Uhura just needs to write `content/items/consumables.json`.

Waiting on your decision before I commit Phase 3.

— Scotty
