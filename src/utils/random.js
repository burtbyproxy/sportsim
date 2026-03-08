/**
 * Random utilities — seeded and unseeded RNG functions.
 * All functions accept an optional rng parameter for reproducible results in tests.
 */

/**
 * Creates a seeded pseudo-random number generator using a simple mulberry32 algorithm.
 * Returns a function that produces values in [0, 1).
 * @param {number} seed
 * @returns {() => number}
 */
export function seededRandom(seed) {
  let s = seed >>> 0
  return function () {
    s += 0x6d2b79f5
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) >>> 0
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Returns a random integer in [min, max] (inclusive).
 * @param {number} min
 * @param {number} max
 * @param {(() => number)} [rng=Math.random]
 * @returns {number}
 */
export function roll(min, max, rng = Math.random) {
  return Math.floor(rng() * (max - min + 1)) + min
}

/**
 * Picks one item from an array using a weight function.
 * @template T
 * @param {T[]} items
 * @param {(item: T) => number} weightFn - returns a non-negative weight for each item
 * @param {(() => number)} [rng=Math.random]
 * @returns {T|null} - null if items is empty or all weights are zero
 */
export function weightedPick(items, weightFn, rng = Math.random) {
  if (!items || items.length === 0) return null

  const weights = items.map(weightFn)
  const total = weights.reduce((sum, w) => sum + w, 0)
  if (total <= 0) return null

  let target = rng() * total
  for (let i = 0; i < items.length; i++) {
    target -= weights[i]
    if (target <= 0) return items[i]
  }
  // Floating point edge case — return last item
  return items[items.length - 1]
}

/**
 * Returns true with the given probability (0–1).
 * @param {number} probability - 0 = never, 1 = always
 * @param {(() => number)} [rng=Math.random]
 * @returns {boolean}
 */
export function chance(probability, rng = Math.random) {
  return rng() < probability
}

/**
 * Fisher-Yates shuffle. Returns a new array (does not mutate input).
 * @template T
 * @param {T[]} array
 * @param {(() => number)} [rng=Math.random]
 * @returns {T[]}
 */
export function shuffle(array, rng = Math.random) {
  const result = [...array]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}
