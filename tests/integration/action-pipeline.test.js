// @vitest-environment node
/**
 * Integration: Action pipeline
 *
 * Tests:
 *   getAvailableActions() with real Kenton location data (from content/)
 *   resolveAction() with a real action fixture
 *   Stat decay over realistic tick counts
 *   tickModifiers() expiry over N ticks
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'fs'
import { join, resolve } from 'path'
import { createPlayer, addModifier, tickModifiers } from '../../src/models/player.js'
import { statEffective } from '../../src/engine/dice.js'
import { createLocation } from '../../src/models/location.js'
import { getAvailableActions, resolveAction } from '../../src/engine/actions.js'
import { getStatDecayEffects } from '../../src/engine/stats.js'
import { seededRandom } from '../../src/utils/random.js'

// ---------------------------------------------------------------------------
// Load content from content/ (same approach as content-validation.test.js)
// ---------------------------------------------------------------------------

const CONTENT_ROOT = resolve('content')

function loadJsonFiles(dirPath) {
  if (!existsSync(dirPath)) return []
  return readdirSync(dirPath)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(dirPath, f), 'utf-8')))
}

// Load all Kenton locations keyed by ID
const kentonLocationFiles = loadJsonFiles(join(CONTENT_ROOT, 'maps/kenton/locations'))
const kentonLocations = Object.fromEntries(kentonLocationFiles.map((l) => [l.id, l]))

// Load all Kenton actions keyed by ID (files may contain arrays)
const kentonActionFiles = loadJsonFiles(join(CONTENT_ROOT, 'maps/kenton/actions'))
const kentonActionsFlat = kentonActionFiles.flatMap((f) =>
  Array.isArray(f) ? f : Object.values(f)
)
const kentonActions = Object.fromEntries(kentonActionsFlat.map((a) => [a.id, a]))
const kentonActionRegistry = kentonActionsFlat

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeGameTime(hour = 14) {
  return {
    tick: 100,
    day: 1,
    hour,
    minute: 0,
    period: 'afternoon',
    dayOfWeek: 'monday',
  }
}

/**
 * A minimal valid action fixture.
 * Represents a "drink PBR" action available at bars.
 */
const DRINK_ACTION = {
  id: 'drink_pbr',
  label: 'Order a PBR',
  locationId: 'blue_parrot',
  timeCost: 1,
  requirements: {},
  check: null,
  success: {
    narrative: {
      tokens: [
        {
          text: 'You drink the beer.',
          style: 'normal',
          speed: 'normal',
          pauseAfter: 0,
          effect: 'none',
          color: null,
        },
      ],
    },
    statChanges: null,
    statusChanges: { mood: 5 },
    doses: [{ substanceId: 'beer', value: 10 }],
    moneyChange: -1,
    itemsGained: null,
    itemsLost: null,
    eventTriggered: null,
    locationDiscovered: null,
    archetypeChanges: { drunk_artist: 1 },
    counterChanges: { drinks_consumed: 1 },
    traumaGained: null,
    obsessionFed: null,
  },
  failure: null,
  criticalSuccess: null,
  criticalFailure: null,
  weight: 10,
  obsessionIds: ['booze'],
}

const CHARM_CHECK_ACTION = {
  id: 'chat_up_bartender',
  label: 'Chat up the bartender',
  locationId: 'blue_parrot',
  timeCost: 1,
  requirements: {},
  check: { stat: 'charm', dc: 15, opposedStat: null, opposedNpcId: null },
  success: {
    narrative: {
      tokens: [
        {
          text: 'They smile.',
          style: 'normal',
          speed: 'normal',
          pauseAfter: 0,
          effect: 'none',
          color: null,
        },
      ],
    },
    statChanges: null,
    statusChanges: { mood: 10 },
    moneyChange: null,
    itemsGained: null,
    itemsLost: null,
    eventTriggered: null,
    locationDiscovered: null,
    archetypeChanges: null,
    counterChanges: null,
    traumaGained: null,
    obsessionFed: null,
  },
  failure: {
    narrative: {
      tokens: [
        {
          text: 'They look away.',
          style: 'normal',
          speed: 'normal',
          pauseAfter: 0,
          effect: 'none',
          color: null,
        },
      ],
    },
    statChanges: null,
    statusChanges: { mood: -5 },
    moneyChange: null,
    itemsGained: null,
    itemsLost: null,
    eventTriggered: null,
    locationDiscovered: null,
    archetypeChanges: null,
    counterChanges: null,
    traumaGained: null,
    obsessionFed: null,
  },
  criticalSuccess: null,
  criticalFailure: null,
  weight: 5,
  obsessionIds: [],
}

