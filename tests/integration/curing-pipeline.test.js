/**
 * Integration: how a mark ends. A cure is a door on the menu; through it,
 * the marks it can reach; each session costs its time and its toll and is
 * a check; the count reached changes the mark's status, and a cured mark
 * stops doing anything. Driven through the real loop, store and content.
 *
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useGameStore } from '../../src/stores/game.js'
import { playerCreate, inventoryAdd } from '../../src/models/player.js'
import { locationCreate } from '../../src/models/location.js'
import { useNarrative } from '../../src/composables/useNarrative.js'
import { useGameLoop } from '../../src/composables/useGameLoop.js'
import { MARK_STATUSES } from '../../src/engine/psyche.js'
import { contentDir, tuningContent } from '../helpers/content.js'
import { narrativeSettle } from '../helpers/narrative.js'
import { rngForNatural, rngSequence } from '../helpers/rng.js'
import { textFill } from '../../src/utils/text.js'

const tuning = tuningContent()
const locations = contentDir({ dir: 'content/maps/kenton/locations' })
const actions = contentDir({ dir: 'content/maps/kenton/actions' }).flat()
const voices = contentDir({ dir: 'content/voices' })
const marks = contentDir({ dir: 'content/marks' })
const tables = contentDir({ dir: 'content/psyche' })
const topics = contentDir({ dir: 'content/topics' })
const items = contentDir({ dir: 'content/items' }).flat()
const cures = contentDir({ dir: 'content/cures' })
const sober = (code) => voices.find((v) => v.id === 'sober').lines[code]
const cureOf = (id) => cures.find((c) => c.id === id)
const markOf = (id) => marks.find((m) => m.id === id)
const PASS = rngForNatural({ natural: 20 })
const FAIL = rngForNatural({ natural: 1 })

const stillWorld = { tick: ({ characters: here }) => ({ characters: here }) }

// The church: nothing random happens there, so the dice are the sessions'.
function startGame({ at = 'abundant_life', values = [PASS] } = {}) {
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
  for (const item of items) game.itemRegister({ item })
  for (const mark of marks) game.markRegister({ mark })
  for (const table of tables) game.psycheTableRegister({ table })
  for (const topic of topics) game.topicRegister({ topic })
  for (const cure of cures) game.cureRegister({ cure })
  game.runStart({ player: playerCreate({ name: 'Tester' }), locationId: at })
  game.locationLearnApply({ locationId: at })
  const narrative = useNarrative({ tuning })
  const loop = useGameLoop({
    actionRegistry: actions,
    narrative,
    rng: rngSequence({ values, repeatLast: true }),
    simulation: stillWorld,
  })
  loop.onLocationEntered()
  return { game, narrative, loop }
}

/** The church opens its office at nine; the game starts at eight. */
async function officeHours({ game, loop }) {
  while (game.time.hour < 9) await loop.tick({ ticks: 1 })
}

/** A mark the player already carries; the menu is rebuilt to see it. */
function marked({ game, loop, markId, target = null }) {
  const id = `${markId}:${target?.id ?? 'none'}`
  game.player.psyche.marks.push({
    id,
    markId,
    target,
    source: { kind: 'test', id: 'test' },
    status: MARK_STATUSES.active,
    fitTicksRemaining: 0,
    cures: {},
    acquiredAtTick: 0,
    updatedAtTick: 0,
  })
  game.blendRefresh()
  loop.onLocationEntered()
  return id
}

const park = { kind: 'location', id: 'columbia_park' }
const entry = ({ game, id }) => game.availableActions.find((a) => a.id === id)
const parkName = (game) => game.targetName({ target: park })

