// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import {
  GAME_ERROR_CODES,
  GAME_MODIFIER_SOURCE_ID,
  gameStart,
  gameRoundResolve,
  gameScore,
} from './minigame.js'

// The shapes are the code; the games are content. These play the real ones.
const load = (id) => JSON.parse(readFileSync(resolve(`content/games/${id}.json`), 'utf-8'))
const nerve = load('nerve')
const words = load('words')
const room = load('room')
const steady = load('steady')

const always = (value) => () => value
function sequence(...values) {
  let i = 0
  return () => values[i++ % values.length]
}

/** Play choices in order; returns every round's result and the final state. */
function play({ game, choices, personaId = 'sober', rng = always(0.99), skillValue = 0 }) {
  let state = gameStart({ game, personaId, rng }).data.state
  const rounds = []
  for (const choiceId of choices) {
    const round = gameRoundResolve({ game, state, choiceId, personaId, skillValue, rng })
    rounds.push(round)
    if (!round.ok) break
    state = round.data.state
  }
  return { state, rounds }
}
const value = ({ game, state }) => gameScore({ game, state }).data.modifier.value

describe('the contract', () => {
  it('refuses a game with no shape, an unknown shape, or no lines', () => {
    expect(gameStart({ game: null, personaId: 'sober' }).error.code).toBe(
      GAME_ERROR_CODES.GAME_INVALID
    )
    expect(
      gameStart({ game: { shape: 'staring', lines: {} }, personaId: 'sober' }).error.code
    ).toBe(GAME_ERROR_CODES.SHAPE_UNKNOWN)
    expect(gameStart({ game: { id: 'x', shape: 'steady' }, personaId: 'sober' }).error.code).toBe(
      GAME_ERROR_CODES.GAME_INVALID
    )
  })

  it('refuses a choice that is not on offer, and any choice once the game is over', () => {
    const { state, rounds } = play({ game: nerve, choices: ['stop', 'press'] })
    expect(state.offer).toBeNull()
    expect(rounds[1].error.code).toBe(GAME_ERROR_CODES.GAME_OVER)
    const fresh = gameStart({ game: nerve, personaId: 'sober' }).data.state
    const bad = gameRoundResolve({
      game: nerve,
      state: fresh,
      choiceId: 'dance',
      personaId: 'sober',
    })
    expect(bad.error.code).toBe(GAME_ERROR_CODES.CHOICE_UNKNOWN)
  })

  it('hands the check one modifier, named for what it is', () => {
    const { state } = play({ game: nerve, choices: ['press', 'stop'] })
    expect(gameScore({ game: nerve, state }).data.modifier).toEqual({
      sourceId: GAME_MODIFIER_SOURCE_ID,
      value: 1,
    })
  })
})

describe('steady', () => {
  it('is one choice a round, never ends the work itself, and is worth nothing either way', () => {
    const { state, rounds } = play({ game: steady, choices: ['work', 'work', 'work'] })
    expect(rounds.every((r) => r.ok && !r.data.workDone)).toBe(true)
    expect(state.offer.choices.map((c) => c.id)).toEqual(['work'])
    expect(state.offer.round).toBe(4)
    expect(value({ game: steady, state })).toBe(0)
  })
})

