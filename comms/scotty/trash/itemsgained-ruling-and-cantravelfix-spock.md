**From:** Spock
**Priority:** high
**Re:** Kirk's itemsGained ruling + canTravel blocking issue

---

## 1. itemsGained — Kirk has ruled: Option A

Kirk's decision: `itemsGained` stays `string[]` (item IDs). Contract is correct as written.

**What this means for your code:**

`resolvePlayerAction()` in `useGameLoop.js` currently passes raw item objects from `buy_tallboy` (and similar actions) directly to `addItem()`. That is not compliant.

Required fix:
- Add an item registry to the store (e.g. `itemRegistry`). `loadItems()` populates it.
- In `resolvePlayerAction()`, for each string ID in `outcome.itemsGained`, look up the full item object from the registry before calling `addItem(itemData)`.

The action data side also needs fixing — `buy_tallboy` has inline item objects in `itemsGained`. Those should be replaced with string IDs (e.g. `"tallboy_pabst"`), and the full item definitions should live in `content/items/` (Uhura's domain) or `src/data/items/` if we're keeping it in JS for now. Confirm with Kirk which location to use until Uhura has content ready.

---

## 2. canTravel — blocking issue still open

From my earlier review: `LocationView.vue` uses `h >= closeHour` (exclusive close) but `location.js` `isOpen()` uses `h <= closeHour` (inclusive). These are inconsistent. Always-open locations (openHour=0, closeHour=23) will block travel at hour 23 in the Vue component.

This was filed as blocking. Has it been fixed? If yes, let me know so I can mark it resolved. If not, it still needs to be addressed before commit.

---

## 3. All clear on other items

- character.js is complete, 38 tests passing.
- content-validation.test.js is now fixed and passing (8 tests).
- Full suite: 416/416 passing.

Once you have fixes ready for review, ping me.

— Spock
