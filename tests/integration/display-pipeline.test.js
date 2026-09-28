/**
 * Integration: the world's verdict. A piece goes up in front of strangers
 * once; the world's words replace the artist's; legend lands; what the
 * reception does to the player lands like any outcome; friends are not the
 * world; a wall in a bar shows itself the moment it goes up. Driven
 * through the real loop, store and content.
 *
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useGameStore } from '../../src/stores/game.js'
import { playerCreate } from '../../src/models/player.js'
import { locationCreate } from '../../src/models/location.js'
import { itemCreate } from '../../src/models/item.js'
import { useNarrative } from '../../src/composables/useNarrative.js'
import { useGameLoop } from '../../src/composables/useGameLoop.js'
import { ARTIFACT_KINDS, ARTIFACT_STATUSES, MAKING_TIERS } from '../../src/engine/making.js'
import { RECEPTIONS } from '../../src/engine/display.js'
import { contentDir, contentFile, tuningContent } from '../helpers/content.js'
import { narrativeSettle } from '../helpers/narrative.js'
import { rngForNatural, rngSequence } from '../helpers/rng.js'
import { textFill } from '../../src/utils/text.js'

const tuning = tuningContent()
const vocabulary = contentFile({ path: 'content/vocabulary.json' })
const locations = contentDir({ dir: 'content/maps/kenton/locations' })
const actions = contentDir({ dir: 'content/maps/kenton/actions' }).flat()
const voices = contentDir({ dir: 'content/voices' })
const items = contentDir({ dir: 'content/items' }).flat()
const mediums = contentDir({ dir: 'content/mediums' })
const games = contentDir({ dir: 'content/games' })
const marks = contentDir({ dir: 'content/marks' })
const tables = contentDir({ dir: 'content/psyche' })
const sober = (code) => voices.find((v) => v.id === 'sober').lines[code]
const PASS = rngForNatural({ natural: 20 })
const FAIL = rngForNatural({ natural: 1 })

function startGame({ at = 'mocks_crest', values = [PASS] } = {}) {
  setActivePinia(createPinia())
  const game = useGameStore()
  game.tuningRegister({ tuning })
  game.vocabularyRegister({ vocabulary })
  for (const location of locations) game.locationRegister({ location: locationCreate(location) })
  for (const voice of voices) game.voiceRegister({ voice })
  for (const item of items) game.itemRegister({ item: itemCreate(item) })
  for (const medium of mediums) game.mediumRegister({ medium })
  for (const minigame of games) game.minigameRegister({ minigame })
  for (const substance of contentDir({ dir: 'content/substances' })) {
    game.substanceRegister({ substance })
  }
  for (const condition of contentDir({ dir: 'content/conditions' })) {
    game.conditionRegister({ condition })
  }
  for (const mark of marks) game.markRegister({ mark })
  for (const table of tables) game.psycheTableRegister({ table })
  game.runStart({ player: playerCreate({ name: 'Tester' }), locationId: at })
  game.locationLearnApply({ locationId: at })
  const narrative = useNarrative({ tuning })
  const loop = useGameLoop({
    actionRegistry: actions,
    narrative,
    rng: rngSequence({ values, repeatLast: true }),
    simulation: {
      tick: ({ characters }) => ({
        characters: characters.map((c) => ({ id: c.id, locationId: c.currentLocationId })),
      }),
    },
  })
  loop.onLocationEntered()
  return { game, narrative, loop }
}

/** A piece the player carries, made earlier, as the making engine leaves it. */
function carried({ game, tier = MAKING_TIERS.solid, id = 'piece1' }) {
  const artifact = {
    id,
    status: ARTIFACT_STATUSES.unshown,
    kind: ARTIFACT_KINDS.portable,
    experienceId: `exp_${id}`,
    makingId: 'm',
    mediumId: 'painting',
    toolItemId: null,
    surfaceKind: 'item',
    surfaceId: 'cabinet_door',
    ingredientItemId: null,
    tier,
    madeAtLocationId: 'moms_house',
    workText: 'a painting on a cabinet door',
    artistText: 'Done: a painting on a cabinet door. It is exactly the thing you saw.',
    reception: null,
    legend: 0,
    ideaText: null,
    shownAtTick: null,
    shownAtLocationId: null,
    endedBy: null,
    createdAtTick: 0,
    updatedAtTick: 0,
  }
  game.player.portfolio.push(artifact)
  game.player.experiences.push({
    id: `exp_${id}`,
    status: 'remembered',
    kind: 'making',
    mediumId: 'painting',
    tier,
    locationId: 'moms_house',
    artifactId: id,
    workText: artifact.workText,
    artistText: artifact.artistText,
    createdAtTick: 0,
    updatedAtTick: 0,
  })
  game.player.stats.reputation.base = 30
  return artifact
}

