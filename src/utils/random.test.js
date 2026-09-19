import { describe, it, expect } from 'vitest'
import {
  randomSeeded,
  randomInt,
  randomPickWeighted,
  randomChance,
  randomShuffle,
} from './random.js'

describe('randomSeeded', () => {
  it('produces values in [0, 1)', () => {
    const rng = randomSeeded({ seed: 42 })
    for (let i = 0; i < 100; i++) {
      const v = rng()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('produces reproducible sequences with same seed', () => {
    const rng1 = randomSeeded({ seed: 123 })
    const rng2 = randomSeeded({ seed: 123 })
    for (let i = 0; i < 20; i++) {
      expect(rng1()).toBe(rng2())
    }
  })

  it('produces different sequences with different seeds', () => {
    const rng1 = randomSeeded({ seed: 1 })
    const rng2 = randomSeeded({ seed: 2 })
    const seq1 = Array.from({ length: 10 }, () => rng1())
    const seq2 = Array.from({ length: 10 }, () => rng2())
    expect(seq1).not.toEqual(seq2)
  })
})

describe('randomInt', () => {
  it('returns values within [min, max] inclusive', () => {
    const rng = randomSeeded({ seed: 99 })
    for (let i = 0; i < 200; i++) {
      const v = randomInt({ min: 1, max: 20, rng })
      expect(v).toBeGreaterThanOrEqual(1)
      expect(v).toBeLessThanOrEqual(20)
    }
  })

  it('returns integers', () => {
    const rng = randomSeeded({ seed: 7 })
    for (let i = 0; i < 50; i++) {
      expect(Number.isInteger(randomInt({ min: 1, max: 6, rng }))).toBe(true)
    }
  })

  it('works with min === max', () => {
    const rng = randomSeeded({ seed: 5 })
    expect(randomInt({ min: 7, max: 7, rng })).toBe(7)
  })
})

describe('randomPickWeighted', () => {
  it('returns null for empty array', () => {
    expect(randomPickWeighted({ items: [], weightOf: () => 1 })).toBeNull()
  })

  it('returns null when all weights are zero', () => {
    expect(randomPickWeighted({ items: ['a', 'b'], weightOf: () => 0 })).toBeNull()
  })

  it('always picks the only item with weight', () => {
    const items = ['a', 'b', 'c']
    const rng = randomSeeded({ seed: 1 })
    for (let i = 0; i < 20; i++) {
      const result = randomPickWeighted({ items, weightOf: (item) => (item === 'b' ? 1 : 0), rng })
      expect(result).toBe('b')
    }
  })

  it('distributes picks roughly proportionally', () => {
    const rng = randomSeeded({ seed: 42 })
    const counts = { low: 0, high: 0 }
    for (let i = 0; i < 1000; i++) {
      const result = randomPickWeighted({
        items: ['low', 'high'],
        weightOf: (item) => (item === 'high' ? 9 : 1),
        rng,
      })
      counts[result]++
    }
    // high should be picked ~90% of the time
    expect(counts.high).toBeGreaterThan(800)
    expect(counts.low).toBeGreaterThan(50)
  })
})

describe('randomChance', () => {
  it('returns false with probability 0', () => {
    const rng = randomSeeded({ seed: 1 })
    for (let i = 0; i < 20; i++) {
      expect(randomChance({ probability: 0, rng })).toBe(false)
    }
  })

  it('returns true with probability 1', () => {
    const rng = randomSeeded({ seed: 1 })
    for (let i = 0; i < 20; i++) {
      expect(randomChance({ probability: 1, rng })).toBe(true)
    }
  })

  it('fires roughly at given probability', () => {
    const rng = randomSeeded({ seed: 99 })
    let hits = 0
    const trials = 1000
    for (let i = 0; i < trials; i++) {
      if (randomChance({ probability: 0.3, rng })) hits++
    }
    expect(hits).toBeGreaterThan(200)
    expect(hits).toBeLessThan(400)
  })
})

describe('randomShuffle', () => {
  it('returns an array of the same length', () => {
    const rng = randomSeeded({ seed: 1 })
    const arr = [1, 2, 3, 4, 5]
    expect(randomShuffle({ items: arr, rng })).toHaveLength(5)
  })

  it('does not mutate the input array', () => {
    const rng = randomSeeded({ seed: 1 })
    const arr = [1, 2, 3, 4, 5]
    randomShuffle({ items: arr, rng })
    expect(arr).toEqual([1, 2, 3, 4, 5])
  })

  it('contains the same elements', () => {
    const rng = randomSeeded({ seed: 42 })
    const arr = [1, 2, 3, 4, 5]
    const result = randomShuffle({ items: arr, rng })
    expect(result.sort()).toEqual([1, 2, 3, 4, 5])
  })

  it('produces reproducible results with seeded RNG', () => {
    const arr = ['a', 'b', 'c', 'd', 'e']
    const result1 = randomShuffle({ items: arr, rng: randomSeeded({ seed: 7 }) })
    const result2 = randomShuffle({ items: arr, rng: randomSeeded({ seed: 7 }) })
    expect(result1).toEqual(result2)
  })
})
