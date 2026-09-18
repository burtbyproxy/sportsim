import { describe, it, expect } from 'vitest'
import { createClock, advanceClock, formatTime, durationFormat } from './clock.js'

describe('createClock', () => {
  it('starts Monday at 8:00 in the morning, tick zero, day one', () => {
    expect(createClock()).toEqual({
      tick: 0,
      day: 1,
      hour: 8,
      minute: 0,
      period: 'morning',
      dayOfWeek: 'monday',
    })
  })
})

describe('advanceClock', () => {
  it('a tick is fifteen minutes', () => {
    expect(advanceClock(createClock(), 1)).toMatchObject({ tick: 1, hour: 8, minute: 15 })
    expect(advanceClock(createClock(), 3)).toMatchObject({ hour: 8, minute: 45 })
    expect(advanceClock(createClock(), 4)).toMatchObject({ hour: 9, minute: 0 })
  })

  it('names the period of the day', () => {
    const at = (ticks) => advanceClock(createClock(), ticks).period
    expect(at(0)).toBe('morning') // 8:00
    expect(at(16)).toBe('afternoon') // 12:00
    expect(at(36)).toBe('evening') // 17:00
    expect(at(52)).toBe('night') // 21:00
    expect(at(64)).toBe('late_night') // 0:00
    expect(at(84)).toBe('morning') // 5:00
  })

  it('rolls over midnight into the next day and the next weekday', () => {
    const midnight = advanceClock(createClock(), 64)
    expect(midnight).toMatchObject({ hour: 0, minute: 0, day: 2, dayOfWeek: 'tuesday' })
  })

  it('wraps the week: seven days on it is Monday again', () => {
    expect(advanceClock(createClock(), 96 * 7)).toMatchObject({
      day: 8,
      dayOfWeek: 'monday',
      hour: 8,
    })
  })

  it('does not mutate the time it was given', () => {
    const start = createClock()
    advanceClock(start, 10)
    expect(start.tick).toBe(0)
  })
})

describe('formatTime', () => {
  it('reads like a clock on a wall', () => {
    expect(formatTime(createClock())).toBe('Monday 8:00 AM')
    expect(formatTime(advanceClock(createClock(), 17))).toBe('Monday 12:15 PM')
    expect(formatTime(advanceClock(createClock(), 64))).toBe('Tuesday 12:00 AM')
    expect(formatTime(advanceClock(createClock(), 61))).toBe('Monday 11:15 PM')
  })
})

describe('durationFormat', () => {
  it('shows minutes under an hour, hours on the hour, both otherwise', () => {
    expect(durationFormat({ ticks: 1 })).toBe('15m')
    expect(durationFormat({ ticks: 3 })).toBe('45m')
    expect(durationFormat({ ticks: 4 })).toBe('1h')
    expect(durationFormat({ ticks: 10 })).toBe('2h 30m')
    expect(durationFormat({ ticks: 32 })).toBe('8h')
  })

  it('shows nothing for no time at all', () => {
    expect(durationFormat({ ticks: 0 })).toBe('')
    expect(durationFormat({ ticks: undefined })).toBe('')
  })
})
