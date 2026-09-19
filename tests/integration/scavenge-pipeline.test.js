/**
 * Integration: scavenging at the boundary.
 *
 * Items, loot tables, locations, the scavenge action, and the voices all come
 * from content/. Looking around goes through the real game loop, and the
 * assertions are on what the player ends up carrying, what the log says, how
 * the spot wears down, and what a find can set off.
 *
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { resolve } from 'path'
import { createPinia, setActivePinia } from 'pinia'
import { useGameStore } from '../../src/stores/game.js'
import { playerCreate } from '../../src/models/player.js'
import { useNarrative } from '../../src/composables/useNarrative.js'
import { useGameLoop } from '../../src/composables/useGameLoop.js'
import { actionsAvailable } from '../../src/engine/actions.js'
import { SCAVENGE_TICKS_PER_RESTOCK, scavengeDepletion } from '../../src/engine/scavenge.js'

const loadDir = (dir) =>
  readdirSync(resolve(dir))
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(resolve(dir, f), 'utf-8')))
const loadFile = (path) => JSON.parse(readFileSync(resolve(path), 'utf-8'))

const items = loadDir('content/items').flat()
const tables = loadDir('content/scavenge')
const voices = loadDir('content/voices')
const mediums = loadDir('content/mediums')
const substances = loadDir('content/substances')
const locations = loadDir('content/maps/kenton/locations')
const scavengeAction = loadFile('content/maps/kenton/actions/scavenge.json')[0]
const momsHouseEvents = loadFile('content/maps/kenton/events/moms_house.json')

const voice = (personaId, code) => voices.find((v) => v.id === personaId).lines[code]
const itemById = (id) => items.find((i) => i.id === id)

function startGame({ at = 'moms_house' } = {}) {
  setActivePinia(createPinia())
  const game = useGameStore()
  for (const item of items) game.registerItem(item)
  for (const table of tables) game.registerScavengeTable({ table })
  for (const v of voices) game.registerVoice({ voice: v })
  for (const medium of mediums) game.registerMedium({ medium })
  for (const substance of substances) game.registerSubstance({ substance })
  // Registered the way the title screen does it: the raw content object.
  for (const location of locations) game.registerLocation({ ...location })
  const player = playerCreate({ name: 'Tester' })
  player.stats.luck.base = 15
  player.stats.wits.base = 15
  game.startNewGame(player, at)
  return game
}

/**
 * An rng that cycles through the given values. A search rolls the die and
 * then draws, so (die, draw) repeats cleanly across actions.
 */
function sequence(...values) {
  let i = 0
  return () => values[i++ % values.length]
}
const HIGH_DIE = 0.7
const LOW_DIE = 0.05
const MAX_DIE = 0.9999

async function settle(narrative) {
  await vi.advanceTimersByTimeAsync(60000)
  return narrative.log.value.map((entry) => entry.tokens.map((t) => t.rendered).join(''))
}

