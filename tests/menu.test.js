/**
 * Menu entries — the single navigable list behind the action menu.
 *
 * Arrow keys and Enter must reach exits as well as actions. Before this
 * helper existed, keyboard navigation covered actions only, so selecting an
 * exit and pressing Enter did nothing.
 *
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest'
import {
  menuEntriesBuild,
  EXIT_KEYS,
  exitKeyFor,
  shortcutLabelParts,
} from '../src/utils/menu.js'

const actions = [
  { id: 'raid_fridge', label: 'Raid the fridge', available: true },
  { id: 'sleep', label: 'Sleep', available: false },
]
const exits = [
  { locationId: 'park', label: 'Head to the park' },
  { locationId: 'bar', label: 'Walk to the bar' },
]
const allOpen = () => true

describe('menuEntriesBuild', () => {
  it('lists every action then every exit, in order', () => {
    const entries = menuEntriesBuild({ actions, exits, exitAvailable: allOpen })
    expect(entries.map((e) => e.kind)).toEqual(['action', 'action', 'exit', 'exit'])
    expect(entries.map((e) => e.label)).toEqual([
      'Raid the fridge',
      'Sleep',
      'Head to the park',
      'Walk to the bar',
    ])
  })

  it('numbers actions from 1 and letters exits from a', () => {
    const entries = menuEntriesBuild({ actions, exits, exitAvailable: allOpen })
    expect(entries.map((e) => e.key)).toEqual(['1', '2', 'a', 'b'])
  })

  it('carries action availability through and asks the caller about each exit', () => {
    const entries = menuEntriesBuild({
      actions,
      exits,
      exitAvailable: (exit) => exit.locationId !== 'bar',
    })
    expect(entries.map((e) => e.available)).toEqual([true, false, true, false])
  })

  it('keeps the original action and exit objects for dispatch', () => {
    const entries = menuEntriesBuild({ actions, exits, exitAvailable: allOpen })
    expect(entries[0].action).toBe(actions[0])
    expect(entries[2].exit).toBe(exits[0])
  })

  it('an empty menu is an empty list, not a crash', () => {
    expect(menuEntriesBuild({ actions: [], exits: [], exitAvailable: allOpen })).toEqual([])
  })

  it('actions past the ninth and exits past the twenty-sixth get no key', () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ id: `a${i}`, label: `A${i}`, available: true }))
    const manyExits = Array.from({ length: 27 }, (_, i) => ({ locationId: `l${i}`, label: `L${i}` }))
    const entries = menuEntriesBuild({ actions: many, exits: manyExits, exitAvailable: allOpen })
    expect(entries[9].key).toBe('')
    expect(entries[10 + 25].key).toBe(EXIT_KEYS[25])
    expect(entries[10 + 26].key).toBe('')
  })
})

describe('menuEntriesBuild — event choices', () => {
  const choices = [
    { label: 'Be polite', check: null, outcome: {} },
    { label: 'Walk faster', check: null, outcome: {} },
  ]

  it('choices replace actions and exits entirely while an event waits', () => {
    const entries = menuEntriesBuild({ actions, exits, exitAvailable: allOpen, choices })
    expect(entries.map((e) => e.kind)).toEqual(['choice', 'choice'])
    expect(entries.map((e) => e.key)).toEqual(['1', '2'])
    expect(entries.map((e) => e.choiceIndex)).toEqual([0, 1])
    expect(entries.every((e) => e.available)).toBe(true)
  })

  it('no choices means the ordinary menu', () => {
    const entries = menuEntriesBuild({ actions, exits, exitAvailable: allOpen, choices: [] })
    expect(entries.map((e) => e.kind)).toEqual(['action', 'action', 'exit', 'exit'])
  })
})

describe('exitKeyFor', () => {
  it('letters the exits from a', () => {
    expect(exitKeyFor({ index: 0 })).toBe('a')
    expect(exitKeyFor({ index: 3 })).toBe('d')
    expect(exitKeyFor({ index: 25 })).toBe('z')
  })

  it("runs out of alphabet with a '?'", () => {
    expect(exitKeyFor({ index: 26 })).toBe('?')
  })

  it('agrees with the keys the menu entries are built with', () => {
    const entries = menuEntriesBuild({
      actions: [],
      exits: [{ locationId: 'a' }, { locationId: 'b' }],
      exitAvailable: () => true,
    })
    expect(entries.map((e) => e.key)).toEqual([exitKeyFor({ index: 0 }), exitKeyFor({ index: 1 })])
  })
})

describe('shortcutLabelParts', () => {
  it('brackets the shortcut letter at the start of a label', () => {
    expect(shortcutLabelParts({ label: 'New Game', shortcut: 'n' })).toEqual([
      { text: '[N]', isKey: true },
      { text: 'ew Game', isKey: false },
    ])
  })

  it('brackets a shortcut letter in the middle, keeping the label\'s own case', () => {
    expect(shortcutLabelParts({ label: 'Quit', shortcut: 'i' })).toEqual([
      { text: 'Qu', isKey: false },
      { text: '[i]', isKey: true },
      { text: 't', isKey: false },
    ])
  })

  it('brackets a shortcut letter at the end', () => {
    expect(shortcutLabelParts({ label: 'Load', shortcut: 'D' })).toEqual([
      { text: 'Loa', isKey: false },
      { text: '[d]', isKey: true },
    ])
  })

  it('leaves the label whole when there is no shortcut or the letter is not in it', () => {
    expect(shortcutLabelParts({ label: 'Load Game', shortcut: null })).toEqual([
      { text: 'Load Game', isKey: false },
    ])
    expect(shortcutLabelParts({ label: 'Load Game', shortcut: 'z' })).toEqual([
      { text: 'Load Game', isKey: false },
    ])
  })
})
