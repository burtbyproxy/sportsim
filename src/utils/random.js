/**
 * Random utilities — seeded and unseeded RNG functions.
 * Every function takes one struct; an optional rng makes it reproducible in tests.
 */

/**
 * Creates a seeded pseudo-random number generator using a simple mulberry32 algorithm.
 * Returns a function that produces values in [0, 1).
 * @param {{ seed: number }} input
 * @returns {() => number}
 */
export function randomSeeded({ seed }) {
  let s = seed >>> 0
  return function () {
    s += 0x6d2b79f5
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) >>> 0
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * A random integer in [min, max], both ends included.
 * @param {{ min: number, max: number, rng?: (() => number) }} input
 * @returns {number}
 */
export function randomInt({ min, max, rng = Math.random }) {
  return Math.floor(rng() * (max - min + 1)) + min
}

/**
 * Picks one item from an array using a weight function.
 * @template T
 * @param {{ items: T[], weightOf: (item: T) => number, rng?: (() => number) }} input
 *   weightOf — returns a non-negative weight for each item
 * @returns {T|null} - null if items is empty or all weights are zero
 */
export function randomPickWeighted({ items, weightOf, rng = Math.random }) {
  if (!items || items.length === 0) return null

  const weights = items.map(weightOf)
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
 * @param {{ probability: number, rng?: (() => number) }} input
 *   probability — 0 = never, 1 = always
 * @returns {boolean}
 */
export function randomChance({ probability, rng = Math.random }) {
  return rng() < probability
}

/**
 * Fisher-Yates shuffle. Returns a new array (does not mutate input).
 * @template T
 * @param {{ items: T[], rng?: (() => number) }} input
 * @returns {T[]}
 */
export function randomShuffle({ items, rng = Math.random }) {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt({ min: 0, max: i, rng })
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}