describe('push_luck — nerve', () => {
  it('every beat banked is worth more, up to the cap, and stopping ends the work', () => {
    const worth = (presses) => {
      const { state, rounds } = play({
        game: nerve,
        choices: [...Array(presses).fill('press'), 'stop'],
      })
      expect(rounds.at(-1).data.workDone).toBe(true)
      return value({ game: nerve, state })
    }
    expect(worth(1)).toBe(1)
    expect(worth(2)).toBe(2)
    expect(worth(3)).toBe(nerve.params.bankCap)
    expect(worth(5)).toBe(nerve.params.bankCap)
  })

  it('stopping before you start is timid, and costs', () => {
    const { state } = play({ game: nerve, choices: ['stop'] })
    expect(value({ game: nerve, state })).toBe(nerve.params.timidModifier)
  })

  it('a bust ends the work, says so, and costs more than anything banked was worth', () => {
    const { state, rounds } = play({
      game: nerve,
      choices: ['press', 'press'],
      rng: sequence(0.99, 0.0),
    })
    expect(rounds[1].data.workDone).toBe(true)
    expect(rounds[1].data.lineCode).toBe(nerve.lines.busted)
    expect(state.offer).toBeNull()
    expect(value({ game: nerve, state })).toBe(nerve.params.bustModifier)
  })

  it('the risk climbs with every beat banked', () => {
    // A roll that is safe on the first beat is not safe on the third.
    const roll = nerve.params.riskBase + nerve.params.riskStep * 1.5
    const { rounds } = play({
      game: nerve,
      choices: ['press', 'press', 'press'],
      rng: always(roll),
    })
    expect(rounds.map((r) => r.data.lineCode)).toEqual([
      nerve.lines.pressed,
      nerve.lines.pressed,
      nerve.lines.busted,
    ])
  })

  it('practice steadies the hand: the same roll that busts a beginner spares the practised', () => {
    const roll = nerve.params.riskBase - 0.01
    const beginner = play({ game: nerve, choices: ['press'], rng: always(roll), skillValue: 0 })
    const practised = play({ game: nerve, choices: ['press'], rng: always(roll), skillValue: 40 })
    expect(beginner.rounds[0].data.lineCode).toBe(nerve.lines.busted)
    expect(practised.rounds[0].data.lineCode).toBe(nerve.lines.pressed)
  })

  it('the persona in charge forbids a choice for the rounds it says, with its reason, and no longer', () => {
    const gangster = nerve.compulsions.find((c) => c.personaId === 'suburban_gangster')
    const start = gameStart({ game: nerve, personaId: 'suburban_gangster' }).data.state
    const stop = (state) => state.offer.choices.find((c) => c.id === 'stop')
    expect(stop(start)).toMatchObject({ available: false, reason: gangster.reason })
    const refused = gameRoundResolve({
      game: nerve,
      state: start,
      choiceId: 'stop',
      personaId: 'suburban_gangster',
    })
    expect(refused.error.code).toBe(GAME_ERROR_CODES.CHOICE_FORBIDDEN)

    const { state } = play({
      game: nerve,
      choices: ['press', 'press'],
      personaId: 'suburban_gangster',
    })
    expect(state.offer.round).toBe(gangster.toRound + 1)
    expect(stop(state).available).toBe(true)
    // Sober, nobody is stopping you from stopping.
    expect(stop(gameStart({ game: nerve, personaId: 'sober' }).data.state).available).toBe(true)
  })
})

describe('push_luck — a compulsion that starts late', () => {
  it('stoned, you can keep going until the round the street starts watching, and not after', () => {
    const frozen = nerve.compulsions.find((c) => c.personaId === 'telepath')
    const press = (state) => state.offer.choices.find((c) => c.id === 'press')
    let state = gameStart({ game: nerve, personaId: 'telepath' }).data.state
    for (let round = 1; round < frozen.fromRound; round++) {
      expect(press(state).available, `round ${round}`).toBe(true)
      state = gameRoundResolve({
        game: nerve,
        state,
        choiceId: 'press',
        personaId: 'telepath',
        rng: always(0.99),
      }).data.state
    }
    expect(state.offer.round).toBe(frozen.fromRound)
    expect(press(state)).toMatchObject({ available: false, reason: frozen.reason })
  })
})