describe('scavenge pipeline', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('every Kenton location names a table that exists, so looking around is on every menu', () => {
    const game = startGame()
    for (const location of locations) {
      expect(game.scavengeTables[location.scavengeTableId], location.id).toBeTruthy()
      const menu = actionsAvailable({
        player: game.player,
        location,
        characters: [],
        gameTime: game.time,
        actionRegistry: [scavengeAction],
      })
      expect(
        menu.map((a) => a.id),
        location.id
      ).toEqual(['scavenge'])
    }
  })

  it('a place with nothing to find does not offer the action', () => {
    const game = startGame()
    const sealed = { ...locations[0], scavengeTableId: null }
    expect(
      actionsAvailable({
        player: game.player,
        location: sealed,
        characters: [],
        gameTime: game.time,
        actionRegistry: [scavengeAction],
      })
    ).toEqual([])
  })

  it('the first thing in the basement is the wood, and the wood is an idea', async () => {
    const game = startGame()
    const narrative = useNarrative()
    const loop = useGameLoop({
      actionRegistry: [scavengeAction],
      narrative,
      rng: sequence(HIGH_DIE, 0.0),
    })

    await loop.resolvePlayerAction(scavengeAction)
    const entries = await settle(narrative)

    expect(game.playerInventory.map((i) => i.id)).toEqual(['nice_piece_of_wood'])
    expect(game.player.counters.scavenged_nice_piece_of_wood).toBe(1)
    expect(game.player.counters.times_scavenged).toBe(1)
    expect(entries[0]).toContain('shop windows')
    expect(entries[1]).toBe(
      voice('sober', 'scavenge.found').replace('{item}', itemById('nice_piece_of_wood').foundAs)
    )
    expect(entries[2]).toBe(voice('sober', 'inspiration.struck'))
    expect(game.inspirationActive).toMatchObject({
      sourceKind: 'item',
      sourceId: 'nice_piece_of_wood',
      mediumId: 'painting',
    })
    expect(game.time.tick).toBe(2)
  })

  it('the wood is found once; the basement keeps giving, but not that', async () => {
    const game = startGame()
    const loop = useGameLoop({ actionRegistry: [scavengeAction], rng: sequence(HIGH_DIE, 0.0) })

    await loop.resolvePlayerAction(scavengeAction)
    await loop.resolvePlayerAction(scavengeAction)

    const carried = game.playerInventory.map((i) => i.id)
    expect(carried.filter((id) => id === 'nice_piece_of_wood')).toHaveLength(1)
    expect(carried).toHaveLength(2)
  })

  it('coming up empty says so, and costs the time anyway', async () => {
    const game = startGame({ at: 'toads_express' })
    const narrative = useNarrative()
    const loop = useGameLoop({
      actionRegistry: [scavengeAction],
      narrative,
      rng: sequence(LOW_DIE),
    })

    await loop.resolvePlayerAction(scavengeAction)
    const entries = await settle(narrative)

    expect(game.playerInventory).toEqual([])
    expect(entries.at(-1)).toBe(voice('sober', 'scavenge.nothing'))
    expect(game.time.tick).toBe(2)
  })

  it('the persona in charge says what was found', async () => {
    const game = startGame({ at: 'toads_express' })
    const narrative = useNarrative()
    const loop = useGameLoop({
      actionRegistry: [scavengeAction],
      narrative,
      rng: sequence(HIGH_DIE, 0.0),
    })
    game.applyDoses({ doses: [{ substanceId: 'weed', value: 90 }] })

    await loop.resolvePlayerAction(scavengeAction)
    const entries = await settle(narrative)

    expect(entries.at(-1)).toBe(
      voice('telepath', 'scavenge.found').replace('{item}', itemById('cardboard').foundAs)
    )
  })

  it('stackable junk stacks', async () => {
    const game = startGame({ at: 'toads_express' })
    game.player.stats.luck.base = 100
    const loop = useGameLoop({ actionRegistry: [scavengeAction], rng: sequence(HIGH_DIE, 0.0) })

    await loop.resolvePlayerAction(scavengeAction)
    await loop.resolvePlayerAction(scavengeAction)

    expect(game.playerInventory).toEqual([
      expect.objectContaining({ id: 'cardboard', quantity: 2 }),
    ])
  })

  it('a critical find at the lot is one of the rare things', async () => {
    const game = startGame({ at: 'toads_express' })
    const loop = useGameLoop({ actionRegistry: [scavengeAction], rng: sequence(MAX_DIE, 0.0) })

    await loop.resolvePlayerAction(scavengeAction)

    const lot = tables.find((t) => t.id === 'lot')
    const rareIds = lot.entries.filter((e) => e.rare).map((e) => e.itemId)
    expect(rareIds).toContain(game.playerInventory[0].id)
  })

  it('a spot gets picked over, the check pays for it, and the city restocks it', async () => {
    const game = startGame({ at: 'toads_express' })
    game.player.stats.luck.base = 100
    const narrative = useNarrative()
    const find = useGameLoop({ actionRegistry: [scavengeAction], rng: sequence(HIGH_DIE, 0.0) })
    for (let n = 0; n < 4; n++) await find.resolvePlayerAction(scavengeAction)

    const location = game.currentLocation
    expect(location.scavenge.depletion).toBe(4)

    game.player.stats.luck.base = 1
    const miss = useGameLoop({
      actionRegistry: [scavengeAction],
      narrative,
      rng: sequence(LOW_DIE),
    })
    await miss.resolvePlayerAction(scavengeAction)
    const entries = await settle(narrative)
    expect(entries.at(-1)).toBe(voice('sober', 'scavenge.picked_clean'))

    const later = { tick: game.time.tick + SCAVENGE_TICKS_PER_RESTOCK * 4 }
    expect(scavengeDepletion({ location, gameTime: later })).toBe(0)
  })

  it("Mom's note puts Grandma's paints in your hands", async () => {
    const game = startGame()
    const note = { ...momsHouseEvents.find((e) => e.id === 'moms_note'), conditions: {} }
    const loop = useGameLoop({ eventRegistry: [note] })

    await loop.tick(1)

    expect(game.playerInventory.map((i) => i.id)).toEqual(['grandmas_paints'])
  })

  it('a location nobody taught about tables is refused with a code', () => {
    const game = startGame()
    game.currentLocation.scavengeTableId = 'moon'
    const result = game.applyScavenge()
    expect(result.ok).toBe(false)
    expect(result.error.code).toBe('TABLE_UNKNOWN')
    expect(game.playerInventory).toEqual([])
  })
})
