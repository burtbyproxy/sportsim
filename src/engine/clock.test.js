import { describe, it, expect } from 'vitest'
import { clockCreate, clockAdvance, clockFormat, durationFormat } from './clock.js'

describe('clockCreate', () => {
  it('starts Monday at 8:00 in the morning, tick zero, day one', () => {
    expect(clockCreate()).toEqual({
      tick: 0,
      day: 1,
      hour: 8,
      minute: 0,
      period: 'morning',
      dayOfWeek: 'monday',
    })
  })
})

describe('clockAdvance', () => {
  it('a tick is fifteen minutes', () => {
    expect(clockAdvance({ gameTime: clockCreate(), ticks: 1 })).toMatchObject({
      tick: 1,
      hour: 8,
      minute: 15,
    })
    expect(clockAdvance({ gameTime: clockCreate(), ticks: 3 })).toMatchObject({
      hour: 8,
      minute: 45,
    })
    expect(clockAdvance({ gameTime: clockCreate(), ticks: 4 })).toMatchObject({
      hour: 9,
      minute: 0,
    })
  })

  it('names the period of the day', () => {
    const at = (ticks) => clockAdvance({ gameTime: clockCreate(), ticks }).period
    expect(at(0)).toBe('morning') // 8:00
    expect(at(16)).toBe('afternoon') // 12:00
    expect(at(36)).toBe('evening') // 17:00
    expect(at(52)).toBe('night') // 21:00
    expect(at(64)).toBe('late_night') // 0:00
    expect(at(84)).toBe('morning') // 5:00
  })

  it('rolls over midnight into the next day and the next weekday', () => {
    const midnight = clockAdvance({ gameTime: clockCreate(), ticks: 64 })
    expect(midnight).toMatchObject({ hour: 0, minute: 0, day: 2, dayOfWeek: 'tuesday' })
  })

  it('wraps the week: seven days on it is Monday again', () => {
    expect(clockAdvance({ gameTime: clockCreate(), ticks: 96 * 7 })).toMatchObject({
      day: 8,
      dayOfWeek: 'monday',
      hour: 8,
    })
  })

  it('does not mutate the time it was given', () => {
    const start = clockCreate()
    clockAdvance({ gameTime: start, ticks: 10 })
    expect(start.tick).toBe(0)
  })
})

describe('clockFormat', () => {
  it('reads like a clock on a wall', () => {
    expect(clockFormat({ gameTime: clockCreate() })).toBe('Monday 8:00 AM')
    expect(clockFormat({ gameTime: clockAdvance({ gameTime: clockCreate(), ticks: 17 }) })).toBe(
      'Monday 12:15 PM'
    )
    expect(clockFormat({ gameTime: clockAdvance({ gameTime: clockCreate(), ticks: 64 }) })).toBe(
      'Tuesday 12:00 AM'
    )
    expect(clockFormat({ gameTime: clockAdvance({ gameTime: clockCreate(), ticks: 61 }) })).toBe(
      'Monday 11:15 PM'
    )
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