const entry = ({ game, id }) => game.availableActions.find((a) => a.id === id)
const mocks = locations.find((l) => l.id === 'mocks_crest')

describe('the door', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('with nothing to show, the door is greyed and says so; with a piece, it opens onto the piece', async () => {
    const { game, loop } = startGame()
    expect(entry({ game, id: 'show_something' })).toMatchObject({
      available: false,
      unavailableReason: sober('requirement.display.none'),
    })
    const piece = carried({ game })
    loop.onLocationEntered()
    await loop.resolvePlayerAction(entry({ game, id: 'show_something' }))
    expect(game.displayPicker).toEqual({ actionId: 'show_something' })
    expect(entry({ game, id: `display_piece_${piece.id}` }).label).toBe(piece.workText)
    expect(entry({ game, id: 'display_cancel' }).label).toBe(sober('menu.display.cancel'))
  })

  it("friends are not the world: at mom's the door is greyed", () => {
    const { game, loop } = startGame({ at: 'moms_house' })
    carried({ game })
    loop.onLocationEntered()
    expect(entry({ game, id: 'show_something' })).toMatchObject({
      available: false,
      unavailableReason: sober('requirement.display.venue'),
    })
  })
})

describe('a wall in front of the world', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  /** Pick the menu entry whose label contains the text, the way a click would. */
  async function pick({ text, game, loop }) {
    const found = game.availableActions.find((a) => a.label.includes(text))
    expect(found, `no menu entry containing '${text}'`).toBeTruthy()
    await loop.resolvePlayerAction(found)
  }

  it('shows itself the moment it goes up: the verdict is written at the finish, once', async () => {
    const { game, narrative, loop } = startGame({ at: 'lombard_dental', values: [PASS] })
    game.player.stats.reputation.base = 30
    game.player.inventory.push({ ...game.itemGet({ itemId: 'sharpie' }) })
    game.inspirationStrikeApply({
      source: { kind: 'event', id: 'test' },
      mediumId: 'tagging',
      strength: 60,
      ticksTotal: 12,
    })
    loop.onLocationEntered()
    await pick({ text: 'Make something', game, loop })
    await pick({ text: 'Tagging: Sharpie, the back wall', game, loop })
    await pick({ text: 'Keep going', game, loop })
    await pick({ text: "That's enough", game, loop })
    const entries = await narrativeSettle({ narrative })

    const wall = game.locations.lombard_dental.marks[0]
    expect(wall).toMatchObject({ kind: ARTIFACT_KINDS.fixed, status: ARTIFACT_STATUSES.fresh })
    expect(wall.reception).toBe(RECEPTIONS.praised)
    expect(wall.legend).toBe(tuning.display.legend.praised)
    expect(wall.ideaText).toBeTruthy()
    expect(entries).toContain(wall.artistText)
    expect(entries.filter((line) => line === wall.artistText)).toHaveLength(1)
  })
})

describe('a performance, judged live', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  async function pick({ text, game, loop }) {
    const found = game.availableActions.find((a) => a.label.includes(text))
    expect(found, `no menu entry containing '${text}'`).toBeTruthy()
    await loop.resolvePlayerAction(found)
  }

  it('leaves nothing but the doing, and the doing gets its verdict at the finish, from the room', async () => {
    const { game, narrative, loop } = startGame({ at: 'blue_parrot', values: [PASS] })
    game.player.stats.reputation.base = 30
    game.inspirationStrikeApply({
      source: { kind: 'event', id: 'test' },
      mediumId: 'performance',
      strength: 60,
      ticksTotal: 6,
    })
    loop.onLocationEntered()
    await pick({ text: 'Make something', game, loop })
    await pick({ text: 'Performance: the corner by the jukebox', game, loop })
    await pick({ text: 'Bow', game, loop })
    const entries = await narrativeSettle({ narrative })

    const lived = game.player.experiences[0]
    expect(game.player.portfolio).toHaveLength(0)
    expect(lived.reception).toBe(RECEPTIONS.praised)
    expect(lived.legend).toBe(tuning.display.legend.praised)
    const verdict = textFill({
      text: sober(`verdict.live.${RECEPTIONS.praised}.${lived.tier}`),
      params: {
        work: lived.workText,
        place: locations.find((l) => l.id === 'blue_parrot').displayInline,
      },
    })
    expect(lived.artistText).toBe(verdict)
    expect(entries).toContain(verdict)
  })
})

