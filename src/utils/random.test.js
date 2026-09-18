import { describe, it, expect } from 'vitest'
import { seededRandom, randomInt, weightedPick, chance, shuffle } from './random.js'

describe('seededRandom', () => {
  it('produces values in [0, 1)', () => {
    const rng = seededRandom(42)
    for (let i = 0; i < 100; i++) {
      const v = rng()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('produces reproducible sequences with same seed', () => {
    const rng1 = seededRandom(123)
    const rng2 = seededRandom(123)
    for (let i = 0; i < 20; i++) {
      expect(rng1()).toBe(rng2())
    }
  })

  it('produces different sequences with different seeds', () => {
    const rng1 = seededRandom(1)
    const rng2 = seededRandom(2)
    const seq1 = Array.from({ length: 10 }, () => rng1())
    const seq2 = Array.from({ length: 10 }, () => rng2())
    expect(seq1).not.toEqual(seq2)
  })
})

describe('randomInt', () => {
  it('returns values within [min, max] inclusive', () => {
    const rng = seededRandom(99)
    for (let i = 0; i < 200; i++) {
      const v = randomInt({ min: 1, max: 20, rng })
      expect(v).toBeGreaterThanOrEqual(1)
      expect(v).toBeLessThanOrEqual(20)
    }
  })

  it('returns integers', () => {
    const rng = seededRandom(7)
    for (let i = 0; i < 50; i++) {
      expect(Number.isInteger(randomInt({ min: 1, max: 6, rng }))).toBe(true)
    }
  })

  it('works with min === max', () => {
    const rng = seededRandom(5)
    expect(randomInt({ min: 7, max: 7, rng })).toBe(7)
  })
})

describe('weightedPick', () => {
  it('returns null for empty array', () => {
    expect(weightedPick([], () => 1)).toBeNull()
  })

  it('returns null when all weights are zero', () => {
    expect(weightedPick(['a', 'b'], () => 0)).toBeNull()
  })

  it('always picks the only item with weight', () => {
    const items = ['a', 'b', 'c']
    const rng = seededRandom(1)
    for (let i = 0; i < 20; i++) {
      const result = weightedPick(items, (item) => (item === 'b' ? 1 : 0), rng)
      expect(result).toBe('b')
    }
  })

  it('distributes picks roughly proportionally', () => {
    const rng = seededRandom(42)
    const counts = { low: 0, high: 0 }
    for (let i = 0; i < 1000; i++) {
      const result = weightedPick(['low', 'high'], (item) => (item === 'high' ? 9 : 1), rng)
      counts[result]++
    }
    // high should be picked ~90% of the time
    expect(counts.high).toBeGreaterThan(800)
    expect(counts.low).toBeGreaterThan(50)
  })
})

describe('chance', () => {
  it('returns false with probability 0', () => {
    const rng = seededRandom(1)
    for (let i = 0; i < 20; i++) {
      expect(chance(0, rng)).toBe(false)
    }
  })

  it('returns true with probability 1', () => {
    const rng = seededRandom(1)
    for (let i = 0; i < 20; i++) {
      expect(chance(1, rng)).toBe(true)
    }
  })

  it('fires roughly at given probability', () => {
    const rng = seededRandom(99)
    let hits = 0
    const trials = 1000
    for (let i = 0; i < trials; i++) {
      if (chance(0.3, rng)) hits++
    }
    expect(hits).toBeGreaterThan(200)
    expect(hits).toBeLessThan(400)
  })
})

describe('shuffle', () => {
  it('returns an array of the same length', () => {
    const rng = seededRandom(1)
    const arr = [1, 2, 3, 4, 5]
    expect(shuffle(arr, rng)).toHaveLength(5)
  })

  it('does not mutate the input array', () => {
    const rng = seededRandom(1)
    const arr = [1, 2, 3, 4, 5]
    shuffle(arr, rng)
    expect(arr).toEqual([1, 2, 3, 4, 5])
  })

  it('contains the same elements', () => {
    const rng = seededRandom(42)
    const arr = [1, 2, 3, 4, 5]
    const result = shuffle(arr, rng)
    expect(result.sort()).toEqual([1, 2, 3, 4, 5])
  })

  it('produces reproducible results with seeded RNG', () => {
    const arr = ['a', 'b', 'c', 'd', 'e']
    const result1 = shuffle(arr, seededRandom(7))
    const result2 = shuffle(arr, seededRandom(7))
    expect(result1).toEqual(result2)
  })
})
