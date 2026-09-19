// @vitest-environment node
// Content contract: content/games/*.json — Minigame contract.
import { describe, it, expect } from 'vitest'
import { join } from 'path'
import { CONTENT_ROOT, loadJsonFiles } from '../helpers/contentContracts.js'

describe('content/games/*.json — Minigame contract', () => {
  const files = loadJsonFiles(join(CONTENT_ROOT, 'games'))
  const gameIds = new Set(files.map(({ data }) => data.id))
  const personaIds = new Set(['sober'])
  for (const { data } of loadJsonFiles(join(CONTENT_ROOT, 'substances'))) {
    personaIds.add(data.persona?.id)
    if (data.withdrawal) personaIds.add(data.withdrawal.persona?.id)
  }
  for (const { data } of loadJsonFiles(join(CONTENT_ROOT, 'conditions')))
    personaIds.add(data.persona?.id)

  const SHAPES = {
    steady: { choices: ['work'], lines: ['work'], params: [] },
    push_luck: {
      choices: ['press', 'stop'],
      lines: ['pressed', 'busted', 'stopped'],
      params: ['riskBase', 'riskStep', 'skillRelief', 'bankCap', 'bustModifier', 'timidModifier'],
    },
    word_pick: {
      choices: [],
      lines: ['picked'],
      params: ['picksPerRound', 'voiceCap', 'mushModifier', 'registers'],
    },
    read_room: {
      choices: ['push', 'hold', 'bow'],
      lines: ['pushed', 'held', 'bowed', 'crowd'],
      params: ['crowdStart', 'scoreCap', 'transitions'],
    },
  }

  for (const { file, data } of files) {
    it(`${file} — valid game`, () => {
      expect(
        file.endsWith(`${data.id}.json`),
        `${file}: file name must match id '${data.id}'`
      ).toBe(true)
      const shape = SHAPES[data.shape]
      expect(shape, `${file}: unknown shape '${data.shape}'`).toBeTruthy()
      expect(
        Number.isInteger(data.sittingTicks) && data.sittingTicks >= 1,
        `${file}: sittingTicks must be a whole number >= 1`
      ).toBe(true)
      expect(typeof data.description, `${file}: description must be string`).toBe('string')
      for (const id of shape.choices) {
        expect(typeof data.choices?.[id]?.label, `${file}: choice '${id}' needs a label`).toBe(
          'string'
        )
      }
      for (const key of shape.lines)
        expect(data.lines, `${file}: lines.${key} missing`).toHaveProperty(key)
      for (const key of shape.params)
        expect(data.params, `${file}: params.${key} missing`).toHaveProperty(key)

      for (const compulsion of data.compulsions ?? []) {
        expect(
          personaIds.has(compulsion.personaId),
          `${file}: compulsion names unknown persona '${compulsion.personaId}'`
        ).toBe(true)
        expect(
          shape.choices,
          `${file}: compulsion forbids unknown choice '${compulsion.choiceId}'`
        ).toContain(compulsion.choiceId)
        expect(typeof compulsion.reason, `${file}: a compulsion says why`).toBe('string')
      }
      // No persona may be left with nothing to choose in any round.
      for (const personaId of new Set((data.compulsions ?? []).map((c) => c.personaId))) {
        for (let round = 1; round <= 12; round++) {
          const forbidden = (data.compulsions ?? []).filter(
            (c) =>
              c.personaId === personaId &&
              round >= (c.fromRound ?? 1) &&
              round <= (c.toRound ?? Infinity)
          )
          expect(
            forbidden.length,
            `${file}: '${personaId}' has no choice left in round ${round}`
          ).toBeLessThan(shape.choices.length)
        }
      }

      if (data.shape === 'word_pick') {
        const registers = Object.entries(data.params.registers)
        expect(
          registers.length,
          `${file}: needs at least picksPerRound registers`
        ).toBeGreaterThanOrEqual(data.params.picksPerRound)
        const seen = new Set()
        for (const [register, words] of registers) {
          expect(
            words.length,
            `${file}: register '${register}' is too thin to draw from all game`
          ).toBeGreaterThanOrEqual(8)
          for (const word of words) {
            expect(seen.has(word), `${file}: '${word}' is in two registers`).toBe(false)
            seen.add(word)
          }
        }
        for (const [personaId, register] of Object.entries(data.params.personaLean ?? {})) {
          expect(
            personaIds.has(personaId),
            `${file}: personaLean names unknown persona '${personaId}'`
          ).toBe(true)
          expect(
            data.params.registers,
            `${file}: '${personaId}' leans on unknown register '${register}'`
          ).toHaveProperty(register)
        }
      }
      if (data.shape === 'read_room') {
        const crowds = Object.keys(data.lines.crowd)
        expect(crowds, `${file}: crowdStart must be a crowd`).toContain(data.params.crowdStart)
        for (const crowd of crowds) {
          for (const choiceId of ['push', 'hold']) {
            const move = data.params.transitions[crowd]?.[choiceId]
            expect(move, `${file}: no transition for ${choiceId} when ${crowd}`).toBeTruthy()
            expect(typeof move.score, `${file}: ${crowd}.${choiceId}.score must be number`).toBe(
              'number'
            )
            expect(move.to.length, `${file}: ${crowd}.${choiceId} leads nowhere`).toBeGreaterThan(0)
            for (const target of move.to) {
              expect(
                crowds,
                `${file}: ${crowd}.${choiceId} leads to unknown crowd '${target.crowd}'`
              ).toContain(target.crowd)
              expect(target.weight, `${file}: weights must be > 0`).toBeGreaterThan(0)
            }
          }
        }
      }
    })
  }

  // Urges: every persona's urges name a real medium and can outlast the work.
  const mediumsById = new Map(
    loadJsonFiles(join(CONTENT_ROOT, 'mediums')).map(({ data }) => [data.id, data])
  )
  const personaBlocks = [
    ...loadJsonFiles(join(CONTENT_ROOT, 'substances')).flatMap(({ file, data }) =>
      [data.persona, data.withdrawal?.persona].filter(Boolean).map((persona) => ({ file, persona }))
    ),
    ...loadJsonFiles(join(CONTENT_ROOT, 'conditions')).map(({ file, data }) => ({
      file,
      persona: data.persona,
    })),
  ]
  for (const { file, persona } of personaBlocks) {
    for (const urge of persona.urges ?? []) {
      it(`${file}: persona '${persona.id}' urge to '${urge.mediumId}' is real and can be acted on`, () => {
        const medium = mediumsById.get(urge.mediumId)
        expect(medium, `unknown medium '${urge.mediumId}'`).toBeTruthy()
        expect(urge.chancePerTick).toBeGreaterThan(0)
        expect(urge.chancePerTick).toBeLessThanOrEqual(1)
        expect(urge.strength).toBeGreaterThanOrEqual(1)
        expect(urge.strength).toBeLessThanOrEqual(100)
        expect(urge.ticksTotal, 'the urge has to outlast the work').toBeGreaterThan(
          medium.making.ticksTotal
        )
        const refuses = (medium.making.refusals ?? []).some((r) => r.personaId === persona.id)
        expect(refuses, `'${persona.id}' has the urge to do what it refuses to do`).toBe(false)
      })
    }
  }

  for (const { file, data } of loadJsonFiles(join(CONTENT_ROOT, 'mediums'))) {
    it(`${file}: gameId '${data.making?.gameId}' is a game`, () => {
      expect(
        gameIds.has(data.making?.gameId),
        `${file}: unknown game '${data.making?.gameId}'`
      ).toBe(true)
      for (const refusal of data.making?.refusals ?? []) {
        expect(
          personaIds.has(refusal.personaId),
          `${file}: refusal names unknown persona '${refusal.personaId}'`
        ).toBe(true)
      }
    })
  }
})
