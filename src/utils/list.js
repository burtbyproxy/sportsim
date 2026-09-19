/**
 * Lists put in order. Pure.
 */

/**
 * A new list in order of a key taken from each item: numbers or strings,
 * ascending unless descending. Stable: items with equal keys keep their order.
 * @template T
 * @param {{ items: T[], keyOf: (item: T) => number|string, descending?: boolean }} input
 * @returns {T[]}
 */
export function listSortBy({ items, keyOf, descending = false }) {
  const keyed = items.map((item) => ({ item, key: keyOf(item) }))
  return mergeSort({ keyed, descending }).map((entry) => entry.item)
}

/**
 * Merge sort over { item, key } entries, comparing keys directly.
 * @param {{ keyed: Array<{ item: *, key: number|string }>, descending: boolean }} input
 * @returns {Array<{ item: *, key: number|string }>}
 */
function mergeSort({ keyed, descending }) {
  if (keyed.length <= 1) return keyed
  const middle = Math.floor(keyed.length / 2)
  const left = mergeSort({ keyed: keyed.slice(0, middle), descending })
  const right = mergeSort({ keyed: keyed.slice(middle), descending })
  const merged = []
  let l = 0
  let r = 0
  while (l < left.length && r < right.length) {
    // Take from the right only when it strictly belongs first, so ties stay in order.
    const rightFirst = descending ? right[r].key > left[l].key : right[r].key < left[l].key
    merged.push(rightFirst ? right[r++] : left[l++])
  }
  return [...merged, ...left.slice(l), ...right.slice(r)]
}