describe('the door', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('with nothing to work on, the pastor is on the menu and greyed, and says why', async () => {
    const { game, loop } = startGame()
    await officeHours({ game, loop })
    const door = entry({ game, id: 'counsel_abundant_life' })
    expect(door.available).toBe(false)
    expect(door.unavailableReason).toBe(sober('requirement.cure.none'))
  })

  it('with a mark to work on, walking in costs nothing and the menu becomes the marks the cure can reach', async () => {
    const { game, loop } = startGame()
    await officeHours({ game, loop })
    const scarId = marked({ game, loop, markId: 'scar', target: park })
    const tickBefore = game.time.tick
    await loop.resolvePlayerAction(entry({ game, id: 'counsel_abundant_life' }))

    expect(game.time.tick).toBe(tickBefore)
    expect(game.curePicker).toEqual({ actionId: 'counsel_abundant_life' })
    const session = entry({ game, id: `cure_mark_${scarId}` })
    expect(session.label).toBe(
      textFill({
        text: sober('menu.cure.mark'),
        params: { mark: markOf('scar').display, target: parkName(game) },
      })
    )
    expect(session.timeCost).toBe(cureOf('therapy').session.ticks)
    expect(entry({ game, id: 'cure_cancel' }).label).toBe(sober('menu.cure.cancel'))
  })

  it('not today: the menu goes back to the ordinary one', async () => {
    const { game, loop } = startGame()
    await officeHours({ game, loop })
    marked({ game, loop, markId: 'scar', target: park })
    await loop.resolvePlayerAction(entry({ game, id: 'counsel_abundant_life' }))
    await loop.resolvePlayerAction(entry({ game, id: 'cure_cancel' }))
    expect(game.curePicker).toBeNull()
    expect(entry({ game, id: 'counsel_abundant_life' })).toBeTruthy()
  })

  it('the tape is a door anywhere, and only with the tape', async () => {
    const { game, loop } = startGame()
    marked({ game, loop, markId: 'phobia', target: park })
    expect(entry({ game, id: 'play_the_tape' })?.available).toBe(false)
    inventoryAdd({ player: game.player, item: items.find((i) => i.id === 'self_hypnosis_tape') })
    loop.onLocationEntered()
    expect(entry({ game, id: 'play_the_tape' }).available).toBe(true)
  })

  it('a cure that cannot reach the mark carried is a door to nowhere', () => {
    const { game, loop } = startGame()
    inventoryAdd({ player: game.player, item: items.find((i) => i.id === 'self_hypnosis_tape') })
    // A scar is trauma; the tape reaches phobias, obsessions and neuroses.
    marked({ game, loop, markId: 'scar', target: park })
    expect(entry({ game, id: 'play_the_tape' }).available).toBe(false)
  })
})

describe('a session', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('takes: the check trains, the toll and the time are paid, the count moves, the cure says so, and the menu closes', async () => {
    const therapy = cureOf('therapy')
    const { game, narrative, loop } = startGame()
    await officeHours({ game, loop })
    const scarId = marked({ game, loop, markId: 'scar', target: park })
    await loop.resolvePlayerAction(entry({ game, id: 'counsel_abundant_life' }))
    await narrativeSettle({ narrative })
    const before = {
      tick: game.time.tick,
      energy: game.player.status.energy,
      xp: game.player.stats[therapy.session.check.stat].xp,
    }

    await loop.resolvePlayerAction(entry({ game, id: `cure_mark_${scarId}` }))
    const entries = await narrativeSettle({ narrative })

    const scar = game.player.psyche.marks.find((m) => m.id === scarId)
    expect(scar.cures).toEqual({ therapy: 1 })
    expect(scar.status).toBe(MARK_STATUSES.active)
    expect(game.time.tick).toBe(before.tick + therapy.session.ticks)
    expect(game.player.stats[therapy.session.check.stat].xp).toBe(
      before.xp + tuning.stats.xpCheckSuccess
    )
    expect(game.player.status.energy).toBeLessThanOrEqual(
      before.energy + therapy.session.statusChanges.energy
    )
    expect(entries).toContain(
      textFill({
        text: sober(therapy.lineCodes.took),
        params: { mark: markOf('scar').display, target: parkName(game) },
      })
    )
    expect(game.curePicker).toBeNull()
  })

  it('slips: the count sets back by what the cure says, and the cure says so', async () => {
    const tape = cureOf('self_hypnosis')
    const { game, narrative, loop } = startGame({ values: [PASS, FAIL] })
    inventoryAdd({ player: game.player, item: items.find((i) => i.id === 'self_hypnosis_tape') })
    const fearId = marked({ game, loop, markId: 'phobia', target: park })
    const fear = () => game.player.psyche.marks.find((m) => m.id === fearId)
    const session = async () => {
      await loop.resolvePlayerAction(entry({ game, id: 'play_the_tape' }))
      await loop.resolvePlayerAction(entry({ game, id: `cure_mark_${fearId}` }))
    }
    await session()
    expect(fear().cures).toEqual({ [tape.id]: 1 })
    await session()
    const entries = await narrativeSettle({ narrative })
    expect(fear().cures).toEqual({ [tape.id]: 1 - tape.setbackOnFailure })
    expect(fear().status).toBe(MARK_STATUSES.active)
    expect(entries).toContain(
      textFill({
        text: sober(tape.lineCodes.slipped),
        params: { mark: markOf('phobia').display, target: parkName(game) },
      })
    )
  })
})