describe('the world acts on what was left in it', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('a shown piece with legend on a wall goes while you are away, and you find out when you look', async () => {
    // Every chance lands, so the first fate takes it: stolen. The park never closes.
    const { game, narrative, loop } = startGame({ at: 'columbia_park', values: [0] })
    const onWall = {
      ...carried({ game, id: 'wall1' }),
      kind: ARTIFACT_KINDS.fixed,
      status: ARTIFACT_STATUSES.fresh,
      reception: RECEPTIONS.praised,
      legend: 2,
      surfaceKind: 'location',
      surfaceId: 'under_the_firs',
    }
    game.player.portfolio = []
    game.player.experiences[0].locationId = 'columbia_park'
    const park = () => game.locations.columbia_park.marks[0]
    game.locations.columbia_park.marks = [onWall]
    await loop.travel({ locationId: 'moms_house' })
    await loop.tick({ ticks: 1 })
    expect(park().status).toBe(ARTIFACT_STATUSES.stolen)
    expect(park().noticedAtTick).toBeNull()

    await loop.travel({ locationId: 'columbia_park' })
    const entries = await narrativeSettle({ narrative })
    expect(entries).toContain(
      textFill({ text: sober('mark.stolen'), params: { work: onWall.workText } })
    )
    expect(park().noticedAtTick).not.toBeNull()
    expect(game.playerWorks[0].whereabouts).toBe(sober('work.whereabouts.stolen'))
  })
})

describe('the verdict', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  async function show({ game, loop, piece }) {
    await loop.resolvePlayerAction(entry({ game, id: 'show_something' }))
    await loop.resolvePlayerAction(entry({ game, id: `display_piece_${piece.id}` }))
  }

  it("praised: the world's words replace the artist's, the idea survives as story, legend lands, and the reception's outcome too", async () => {
    const { game, narrative, loop } = startGame()
    const piece = carried({ game })
    loop.onLocationEntered()
    await narrativeSettle({ narrative })
    const before = {
      mood: game.player.status.mood,
      reputation: game.player.stats.reputation.base,
      tick: game.time.tick,
    }

    await show({ game, loop, piece })
    const entries = await narrativeSettle({ narrative })

    const shown = game.player.portfolio[0]
    const verdict = textFill({
      text: sober(`verdict.${RECEPTIONS.praised}.${MAKING_TIERS.solid}`),
      params: { work: piece.workText, place: mocks.displayInline },
    })
    expect(shown).toMatchObject({
      status: ARTIFACT_STATUSES.shown,
      reception: RECEPTIONS.praised,
      legend: tuning.display.legend.praised,
      ideaText: piece.artistText,
      artistText: verdict,
      shownAtLocationId: 'mocks_crest',
    })
    expect(entries).toContain(verdict)
    expect(game.player.status.mood).toBeGreaterThan(before.mood)
    expect(game.player.stats.reputation.base).toBe(
      before.reputation + tuning.display.receptions.praised.outcome.statChanges.reputation
    )
    expect(game.time.tick).toBe(before.tick + tuning.display.ticks)
    // The work panel reads it as the world did now.
    expect(game.playerWorks[0].artistText).toBe(verdict)
    expect(game.playerWorks[0].whereabouts).toBe(sober('work.whereabouts.carried.shown'))
    // Once: the door is greyed again.
    expect(entry({ game, id: 'show_something' }).available).toBe(false)
  })

  it('mocked in front of strangers: the toll, and a save, about the place', async () => {
    const { game, loop } = startGame({ values: [FAIL] })
    const piece = carried({ game })
    loop.onLocationEntered()
    const moodBefore = game.player.status.mood

    await show({ game, loop, piece })

    expect(game.player.portfolio[0].reception).toBe(RECEPTIONS.mocked)
    expect(game.player.status.mood).toBeLessThan(moodBefore)
    expect(game.player.psyche.marks).toEqual([
      expect.objectContaining({
        target: { kind: 'location', id: 'mocks_crest' },
        source: { kind: 'display', id: piece.id },
      }),
    ])
  })
})