// ---------------------------------------------------------------------------
// getAvailableActions with Kenton location data
// ---------------------------------------------------------------------------

describe('getAvailableActions — real Kenton location data', () => {
  it('mouse_trap returns its own wired actions alongside "any" actions', () => {
    const location = createLocation(kentonLocations.mouse_trap)
    const player = createPlayer('Test')
    const result = getAvailableActions(player, location, makeGameTime(), kentonActionRegistry)
    const ids = result.map((a) => a.id)
    expect(ids).toContain('play_pool_mouse_trap')
    expect(ids).toContain('smoke_out_front_mouse_trap')
    for (const action of result) {
      expect(['any', 'mouse_trap']).toContain(action.locationId)
    }
  })

  it('returns real actions at blue_parrot with real action registry', () => {
    const location = createLocation(kentonLocations.blue_parrot)
    const player = createPlayer('Test')
    player.status.money = 10
    // Blue Parrot is open at 14:00 (minHour: 11)
    const result = getAvailableActions(player, location, makeGameTime(14), kentonActionRegistry)
    expect(result.map((a) => a.id)).toContain('order_beer_parrot')
    // NPC interactions at blue_parrot use character names (talk_to_tina, talk_to_greg)
    const ids = result.map((a) => a.id)
    expect(ids.some((id) => id.startsWith('talk_to_'))).toBe(true)
  })

  it('blue_parrot location actions are filtered before 11am (time-restricted)', () => {
    const location = createLocation(kentonLocations.blue_parrot)
    const player = createPlayer('Test')
    // Bar actions require minHour: 11 — time-restricted actions should be absent at 9am
    const result = getAvailableActions(player, location, makeGameTime(9), kentonActionRegistry)
    // order_beer_parrot requires minHour: 11 — should not appear at 9am
    expect(result.map((a) => a.id)).not.toContain('order_beer_parrot')
  })

  it('returns real actions at moms_house with real action registry', () => {
    const location = createLocation(kentonLocations.moms_house)
    const player = createPlayer('Test')
    // At 14:00, sleep requires minHour: 21 so raid_fridge and stare_at_ceiling available
    const result = getAvailableActions(player, location, makeGameTime(14), kentonActionRegistry)
    const ids = result.map((a) => a.id)
    expect(ids).toContain('raid_fridge')
    expect(ids).toContain('stare_at_ceiling')
    expect(ids).not.toContain('sleep')
  })

  it('sleep is available at moms_house after 9pm', () => {
    const location = createLocation(kentonLocations.moms_house)
    const player = createPlayer('Test')
    const result = getAvailableActions(player, location, makeGameTime(21), kentonActionRegistry)
    expect(result.map((a) => a.id)).toContain('sleep')
  })

  it('shoplift_plaid is filtered when player is too drunk (sobriety < 50)', () => {
    const location = createLocation(kentonLocations.ainsworth_plaid)
    const player = createPlayer('Test')
    player.status.money = 10
    player.status.sobriety = 30 // below minSobriety: 50
    const result = getAvailableActions(player, location, makeGameTime(14), kentonActionRegistry)
    const ids = result.map((a) => a.id)
    expect(ids).not.toContain('shoplift_plaid')
    expect(ids).toContain('buy_tallboy') // no sobriety requirement
  })

  it('look_for_change not available at night (maxHour: 22)', () => {
    const location = createLocation(kentonLocations.columbia_park)
    const player = createPlayer('Test')
    const result = getAvailableActions(player, location, makeGameTime(23), kentonActionRegistry)
    expect(result.map((a) => a.id)).not.toContain('look_for_change')
  })

  it('highest-weight location actions appear first at moms_house', () => {
    const location = createLocation(kentonLocations.moms_house)
    const player = createPlayer('Test')
    const result = getAvailableActions(player, location, makeGameTime(14), kentonActionRegistry)
    // raid_fridge weight=80 — must be the top location-specific action
    expect(result.map((a) => a.id)).toContain('raid_fridge')
    const raidIdx = result.findIndex((a) => a.id === 'raid_fridge')
    const stareIdx = result.findIndex((a) => a.id === 'stare_at_ceiling')
    expect(raidIdx).toBeLessThan(stareIdx)
  })

  it('always returns "any" location actions regardless of actionIds', () => {
    const location = createLocation(kentonLocations.columbia_park)
    const player = createPlayer('Test')
    const anyAction = { ...DRINK_ACTION, id: 'look_around', locationId: 'any', weight: 1 }

    const result = getAvailableActions(player, location, makeGameTime(), [anyAction])
    expect(result.map((a) => a.id)).toContain('look_around')
  })

  it('filters actions by time-of-day requirements', () => {
    const locationData = { ...kentonLocations.blue_parrot, actionIds: ['drink_pbr'] }
    const location = createLocation(locationData)
    const player = createPlayer('Test')
    const earlyAction = { ...DRINK_ACTION, requirements: { minHour: 20 } }

    // It's 14:00, action requires hour >= 20 — should be filtered out
    const result = getAvailableActions(player, location, makeGameTime(14), [earlyAction])
    expect(result).toHaveLength(0)
  })

  it('filters actions by stat requirements', () => {
    const locationData = { ...kentonLocations.blue_parrot, actionIds: ['charm_action'] }
    const location = createLocation(locationData)
    const player = createPlayer('Test')
    player.stats.charm.base = 5

    const eliteAction = {
      ...DRINK_ACTION,
      id: 'charm_action',
      requirements: { minStats: { charm: 50 } },
    }
    const result = getAvailableActions(player, location, makeGameTime(), [eliteAction])
    expect(result).toHaveLength(0)
  })

  it('sorts available actions by descending weight', () => {
    const locationData = {
      ...kentonLocations.blue_parrot,
      actionIds: ['drink_pbr', 'chat_up_bartender'],
    }
    const location = createLocation(locationData)
    const player = createPlayer('Test')

    const result = getAvailableActions(player, location, makeGameTime(), [
      DRINK_ACTION,
      CHARM_CHECK_ACTION,
    ])
    // DRINK_ACTION weight=10, CHARM_CHECK_ACTION weight=5
    expect(result[0].id).toBe('drink_pbr')
    expect(result[1].id).toBe('chat_up_bartender')
  })
})

