import { describe, it, expect } from 'vitest'
import {
  INSPIRATION_ERROR_CODES,
  INSPIRATION_STATUSES,
  inspirationActive,
  inspirationStrike,
  inspirationTick,
  inspirationInterrupt,
  inspirationSpend,
  inspirationUrge,
} from './inspiration.js'
import { blendSober } from './blend.js'

const at = (tick) => ({ tick })
const wood = { kind: 'event', id: 'rock_bottom_echo' }
const rain = { kind: 'event', id: 'rain' }

function makePlayer({ inspirations = [], blend = blendSober() } = {}) {
  return { inspirations, blend }
}

/** A player already carrying an active inspiration struck at tick 10. */
function inspiredPlayer(overrides = {}) {
  const player = makePlayer(overrides)
  const { data } = inspirationStrike({
    player,
    source: wood,
    mediumId: 'painting',
    strength: 60,
    ticksTotal: 8,
    gameTime: at(10),
    locationId: 'moms_house',
  })
  player.inspirations = data.inspirations
  return player
}

// --- inspirationActive ---

describe('inspirationActive', () => {
  it('is null for a player nothing has struck', () => {
    expect(inspirationActive({ player: makePlayer() })).toBeNull()
    expect(inspirationActive({ player: {} })).toBeNull()
  })

  it('returns a copy of the active record', () => {
    const player = inspiredPlayer()
    const active = inspirationActive({ player })
    expect(active.status).toBe(INSPIRATION_STATUSES.ACTIVE)
    active.strength = 0
    expect(player.inspirations[0].strength).toBe(60)
  })
})

// --- inspirationStrike ---

describe('inspirationStrike', () => {
  it('rejects a missing player', () => {
    const result = inspirationStrike({
      player: null,
      source: wood,
      strength: 50,
      ticksTotal: 4,
      gameTime: at(0),
    })
    expect(result.error.code).toBe(INSPIRATION_ERROR_CODES.PLAYER_MISSING)
  })

  it('rejects a source without a kind and an id', () => {
    for (const source of [null, {}, { kind: 'event' }, { kind: '', id: 'x' }]) {
      const result = inspirationStrike({
        player: makePlayer(),
        source,
        strength: 50,
        ticksTotal: 4,
        gameTime: at(0),
      })
      expect(result.error.code).toBe(INSPIRATION_ERROR_CODES.SOURCE_INVALID)
    }
  })

  it('rejects a strength outside 1–100', () => {
    for (const strength of [0, 101, NaN, undefined]) {
      const result = inspirationStrike({
        player: makePlayer(),
        source: wood,
        strength,
        ticksTotal: 4,
        gameTime: at(0),
      })
      expect(result.error.code).toBe(INSPIRATION_ERROR_CODES.STRENGTH_INVALID)
    }
  })

  it('rejects a clock that is not a whole tick or more', () => {
    for (const ticksTotal of [0, -1, 2.5, NaN, undefined]) {
      const result = inspirationStrike({
        player: makePlayer(),
        source: wood,
        strength: 50,
        ticksTotal,
        gameTime: at(0),
      })
      expect(result.error.code).toBe(INSPIRATION_ERROR_CODES.TICKS_INVALID)
    }
  })

  it('creates an active record that snapshots the blend at the moment it struck', () => {
    const blend = {
      ...blendSober(),
      weights: [{ personaId: 'priest', weight: 0.6, source: 'substance', sourceId: 'whiskey' }],
      soberWeight: 0.4,
      dominantPersonaId: 'priest',
    }
    const player = makePlayer({ blend })
    const { data } = inspirationStrike({
      player,
      source: wood,
      mediumId: 'painting',
      strength: 60,
      ticksTotal: 8,
      gameTime: at(10),
      locationId: 'moms_house',
    })
    expect(data.replaced).toBeNull()
    expect(data.struck).toMatchObject({
      status: INSPIRATION_STATUSES.ACTIVE,
      sourceKind: 'event',
      sourceId: 'rock_bottom_echo',
      mediumId: 'painting',
      strength: 60,
      ticksTotal: 8,
      ticksRemaining: 8,
      struckAtTick: 10,
      struckAtLocationId: 'moms_house',
      dominantPersonaId: 'priest',
      endedBy: null,
      updatedAtTick: 10,
    })
    expect(typeof data.struck.id).toBe('string')
    expect(data.struck.personaSnapshot).toEqual(blend)
    expect(data.inspirations).toHaveLength(1)
  })

  it("the snapshot is the idea's owner: sobering up later does not change it", () => {
    const player = inspiredPlayer({
      blend: { ...blendSober(), dominantPersonaId: 'telepath', soberWeight: 0.2 },
    })
    player.blend = blendSober()
    expect(inspirationActive({ player }).dominantPersonaId).toBe('telepath')
  })

  it('the snapshot is a copy: changing the live blend in place cannot rewrite the idea', () => {
    const blend = {
      ...blendSober(),
      weights: [{ personaId: 'priest', weight: 0.6, source: 'substance', sourceId: 'whiskey' }],
      soberWeight: 0.4,
      dominantPersonaId: 'priest',
    }
    const player = makePlayer({ blend })
    const { data } = inspirationStrike({
      player,
      source: wood,
      strength: 50,
      ticksTotal: 4,
      gameTime: at(0),
    })
    player.blend.weights[0].personaId = 'telepath'
    player.blend.weights.push({ personaId: 'yeller', weight: 0.1 })
    expect(data.struck.personaSnapshot.weights).toEqual([
      { personaId: 'priest', weight: 0.6, source: 'substance', sourceId: 'whiskey' },
    ])
  })

  it('a new strike replaces the active one and records what replaced it', () => {
    const player = inspiredPlayer()
    const { data } = inspirationStrike({
      player,
      source: rain,
      mediumId: 'writing',
      strength: 30,
      ticksTotal: 6,
      gameTime: at(14),
    })
    expect(data.replaced).toMatchObject({
      status: INSPIRATION_STATUSES.REPLACED,
      sourceId: 'rock_bottom_echo',
      endedBy: { kind: 'event', id: 'rain' },
      updatedAtTick: 14,
    })
    expect(data.inspirations.map((r) => r.status)).toEqual([
      INSPIRATION_STATUSES.REPLACED,
      INSPIRATION_STATUSES.ACTIVE,
    ])
  })

  it('a medium is optional — the world does not always say what it wants', () => {
    const { data } = inspirationStrike({
      player: makePlayer(),
      source: rain,
      strength: 20,
      ticksTotal: 4,
      gameTime: at(0),
    })
    expect(data.struck.mediumId).toBeNull()
  })

  it('does not mutate the player', () => {
    const player = inspiredPlayer()
    const before = JSON.stringify(player)
    inspirationStrike({ player, source: rain, strength: 20, ticksTotal: 4, gameTime: at(12) })
    expect(JSON.stringify(player)).toBe(before)
  })
})

