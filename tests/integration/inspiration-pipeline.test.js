/**
 * Integration: the inspiration clock at the boundary.
 *
 * Events, actions, substances, and voice catalogs come from content/. The
 * world strikes through the game loop, the clock runs through the game loop,
 * and the assertions are on what the rest of the game reads: the player's
 * inspiration log, the sidebar label, the action gate, and the prose.
 *
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { resolve } from 'path'
import { createPinia, setActivePinia } from 'pinia'
import { useGameStore } from '../../src/stores/game.js'
import { createPlayer } from '../../src/models/player.js'
import { createLocation } from '../../src/models/location.js'
import { useNarrative } from '../../src/composables/useNarrative.js'
import { useGameLoop } from '../../src/composables/useGameLoop.js'
import { meetsRequirements } from '../../src/engine/actions.js'
import { INSPIRATION_STATUSES } from '../../src/engine/inspiration.js'

const loadDir = (dir) =>
  readdirSync(resolve(dir))
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(resolve(dir, f), 'utf-8')))
const loadFile = (path) => JSON.parse(readFileSync(resolve(path), 'utf-8'))

const substances = loadDir('content/substances')
const conditions = loadDir('content/conditions')
const mediums = loadDir('content/mediums')
const voices = loadDir('content/voices')
const momsHouse = loadFile('content/maps/kenton/locations/moms_house.json')
const momsHouseActions = loadFile('content/maps/kenton/actions/moms_house.json')
const streetEvents = loadFile('content/maps/kenton/events/street.json')

const eventById = (id) => streetEvents.find((e) => e.id === id)
const actionById = (id) => momsHouseActions.find((a) => a.id === id)
/** Force an event to fire on the next tick, whatever its own conditions say. */
const forced = (id) => ({ ...eventById(id), type: 'triggered', conditions: {}, oneTime: false })
const voice = (personaId, code) => voices.find((v) => v.id === personaId).lines[code]

function startGame() {
  setActivePinia(createPinia())
  const game = useGameStore()
  for (const substance of substances) game.registerSubstance({ substance })
  for (const condition of conditions) game.registerCondition({ condition })
  for (const medium of mediums) game.registerMedium({ medium })
  for (const v of voices) game.registerVoice({ voice: v })
  game.registerLocation(createLocation(momsHouse))
  game.startNewGame(createPlayer('Tester'), 'moms_house')
  return game
}

async function settle(narrative) {
  await vi.advanceTimersByTimeAsync(60000)
  return narrative.log.value.map((entry) => entry.tokens.map((t) => t.rendered).join(''))
}

const statuses = (game) => game.player.inspirations.map((r) => r.status)