// ---------------------------------------------------------------------------
// resolveAction — full pipeline with dice
// ---------------------------------------------------------------------------

describe('resolveAction — real Kenton action data', () => {
  it('raid_fridge auto-succeeds and returns hunger gain', () => {
    const player = createPlayer('Test')
    const result = resolveAction(
      player,
      kentonActions.raid_fridge,
      makeGameTime(),
      [],
      seededRandom(1)
    )
    expect(result.success).toBe(true)
    expect(result.diceResult).toBeNull()
    expect(result.outcome.statusChanges.hunger).toBe(25)
    expect(result.outcome.counterChanges.times_raided_fridge).toBe(1)
  })

  it('order_beer_parrot auto-succeeds, costs money, and doses beer', () => {
    const player = createPlayer('Test')
    player.status.money = 10
    const result = resolveAction(
      player,
      kentonActions.order_beer_parrot,
      makeGameTime(14),
      [],
      seededRandom(1)
    )
    expect(result.success).toBe(true)
    expect(result.outcome.moneyChange).toBe(-3)
    expect(result.outcome.statusChanges.sobriety).toBeUndefined()
    expect(result.outcome.doses).toEqual([{ substanceId: 'beer', value: 15 }])
    expect(result.outcome.statusChanges.mood).toBe(10)
  })

  it('look_for_change critical success yields $20 on natural 20', () => {
    const player = createPlayer('Test')
    const alwaysMax = () => 0.9999 // natural 20
    const result = resolveAction(
      player,
      kentonActions.look_for_change,
      makeGameTime(14),
      [],
      alwaysMax
    )
    expect(result.success).toBe(true)
    expect(result.outcome.moneyChange).toBe(20)
    expect(result.outcome.archetypeChanges.lucky_bastard).toBe(5)
  })

  it('look_for_change critical failure on natural 1 — crit outcome selected regardless of success', () => {
    const player = createPlayer('Test')
    const alwaysMin = () => 0 // natural 1 = criticalFailure
    const result = resolveAction(
      player,
      kentonActions.look_for_change,
      makeGameTime(14),
      [],
      alwaysMin
    )
    // Natural 1 triggers criticalFailure outcome. Note: result.success may still be true if
    // luck modifier + natural 1 clears the dc — criticalFailure outcome is selected by
    // _selectOutcome before the success check. This is correct engine behavior.
    expect(result.diceResult.criticalFailure).toBe(true)
    expect(result.diceResult.natural).toBe(1)
    expect(result.outcome.statusChanges.mood).toBe(-15)
  })

  it('shoplift_plaid blocked when sobriety below requirement', () => {
    const player = createPlayer('Test')
    player.status.sobriety = 30
    const result = resolveAction(
      player,
      kentonActions.shoplift_plaid,
      makeGameTime(),
      [],
      seededRandom(1)
    )
    expect(result.requirementFailure).toBeTruthy()
    expect(result.outcome).toBeNull()
  })
})