describe('the cure', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  async function cured({ game, loop, markId, target }) {
    const id = marked({ game, loop, markId, target })
    const therapy = cureOf('therapy')
    for (let i = 0; i < therapy.sessions; i++) {
      await loop.resolvePlayerAction(entry({ game, id: 'counsel_abundant_life' }))
      await loop.resolvePlayerAction(entry({ game, id: `cure_mark_${id}` }))
    }
    return game.player.psyche.marks.find((m) => m.id === id)
  }

  it('the count reached changes the status; the mark stays, and the cure says so', async () => {
    const { game, narrative, loop } = startGame()
    await officeHours({ game, loop })
    const scar = await cured({ game, loop, markId: 'scar', target: park })
    const entries = await narrativeSettle({ narrative })
    expect(scar.status).toBe(MARK_STATUSES.cured)
    expect(game.player.psyche.marks).toHaveLength(1)
    expect(entries).toContain(
      textFill({
        text: sober(cureOf('therapy').lineCodes.cured),
        params: { mark: markOf('scar').display, target: parkName(game) },
      })
    )
    // Nothing left to work on: the door is greyed again.
    expect(entry({ game, id: 'counsel_abundant_life' }).available).toBe(false)
  })

  it('a cured mark does nothing: no refusing, no bending, no going off', async () => {
    const { game, loop } = startGame()
    await officeHours({ game, loop })
    expect(game.playerAvoids({ target: park })).toBeNull()
    const fearId = marked({ game, loop, markId: 'phobia', target: park })
    expect(game.playerAvoids({ target: park })?.id).toBe(fearId)
    const toughnessMarked = game.player.stats.toughness.modifiers.length

    await cured({ game, loop, markId: 'scar', target: park })
    // The fear goes on the tape: the pastor's day is six sessions long.
    inventoryAdd({ player: game.player, item: items.find((i) => i.id === 'self_hypnosis_tape') })
    loop.onLocationEntered()
    for (let i = 0; i < cureOf('self_hypnosis').sessions; i++) {
      await loop.resolvePlayerAction(entry({ game, id: 'play_the_tape' }))
      await loop.resolvePlayerAction(entry({ game, id: `cure_mark_${fearId}` }))
    }

    expect(game.playerAvoids({ target: park })).toBeNull()
    expect(game.player.blend.modifierSources ?? []).not.toContainEqual(
      expect.objectContaining({ sourceId: 'scar' })
    )
    expect(game.player.stats.toughness.modifiers.length).toBeLessThanOrEqual(toughnessMarked)
    // At the park, with every chance landing, a cured scar's fit never starts.
    const swung = useGameLoop({
      actionRegistry: actions,
      rng: () => 0,
      simulation: stillWorld,
    })
    await swung.travel({ locationId: 'columbia_park' })
    await swung.tick({ ticks: 4 })
    for (const mark of game.player.psyche.marks) expect(mark.fitTicksRemaining).toBe(0)
  })
})