describe('word_pick — words', () => {
  const registerOf = (word) =>
    Object.entries(words.params.registers).find(([, list]) => list.includes(word))[0]

  it('offers one word from each of three registers, and never a word already used', () => {
    let state = gameStart({ game: words, personaId: 'sober', rng: sequence(0.1, 0.5, 0.9) }).data
      .state
    const seen = []
    for (let i = 0; i < 6; i++) {
      const offered = state.offer.choices.map((c) => c.id)
      expect(offered).toHaveLength(words.params.picksPerRound)
      expect(new Set(offered.map(registerOf)).size).toBe(3)
      for (const word of seen) expect(offered).not.toContain(word)
      seen.push(offered[0])
      state = gameRoundResolve({
        game: words,
        state,
        choiceId: offered[0],
        personaId: 'sober',
        rng: sequence(0.1, 0.5, 0.9),
      }).data.state
    }
  })

  it('the persona in charge leans on the draw: the priest keeps being handed the holy ones', () => {
    const state = gameStart({ game: words, personaId: 'priest', rng: sequence(0.2, 0.7, 0.4) }).data
      .state
    const holy = state.offer.choices.filter((c) => registerOf(c.id) === 'holy')
    expect(holy).toHaveLength(2)
  })

  it('the words picked are the words of the piece, in order', () => {
    let state = gameStart({ game: words, personaId: 'sober', rng: always(0.3) }).data.state
    const picked = []
    for (let i = 0; i < 3; i++) {
      const word = state.offer.choices[i % 3].id
      picked.push(word)
      const round = gameRoundResolve({
        game: words,
        state,
        choiceId: word,
        personaId: 'sober',
        rng: always(0.3),
      })
      expect(round.data.lineParams).toEqual({ word })
      state = round.data.state
    }
    expect(gameScore({ game: words, state }).data.words).toEqual(picked)
  })

  it('words that belong together are a voice; one of everything is mush', () => {
    const pickBy = (wanted) => {
      let state = gameStart({ game: words, personaId: 'priest', rng: sequence(0.2, 0.6, 0.8) }).data
        .state
      for (const register of wanted) {
        const choice =
          state.offer.choices.find((c) => registerOf(c.id) === register) ?? state.offer.choices[0]
        state = gameRoundResolve({
          game: words,
          state,
          choiceId: choice.id,
          personaId: 'priest',
          rng: sequence(0.2, 0.6, 0.8),
        }).data.state
      }
      return { state, registers: state.words.map((w) => w.register) }
    }
    const voice = pickBy(['holy', 'holy', 'holy'])
    expect(voice.registers).toEqual(['holy', 'holy', 'holy'])
    expect(value({ game: words, state: voice.state })).toBe(words.params.voiceCap)

    const pair = {
      words: [
        { word: 'lamb', register: 'holy' },
        { word: 'rain', register: 'plain' },
        { word: 'mercy', register: 'holy' },
      ],
    }
    expect(value({ game: words, state: pair })).toBe(1)

    const mush = {
      words: [
        { word: 'rain', register: 'plain' },
        { word: 'abyss', register: 'purple' },
        { word: 'lamb', register: 'holy' },
      ],
    }
    expect(value({ game: words, state: mush })).toBe(words.params.mushModifier)
  })
})

describe('read_room — room', () => {
  it('opens by telling you the room, and tells you again after every move', () => {
    const start = gameStart({ game: room, personaId: 'sober' })
    expect(start.data.promptCode).toBe(room.lines.crowd[room.params.crowdStart])
    const round = gameRoundResolve({
      game: room,
      state: start.data.state,
      choiceId: 'hold',
      personaId: 'sober',
      rng: always(0.0),
    })
    expect(round.data.promptCode).toBe(room.lines.crowd[round.data.state.crowd])
  })

  it('pushing a cold room costs you and turns it; holding lets it warm', () => {
    const pushed = play({ game: room, choices: ['push'], rng: always(0.0) })
    expect(pushed.state.crowd).toBe('turning')
    expect(pushed.state.total).toBe(-1)
    const held = play({ game: room, choices: ['hold'], rng: always(0.0) })
    expect(held.state.crowd).toBe('warm')
    expect(held.state.total).toBe(0)
  })

  it('the way up is hold, push, push — and the score is capped both ways', () => {
    const { state } = play({
      game: room,
      choices: ['hold', 'push', 'push', 'bow'],
      rng: always(0.0),
    })
    expect(state.total).toBe(3)
    expect(value({ game: room, state })).toBe(3)
    expect(value({ game: room, state: { ...state, total: 11 } })).toBe(room.params.scoreCap)
    expect(value({ game: room, state: { ...state, total: -11 } })).toBe(-room.params.scoreCap)
  })

  it('bowing ends the work and keeps what you had', () => {
    const { state, rounds } = play({
      game: room,
      choices: ['hold', 'push', 'bow'],
      rng: always(0.0),
    })
    expect(rounds.at(-1).data.workDone).toBe(true)
    expect(rounds.at(-1).data.lineCode).toBe(room.lines.bowed)
    expect(state.offer).toBeNull()
    expect(state.total).toBe(1)
  })

  it('stoned, you cannot push: you freeze in public', () => {
    const state = gameStart({ game: room, personaId: 'telepath' }).data.state
    const push = state.offer.choices.find((c) => c.id === 'push')
    expect(push.available).toBe(false)
    expect(state.offer.choices.filter((c) => c.available).map((c) => c.id)).toEqual(['hold', 'bow'])
  })
})
