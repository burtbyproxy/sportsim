import { describe, it, expect } from 'vitest'
import {
  scheduleEntryCoversHour,
  scheduleEntryCoversDay,
  scheduleEntryResolve,
  scheduleTransitActive,
  scheduleTransitDestination,
} from './schedule.js'

// --- scheduleEntryCoversHour ---

describe('scheduleEntryCoversHour', () => {
  it('normal window: hour inside', () => {
    expect(scheduleEntryCoversHour({ entry: { startHour: 8, endHour: 17 }, hour: 12 })).toBe(true)
  })

  it('normal window: hour at start (inclusive)', () => {
    expect(scheduleEntryCoversHour({ entry: { startHour: 8, endHour: 17 }, hour: 8 })).toBe(true)
  })

  it('normal window: hour at end (exclusive)', () => {
    expect(scheduleEntryCoversHour({ entry: { startHour: 8, endHour: 17 }, hour: 17 })).toBe(false)
  })

  it('normal window: hour before start', () => {
    expect(scheduleEntryCoversHour({ entry: { startHour: 8, endHour: 17 }, hour: 6 })).toBe(false)
  })

  it('normal window: hour after end', () => {
    expect(scheduleEntryCoversHour({ entry: { startHour: 8, endHour: 17 }, hour: 20 })).toBe(false)
  })

  it('midnight crossover: hour in evening portion', () => {
    // Bar shift: 16:00 to 02:00
    expect(scheduleEntryCoversHour({ entry: { startHour: 16, endHour: 2 }, hour: 22 })).toBe(true)
  })

  it('midnight crossover: hour in early morning portion', () => {
    expect(scheduleEntryCoversHour({ entry: { startHour: 16, endHour: 2 }, hour: 1 })).toBe(true)
  })

  it('midnight crossover: hour at endHour (exclusive)', () => {
    expect(scheduleEntryCoversHour({ entry: { startHour: 16, endHour: 2 }, hour: 2 })).toBe(false)
  })

  it('midnight crossover: hour just before startHour', () => {
    expect(scheduleEntryCoversHour({ entry: { startHour: 16, endHour: 2 }, hour: 15 })).toBe(false)
  })

  it('midnight crossover: hour in gap (e.g. 9am during 16-2 shift)', () => {
    expect(scheduleEntryCoversHour({ entry: { startHour: 16, endHour: 2 }, hour: 9 })).toBe(false)
  })

  it('zero-length window (start === end) returns false', () => {
    expect(scheduleEntryCoversHour({ entry: { startHour: 12, endHour: 12 }, hour: 12 })).toBe(false)
  })
})

// --- scheduleEntryCoversDay ---

describe('scheduleEntryCoversDay', () => {
  it('matches "all" for any day', () => {
    expect(scheduleEntryCoversDay({ entry: { days: ['all'] }, dayOfWeek: 'tuesday' })).toBe(true)
    expect(scheduleEntryCoversDay({ entry: { days: ['all'] }, dayOfWeek: 'sunday' })).toBe(true)
  })

  it('matches specific day', () => {
    expect(
      scheduleEntryCoversDay({ entry: { days: ['monday', 'wednesday'] }, dayOfWeek: 'monday' })
    ).toBe(true)
    expect(
      scheduleEntryCoversDay({ entry: { days: ['monday', 'wednesday'] }, dayOfWeek: 'tuesday' })
    ).toBe(false)
  })

  it('returns false for empty days array', () => {
    expect(scheduleEntryCoversDay({ entry: { days: [] }, dayOfWeek: 'monday' })).toBe(false)
  })

  it('returns false for null days', () => {
    expect(scheduleEntryCoversDay({ entry: { days: null }, dayOfWeek: 'monday' })).toBe(false)
  })
})

// --- scheduleEntryResolve ---

