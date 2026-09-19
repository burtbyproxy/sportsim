/**
 * Random sources that say in advance what they will give.
 */
import { diceD20 } from '../../src/engine/dice.js'

/**
 * A random source that hands out the given values in order: over again from
 * the start, or holding the last one, once they run out.
 * @param {{ values: number[], repeatLast?: boolean }} input
 * @returns {() => number}
 */
export function rngSequence({ values, repeatLast = false }) {
  let i = 0
  return () => (repeatLast ? values[Math.min(i++, values.length - 1)] : values[i++ % values.length])
}

/**
 * The random value the real d20 turns into a given natural roll. Found by
 * asking the dice, not by knowing how they work, so a change to the dice
 * cannot quietly change what a test means.
 * @param {{ natural: number }} input - 1 to 20
 * @returns {number}
 */
export function rngForNatural({ natural }) {
  for (let step = 0; step < 2000; step++) {
    const value = (step + 0.5) / 2000
    if (diceD20({ rng: () => value }) === natural) return value
  }
  throw new Error(`No random value rolls a natural ${natural}`)
}