describe('resolveAction — full pipeline', () => {
  it('auto-success action returns correct outcome without a dice roll', () => {
    const player = createPlayer('Test')
    const result = resolveAction(player, DRINK_ACTION, makeGameTime(), [], seededRandom(1))

    expect(result.success).toBe(true)
    expect(result.diceResult).toBeNull()
    expect(result.requirementFailure).toBeNull()
    expect(result.outcome.doses).toEqual([{ substanceId: 'beer', value: 10 }])
    expect(result.outcome.statusChanges.mood).toBe(5)
    expect(result.outcome.moneyChange).toBe(-1)
    expect(result.outcome.counterChanges.drinks_consumed).toBe(1)
  })

  it('dice check action returns a valid DiceResult', () => {
    const player = createPlayer('Test')
    player.stats.charm.base = 15

    const result = resolveAction(player, CHARM_CHECK_ACTION, makeGameTime(), [], seededRandom(42))

    expect(result.diceResult).not.toBeNull()
    expect(result.diceResult.natural).toBeGreaterThanOrEqual(1)
    expect(result.diceResult.natural).toBeLessThanOrEqual(20)
    expect(result.diceResult.stat).toBe('charm')
    expect(result.diceResult.dc).toBe(15)
    expect(typeof result.diceResult.success).toBe('boolean')
  })

  it('success outcome applied when check passes (forced)', () => {
    const player = createPlayer('Test')
    player.stats.charm.base = 15

    const alwaysMax = () => 0.9999 // natural 20 = always success
    const result = resolveAction(player, CHARM_CHECK_ACTION, makeGameTime(), [], alwaysMax)

    expect(result.success).toBe(true)
    expect(result.outcome.statusChanges.mood).toBe(10)
  })

  it('failure outcome applied when check fails (forced)', () => {
    const player = createPlayer('Test')
    player.stats.charm.base = 1

    const alwaysMin = () => 0 // natural 1 = always failure
    const result = resolveAction(player, CHARM_CHECK_ACTION, makeGameTime(), [], alwaysMin)

    expect(result.success).toBe(false)
    expect(result.outcome.statusChanges.mood).toBe(-5)
  })

  it('requirement failure blocks action before dice roll', () => {
    const player = createPlayer('Test')
    player.stats.charm.base = 5

    const gatedAction = { ...CHARM_CHECK_ACTION, requirements: { minStats: { charm: 50 } } }
    const result = resolveAction(player, gatedAction, makeGameTime(), [], seededRandom(1))

    expect(result.requirementFailure).toBeTruthy()
    expect(result.outcome).toBeNull()
    expect(result.diceResult).toBeNull()
  })

  it('outcome is deterministic with seeded RNG', () => {
    const player = createPlayer('Test')
    player.stats.charm.base = 15

    const result1 = resolveAction(player, CHARM_CHECK_ACTION, makeGameTime(), [], seededRandom(100))
    const result2 = resolveAction(player, CHARM_CHECK_ACTION, makeGameTime(), [], seededRandom(100))

    expect(result1.success).toBe(result2.success)
    expect(result1.diceResult.natural).toBe(result2.diceResult.natural)
    expect(result1.diceResult.total).toBe(result2.diceResult.total)
  })
})