// --- inspirationTick ---

describe('inspirationTick', () => {
  it('rejects a missing player and bad ticks', () => {
    expect(inspirationTick({ player: null, ticksElapsed: 1, gameTime: at(1) }).error.code).toBe(
      INSPIRATION_ERROR_CODES.PLAYER_MISSING
    )
    expect(
      inspirationTick({ player: makePlayer(), ticksElapsed: -1, gameTime: at(1) }).error.code
    ).toBe(INSPIRATION_ERROR_CODES.TICKS_INVALID)
  })

  it('runs the clock down without expiring', () => {
    const player = inspiredPlayer()
    const { data } = inspirationTick({ player, ticksElapsed: 3, gameTime: at(13) })
    expect(data.expired).toBeNull()
    expect(data.inspirations[0]).toMatchObject({
      ticksRemaining: 5,
      updatedAtTick: 13,
      status: 'active',
    })
  })

  it('expires at zero and blames the clock', () => {
    const player = inspiredPlayer()
    const { data } = inspirationTick({ player, ticksElapsed: 8, gameTime: at(18) })
    expect(data.expired).toMatchObject({
      status: INSPIRATION_STATUSES.EXPIRED,
      ticksRemaining: 0,
      endedBy: { kind: 'clock', id: 'clock' },
    })
  })

  it('never goes below zero on a long sleep', () => {
    const player = inspiredPlayer()
    const { data } = inspirationTick({ player, ticksElapsed: 40, gameTime: at(50) })
    expect(data.inspirations[0].ticksRemaining).toBe(0)
    expect(data.expired).not.toBeNull()
  })

  it('is a no-op with nothing active, and with zero ticks', () => {
    const idle = inspirationTick({ player: makePlayer(), ticksElapsed: 5, gameTime: at(5) })
    expect(idle.data).toEqual({ inspirations: [], expired: null })
    const player = inspiredPlayer()
    const still = inspirationTick({ player, ticksElapsed: 0, gameTime: at(10) })
    expect(still.data.inspirations[0].ticksRemaining).toBe(8)
  })

  it('leaves closed records alone', () => {
    const player = inspiredPlayer()
    player.inspirations = inspirationInterrupt({
      player,
      reason: rain,
      gameTime: at(11),
    }).data.inspirations
    const { data } = inspirationTick({ player, ticksElapsed: 8, gameTime: at(19) })
    expect(data.expired).toBeNull()
    expect(data.inspirations[0].status).toBe(INSPIRATION_STATUSES.INTERRUPTED)
    expect(data.inspirations[0].ticksRemaining).toBe(8)
  })
})

// --- inspirationInterrupt ---

