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

import { createPinia, setActivePinia } from 'pinia'
import { useGameStore } from '../../src/stores/game.js'
import { playerCreate } from '../../src/models/player.js'
import { locationCreate } from '../../src/models/location.js'
import { useNarrative } from '../../src/composables/useNarrative.js'
import { useGameLoop } from '../../src/composables/useGameLoop.js'
import { requirementsMeet } from '../../src/engine/actions.js'
import { INSPIRATION_STATUSES } from '../../src/engine/inspiration.js'
import { contentDir, contentFile, tuningContent, voiceLineOf } from '../helpers/content.js'
import { narrativeSettle } from '../helpers/narrative.js'

const tuning = tuningContent()

const substances = contentDir({ dir: 'content/substances' })
const conditions = contentDir({ dir: 'content/conditions' })
const mediums = contentDir({ dir: 'content/mediums' })
const voices = contentDir({ dir: 'content/voices' })
const momsHouse = contentFile({ path: 'content/maps/kenton/locations/moms_house.json' })
const columbiaPark = contentFile({ path: 'content/maps/kenton/locations/columbia_park.json' })
const momsHouseActions = contentFile({ path: 'content/maps/kenton/actions/moms_house.json' })
const streetEvents = contentFile({ path: 'content/maps/kenton/events/street.json' })

const eventById = (id) => streetEvents.find((e) => e.id === id)
const actionById = (id) => momsHouseActions.find((a) => a.id === id)
/** Force an event to fire on the next tick, whatever its own conditions say. */
const forced = (id) => ({ ...eventById(id), type: 'triggered', conditions: {}, oneTime: false })

function startGame() {
  setActivePinia(createPinia())
  const game = useGameStore()
  game.tuningRegister({ tuning })
  for (const substance of substances) game.substanceRegister({ substance })
  for (const condition of conditions) game.conditionRegister({ condition })
  for (const medium of mediums) game.mediumRegister({ medium })
  for (const v of voices) game.voiceRegister({ voice: v })
  game.locationRegister({ location: locationCreate(momsHouse) })
  game.runStart({ player: playerCreate({ name: 'Tester' }), locationId: 'moms_house' })
  return game
}

const statuses = (game) => game.player.inspirations.map((r) => r.status)

