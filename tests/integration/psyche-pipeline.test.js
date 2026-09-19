/**
 * Integration: what stays with you. Something bad happens, the player
 * saves, and a failed save leaves a mark about what did it. Marks refuse
 * (a place you can't go back to, somebody you can't face), pull (up the
 * menu), and go off (a fit shoves a persona into the blend). Time in charge
 * wears a groove. NPCs carry the same marks. Driven through the real loop,
 * store and content.
 *
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useGameStore } from '../../src/stores/game.js'
import { playerCreate } from '../../src/models/player.js'
import { locationCreate } from '../../src/models/location.js'
import { characterCreate } from '../../src/models/character.js'
import { useNarrative } from '../../src/composables/useNarrative.js'
import { useGameLoop } from '../../src/composables/useGameLoop.js'
import { contentDir, tuningContent } from '../helpers/content.js'
import { narrativeSettle } from '../helpers/narrative.js'
import { rngForNatural, rngSequence } from '../helpers/rng.js'

const tuning = tuningContent()
const locations = contentDir({ dir: 'content/maps/kenton/locations' })
const actions = contentDir({ dir: 'content/maps/kenton/actions' }).flat()
const events = contentDir({ dir: 'content/maps/kenton/events' }).flat()
const voices = contentDir({ dir: 'content/voices' })
const marks = contentDir({ dir: 'content/marks' })
const tables = contentDir({ dir: 'content/psyche' })
const topics = contentDir({ dir: 'content/topics' })
const characters = contentDir({ dir: 'content/characters' })
const sober = (code) => voices.find((v) => v.id === 'sober').lines[code]
const markOf = (id) => marks.find((m) => m.id === id)
const FAIL = rngForNatural({ natural: 1 })
const PASS = rngForNatural({ natural: 20 })

// Nobody wanders off mid-test; a test that wants somebody somewhere says so.
const stillWorld = {
  tick: ({ characters: here }) => ({
    characters: here.map((c) => ({ id: c.id, locationId: c.currentLocationId })),
  }),
}

function startGame({
  at = 'columbia_park',
  values = [0.99],
  simulation = stillWorld,
  actionRegistry = actions,
} = {}) {
  setActivePinia(createPinia())
  const game = useGameStore()
  game.tuningRegister({ tuning })
  for (const location of locations) game.locationRegister({ location: locationCreate(location) })
  for (const voice of voices) game.voiceRegister({ voice })
  for (const substance of contentDir({ dir: 'content/substances' })) {
    game.substanceRegister({ substance })
  }
  for (const condition of contentDir({ dir: 'content/conditions' })) {
    game.conditionRegister({ condition })
  }
  for (const mark of marks) game.markRegister({ mark })
  for (const table of tables) game.psycheTableRegister({ table })
  for (const topic of topics) game.topicRegister({ topic })
  game.runStart({ player: playerCreate({ name: 'Tester' }), locationId: at })
  const narrative = useNarrative({ tuning })
  const loop = useGameLoop({
    actionRegistry,
    narrative,
    rng: rngSequence({ values, repeatLast: true }),
    simulation,
  })
  return { game, narrative, loop }
}

/** A mark the player already carries. */
function marked({ game, markId, target = null }) {
  game.player.psyche.marks.push({
    id: `${markId}:${target?.id ?? 'none'}`,
    markId,
    target,
    source: { kind: 'test', id: 'test' },
    status: 'active',
    fitTicksRemaining: 0,
    acquiredAtTick: 0,
    updatedAtTick: 0,
  })
  game.blendRefresh()
}

const place = (id) => ({ kind: 'location', id })