describe('inspirationInterrupt', () => {
  it('rejects a missing player and a reason without kind and id', () => {
    expect(inspirationInterrupt({ player: null, reason: rain, gameTime: at(1) }).error.code).toBe(
      INSPIRATION_ERROR_CODES.PLAYER_MISSING
    )
    expect(
      inspirationInterrupt({ player: makePlayer(), reason: {}, gameTime: at(1) }).error.code
    ).toBe(INSPIRATION_ERROR_CODES.SOURCE_INVALID)
  })

  it('kills the active inspiration and names what did it', () => {
    const player = inspiredPlayer()
    const { data } = inspirationInterrupt({
      player,
      reason: { kind: 'action', id: 'sleep' },
      gameTime: at(12),
    })
    expect(data.interrupted).toMatchObject({
      status: INSPIRATION_STATUSES.INTERRUPTED,
      endedBy: { kind: 'action', id: 'sleep' },
      updatedAtTick: 12,
    })
    expect(inspirationActive({ player: { inspirations: data.inspirations } })).toBeNull()
  })

  it('interrupting nothing is fine — the world barges in constantly', () => {
    const { ok, data } = inspirationInterrupt({
      player: makePlayer(),
      reason: rain,
      gameTime: at(1),
    })
    expect(ok).toBe(true)
    expect(data.interrupted).toBeNull()
  })
})

// --- inspirationSpend ---

describe('inspirationSpend', () => {
  it('marks the active inspiration spent on what it made', () => {
    const player = inspiredPlayer()
    const { data } = inspirationSpend({
      player,
      spentOn: { kind: 'piece', id: 'p1' },
      gameTime: at(15),
    })
    expect(data.spent).toMatchObject({
      status: INSPIRATION_STATUSES.SPENT,
      endedBy: { kind: 'piece', id: 'p1' },
    })
  })

  it('spending nothing is an error', () => {
    const result = inspirationSpend({
      player: makePlayer(),
      spentOn: { kind: 'piece', id: 'p1' },
      gameTime: at(1),
    })
    expect(result.error.code).toBe(INSPIRATION_ERROR_CODES.NONE_ACTIVE)
  })

  it('rejects a bad spentOn', () => {
    const result = inspirationSpend({ player: inspiredPlayer(), spentOn: null, gameTime: at(1) })
    expect(result.error.code).toBe(INSPIRATION_ERROR_CODES.SOURCE_INVALID)
  })
})

describe('inspirationUrge', () => {
  const personas = {
    gangster: {
      urges: [{ mediumId: 'freestyle', chancePerTick: 0.1, strength: 40, ticksTotal: 8 }],
    },
    quiet: {},
  }
  const as = (personaId, inspirations = []) => ({
    blend: { dominantPersonaId: personaId, weights: [], soberWeight: 0 },
    inspirations,
  })

  it('lands for the persona in charge when the roll is under the odds, and names who it was', () => {
    const hit = inspirationUrge({
      player: as('gangster'),
      personas,
      ticksElapsed: 1,
      rng: () => 0.09,
    })
    expect(hit.data).toEqual({
      urge: { mediumId: 'freestyle', chancePerTick: 0.1, strength: 40, ticksTotal: 8 },
      personaId: 'gangster',
    })
    const miss = inspirationUrge({
      player: as('gangster'),
      personas,
      ticksElapsed: 1,
      rng: () => 0.1,
    })
    expect(miss.data.urge).toBeNull()
  })

  it('more time is more chances: a roll that misses one tick lands over four', () => {
    const roll = () => 0.3
    expect(
      inspirationUrge({ player: as('gangster'), personas, ticksElapsed: 1, rng: roll }).data.urge
    ).toBeNull()
    // 1 - 0.9^4 = 0.344
    expect(
      inspirationUrge({ player: as('gangster'), personas, ticksElapsed: 4, rng: roll }).data.urge
    ).not.toBeNull()
  })

  it('moves nobody who has no urges, nobody already moved, and nobody when no time passed', () => {
    const always = () => 0.0
    expect(
      inspirationUrge({ player: as('quiet'), personas, ticksElapsed: 4, rng: always }).data.urge
    ).toBeNull()
    expect(
      inspirationUrge({ player: as('stranger'), personas, ticksElapsed: 4, rng: always }).data.urge
    ).toBeNull()
    expect(
      inspirationUrge({ player: as('gangster'), personas, ticksElapsed: 0, rng: always }).data.urge
    ).toBeNull()
    const busy = as('gangster', [
      { id: 'i1', status: 'active', personaSnapshot: {}, endedBy: null },
    ])
    expect(
      inspirationUrge({ player: busy, personas, ticksElapsed: 4, rng: always }).data.urge
    ).toBeNull()
  })

  it('refuses a missing player and nonsense time', () => {
    expect(inspirationUrge({ player: null, personas, ticksElapsed: 1 }).error.code).toBe(
      'PLAYER_MISSING'
    )
    expect(inspirationUrge({ player: as('gangster'), personas, ticksElapsed: -1 }).error.code).toBe(
      'TICKS_INVALID'
    )
  })
})
