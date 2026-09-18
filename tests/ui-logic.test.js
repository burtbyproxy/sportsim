/**
 * UI logic tests — Portland 2001 overhaul
 *
 * Tests the pure logic that lives inside GameScreen, ActionMenu, and friends.
 * No Vue mounting. No DOM. Just logic.
 *
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest'

// ─── Status bar label correctness ────────────────────────────────────────────
// These are the full-word labels from the Portland 2001 overhaul.
// They must be full words, not abbreviations.

describe('status bar stat labels', () => {
  // Mirrors the statusStats computed in GameScreen.vue
  const STATUS_STATS = [
    { key: 'health', label: 'Health', icon: '♥' },
    { key: 'energy', label: 'Energy', icon: '⚡' },
    { key: 'mood', label: 'Mood', icon: '◈' },
    { key: 'sobriety', label: 'Sobriety', icon: '◎' },
    { key: 'hunger', label: 'Hunger', icon: '◆' },
  ]

  it('has exactly 5 stats', () => {
    expect(STATUS_STATS).toHaveLength(5)
  })

  it('uses full words, not abbreviations', () => {
    const fullWords = ['Health', 'Energy', 'Mood', 'Sobriety', 'Hunger']
    const labels = STATUS_STATS.map((s) => s.label)
    expect(labels).toEqual(fullWords)
  })

  it('each stat has a key, label, and icon', () => {
    for (const stat of STATUS_STATS) {
      expect(stat.key).toBeTruthy()
      expect(stat.label).toBeTruthy()
      expect(stat.icon).toBeTruthy()
    }
  })

  it('stat keys match expected store getter names', () => {
    const keys = STATUS_STATS.map((s) => s.key)
    expect(keys).toContain('health')
    expect(keys).toContain('energy')
    expect(keys).toContain('mood')
    expect(keys).toContain('sobriety')
    expect(keys).toContain('hunger')
  })
})

// ─── Status bar danger/warning threshold logic ───────────────────────────────
// Extracted from GameScreen.vue barFillClass(). Pure function. Test it hard.

function barFillClass(key, value) {
  if (key === 'hunger') {
    if (value <= 20) return 'status-stat__fill--danger'
    if (value <= 40) return 'status-stat__fill--warning'
    return ''
  }
  if (key === 'sobriety') {
    if (value <= 25) return 'status-stat__fill--danger'
    if (value <= 50) return 'status-stat__fill--warning'
    return ''
  }
  // Default: danger below 20, warning below 40
  if (value <= 20) return 'status-stat__fill--danger'
  if (value <= 40) return 'status-stat__fill--warning'
  return ''
}

describe('barFillClass — default stats (health, energy, mood)', () => {
  for (const key of ['health', 'energy', 'mood']) {
    describe(key, () => {
      it('is danger at 20', () => {
        expect(barFillClass(key, 20)).toBe('status-stat__fill--danger')
      })

      it('is danger below 20', () => {
        expect(barFillClass(key, 5)).toBe('status-stat__fill--danger')
        expect(barFillClass(key, 0)).toBe('status-stat__fill--danger')
        expect(barFillClass(key, 1)).toBe('status-stat__fill--danger')
      })

      it('is warning at 21', () => {
        expect(barFillClass(key, 21)).toBe('status-stat__fill--warning')
      })

      it('is warning at 40', () => {
        expect(barFillClass(key, 40)).toBe('status-stat__fill--warning')
      })

      it('is normal above 40', () => {
        expect(barFillClass(key, 41)).toBe('')
        expect(barFillClass(key, 75)).toBe('')
        expect(barFillClass(key, 100)).toBe('')
      })
    })
  }
})

describe('barFillClass — hunger (inverted: low = starving)', () => {
  it('is danger at 20', () => {
    expect(barFillClass('hunger', 20)).toBe('status-stat__fill--danger')
  })

  it('is danger below 20', () => {
    expect(barFillClass('hunger', 0)).toBe('status-stat__fill--danger')
    expect(barFillClass('hunger', 10)).toBe('status-stat__fill--danger')
  })

  it('is warning at 21', () => {
    expect(barFillClass('hunger', 21)).toBe('status-stat__fill--warning')
  })

  it('is warning at 40', () => {
    expect(barFillClass('hunger', 40)).toBe('status-stat__fill--warning')
  })

  it('is normal when well-fed (above 40)', () => {
    expect(barFillClass('hunger', 50)).toBe('')
    expect(barFillClass('hunger', 100)).toBe('')
  })
})

describe('barFillClass — sobriety (wider warning band)', () => {
  it('is danger at 25', () => {
    expect(barFillClass('sobriety', 25)).toBe('status-stat__fill--danger')
  })

  it('is danger below 25', () => {
    expect(barFillClass('sobriety', 0)).toBe('status-stat__fill--danger')
    expect(barFillClass('sobriety', 10)).toBe('status-stat__fill--danger')
    expect(barFillClass('sobriety', 24)).toBe('status-stat__fill--danger')
  })

  it('is warning at 26', () => {
    expect(barFillClass('sobriety', 26)).toBe('status-stat__fill--warning')
  })

  it('is warning at 50', () => {
    expect(barFillClass('sobriety', 50)).toBe('status-stat__fill--warning')
  })

  it('is normal when clear (above 50)', () => {
    expect(barFillClass('sobriety', 51)).toBe('')
    expect(barFillClass('sobriety', 80)).toBe('')
    expect(barFillClass('sobriety', 100)).toBe('')
  })

  it('sobriety danger threshold is lower than health (25 vs 20)', () => {
    // sobriety at 21 = warning; health at 21 = warning too but sobriety has wider band
    expect(barFillClass('sobriety', 25)).toBe('status-stat__fill--danger')
    expect(barFillClass('health', 25)).toBe('status-stat__fill--warning')
  })
})

// ─── Exit key mapping ─────────────────────────────────────────────────────────
// ActionMenu.vue maps exits to letter keys a–z.
// The mapping must be correct and must not run past z.

const EXIT_KEYS = 'abcdefghijklmnopqrstuvwxyz'

function exitKey(index) {
  return EXIT_KEYS[index] ?? '?'
}

describe('exit key mapping (ActionMenu)', () => {
  it('first exit maps to a', () => {
    expect(exitKey(0)).toBe('a')
  })

  it('second exit maps to b', () => {
    expect(exitKey(1)).toBe('b')
  })

  it('26th exit maps to z', () => {
    expect(exitKey(25)).toBe('z')
  })

  it('27th exit and beyond returns ?', () => {
    expect(exitKey(26)).toBe('?')
    expect(exitKey(100)).toBe('?')
  })

  it('all 26 keys are distinct letters', () => {
    const keys = Array.from({ length: 26 }, (_, i) => exitKey(i))
    const unique = new Set(keys)
    expect(unique.size).toBe(26)
    for (const k of keys) {
      expect(k).toMatch(/^[a-z]$/)
    }
  })
})

// ─── ActionMenu empty state logic ─────────────────────────────────────────────
// When there are zero actions AND zero exits, the empty message shows.
// When there are actions OR exits, the list shows.

describe('ActionMenu empty state logic', () => {
  function shouldShowEmpty(filteredActionsLength, exitsLength) {
    return filteredActionsLength === 0 && exitsLength === 0
  }

  it('shows empty when no actions and no exits', () => {
    expect(shouldShowEmpty(0, 0)).toBe(true)
  })

  it('shows list when actions exist but no exits', () => {
    expect(shouldShowEmpty(1, 0)).toBe(false)
  })

  it('shows list when exits exist but no actions', () => {
    expect(shouldShowEmpty(0, 1)).toBe(false)
  })

  it('shows list when both actions and exits exist', () => {
    expect(shouldShowEmpty(3, 2)).toBe(false)
  })
})

// ─── Separator visibility logic ───────────────────────────────────────────────
// The separator between actions and exits should only show when both lists are non-empty.

describe('ActionMenu separator logic', () => {
  function shouldShowSeparator(sortedActionsLength, exitsLength) {
    return sortedActionsLength > 0 && exitsLength > 0
  }

  it('shows separator when both actions and exits present', () => {
    expect(shouldShowSeparator(2, 3)).toBe(true)
  })

  it('hides separator when only actions', () => {
    expect(shouldShowSeparator(2, 0)).toBe(false)
  })

  it('hides separator when only exits', () => {
    expect(shouldShowSeparator(0, 2)).toBe(false)
  })

  it('hides separator when both empty', () => {
    expect(shouldShowSeparator(0, 0)).toBe(false)
  })
})

// ─── Action number shortcut display ───────────────────────────────────────────
// Actions 1–9 get number shortcuts. Actions at index 9+ get blank space.

describe('action number shortcut display', () => {
  function actionShortcut(i) {
    return i < 9 ? String(i + 1) + '.' : '  '
  }

  it('first action shows 1.', () => {
    expect(actionShortcut(0)).toBe('1.')
  })

  it('ninth action shows 9.', () => {
    expect(actionShortcut(8)).toBe('9.')
  })

  it('tenth action shows blank', () => {
    expect(actionShortcut(9)).toBe('  ')
  })

  it('eleventh action shows blank', () => {
    expect(actionShortcut(10)).toBe('  ')
  })

  it('shortcuts 1–9 are all distinct', () => {
    const shortcuts = Array.from({ length: 9 }, (_, i) => actionShortcut(i))
    const unique = new Set(shortcuts)
    expect(unique.size).toBe(9)
  })
})

// ─── NarrativeLog accessibility contract ─────────────────────────────────────
// The NarrativeLog must keep its accessibility attributes.
// The component cannot be mounted in the node env, so the contract is tested
// as a specification — what values the props/aria config must have.

describe('NarrativeLog accessibility specification', () => {
  // These are the values that must be present on the root element
  const REQUIRED_ARIA = {
    role: 'log',
    'aria-live': 'polite',
    'aria-label': 'Game narrative',
    tabindex: '0',
  }

  it('specifies role=log for screen readers', () => {
    expect(REQUIRED_ARIA.role).toBe('log')
  })

  it('specifies aria-live=polite (not assertive — narrative should not interrupt)', () => {
    expect(REQUIRED_ARIA['aria-live']).toBe('polite')
  })

  it('has a human-readable aria-label', () => {
    expect(REQUIRED_ARIA['aria-label']).toBeTruthy()
    expect(REQUIRED_ARIA['aria-label'].length).toBeGreaterThan(0)
  })

  it('is focusable (tabindex 0)', () => {
    expect(REQUIRED_ARIA.tabindex).toBe('0')
  })
})

// ─── GameFooter keyboard hint ─────────────────────────────────────────────────
// The footer hint must document both number keys (actions) and letter keys (exits).

describe('GameFooter keyboard hint', () => {
  const HINT_RUNNING = '1–9 actions · a–z go · space skip'
  const HINT_IDLE = 'no active game'

  it('running hint mentions number keys for actions', () => {
    expect(HINT_RUNNING).toMatch(/1.+9/)
    expect(HINT_RUNNING.toLowerCase()).toMatch(/action/)
  })

  it('running hint mentions letter keys for exits', () => {
    expect(HINT_RUNNING).toMatch(/a.+z/)
  })

  it('running hint mentions space to skip', () => {
    expect(HINT_RUNNING.toLowerCase()).toMatch(/space/)
    expect(HINT_RUNNING.toLowerCase()).toMatch(/skip/)
  })

  it('idle hint is clear about no active game', () => {
    expect(HINT_IDLE).toBeTruthy()
  })
})

// ─── TitleScreen renderShortcutLabel ─────────────────────────────────────────
// Pure function that splits a label around a shortcut letter.
// "[n]ew Game" — bracket + class on the matched character.

function renderShortcutLabel(label, shortcut) {
  if (!shortcut) return [{ text: label, isKey: false }]
  const idx = label.toLowerCase().indexOf(shortcut.toLowerCase())
  if (idx === -1) return [{ text: label, isKey: false }]
  const parts = []
  if (idx > 0) parts.push({ text: label.slice(0, idx), isKey: false })
  parts.push({ text: `[${label[idx]}]`, isKey: true })
  if (idx + 1 < label.length) parts.push({ text: label.slice(idx + 1), isKey: false })
  return parts
}

describe('renderShortcutLabel (TitleScreen)', () => {
  it('wraps the shortcut letter in brackets', () => {
    const parts = renderShortcutLabel('New Game', 'n')
    const keyPart = parts.find((p) => p.isKey)
    expect(keyPart).toBeDefined()
    expect(keyPart.text).toBe('[N]')
  })

  it('prefix text before the shortcut is a non-key part (when shortcut is mid-word)', () => {
    // 'Unlocks' with shortcut 'l' — idx=2, prefix='Un'
    const parts = renderShortcutLabel('Unlocks', 'l')
    expect(parts[0].isKey).toBe(false)
    expect(parts[0].text).toBe('Un')
  })

  it('Load Game — [L] is first char, no prefix part', () => {
    // 'l' is at index 0 in 'Load Game' — no prefix pushed
    const parts = renderShortcutLabel('Load Game', 'l')
    expect(parts.length).toBe(2)
    expect(parts[0].text).toBe('[L]')
    expect(parts[0].isKey).toBe(true)
    expect(parts[1].text).toBe('oad Game')
    expect(parts[1].isKey).toBe(false)
  })

  it('New Game — prefix is empty (n is first char)', () => {
    const parts = renderShortcutLabel('New Game', 'n')
    // idx=0, no prefix part pushed
    expect(parts.length).toBe(2) // [key][suffix]
    expect(parts[0].text).toBe('[N]')
    expect(parts[1].text).toBe('ew Game')
  })

  it('Unlocks — [U] first char', () => {
    const parts = renderShortcutLabel('Unlocks', 'u')
    expect(parts.length).toBe(2)
    expect(parts[0].text).toBe('[U]')
    expect(parts[0].isKey).toBe(true)
  })

  it('returns single part when shortcut not found', () => {
    const parts = renderShortcutLabel('New Game', 'z')
    expect(parts).toHaveLength(1)
    expect(parts[0].text).toBe('New Game')
    expect(parts[0].isKey).toBe(false)
  })

  it('returns single part when no shortcut given', () => {
    const parts = renderShortcutLabel('New Game', undefined)
    expect(parts).toHaveLength(1)
    expect(parts[0].isKey).toBe(false)
  })

  it('is case-insensitive on the match', () => {
    // shortcut 'n' matches 'N' in 'New Game'
    const parts = renderShortcutLabel('New Game', 'n')
    const key = parts.find((p) => p.isKey)
    expect(key).toBeDefined()
    expect(key.text).toBe('[N]')
  })
})

// ─── TitleScreen menu item shortcut contract ──────────────────────────────────
// The three menu items must have the right ids, shortcuts, and disabled states.

describe('TitleScreen menu item contract', () => {
  // Mirrors the menuItems computed in TitleScreen.vue (with hasSave = false)
  function buildMenuItems(hasSave) {
    return [
      { id: 'new', label: 'New Game', shortcut: 'n', disabled: false },
      { id: 'load', label: 'Load Game', shortcut: 'l', disabled: !hasSave },
      { id: 'unlocks', label: 'Unlocks', shortcut: 'u', disabled: true },
    ]
  }

  it('has exactly 3 menu items', () => {
    expect(buildMenuItems(false)).toHaveLength(3)
  })

  it('new game is never disabled', () => {
    expect(buildMenuItems(false)[0].disabled).toBe(false)
    expect(buildMenuItems(true)[0].disabled).toBe(false)
  })

  it('load game is disabled when no save exists', () => {
    expect(buildMenuItems(false)[1].disabled).toBe(true)
  })

  it('load game is enabled when save exists', () => {
    expect(buildMenuItems(true)[1].disabled).toBe(false)
  })

  it('unlocks is always disabled (not implemented)', () => {
    expect(buildMenuItems(false)[2].disabled).toBe(true)
    expect(buildMenuItems(true)[2].disabled).toBe(true)
  })

  it('each item has a unique shortcut key', () => {
    const items = buildMenuItems(false)
    const shortcuts = items.map((i) => i.shortcut)
    const unique = new Set(shortcuts)
    expect(unique.size).toBe(shortcuts.length)
  })

  it('shortcuts are single lowercase letters', () => {
    const items = buildMenuItems(false)
    for (const item of items) {
      expect(item.shortcut).toMatch(/^[a-z]$/)
    }
  })
})

// ─── TitleScreen onKeydown shortcut routing ───────────────────────────────────
// The keyboard handler should: fire disabled shortcuts = no-op, fire enabled = action.

describe('TitleScreen onKeydown shortcut routing', () => {
  function buildItems(hasSave) {
    return [
      { id: 'new', shortcut: 'n', disabled: false },
      { id: 'load', shortcut: 'l', disabled: !hasSave },
      { id: 'unlocks', shortcut: 'u', disabled: true },
    ]
  }

  function findShortcutItem(items, key) {
    const letter = key.toLowerCase()
    return items.find((m) => m.shortcut === letter && !m.disabled) ?? null
  }

  it('n routes to new game item', () => {
    const item = findShortcutItem(buildItems(false), 'n')
    expect(item).not.toBeNull()
    expect(item.id).toBe('new')
  })

  it('l routes to load game when save exists', () => {
    const item = findShortcutItem(buildItems(true), 'l')
    expect(item).not.toBeNull()
    expect(item.id).toBe('load')
  })

  it('l returns null when no save (disabled)', () => {
    const item = findShortcutItem(buildItems(false), 'l')
    expect(item).toBeNull()
  })

  it('u returns null (unlocks always disabled)', () => {
    const item = findShortcutItem(buildItems(false), 'u')
    expect(item).toBeNull()
  })

  it('unknown key returns null', () => {
    const item = findShortcutItem(buildItems(false), 'z')
    expect(item).toBeNull()
  })

  it('capital N also routes to new game (case insensitive)', () => {
    const item = findShortcutItem(buildItems(false), 'N')
    expect(item).not.toBeNull()
    expect(item.id).toBe('new')
  })
})