describe('something bad happens', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())
  const copStop = events.find((e) => e.id === 'cop_hassle')
  const walkFaster = copStop.choices.findIndex((c) => c.label.startsWith('Walk faster'))

  it('a failed save leaves a mark about where it happened, and says so', async () => {
    // The walk fails, the save fails, and the first pick on the trauma table is a scar.
    const { game, narrative, loop } = startGame({ values: [FAIL, FAIL, 0] })
    game.eventActiveSet({ event: copStop })
    loop.resolveEventChoice({ choiceIndex: walkFaster })
    const entries = await narrativeSettle({ narrative })

    expect(game.player.psyche.marks).toEqual([
      expect.objectContaining({
        markId: 'scar',
        target: place('columbia_park'),
        source: { kind: 'event', id: 'cop_hassle' },
        status: 'active',
      }),
    ])
    // The park is not known yet: the scar is about how it looks.
    const park = locations.find((l) => l.id === 'columbia_park')
    expect(entries).toContain(
      sober(markOf('scar').lineCode).replaceAll('{target}', park.appearance.displayInline)
    )
  })

  it('a save that holds leaves nothing, and says it let go', async () => {
    const { game, narrative, loop } = startGame({ values: [FAIL, PASS] })
    game.eventActiveSet({ event: copStop })
    loop.resolveEventChoice({ choiceIndex: walkFaster })
    const entries = await narrativeSettle({ narrative })
    expect(game.player.psyche.marks).toEqual([])
    expect(entries).toContain(sober('psyche.save.passed'))
  })

  it('the save trains the stat it was made on, held or not', () => {
    const { game, loop } = startGame({ values: [FAIL, PASS] })
    const before = game.player.stats.toughness.xp
    game.eventActiveSet({ event: copStop })
    loop.resolveEventChoice({ choiceIndex: walkFaster })
    expect(game.player.stats.toughness.xp).toBe(before + tuning.stats.xpCheckSuccess)
  })

  it('what happens while dealing with somebody is about them', async () => {
    const hurt = {
      id: 'get_told_off',
      label: 'Get told off',
      locationId: 'any',
      characterId: 'dale',
      timeCost: 1,
      requirements: {},
      check: null,
      success: {
        narrative: 'Dale tells you something true.',
        trauma: { save: { stat: 'toughness', dc: 30 }, tableId: 'trauma' },
      },
    }
    const { game, loop } = startGame({
      at: 'mocks_crest',
      values: [FAIL, 0],
      actionRegistry: [hurt],
    })
    game.characterRegister({ character: characterCreate(characters.find((c) => c.id === 'dale')) })
    game.characterLocationSet({ characterId: 'dale', locationId: 'mocks_crest' })
    await loop.resolvePlayerAction(hurt)
    expect(game.player.psyche.marks[0].target).toEqual({ kind: 'character', id: 'dale' })
  })
})

describe('a mark refuses', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it("a place the player can't go back to: the way is there, and greyed, and won't be taken", async () => {
    const { game, narrative, loop } = startGame({ at: 'moms_house' })
    marked({ game, markId: 'phobia', target: place('columbia_park') })
    loop.onLocationEntered()
    const exit = game.availableExits.find((e) => e.locationId === 'columbia_park')
    const park = locations.find((l) => l.id === 'columbia_park')
    const reason = sober('requirement.avoid').replaceAll('{target}', park.appearance.displayInline)
    expect(exit.available).toBe(false)
    expect(exit.unavailableReason).toBe(reason)

    await loop.travel({ locationId: 'columbia_park' })
    expect(game.currentLocationId).toBe('moms_house')
    expect(await narrativeSettle({ narrative })).toContain(reason)
  })

  it("somebody the player can't face is there, and greyed out", () => {
    const { game, loop } = startGame({ at: 'mocks_crest' })
    game.locationLearnApply({ locationId: 'mocks_crest' })
    game.characterRegister({
      character: characterCreate(characters.find((c) => c.id === 'dennis')),
    })
    game.characterLocationSet({ characterId: 'dennis', locationId: 'mocks_crest' })
    marked({ game, markId: 'phobia', target: { kind: 'character', id: 'dennis' } })
    loop.onLocationEntered()
    const talk = game.availableActions.find((a) => a.id === 'talk_to_dennis')
    expect(talk.available).toBe(false)
    expect(talk.unavailableReason).toBe(sober('requirement.avoid').replaceAll('{target}', 'Dennis'))
  })
})

describe('a mark goes off', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('near what it is about, a fit starts, says so, and lurches the blend for a while', async () => {
    const scar = markOf('scar')
    // Every chance lands.
    const { game, narrative, loop } = startGame({ values: [0] })
    marked({ game, markId: 'scar', target: place('columbia_park') })
    loop.onLocationEntered()
    await narrativeSettle({ narrative })

    await loop.tick({ ticks: 1 })
    const entries = await narrativeSettle({ narrative })
    const park = locations.find((l) => l.id === 'columbia_park')
    expect(entries).toContain(
      sober(scar.fit.lineCode).replaceAll('{target}', park.appearance.displayInline)
    )
    const personas = () => game.player.blend.weights.map((w) => w.personaId)
    expect(personas()).toContain(scar.fit.persona.id)
    expect(game.player.status.confusion).toBeGreaterThanOrEqual(scar.fit.confusion)

    await loop.travel({ locationId: 'moms_house' })
    await loop.tick({ ticks: scar.fit.ticks })
    expect(personas()).not.toContain(scar.fit.persona.id)
  })

  it('somewhere else, nothing goes off', async () => {
    const { game, loop } = startGame({ at: 'moms_house', values: [0] })
    marked({ game, markId: 'scar', target: place('columbia_park') })
    await loop.tick({ ticks: 1 })
    expect(game.player.psyche.marks[0].fitTicksRemaining).toBe(0)
  })

  it('what the talk around the player is about can set it off, and the fit takes over', async () => {
    const love = markOf('obsession_love')
    const { game, loop } = startGame({ at: 'mocks_crest', values: [0] })
    game.locationLearnApply({ locationId: 'mocks_crest' })
    game.characterRegister({
      character: characterCreate(characters.find((c) => c.id === 'dennis')),
    })
    game.characterLocationSet({ characterId: 'dennis', locationId: 'mocks_crest' })
    marked({ game, markId: 'obsession_love', target: { kind: 'topic', id: 'classic_rock' } })
    loop.onLocationEntered()
    await loop.tick({ ticks: 1 })
    expect(game.player.blend.dominantPersonaId).toBe(love.fit.persona.id)
  })
})

