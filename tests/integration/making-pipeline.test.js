/**
 * Integration: making at the boundary.
 *
 * Mediums, items, locations and their surfaces, the make action, and the
 * voices all come from content/. Everything goes through the real game loop
 * by way of the menu the player would see, and the assertions are on what
 * the player ends up with: what is in the log, the inventory, the portfolio,
 * on the wall, and on the skill grid.
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
import { createItem } from '../../src/models/item.js'
import { useNarrative } from '../../src/composables/useNarrative.js'
import { useGameLoop } from '../../src/composables/useGameLoop.js'
import { useSave, saveMigrate, SAVE_VERSION } from '../../src/composables/useSave.js'

const loadDir = (dir) =>
  readdirSync(resolve(dir))
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(resolve(dir, f), 'utf-8')))

const items = loadDir('content/items').flat()
const voices = loadDir('content/voices')
const mediums = loadDir('content/mediums')
const substances = loadDir('content/substances')
const conditions = loadDir('content/conditions')
const locations = loadDir('content/maps/kenton/locations')
const actions = loadDir('content/maps/kenton/actions').flat()

const voice = (personaId, code) => voices.find((v) => v.id === personaId).lines[code]
const medium = (id) => mediums.find((m) => m.id === id)

/** An rng that cycles, so every die in a run is accounted for. */
function sequence(...values) {
  let i = 0
  return () => values[i++ % values.length]
}
const die = (face) => (face - 1) / 20

function startGame({
  at = 'moms_house',
  carrying = [],
  rng = sequence(die(15)),
  events = [],
} = {}) {
  setActivePinia(createPinia())
  const game = useGameStore()
  for (const item of items) game.registerItem(createItem(item))
  for (const v of voices) game.registerVoice({ voice: v })
  for (const m of mediums) game.registerMedium({ medium: m })
  for (const substance of substances) game.registerSubstance({ substance })
  for (const condition of conditions) game.registerCondition({ condition })
  for (const location of locations) game.registerLocation(createLocation(location))
  const player = createPlayer('Tester')
  for (const stat of Object.values(player.stats)) stat.base = 10
  game.startNewGame(player, at)
  for (const itemId of carrying) game.player.inventory.push({ ...game.getItem(itemId) })
  const narrative = useNarrative()
  const loop = useGameLoop({ actionRegistry: actions, eventRegistry: events, narrative, rng })
  loop.onLocationEntered()
  return { game, loop, narrative }
}

function strike(game, { mediumId = 'painting', strength = 60, ticksTotal = 12 } = {}) {
  return game.applyInspirationStrike({
    source: { kind: 'event', id: 'test_strike' },
    mediumId,
    strength,
    ticksTotal,
  })
}

/** Pick the menu entry whose label contains the text, the way a click would. */
async function pick({ game, loop }, text) {
  const entry = game.availableActions.find((a) => a.label.includes(text))
  expect(entry, `no menu entry containing '${text}' in: ${labels(game)}`).toBeTruthy()
  expect(entry.available, `'${entry.label}' is greyed out`).toBe(true)
  await loop.resolvePlayerAction(entry)
}
const labels = (game) => game.availableActions.map((a) => a.label).join(' | ')

async function logOf(narrative) {
  await vi.advanceTimersByTimeAsync(120000)
  return narrative.log.value.map((entry) => entry.tokens.map((t) => t.rendered).join('')).join('\n')
}

