import { describe, it, expect } from 'vitest'
import {
  isHourInWindow,
  entryMatchesDay,
  resolveSchedule,
  isInTransit,
  getTransitDestination,
} from './schedule.js'

// --- isHourInWindow ---

describe('isHourInWindow', () => {
  it('normal window: hour inside', () => {
    expect(isHourInWindow({ startHour: 8, endHour: 17 }, 12)).toBe(true)
  })

  it('normal window: hour at start (inclusive)', () => {
    expect(isHourInWindow({ startHour: 8, endHour: 17 }, 8)).toBe(true)
  })

  it('normal window: hour at end (exclusive)', () => {
    expect(isHourInWindow({ startHour: 8, endHour: 17 }, 17)).toBe(false)
  })

  it('normal window: hour before start', () => {
    expect(isHourInWindow({ startHour: 8, endHour: 17 }, 6)).toBe(false)
  })

  it('normal window: hour after end', () => {
    expect(isHourInWindow({ startHour: 8, endHour: 17 }, 20)).toBe(false)
  })

  it('midnight crossover: hour in evening portion', () => {
    // Bar shift: 16:00 to 02:00
    expect(isHourInWindow({ startHour: 16, endHour: 2 }, 22)).toBe(true)
  })

  it('midnight crossover: hour in early morning portion', () => {
    expect(isHourInWindow({ startHour: 16, endHour: 2 }, 1)).toBe(true)
  })

  it('midnight crossover: hour at endHour (exclusive)', () => {
    expect(isHourInWindow({ startHour: 16, endHour: 2 }, 2)).toBe(false)
  })

  it('midnight crossover: hour just before startHour', () => {
    expect(isHourInWindow({ startHour: 16, endHour: 2 }, 15)).toBe(false)
  })

  it('midnight crossover: hour in gap (e.g. 9am during 16-2 shift)', () => {
    expect(isHourInWindow({ startHour: 16, endHour: 2 }, 9)).toBe(false)
  })

  it('zero-length window (start === end) returns false', () => {
    expect(isHourInWindow({ startHour: 12, endHour: 12 }, 12)).toBe(false)
  })
})

// --- entryMatchesDay ---

describe('entryMatchesDay', () => {
  it('matches "all" for any day', () => {
    expect(entryMatchesDay({ days: ['all'] }, 'tuesday')).toBe(true)
    expect(entryMatchesDay({ days: ['all'] }, 'sunday')).toBe(true)
  })

  it('matches specific day', () => {
    expect(entryMatchesDay({ days: ['monday', 'wednesday'] }, 'monday')).toBe(true)
    expect(entryMatchesDay({ days: ['monday', 'wednesday'] }, 'tuesday')).toBe(false)
  })

  it('returns false for empty days array', () => {
    expect(entryMatchesDay({ days: [] }, 'monday')).toBe(false)
  })

  it('returns false for null days', () => {
    expect(entryMatchesDay({ days: null }, 'monday')).toBe(false)
  })
})

// --- resolveSchedule ---

describe('resolveSchedule', () => {
  const schedule = {
    entries: [
      { locationId: 'work', startHour: 9, endHour: 17, probability: 0.95, days: ['all'] },
      {
        locationId: 'bar',
        startHour: 17,
        endHour: 23,
        probability: 0.8,
        days: ['friday', 'saturday'],
      },
      { locationId: 'home', startHour: 23, endHour: 9, probability: 0.99, days: ['all'] },
    ],
  }

  it('returns the matching entry for current time', () => {
    const entry = resolveSchedule(schedule, 10, 'monday')
    expect(entry.locationId).toBe('work')
  })

  it('returns home entry during overnight window', () => {
    const entry = resolveSchedule(schedule, 2, 'monday')
    expect(entry.locationId).toBe('home')
  })

  it('returns bar entry on friday evening', () => {
    const entry = resolveSchedule(schedule, 20, 'friday')
    expect(entry.locationId).toBe('bar')
  })

  it('does not return bar entry on monday (wrong day)', () => {
    const entry = resolveSchedule(schedule, 20, 'monday')
    // Falls through bar (wrong day) and home (hour 20 not in 23-9 window)
    expect(entry).toBeNull()
  })

  it('returns null when no entry matches', () => {
    // Hour 20 on monday: not work (ended), not bar (wrong day), not home (not started)
    expect(resolveSchedule(schedule, 20, 'monday')).toBeNull()
  })

  it('returns null for empty schedule', () => {
    expect(resolveSchedule({ entries: [] }, 10, 'monday')).toBeNull()
  })

  it('returns null for null schedule', () => {
    expect(resolveSchedule(null, 10, 'monday')).toBeNull()
  })

  it('handles first-match-wins (no overlap expected, but order matters)', () => {
    const overlapping = {
      entries: [
        { locationId: 'first', startHour: 10, endHour: 14, probability: 1, days: ['all'] },
        { locationId: 'second', startHour: 10, endHour: 14, probability: 1, days: ['all'] },
      ],
    }
    expect(resolveSchedule(overlapping, 11, 'monday').locationId).toBe('first')
  })
})

// --- isInTransit / getTransitDestination ---

describe('isInTransit', () => {
  const schedule = {
    entries: [
      { locationId: 'bar', startHour: 16, endHour: 23, probability: 1, days: ['all'] },
      { locationId: 'plaid', startHour: 23, endHour: 0, probability: 0.7, days: ['all'] },
      { locationId: 'home', startHour: 0, endHour: 16, probability: 0.9, days: ['all'] },
    ],
  }

  it('returns true at an endHour boundary with non-zero minutes', () => {
    expect(isInTransit(schedule, 23, 15)).toBe(true)
  })

  it('returns false when minute is 0 (exactly on the hour)', () => {
    expect(isInTransit(schedule, 23, 0)).toBe(false)
  })

  it('returns false when not at any endHour', () => {
    expect(isInTransit(schedule, 20, 30)).toBe(false)
  })

  it('returns false for single-entry schedule', () => {
    const single = {
      entries: [{ locationId: 'home', startHour: 0, endHour: 24, probability: 1, days: ['all'] }],
    }
    expect(isInTransit(single, 12, 30)).toBe(false)
  })
})

describe('getTransitDestination', () => {
  const schedule = {
    entries: [
      { locationId: 'bar', startHour: 16, endHour: 23, probability: 1, days: ['all'] },
      { locationId: 'plaid', startHour: 23, endHour: 0, probability: 0.7, days: ['all'] },
      { locationId: 'home', startHour: 0, endHour: 16, probability: 0.9, days: ['all'] },
    ],
  }

  it('returns the next location when in transit', () => {
    expect(getTransitDestination(schedule, 23, 15)).toBe('plaid')
  })

  it('wraps around to first entry from last', () => {
    // At 0:15, home entry has endHour 16 — not at a boundary
    // At 0:15 we're inside home, not at an endHour
    // Let's test wrapping: last entry ends at 16, minute=15
    expect(getTransitDestination(schedule, 16, 15)).toBe('bar') // wraps to first
  })

  it('returns null when not at any endHour boundary', () => {
    expect(getTransitDestination(schedule, 20, 30)).toBeNull()
  })
})