describe('inspiration pipeline', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('a new player has no muse, and the sidebar says so in words', () => {
    const game = startGame()
    expect(game.player.inspirations).toEqual([])
    expect(game.inspirationActive).toBeNull()
    expect(game.inspirationLabel).toBe(voice('sober', 'inspiration.status.none'))
  })

  it('an event from content strikes: the record, the snapshot, the label, and the line', async () => {
    const game = startGame()
    const narrative = useNarrative()
    const loop = useGameLoop({ eventRegistry: [forced('rock_bottom_echo')], narrative })

    await loop.tick(1)
    const entries = await settle(narrative)

    const active = game.inspirationActive
    expect(active).toMatchObject({
      status: INSPIRATION_STATUSES.ACTIVE,
      sourceKind: 'event',
      sourceId: 'rock_bottom_echo',
      mediumId: 'painting',
      strength: 60,
      ticksTotal: 12,
      ticksRemaining: 12,
      struckAtLocationId: 'moms_house',
      dominantPersonaId: 'sober',
    })
    expect(game.inspirationLabel).toBe(voice('sober', 'inspiration.status.fresh'))
    expect(entries.at(-1)).toBe(voice('sober', 'inspiration.struck'))
    expect(entries.join(' ')).toContain('piece of wood')
  })

  it('whoever you are when it strikes owns the idea, and speaks the line', async () => {
    const game = startGame()
    const narrative = useNarrative()
    const loop = useGameLoop({ eventRegistry: [forced('rock_bottom_echo')], narrative })
    game.applyDoses({ doses: [{ substanceId: 'whiskey', value: 90 }] })

    await loop.tick(1)
    const entries = await settle(narrative)

    expect(game.inspirationActive.dominantPersonaId).toBe('priest')
    expect(game.inspirationActive.personaSnapshot.weights[0].personaId).toBe('priest')
    expect(entries.at(-1)).toBe(voice('priest', 'inspiration.struck'))
    expect(game.inspirationLabel).toBe(voice('priest', 'inspiration.status.fresh'))
  })

  it('the clock runs down through the loop, fades, and expires with a line', async () => {
    const game = startGame()
    const narrative = useNarrative()
    const loop = useGameLoop({ narrative })
    game.applyInspirationStrike({
      source: { kind: 'event', id: 'test' },
      mediumId: 'drawing',
      strength: 40,
      ticksTotal: 8,
    })

    await loop.tick(5)
    expect(game.inspirationActive.ticksRemaining).toBe(3)
    expect(game.inspirationLabel).toBe(voice('sober', 'inspiration.status.fading'))

    await loop.tick(3)
    const entries = await settle(narrative)

    expect(game.inspirationActive).toBeNull()
    expect(statuses(game)).toEqual([INSPIRATION_STATUSES.EXPIRED])
    expect(entries.at(-1)).toBe(voice('sober', 'inspiration.expired'))
    expect(game.inspirationLabel).toBe(voice('sober', 'inspiration.status.none'))
  })

  it('the world barging in kills it: an event with no inspiration of its own interrupts', async () => {
    const game = startGame()
    const narrative = useNarrative()
    const loop = useGameLoop({ eventRegistry: [forced('found_change')], narrative })
    game.applyInspirationStrike({
      source: { kind: 'event', id: 'test' },
      mediumId: 'painting',
      strength: 50,
      ticksTotal: 20,
    })

    await loop.tick(1)
    const entries = await settle(narrative)

    expect(game.inspirationActive).toBeNull()
    expect(game.player.inspirations[0]).toMatchObject({
      status: INSPIRATION_STATUSES.INTERRUPTED,
      endedBy: { kind: 'event', id: 'found_change' },
    })
    expect(entries).toContain(voice('sober', 'inspiration.interrupted'))
  })

  it('distraction is inspiration with worse timing: a new strike replaces the old', async () => {
    const game = startGame()
    const narrative = useNarrative()
    const loop = useGameLoop({ eventRegistry: [forced('rain')], narrative })
    game.applyInspirationStrike({
      source: { kind: 'event', id: 'rock_bottom_echo' },
      mediumId: 'painting',
      strength: 60,
      ticksTotal: 20,
    })

    await loop.tick(1)
    const entries = await settle(narrative)

    expect(statuses(game)).toEqual([INSPIRATION_STATUSES.REPLACED, INSPIRATION_STATUSES.ACTIVE])
    expect(game.player.inspirations[0].endedBy).toEqual({ kind: 'event', id: 'rain' })
    expect(game.inspirationActive.mediumId).toBe('writing')
    expect(entries).not.toContain(voice('sober', 'inspiration.interrupted'))
    expect(entries.slice(-2)).toEqual([
      voice('sober', 'inspiration.replaced'),
      voice('sober', 'inspiration.struck'),
    ])
  })

  it('sleeping on it loses it', async () => {
    const game = startGame()
    const narrative = useNarrative()
    const loop = useGameLoop({ actionRegistry: momsHouseActions, narrative })
    await loop.tick(52) // 8:00 → 21:00, when sleep becomes possible
    game.applyInspirationStrike({
      source: { kind: 'event', id: 'test' },
      mediumId: 'painting',
      strength: 50,
      ticksTotal: 40,
    })

    await loop.resolvePlayerAction(actionById('sleep'))
    const entries = await settle(narrative)

    expect(game.player.inspirations[0]).toMatchObject({
      status: INSPIRATION_STATUSES.INTERRUPTED,
      endedBy: { kind: 'action', id: 'sleep' },
    })
    expect(entries).toContain(voice('sober', 'inspiration.interrupted'))
    expect(entries).not.toContain(voice('sober', 'inspiration.expired'))
  })

  it('an ordinary action does not interrupt, and the idea survives the walk home', async () => {
    const game = startGame()
    const loop = useGameLoop({ actionRegistry: momsHouseActions })
    game.applyInspirationStrike({
      source: { kind: 'event', id: 'test' },
      mediumId: 'painting',
      strength: 50,
      ticksTotal: 20,
    })

    await loop.resolvePlayerAction(actionById('raid_fridge'))
    await loop.travel('moms_house', 2)

    expect(game.inspirationActive).not.toBeNull()
    expect(game.inspirationActive.ticksRemaining).toBe(17)
  })

  it('an action can demand a muse: the gate opens on a strike and closes when it dies', async () => {
    const game = startGame()
    const loop = useGameLoop()
    const make = { id: 'make_something', requirements: { requiresInspiration: true } }

    expect(meetsRequirements(game.player, make, game.time).meets).toBe(false)
    game.applyInspirationStrike({
      source: { kind: 'event', id: 'test' },
      mediumId: 'painting',
      strength: 50,
      ticksTotal: 2,
    })
    expect(meetsRequirements(game.player, make, game.time).meets).toBe(true)

    await loop.tick(2)
    expect(meetsRequirements(game.player, make, game.time).meets).toBe(false)
  })

  it('spending it closes the record against what it made, and spending nothing is refused', () => {
    const game = startGame()
    const cold = game.applyInspirationSpend({ spentOn: { kind: 'piece', id: 'p1' } })
    expect(cold.ok).toBe(false)
    expect(cold.error.code).toBe('NONE_ACTIVE')

    game.applyInspirationStrike({
      source: { kind: 'event', id: 'test' },
      strength: 50,
      ticksTotal: 5,
    })
    const spent = game.applyInspirationSpend({ spentOn: { kind: 'piece', id: 'p1' } })
    expect(spent.ok).toBe(true)
    expect(game.player.inspirations[0]).toMatchObject({
      status: INSPIRATION_STATUSES.SPENT,
      endedBy: { kind: 'piece', id: 'p1' },
    })
  })

  it('a bad strike is refused with a code and the log is untouched', () => {
    const game = startGame()
    const result = game.applyInspirationStrike({
      source: { kind: 'event', id: 'test' },
      strength: 500,
      ticksTotal: 5,
    })
    expect(result.ok).toBe(false)
    expect(result.error.code).toBe('STRENGTH_INVALID')
    expect(game.player.inspirations).toEqual([])
  })
})