describe('making pipeline', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('cold, making is on the menu and greyed out: nothing is moving you', () => {
    const { game } = startGame({ carrying: ['grandmas_paints', 'cabinet_door'] })
    const make = game.availableActions.find((a) => a.id === 'make_something')
    expect(make.available).toBe(false)
  })

  it('inspired with nothing to work with, the idea has nowhere to go and says so', async () => {
    // Glitters offers only a sign to tag or write on, and the player has nothing to do either with.
    const ctx = startGame({ at: 'glitters' })
    strike(ctx.game)
    ctx.loop.onLocationEntered()
    const tickBefore = ctx.game.time.tick
    await pick(ctx, 'Make something')
    expect(await logOf(ctx.narrative)).toContain(voice('sober', 'making.nothing_to_work_with'))
    expect(ctx.game.makingPicker).toBeNull()
    expect(ctx.game.time.tick).toBe(tickBefore)
  })

  it('paints on a carried door: sittings pass time, the door goes into the piece, the piece goes in the portfolio', async () => {
    const ctx = startGame({ carrying: ['grandmas_paints', 'cabinet_door'] })
    const { game } = ctx
    strike(game)
    ctx.loop.onLocationEntered()
    const tickBefore = game.time.tick
    const energyBefore = game.player.status.energy

    await pick(ctx, 'Make something')
    // Taking stock costs no time, and the menu is now the making menu.
    expect(game.time.tick).toBe(tickBefore)
    expect(labels(game)).toContain("Painting: Grandma's Watercolours, Cabinet Door")
    expect(labels(game)).toContain('Never mind')

    await pick(ctx, 'Cabinet Door')
    // The first sitting happened. The door is committed; the paints are not.
    expect(game.playerInventory.map((i) => i.id)).toEqual(['grandmas_paints'])
    expect(game.makingActive.ticksDone).toBe(2)
    expect(labels(game)).toBe('Keep at it | Walk away from it')

    await pick(ctx, 'Keep at it')
    await pick(ctx, 'Keep at it')

    const total = medium('painting').making.ticksTotal
    expect(game.time.tick).toBe(tickBefore + total)
    // The work costs what the medium says per sitting, on top of what the hours cost anyway.
    const idle = startGame()
    await idle.loop.tick(total)
    const hoursAlone = energyBefore - idle.game.player.status.energy
    const sittings = 3
    expect(game.player.status.energy).toBe(
      energyBefore - hoursAlone + sittings * medium('painting').making.statusChanges.energy
    )
    expect(game.makingActive).toBeNull()
    expect(game.inspirationActive).toBeNull()
    expect(game.player.inspirations[0].status).toBe('spent')

    expect(game.player.portfolio).toHaveLength(1)
    const piece = game.player.portfolio[0]
    expect(piece.status).toBe('unshown')
    expect(piece.workText).toBe("a painting, your grandmother's watercolours on a cabinet door")
    expect(await logOf(ctx.narrative)).toContain(piece.artistText)
    expect(piece.artistText).toBe(
      voice('sober', 'piece.artist.solid').replace('{work}', piece.workText)
    )

    // Practice landed on the sober painter, and the ordinary menu is back.
    expect(game.player.skills.painting.sober.xp).toBeGreaterThan(0)
    expect(labels(game)).toContain('Make something')
    expect(game.playerWorks[0]).toMatchObject({
      workText: piece.workText,
      whereabouts: voice('sober', 'work.whereabouts.carried'),
    })
  })

  it('offers what is carried to work in, and the ingredient ends up in the piece and out of the pockets', async () => {
    const ctx = startGame({ carrying: ['golf_pencil', 'coaster', 'brut_aftershave'] })
    strike(ctx.game, { mediumId: 'drawing' })
    ctx.loop.onLocationEntered()
    await pick(ctx, 'Make something')
    await pick(ctx, 'Coaster')
    expect(labels(ctx.game)).toContain('Just that')
    await pick(ctx, 'Work in the')
    expect(ctx.game.playerInventory.map((i) => i.id)).toEqual(['golf_pencil'])
    expect(ctx.game.player.portfolio[0].workText).toBe(
      'a drawing, golf pencil and Brut on the back of a beer coaster'
    )
  })

  it('a tag on a wall stays on the wall, greets you when you come back, and is covered by the next one', async () => {
    const ctx = startGame({ at: 'lombard_dental', carrying: ['sharpie'] })
    const { game } = ctx
    strike(game, { mediumId: 'tagging' })
    ctx.loop.onLocationEntered()
    await pick(ctx, 'Make something')
    await pick(ctx, 'Tagging: Sharpie, the back wall')

    expect(game.player.portfolio).toHaveLength(0)
    const wall = () => game.locations.lombard_dental.marks
    expect(wall()).toHaveLength(1)
    expect(wall()[0]).toMatchObject({ status: 'fresh', kind: 'fixed', surfaceId: 'back_wall' })
    // The Sharpie is a tool. It survives.
    expect(game.playerInventory.map((i) => i.id)).toEqual(['sharpie'])

    ctx.loop.onLocationEntered()
    const still = voice('sober', 'mark.still_here').replace('{work}', wall()[0].workText)
    expect(await logOf(ctx.narrative)).toContain(still)

    strike(game, { mediumId: 'tagging' })
    ctx.loop.onLocationEntered()
    await pick(ctx, 'Make something')
    await pick(ctx, 'Tagging: Sharpie, the back wall')
    expect(wall().map((m) => m.status)).toEqual(['covered', 'fresh'])
    expect(wall()[0].endedBy).toEqual({ kind: 'mark', id: wall()[1].id })
    expect(await logOf(ctx.narrative)).toContain(voice('sober', 'making.covered'))
    expect(game.playerWorks.map((w) => w.whereabouts)).toEqual([
      voice('sober', 'work.whereabouts.fresh').replace('{place}', 'Lombard Dental'),
      voice('sober', 'work.whereabouts.covered').replace('{place}', 'Lombard Dental'),
    ])
  })

  it('a performance needs no tool and leaves nothing but the doing', async () => {
    const ctx = startGame({ at: 'blue_parrot' })
    strike(ctx.game, { mediumId: 'performance', ticksTotal: 6 })
    ctx.loop.onLocationEntered()
    await pick(ctx, 'Make something')
    await pick(ctx, 'Performance: the corner by the jukebox')
    expect(ctx.game.player.portfolio).toHaveLength(0)
    expect(ctx.game.locations.blue_parrot.marks).toHaveLength(0)
    expect(ctx.game.player.experiences).toHaveLength(1)
    expect(ctx.game.playerWorks[0].whereabouts).toBe(voice('sober', 'work.whereabouts.none'))
    expect(ctx.game.player.skills.performance.sober.xp).toBeGreaterThan(0)
  })

  it('a natural 1 ruins it: the door is gone, there is no piece, and the artist knows', async () => {
    const ctx = startGame({ carrying: ['golf_pencil', 'pizza_box'], rng: sequence(die(1)) })
    strike(ctx.game, { mediumId: 'drawing' })
    ctx.loop.onLocationEntered()
    await pick(ctx, 'Make something')
    await pick(ctx, 'Pizza Box')
    expect(ctx.game.player.portfolio).toHaveLength(0)
    expect(ctx.game.playerInventory.map((i) => i.id)).toEqual(['golf_pencil'])
    expect(ctx.game.player.experiences[0].tier).toBe('botched')
    const work = 'a drawing, golf pencil on the lid of a pizza box'
    expect(await logOf(ctx.narrative)).toContain(
      voice('sober', 'piece.artist.botched').replace('{work}', work)
    )
  })

  it('whoever is holding the brush signs the piece: stoned, a rough one is genius', async () => {
    const ctx = startGame({ carrying: ['golf_pencil', 'coaster'], rng: sequence(die(3)) })
    const { game } = ctx
    game.applyDoses({ doses: [{ substanceId: 'weed', value: 80 }] })
    expect(game.personaInCharge).toBe('telepath')
    strike(game, { mediumId: 'drawing' })
    ctx.loop.onLocationEntered()
    await pick(ctx, 'Make something')
    await pick(ctx, 'Coaster')
    const piece = game.player.portfolio[0]
    expect(piece.tier).toBe('rough')
    expect(piece.artistText).toBe(
      voice('telepath', 'piece.artist.rough').replace('{work}', piece.workText)
    )
    expect(game.player.experiences[0].dominantPersonaId).toBe('telepath')
    // The telepath did the practising, so the telepath did most of the learning.
    const row = game.player.skills.drawing
    expect(row.telepath.xp).toBeGreaterThan(row.sober?.xp ?? 0)
  })

  it('a plan the idea will not outlast is greyed out', async () => {
    const ctx = startGame({
      carrying: ['grandmas_paints', 'cabinet_door', 'golf_pencil', 'coaster'],
    })
    strike(ctx.game, { ticksTotal: medium('painting').making.ticksTotal })
    ctx.loop.onLocationEntered()
    await pick(ctx, 'Make something')
    const entry = (text) => ctx.game.availableActions.find((a) => a.label.includes(text))
    expect(entry('Cabinet Door').available).toBe(false)
    expect(entry('Cabinet Door').unavailableReason).toBeTruthy()
    expect(entry('Coaster').available).toBe(true)
  })

  it('the world barging in kills the idea, and the work dies with it: the door is lost for nothing', async () => {
    const barge = {
      id: 'test_barge',
      type: 'random',
      title: 'Dave',
      conditions: {},
      probability: 1,
      oneTime: true,
      narrative: {
        tokens: [{ text: 'Dave arrives.', style: 'normal', speed: 'normal', pauseAfter: 0 }],
      },
      choices: [],
      outcome: { statusChanges: { mood: -1 } },
    }
    const ctx = startGame({ carrying: ['grandmas_paints', 'cabinet_door'], events: [barge] })
    const { game } = ctx
    strike(game)
    ctx.loop.onLocationEntered()
    await pick(ctx, 'Make something')
    await pick(ctx, 'Cabinet Door')

    expect(game.firedEventIds).toContain('test_barge')
    expect(game.makingActive).toBeNull()
    const making = game.player.makings[0]
    expect(making.status).toBe('abandoned')
    expect(making.endedBy).toEqual({ kind: 'event', id: 'test_barge' })
    expect(game.player.portfolio).toHaveLength(0)
    expect(game.playerInventory.map((i) => i.id)).toEqual(['grandmas_paints'])
    expect(await logOf(ctx.narrative)).toContain(voice('sober', 'making.abandoned.lost'))
    expect(labels(game)).not.toContain('Keep at it')
  })

  it('you cannot leave in the middle of it, but you can walk away from it', async () => {
    const ctx = startGame({ carrying: ['grandmas_paints', 'cabinet_door'] })
    const { game } = ctx
    strike(game)
    ctx.loop.onLocationEntered()
    await pick(ctx, 'Make something')
    await pick(ctx, 'Cabinet Door')

    await ctx.loop.travel('blue_parrot', 1)
    expect(game.currentLocationId).toBe('moms_house')

    await pick(ctx, 'Walk away')
    expect(game.player.makings[0]).toMatchObject({
      status: 'abandoned',
      endedBy: { kind: 'player', id: 'walked_away' },
    })
    // The idea is still there. The door is not.
    expect(game.inspirationActive).not.toBeNull()
    expect(await logOf(ctx.narrative)).toContain(voice('sober', 'making.abandoned.walked_away'))
    await ctx.loop.travel('blue_parrot', 1)
    expect(game.currentLocationId).toBe('blue_parrot')
  })

  it('never mind closes the menu and costs nothing', async () => {
    const ctx = startGame({ carrying: ['grandmas_paints', 'cabinet_door'] })
    strike(ctx.game)
    ctx.loop.onLocationEntered()
    const tickBefore = ctx.game.time.tick
    await pick(ctx, 'Make something')
    await pick(ctx, 'Never mind')
    expect(ctx.game.makingPicker).toBeNull()
    expect(ctx.game.time.tick).toBe(tickBefore)
    expect(ctx.game.playerInventory).toHaveLength(2)
    expect(labels(ctx.game)).toContain('Make something')
  })

  it('work in progress, the portfolio, and the wall all survive a save and a load', async () => {
    const storage = new Map()
    vi.stubGlobal('localStorage', {
      getItem: (k) => storage.get(k) ?? null,
      setItem: (k, v) => storage.set(k, v),
      removeItem: (k) => storage.delete(k),
    })
    const ctx = startGame({
      at: 'lombard_dental',
      carrying: ['sharpie', 'grandmas_paints', 'cabinet_door'],
    })
    strike(ctx.game, { mediumId: 'tagging' })
    ctx.loop.onLocationEntered()
    await pick(ctx, 'Make something')
    await pick(ctx, 'Tagging: Sharpie, the back wall')
    strike(ctx.game)
    ctx.loop.onLocationEntered()
    await pick(ctx, 'Make something')
    await pick(ctx, 'Cabinet Door')
    const id = useSave().save('mid-painting')

    setActivePinia(createPinia())
    const restored = useGameStore()
    for (const item of items) restored.registerItem(createItem(item))
    for (const v of voices) restored.registerVoice({ voice: v })
    for (const m of mediums) restored.registerMedium({ medium: m })
    restored.loadSave(useSave().load(id))
    restored.locationsRestore({ definitions: Object.fromEntries(locations.map((l) => [l.id, l])) })

    expect(restored.locations.lombard_dental.marks).toHaveLength(1)
    expect(restored.makingActive).toMatchObject({ mediumId: 'painting', ticksDone: 2 })
    const loop = useGameLoop({ actionRegistry: actions, eventRegistry: [], rng: sequence(die(15)) })
    loop.onLocationEntered()
    const again = { game: restored, loop }
    await pick(again, 'Keep at it')
    await pick(again, 'Keep at it')
    expect(restored.player.portfolio).toHaveLength(1)
    vi.unstubAllGlobals()
  })

  it('a save from before making loads into a world that has walls to work on', () => {
    const old = {
      id: 'old',
      name: 'old',
      timestamp: 1,
      version: 4,
      player: {
        ...createPlayer('Old'),
        makings: undefined,
        experiences: undefined,
        portfolio: undefined,
      },
      time: { tick: 0, hour: 8, day: 1 },
      // A v4 location: frozen at save time, knowing nothing about surfaces or marks.
      locations: {
        lombard_dental: {
          id: 'lombard_dental',
          display: 'Lombard Dental',
          visitCount: 7,
          discovered: true,
        },
      },
      characters: {},
      firedEventIds: [],
      counters: {},
    }
    const migrated = saveMigrate({ save: old })
    expect(migrated.version).toBe(SAVE_VERSION)
    expect(migrated.player).toMatchObject({ makings: [], experiences: [], portfolio: [] })
    expect(migrated.locations.lombard_dental.marks).toEqual([])

    setActivePinia(createPinia())
    const game = useGameStore()
    game.loadSave(migrated)
    game.locationsRestore({ definitions: Object.fromEntries(locations.map((l) => [l.id, l])) })
    const dental = game.locations.lombard_dental
    // What happened there is remembered; what the place is comes from today's content.
    expect(dental.visitCount).toBe(7)
    expect(dental.discovered).toBe(true)
    expect(dental.surfaces.map((s) => s.id)).toContain('back_wall')
    expect(dental.scavengeTableId).toBe('lot')
    expect(Object.keys(game.locations)).toHaveLength(locations.length)
  })
})
