import { describe, it, expect } from 'vitest'
import { numberClamp, numberRound, numberSum } from './number.js'

describe('numberClamp', () => {
  it('leaves a value inside the range alone', () => {
    expect(numberClamp({ value: 42, min: 0, max: 100 })).toBe(42)
  })

  it('holds a value to either end', () => {
    expect(numberClamp({ value: -5, min: 0, max: 100 })).toBe(0)
    expect(numberClamp({ value: 500, min: 0, max: 100 })).toBe(100)
  })

  it('works for ranges that do not start at zero', () => {
    expect(numberClamp({ value: 0.99, min: 0.02, max: 0.95 })).toBe(0.95)
    expect(numberClamp({ value: -30, min: -20, max: 20 })).toBe(-20)
  })
})

describe('numberRound', () => {
  it('rounds to the places asked for, as a number', () => {
    expect(numberRound({ value: 0.1 + 0.2, places: 2 })).toBe(0.3)
    expect(numberRound({ value: 1.23456, places: 3 })).toBe(1.235)
  })

  it('rounds to a whole number at zero places', () => {
    expect(numberRound({ value: 2.6, places: 0 })).toBe(3)
  })
})

describe('numberSum', () => {
  it('adds a list up', () => {
    expect(numberSum({ values: [1, 2, 3.5] })).toBe(6.5)
  })

  it('an empty list sums to nothing', () => {
    expect(numberSum({ values: [] })).toBe(0)
  })
})
