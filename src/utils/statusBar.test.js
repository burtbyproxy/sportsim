import { describe, it, expect } from 'vitest'
import { statusBarFillClass } from './statusBar.js'

const DANGER = 'status-stat__fill--danger'
const WARNING = 'status-stat__fill--warning'

describe('statusBarFillClass', () => {
  it('turns at the thresholds it is given, inclusive', () => {
    const at = (value) => statusBarFillClass({ value, danger: 20, warning: 40 })
    expect(at(0)).toBe(DANGER)
    expect(at(20)).toBe(DANGER)
    expect(at(21)).toBe(WARNING)
    expect(at(40)).toBe(WARNING)
    expect(at(41)).toBe('')
    expect(at(100)).toBe('')
  })

  it('a vital that warns early is a matter of its thresholds, not of its name', () => {
    const at = (value) => statusBarFillClass({ value, danger: 25, warning: 50 })
    expect(at(25)).toBe(DANGER)
    expect(at(26)).toBe(WARNING)
    expect(at(50)).toBe(WARNING)
    expect(at(51)).toBe('')
  })
})