describe('time in charge wears a groove', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('long enough under one persona is a save, and a failed one is a mark about what put it in charge', async () => {
    // The save fails; the first pick on offer for a substance is an obsession, and the first of those is love.
    const { game, narrative, loop } = startGame({ at: 'moms_house', values: [FAIL, 0] })
    game.playerDosesApply({ doses: [{ substanceId: 'beer', value: 70 }] })
    const personaId = game.player.blend.dominantPersonaId
    expect(personaId).not.toBe('sober')
    game.player.psyche.grooves[personaId] = tuning.psyche.groove.ticksInCharge - 1

    await loop.tick({ ticks: 1 })
    expect(game.player.psyche.marks).toEqual([
      expect.objectContaining({
        markId: 'obsession_love',
        target: { kind: 'substance', id: 'beer' },
        source: { kind: 'persona', id: personaId },
      }),
    ])
    expect(game.player.psyche.grooves[personaId]).toBe(0)
    expect(await narrativeSettle({ narrative })).toContain(
      sober(markOf('obsession_love').lineCode).replaceAll('{target}', 'Beer')
    )
  })

  it('a groove that holds says nothing: nobody saw it coming', async () => {
    const { game, narrative, loop } = startGame({ at: 'moms_house', values: [PASS] })
    game.playerDosesApply({ doses: [{ substanceId: 'beer', value: 70 }] })
    const personaId = game.player.blend.dominantPersonaId
    game.player.psyche.grooves[personaId] = tuning.psyche.groove.ticksInCharge - 1
    await loop.tick({ ticks: 1 })
    expect(game.player.psyche.marks).toEqual([])
    expect(await narrativeSettle({ narrative })).not.toContain(sober('psyche.save.passed'))
  })
})

describe('NPCs carry the same marks', () => {
  const dennis = characters.find((c) => c.id === 'dennis')

  it("Dennis's past is marks about real things", () => {
    const created = characterCreate(dennis)
    expect(created.psyche.marks.map((m) => [m.markId, m.target])).toEqual(
      dennis.psyche.marks.map((m) => [m.markId, m.target])
    )
    expect(created.psyche.marks.every((m) => m.status === 'active')).toBe(true)
  })

  it("somebody who can't go back to a place never turns up there", async () => {
    const sendTo = (locationId) => ({
      tick: ({ characters: here }) => ({
        characters: here.map((c) => ({ id: c.id, locationId })),
      }),
    })
    const toParrot = startGame({ simulation: sendTo('blue_parrot') })
    toParrot.game.characterRegister({ character: characterCreate(dennis) })
    await toParrot.loop.tick({ ticks: 1 })
    expect(toParrot.game.characters.dennis.currentLocationId).toBeNull()

    const toMocks = startGame({ simulation: sendTo('mocks_crest') })
    toMocks.game.characterRegister({ character: characterCreate(dennis) })
    await toMocks.loop.tick({ ticks: 1 })
    expect(toMocks.game.characters.dennis.currentLocationId).toBe('mocks_crest')
  })

  it("an NPC's standing marks bend their blend like the player's", () => {
    const { game } = startGame()
    const maurice = characters.find((c) => c.id === 'maurice')
    game.characterRegister({ character: characterCreate(maurice) })
    const withMark = characterCreate({
      ...maurice,
      id: 'marked_maurice',
      psyche: { marks: [{ markId: 'the_committee', target: null }], abilities: [] },
    })
    game.characterRegister({ character: withMark })
    game.blendRefresh()
    const committee = markOf('the_committee')
    expect(game.characters.marked_maurice.blend.confusion).toBe(
      game.characters.maurice.blend.confusion + committee.confusion
    )
  })
})
