/**
 * Integration: art is community. Other artists make and perform; the
 * world judges them; the player sees it and may find something to chase;
 * the player's own piece, seen by another artist, may make a fan or a
 * rival. Driven through the real loop, store and content.
 *
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useGameStore } from '../../src/stores/game.js'
import { playerCreate } from '../../src/models/player.js'
import { locationCreate } from '../../src/models/location.js'
import { characterCreate } from '../../src/models/character.js'
import { itemCreate } from '../../src/models/item.js'
import { useNarrative } from '../../src/composables/useNarrative.js'
import { useGameLoop } from '../../src/composables/useGameLoop.js'
import { ARTIFACT_KINDS, ARTIFACT_STATUSES, MAKING_TIERS } from '../../src/engine/making.js'
import { MARK_TARGET_KINDS } from '../../src/engine/psyche.js'
import { contentDir, contentFile, tuningContent } from '../helpers/content.js'
import { narrativeSettle } from '../helpers/narrative.js'
import { rngForNatural } from '../helpers/rng.js'
import { textFill } from '../../src/utils/text.js'

const tuning = tuningContent()
const vocabulary = contentFile({ path: 'content/vocabulary.json' })
const locations = contentDir({ dir: 'content/maps/kenton/locations' })
const actions = contentDir({ dir: 'content/maps/kenton/actions' }).flat()
const voices = contentDir({ dir: 'content/voices' })
const items = contentDir({ dir: 'content/items' }).flat()
const mediums = contentDir({ dir: 'content/mediums' })
const marks = contentDir({ dir: 'content/marks' })
const tables = contentDir({ dir: 'content/psyche' })
const characters = contentDir({ dir: 'content/characters' })
const acts = contentDir({ dir: 'content/acts' })
const sober = (code) => voices.find((v) => v.id === 'sober').lines[code]
// The content act, made certain: the chance always lands, whatever the roll.
const actOf = (id) => ({ ...acts.find((a) => a.id === id), chancePerTick: 1 })
const characterOf = (id) => characters.find((c) => c.id === id)
// One roll, switchable mid-test: a natural twenty makes pieces; a natural one fails saves.
const PASS = rngForNatural({ natural: 20 })
const FAIL = rngForNatural({ natural: 1 })

const stillWorld = {
  tick: ({ characters: here }) => ({
    characters: here.map((c) => ({ id: c.id, locationId: c.currentLocationId })),
  }),
}

function startGame({ at = 'blue_parrot', actRegistry = [], quietWalls = false } = {}) {
  const dice = { value: PASS }
  const rng = () => dice.value
  setActivePinia(createPinia())
  const game = useGameStore()
  // quietWalls: nothing is ever stolen or defaced, so a piece stays to be looked at again.
  game.tuningRegister({
    tuning: quietWalls ? { ...tuning, display: { ...tuning.display, fates: [] } } : tuning,
  })
  game.vocabularyRegister({ vocabulary })
  for (const location of locations) game.locationRegister({ location: locationCreate(location) })
  for (const voice of voices) game.voiceRegister({ voice })
  for (const item of items) game.itemRegister({ item: itemCreate(item) })
  for (const medium of mediums) game.mediumRegister({ medium })
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
    actRegistry,
    narrative,
    rng,
    simulation: stillWorld,
  })
  return { game, narrative, loop, dice }
}

/** The Parrot keeps hours; walk the clock to its door before going. */
async function untilOpen({ game, loop, locationId }) {
  const { openHour } = locations.find((l) => l.id === locationId).availability
  while (game.time.hour < openHour) await loop.tick({ ticks: 1 })
}

function arrives({ game, id, at }) {
  game.characterRegister({
    character: characterCreate({ ...characterOf(id), psyche: { marks: [], abilities: [] } }),
  })
  game.characterLocationSet({ characterId: id, locationId: at })
  game.blendRefresh()
  return game.characters[id]
}

describe('other artists', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('a tagger alone in the Parrot tags the bathroom wall, the world judges it, and you find it when you walk in', async () => {
    const { game, narrative, loop } = startGame({
      at: 'moms_house',
      actRegistry: [actOf('artist_tags')],
    })
    loop.onLocationEntered()
    await untilOpen({ game, loop, locationId: 'blue_parrot' })
    const tyler = arrives({ game, id: 'tyler', at: 'blue_parrot' })
    await loop.tick({ ticks: 1 })

    const wall = game.locations.blue_parrot.marks
    expect(wall).toHaveLength(1)
    expect(wall[0]).toMatchObject({
      kind: ARTIFACT_KINDS.fixed,
      status: ARTIFACT_STATUSES.fresh,
      makerId: 'tyler',
      mediumId: 'tagging',
      surfaceId: 'bathroom_wall',
    })
    // Judged on the spot, in the room's words about him.
    expect(wall[0].reception).toBeTruthy()
    expect(wall[0].artistText).toBe(
      textFill({
        text: sober(`verdict.others.${wall[0].reception}`),
        params: { name: 'Tyler', work: wall[0].workText, place: 'the Blue Parrot' },
      })
    )
    expect(tyler.experiences).toHaveLength(1)

    // Walking in later: his is up here.
    await loop.travel({ locationId: 'blue_parrot' })
    const entries = await narrativeSettle({ narrative })
    expect(entries).toContain(
      textFill({ text: sober('mark.others'), params: { name: 'Tyler', work: wall[0].workText } })
    )
  })

  it('in the room, the player sees it go up and hears the verdict', async () => {
    const { game, narrative, loop } = startGame({
      at: 'blue_parrot',
      actRegistry: [actOf('artist_performs')],
    })
    arrives({ game, id: 'maurice', at: 'blue_parrot' })
    loop.onLocationEntered()
    await narrativeSettle({ narrative })
    await loop.tick({ ticks: 1 })
    const entries = await narrativeSettle({ narrative })
    const lived = game.characters.maurice.experiences[0]
    expect(lived).toMatchObject({ mediumId: 'performance', artifactId: null })
    expect(entries).toContain(
      textFill({
        text: sober('community.performed'),
        params: { name: 'Maurice', work: lived.workText },
      })
    )
    expect(entries).toContain(lived.artistText)
  })
})

