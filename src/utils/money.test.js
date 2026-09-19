import { describe, it, expect } from 'vitest'
import { moneyFormat } from './money.js'

describe('moneyFormat', () => {
  it('writes dollars and cents', () => {
    expect(moneyFormat({ amount: 3.5 })).toBe('$3.50')
    expect(moneyFormat({ amount: 0 })).toBe('$0.00')
  })

  it('puts the sign in front of the dollar sign', () => {
    expect(moneyFormat({ amount: -2 })).toBe('-$2.00')
  })
})