describe('scheduleEntryResolve', () => {
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
    const entry = scheduleEntryResolve({ schedule, hour: 10, dayOfWeek: 'monday' })
    expect(entry.locationId).toBe('work')
  })

  it('returns home entry during overnight window', () => {
    const entry = scheduleEntryResolve({ schedule, hour: 2, dayOfWeek: 'monday' })
    expect(entry.locationId).toBe('home')
  })

  it('returns bar entry on friday evening', () => {
    const entry = scheduleEntryResolve({ schedule, hour: 20, dayOfWeek: 'friday' })
    expect(entry.locationId).toBe('bar')
  })

  it('does not return bar entry on monday (wrong day)', () => {
    const entry = scheduleEntryResolve({ schedule, hour: 20, dayOfWeek: 'monday' })
    // Falls through bar (wrong day) and home (hour 20 not in 23-9 window)
    expect(entry).toBeNull()
  })

  it('returns null when no entry matches', () => {
    // Hour 20 on monday: not work (ended), not bar (wrong day), not home (not started)
    expect(scheduleEntryResolve({ schedule, hour: 20, dayOfWeek: 'monday' })).toBeNull()
  })

  it('returns null for empty schedule', () => {
    expect(
      scheduleEntryResolve({ schedule: { entries: [] }, hour: 10, dayOfWeek: 'monday' })
    ).toBeNull()
  })

  it('returns null for null schedule', () => {
    expect(scheduleEntryResolve({ schedule: null, hour: 10, dayOfWeek: 'monday' })).toBeNull()
  })

  it('handles first-match-wins (no overlap expected, but order matters)', () => {
    const overlapping = {
      entries: [
        { locationId: 'first', startHour: 10, endHour: 14, probability: 1, days: ['all'] },
        { locationId: 'second', startHour: 10, endHour: 14, probability: 1, days: ['all'] },
      ],
    }
    expect(
      scheduleEntryResolve({ schedule: overlapping, hour: 11, dayOfWeek: 'monday' }).locationId
    ).toBe('first')
  })
})

// --- scheduleTransitActive / scheduleTransitDestination ---

describe('scheduleTransitActive', () => {
  const schedule = {
    entries: [
      { locationId: 'bar', startHour: 16, endHour: 23, probability: 1, days: ['all'] },
      { locationId: 'plaid', startHour: 23, endHour: 0, probability: 0.7, days: ['all'] },
      { locationId: 'home', startHour: 0, endHour: 16, probability: 0.9, days: ['all'] },
    ],
  }

  it('returns true at an endHour boundary with non-zero minutes', () => {
    expect(scheduleTransitActive({ schedule, hour: 23, minute: 15 })).toBe(true)
  })

  it('returns false when minute is 0 (exactly on the hour)', () => {
    expect(scheduleTransitActive({ schedule, hour: 23, minute: 0 })).toBe(false)
  })

  it('returns false when not at any endHour', () => {
    expect(scheduleTransitActive({ schedule, hour: 20, minute: 30 })).toBe(false)
  })

  it('returns false for single-entry schedule', () => {
    const single = {
      entries: [{ locationId: 'home', startHour: 0, endHour: 24, probability: 1, days: ['all'] }],
    }
    expect(scheduleTransitActive({ schedule: single, hour: 12, minute: 30 })).toBe(false)
  })
})

describe('scheduleTransitDestination', () => {
  const schedule = {
    entries: [
      { locationId: 'bar', startHour: 16, endHour: 23, probability: 1, days: ['all'] },
      { locationId: 'plaid', startHour: 23, endHour: 0, probability: 0.7, days: ['all'] },
      { locationId: 'home', startHour: 0, endHour: 16, probability: 0.9, days: ['all'] },
    ],
  }

  it('returns the next location when in transit', () => {
    expect(scheduleTransitDestination({ schedule, hour: 23, minute: 15 })).toBe('plaid')
  })

  it('wraps around to first entry from last', () => {
    // At 0:15, home entry has endHour 16 — not at a boundary
    // At 0:15 we're inside home, not at an endHour
    // Let's test wrapping: last entry ends at 16, minute=15
    expect(scheduleTransitDestination({ schedule, hour: 16, minute: 15 })).toBe('bar') // wraps to first
  })

  it('returns null when not at any endHour boundary', () => {
    expect(scheduleTransitDestination({ schedule, hour: 20, minute: 30 })).toBeNull()
  })
})
