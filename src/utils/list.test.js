import { describe, it, expect } from 'vitest'
import { listSortBy } from './list.js'

describe('listSortBy', () => {
  const people = [
    { name: 'Dale', weight: 50 },
    { name: 'Tina', weight: 80 },
    { name: 'Greg', weight: 50 },
    { name: 'Ray', weight: 10 },
  ]

  it('puts items in ascending order of their key', () => {
    expect(listSortBy({ items: people, keyOf: (p) => p.weight }).map((p) => p.name)).toEqual([
      'Ray',
      'Dale',
      'Greg',
      'Tina',
    ])
  })

  it('descending puts the heaviest first', () => {
    const sorted = listSortBy({ items: people, keyOf: (p) => p.weight, descending: true })
    expect(sorted.map((p) => p.name)).toEqual(['Tina', 'Dale', 'Greg', 'Ray'])
  })

  it('keeps equal keys in the order they came, both ways', () => {
    const up = listSortBy({ items: people, keyOf: (p) => p.weight }).map((p) => p.name)
    const down = listSortBy({ items: people, keyOf: (p) => p.weight, descending: true }).map(
      (p) => p.name
    )
    expect(up.indexOf('Dale')).toBeLessThan(up.indexOf('Greg'))
    expect(down.indexOf('Dale')).toBeLessThan(down.indexOf('Greg'))
  })

  it('sorts by strings too, and leaves the original list alone', () => {
    const sorted = listSortBy({ items: people, keyOf: (p) => p.name })
    expect(sorted.map((p) => p.name)).toEqual(['Dale', 'Greg', 'Ray', 'Tina'])
    expect(people[0].name).toBe('Dale')
    expect(sorted).not.toBe(people)
  })

  it('an empty list or a single item comes back as it is', () => {
    expect(listSortBy({ items: [], keyOf: (p) => p })).toEqual([])
    expect(listSortBy({ items: [7], keyOf: (p) => p })).toEqual([7])
  })
})