describe('inspiration pipeline', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('a new player has no muse, and the sidebar says so in words', () => {
    const game = startGame()
    expect(game.player.inspirations).toEqual([])
    expect(game.inspirationActive).toBeNull()
    expect(game.inspirationLabel).toBe(
      voiceLineOf({ personaId: 'sober', code: 'inspiration.status.none' })
    )
  })

  it('an event from content strikes: the record, the snapshot, the label, and the line', async () => {
    const game = startGame()
    const narrative = useNarrative({ tuning })
    const loop = useGameLoop({ eventRegistry: [forced('rock_bottom_echo')], narrative })

    await loop.tick({ ticks: 1 })
    const entries = await narrativeSettle({ narrative })

    const active = game.inspirationActive
    expect(active).toMatchObject({
      status: INSPIRATION_STATUSES.active,
      sourceKind: 'event',
      sourceId: 'rock_bottom_echo',
      mediumId: 'painting',
      strength: 60,
      ticksTotal: 12,
      ticksRemaining: 12,
      struckAtLocationId: 'moms_house',
      dominantPersonaId: 'sober',
    })
    expect(game.inspirationLabel).toBe(
      voiceLineOf({ personaId: 'sober', code: 'inspiration.status.fresh' })
    )
    expect(entries.at(-1)).toBe(voiceLineOf({ personaId: 'sober', code: 'inspiration.struck' }))
    expect(entries.join(' ')).toContain('piece of wood')
  })

  it('whoever you are when it strikes owns the idea, and speaks the line', async () => {
    const game = startGame()
    const narrative = useNarrative({ tuning })
    const loop = useGameLoop({ eventRegistry: [forced('rock_bottom_echo')], narrative })
    game.playerDosesApply({ doses: [{ substanceId: 'whiskey', value: 90 }] })

    await loop.tick({ ticks: 1 })
    const entries = await narrativeSettle({ narrative })

    expect(game.inspirationActive.dominantPersonaId).toBe('priest')
    expect(game.inspirationActive.personaSnapshot.weights[0].personaId).toBe('priest')
    expect(entries.at(-1)).toBe(voiceLineOf({ personaId: 'priest', code: 'inspiration.struck' }))
    expect(game.inspirationLabel).toBe(
      voiceLineOf({ personaId: 'priest', code: 'inspiration.status.fresh' })
    )
  })

  it('the clock runs down through the loop, fades, and expires with a line', async () => {
    const game = startGame()
    const narrative = useNarrative({ tuning })
    const loop = useGameLoop({ narrative })
    game.inspirationStrikeApply({
      source: { kind: 'event', id: 'test' },
      mediumId: 'drawing',
      strength: 40,
      ticksTotal: 8,
    })

    await loop.tick({ ticks: 5 })
    expect(game.inspirationActive.ticksRemaining).toBe(3)
    expect(game.inspirationLabel).toBe(
      voiceLineOf({ personaId: 'sober', code: 'inspiration.status.fading' })
    )

    await loop.tick({ ticks: 3 })
    const entries = await narrativeSettle({ narrative })

    expect(game.inspirationActive).toBeNull()
    expect(statuses(game)).toEqual([INSPIRATION_STATUSES.expired])
    expect(entries.at(-1)).toBe(voiceLineOf({ personaId: 'sober', code: 'inspiration.expired' }))
    expect(game.inspirationLabel).toBe(
      voiceLineOf({ personaId: 'sober', code: 'inspiration.status.none' })
    )
  })

  it('the world barging in kills it: an event with no inspiration of its own interrupts', async () => {
    const game = startGame()
    const narrative = useNarrative({ tuning })
    const loop = useGameLoop({ eventRegistry: [forced('found_change')], narrative })
    game.inspirationStrikeApply({
      source: { kind: 'event', id: 'test' },
      mediumId: 'painting',
      strength: 50,
      ticksTotal: 20,
    })

    await loop.tick({ ticks: 1 })
    const entries = await narrativeSettle({ narrative })

    expect(game.inspirationActive).toBeNull()
    expect(game.player.inspirations[0]).toMatchObject({
      status: INSPIRATION_STATUSES.interrupted,
      endedBy: { kind: 'event', id: 'found_change' },
    })
    expect(entries).toContain(voiceLineOf({ personaId: 'sober', code: 'inspiration.interrupted' }))
  })

  it('distraction is inspiration with worse timing: a new strike replaces the old', async () => {
    const game = startGame()
    const narrative = useNarrative({ tuning })
    const loop = useGameLoop({ eventRegistry: [forced('rain')], narrative })
    game.inspirationStrikeApply({
      source: { kind: 'event', id: 'rock_bottom_echo' },
      mediumId: 'painting',
      strength: 60,
      ticksTotal: 20,
    })

    await loop.tick({ ticks: 1 })
    const entries = await narrativeSettle({ narrative })

    expect(statuses(game)).toEqual([INSPIRATION_STATUSES.replaced, INSPIRATION_STATUSES.active])
    expect(game.player.inspirations[0].endedBy).toEqual({ kind: 'event', id: 'rain' })
    expect(game.inspirationActive.mediumId).toBe('writing')
    expect(entries).not.toContain(
      voiceLineOf({ personaId: 'sober', code: 'inspiration.interrupted' })
    )
    expect(entries.slice(-2)).toEqual([
      voiceLineOf({ personaId: 'sober', code: 'inspiration.replaced' }),
      voiceLineOf({ personaId: 'sober', code: 'inspiration.struck' }),
    ])
  })

  it('sleeping on it loses it', async () => {
    const game = startGame()
    const narrative = useNarrative({ tuning })
    const loop = useGameLoop({ actionRegistry: momsHouseActions, narrative })
    await loop.tick({ ticks: 52 }) // 8:00 → 21:00, when sleep becomes possible
    game.inspirationStrikeApply({
      source: { kind: 'event', id: 'test' },
      mediumId: 'painting',
      strength: 50,
      ticksTotal: 40,
    })

    await loop.resolvePlayerAction(actionById('sleep'))
    const entries = await narrativeSettle({ narrative })

    expect(game.player.inspirations[0]).toMatchObject({
      status: INSPIRATION_STATUSES.interrupted,
      endedBy: { kind: 'action', id: 'sleep' },
    })
    expect(entries).toContain(voiceLineOf({ personaId: 'sober', code: 'inspiration.interrupted' }))
    expect(entries).not.toContain(voiceLineOf({ personaId: 'sober', code: 'inspiration.expired' }))
  })

  it('an ordinary action does not interrupt, and the idea survives the walk to the park', async () => {
    const game = startGame()
    const loop = useGameLoop({ actionRegistry: momsHouseActions })
    game.inspirationStrikeApply({
      source: { kind: 'event', id: 'test' },
      mediumId: 'painting',
      strength: 50,
      ticksTotal: 20,
    })

    game.locationRegister({ location: locationCreate(columbiaPark) })
    await loop.resolvePlayerAction(actionById('raid_fridge'))
    await loop.travel({ locationId: 'columbia_park' })

    // One tick at the fridge, one on the walk: the exit says how long it takes.
    expect(game.inspirationActive).not.toBeNull()
    expect(game.inspirationActive.ticksRemaining).toBe(18)
  })

  it('an action can demand a muse: the gate opens on a strike and closes when it dies', async () => {
    const game = startGame()
    const loop = useGameLoop()
    const make = { id: 'make_something', requirements: { requiresInspiration: true } }

    expect(requirementsMeet({ player: game.player, action: make, gameTime: game.time }).meets).toBe(
      false
    )
    game.inspirationStrikeApply({
      source: { kind: 'event', id: 'test' },
      mediumId: 'painting',
      strength: 50,
      ticksTotal: 2,
    })
    expect(requirementsMeet({ player: game.player, action: make, gameTime: game.time }).meets).toBe(
      true
    )

    await loop.tick({ ticks: 2 })
    expect(requirementsMeet({ player: game.player, action: make, gameTime: game.time }).meets).toBe(
      false
    )
  })

  it('spending it closes the record against what it made, and spending nothing is refused', () => {
    const game = startGame()
    const cold = game.inspirationSpendApply({ spentOn: { kind: 'piece', id: 'p1' } })
    expect(cold.ok).toBe(false)
    expect(cold.error.code).toBe('NONE_ACTIVE')

    game.inspirationStrikeApply({
      source: { kind: 'event', id: 'test' },
      strength: 50,
      ticksTotal: 5,
    })
    const spent = game.inspirationSpendApply({ spentOn: { kind: 'piece', id: 'p1' } })
    expect(spent.ok).toBe(true)
    expect(game.player.inspirations[0]).toMatchObject({
      status: INSPIRATION_STATUSES.spent,
      endedBy: { kind: 'piece', id: 'p1' },
    })
  })

  it('a bad strike is refused with a code and the log is untouched', () => {
    const game = startGame()
    const result = game.inspirationStrikeApply({
      source: { kind: 'event', id: 'test' },
      strength: 500,
      ticksTotal: 5,
    })
    expect(result.ok).toBe(false)
    expect(result.error.code).toBe('STRENGTH_INVALID')
    expect(game.player.inspirations).toEqual([])
  })
})