// ---------------------------------------------------------------------------
// Stat decay over realistic tick counts
// ---------------------------------------------------------------------------

describe('getStatDecayEffects — realistic tick counts', () => {
  it('1 hour (4 ticks) produces sensible decay', () => {
    const player = createPlayer('Test')
    player.status.hunger = 60
    player.status.energy = 80

    const changes = getStatDecayEffects(player, 4)

    // 4 ticks = 1 hour
    expect(changes.hunger).toBe(-4) // -1 per tick
    expect(changes.energy).toBe(-2) // -0.5 per tick
    expect(changes.sobriety).toBeUndefined() // derived from the blend, never decayed here
  })

  it('8 hours (32 ticks) — a whole night — produces correct values', () => {
    const player = createPlayer('Test')
    player.status.hunger = 80
    player.status.energy = 100

    const changes = getStatDecayEffects(player, 32)

    expect(changes.hunger).toBe(-32)
    expect(changes.energy).toBe(-16)
  })

  it('hunger cannot go below 0 regardless of ticks', () => {
    const player = createPlayer('Test')
    player.status.hunger = 3

    const changes = getStatDecayEffects(player, 100)
    expect(player.status.hunger + changes.hunger).toBe(0)
  })

  it('energy cannot go below 0 regardless of ticks', () => {
    const player = createPlayer('Test')
    player.status.energy = 2

    const changes = getStatDecayEffects(player, 100)
    expect(player.status.energy + changes.energy).toBeGreaterThanOrEqual(0)
  })

  it('0 ticks returns empty object', () => {
    const player = createPlayer('Test')
    expect(getStatDecayEffects(player, 0)).toEqual({})
  })
})

// ---------------------------------------------------------------------------
// tickModifiers — expiry over N ticks
// ---------------------------------------------------------------------------

describe('tickModifiers — multi-tick expiry', () => {
  it('modifier expires after exactly its duration ticks', () => {
    const player = createPlayer('Test')
    addModifier(player, 'stamina', { source: 'coffee', value: 8, duration: 5 })

    for (let i = 0; i < 4; i++) {
      tickModifiers(player)
      expect(player.stats.stamina.modifiers).toHaveLength(1)
    }
    tickModifiers(player) // 5th tick — expires
    expect(player.stats.stamina.modifiers).toHaveLength(0)
  })

  it('effective stat returns to baseline after modifier expires', () => {
    const player = createPlayer('Test')
    player.stats.charm.base = 12
    addModifier(player, 'charm', { source: 'liquid_courage', value: 6, duration: 3 })

    expect(statEffective({ player, statName: 'charm' })).toBe(18)

    tickModifiers(player)
    tickModifiers(player)
    tickModifiers(player) // expired

    expect(statEffective({ player, statName: 'charm' })).toBe(12)
  })

  it('multiple modifiers with different durations expire independently', () => {
    const player = createPlayer('Test')
    addModifier(player, 'wits', { source: 'coffee', value: 3, duration: 2 })
    addModifier(player, 'wits', { source: 'sugar', value: 2, duration: 4 })

    tickModifiers(player)
    tickModifiers(player) // coffee expires
    expect(player.stats.wits.modifiers).toHaveLength(1)
    expect(player.stats.wits.modifiers[0].source).toBe('sugar')

    tickModifiers(player)
    tickModifiers(player) // sugar expires
    expect(player.stats.wits.modifiers).toHaveLength(0)
  })

  it('permanent modifiers (null duration) never expire across many ticks', () => {
    const player = createPlayer('Test')
    addModifier(player, 'karma', { source: 'bad_vibes', value: -5, duration: null })

    for (let i = 0; i < 100; i++) {
      tickModifiers(player)
    }

    expect(player.stats.karma.modifiers).toHaveLength(1)
    expect(statEffective({ player, statName: 'karma' })).toBe(player.stats.karma.base - 5)
  })
})