describe('the nemesis', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it("seeing a better piece in your medium is a save; fail it, and it's an obsession about the one who made it, once", async () => {
    const { game, narrative, loop, dice } = startGame({
      at: 'moms_house',
      actRegistry: [actOf('artist_tags')],
      quietWalls: true,
    })
    game.player.skills = { tagging: { sober: { base: 5, modifiers: [], xp: 0 } } }
    loop.onLocationEntered()
    await untilOpen({ game, loop, locationId: 'blue_parrot' })
    arrives({ game, id: 'tyler', at: 'blue_parrot' })
    await loop.tick({ ticks: 1 })
    expect(game.locations.blue_parrot.marks).toHaveLength(1)
    const tag = game.locations.blue_parrot.marks[0]

    // From here on the dice go against you: the save fails.
    dice.value = FAIL
    await loop.travel({ locationId: 'blue_parrot' })
    const entries = await narrativeSettle({ narrative })
    const nemesis = game.player.psyche.marks.find((m) => m.target?.id === 'tyler')
    expect(nemesis).toMatchObject({
      target: { kind: MARK_TARGET_KINDS.character, id: 'tyler' },
      source: { kind: 'piece', id: tag.id },
    })
    expect(['obsession_love', 'obsession_hate']).toContain(nemesis.markId)
    expect(entries).toContain(
      textFill({
        text: sober(marks.find((m) => m.id === nemesis.markId).lineCode),
        params: { target: 'Tyler' },
      })
    )
    // Once per piece: walking in again rolls nothing new, and trains nothing.
    // (The dice turn kind again, so nothing steals the tag in the meantime,
    // and Tyler is done for the day, so there is no new piece to see.)
    dice.value = PASS
    game.characters.tyler.skills = {}
    const xpBefore = game.player.stats[tuning.community.rivalry.save.stat].xp
    await loop.travel({ locationId: 'moms_house' })
    await loop.travel({ locationId: 'blue_parrot' })
    expect(game.player.psyche.marks.filter((m) => m.target?.id === 'tyler')).toHaveLength(1)
    expect(game.player.stats[tuning.community.rivalry.save.stat].xp).toBe(xpBefore)
  })

  it('no skill in the medium, nothing to chase', async () => {
    const { game, loop } = startGame({ at: 'moms_house', actRegistry: [actOf('artist_tags')] })
    loop.onLocationEntered()
    await untilOpen({ game, loop, locationId: 'blue_parrot' })
    arrives({ game, id: 'tyler', at: 'blue_parrot' })
    await loop.tick({ ticks: 1 })
    await loop.travel({ locationId: 'blue_parrot' })
    expect(game.player.psyche.marks).toEqual([])
  })
})

describe('the fan, or the rival', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('another artist in the room sees your piece shown and beaten; they come away with an obsession about you, and it can be set off by you', async () => {
    const { game, loop, dice } = startGame({ at: 'blue_parrot' })
    dice.value = FAIL
    const tyler = arrives({ game, id: 'tyler', at: 'blue_parrot' })
    game.player.stats.reputation.base = 90
    game.player.skills = { tagging: { sober: { base: 40, modifiers: [], xp: 0 } } }
    const piece = {
      id: 'mine',
      status: ARTIFACT_STATUSES.unshown,
      kind: ARTIFACT_KINDS.portable,
      makerId: game.player.id,
      experienceId: 'exp_mine',
      mediumId: 'tagging',
      tier: MAKING_TIERS.inspired,
      workText: 'a tag on a cabinet door',
      artistText: 'the idea',
      reception: null,
      legend: 0,
      ideaText: null,
      shownAtTick: null,
      shownAtLocationId: null,
      createdAtTick: 0,
      updatedAtTick: 0,
    }
    game.player.portfolio.push(piece)
    game.player.experiences.push({
      id: 'exp_mine',
      kind: 'making',
      makerId: game.player.id,
      mediumId: 'tagging',
      tier: MAKING_TIERS.inspired,
      locationId: 'blue_parrot',
      artifactId: 'mine',
      workText: piece.workText,
      artistText: piece.artistText,
    })
    loop.onLocationEntered()
    await loop.resolvePlayerAction(game.availableActions.find((a) => a.id === 'show_something'))
    await loop.resolvePlayerAction(game.availableActions.find((a) => a.id === 'display_piece_mine'))

    const about = tyler.psyche.marks.find((m) => m.target?.kind === MARK_TARGET_KINDS.player)
    expect(about).toMatchObject({
      target: { kind: MARK_TARGET_KINDS.player, id: game.player.id },
      source: { kind: 'piece', id: 'mine' },
    })
    // The player is the target: with the player in the room, the fit's trigger holds.
    await loop.tick({ ticks: 1 })
    const after = tyler.psyche.marks.find((m) => m.target?.kind === MARK_TARGET_KINDS.player)
    expect(after.fitTicksRemaining).toBeGreaterThan(0)
  })
})
