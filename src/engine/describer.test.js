import { describe, it, expect } from 'vitest'
import { DESCRIBER_ERROR_CODES, pieceDescribe } from './describer.js'

const voices = {
  sober: {
    id: 'sober',
    lines: {
      'piece.work': '{medium}, {tool} {surface}',
      'piece.work.ingredient': '{medium}, {tool} and {ingredient} {surface}',
      'piece.work.bare': '{medium} {surface}',
      'piece.artist.solid': 'Done: {work}. Close.',
      'piece.artist.rough': 'Done: {work}. Not it.',
      'piece.artist.inspired': 'Done: {work}. Exactly it.',
      'piece.artist.botched': 'It was going to be {work}.',
    },
  },
  telepath: { id: 'telepath', lines: { 'piece.artist.rough': 'Done: {work}. Genius.' } },
}

const medium = { pieceAs: 'a painting' }
const tool = { pieceAs: 'watercolour' }
const surface = { pieceAs: 'on a cabinet door' }
const ingredient = { pieceAs: 'Brut' }

describe('pieceDescribe', () => {
  it('assembles the piece from one fragment per part, then says how it came out', () => {
    const result = pieceDescribe({
      tier: 'solid',
      medium,
      tool,
      surface,
      personaId: 'sober',
      voices,
    })
    expect(result.data.workText).toBe('a painting, watercolour on a cabinet door')
    expect(result.data.artistText).toBe('Done: a painting, watercolour on a cabinet door. Close.')
  })

  it('works the ingredient into the sentence', () => {
    const result = pieceDescribe({
      tier: 'solid',
      medium,
      tool,
      surface,
      ingredient,
      personaId: 'sober',
      voices,
    })
    expect(result.data.workText).toBe('a painting, watercolour and Brut on a cabinet door')
  })

  it('a piece with no tool is the medium and the place', () => {
    const result = pieceDescribe({
      tier: 'inspired',
      medium: { pieceAs: 'a performance' },
      surface: { pieceAs: 'under the elk' },
      personaId: 'sober',
      voices,
    })
    expect(result.data.artistText).toBe('Done: a performance under the elk. Exactly it.')
  })

  it('the persona in charge says how it came out; sober covers what they have no line for', () => {
    const rough = pieceDescribe({
      tier: 'rough',
      medium,
      tool,
      surface,
      personaId: 'telepath',
      voices,
    })
    expect(rough.data.artistText).toBe('Done: a painting, watercolour on a cabinet door. Genius.')
    expect(rough.data.personaId).toBe('telepath')
    const solid = pieceDescribe({
      tier: 'solid',
      medium,
      tool,
      surface,
      personaId: 'telepath',
      voices,
    })
    expect(solid.data.personaId).toBe('sober')
  })

  it.each([
    {
      name: 'an unknown tier',
      override: { tier: 'masterpiece' },
      code: DESCRIBER_ERROR_CODES.tierUnknown,
    },
    {
      name: 'a part with no phrase',
      override: { surface: { id: 'wall' } },
      code: DESCRIBER_ERROR_CODES.partMissing,
    },
    {
      name: 'an ingredient with no tool',
      override: { tool: null, ingredient },
      code: DESCRIBER_ERROR_CODES.partMissing,
    },
    {
      name: 'voices with no line for it',
      override: { voices: { sober: { id: 'sober', lines: {} } } },
      code: DESCRIBER_ERROR_CODES.lineMissing,
    },
  ])('refuses $name', ({ override, code }) => {
    const result = pieceDescribe({
      tier: 'solid',
      medium,
      tool,
      surface,
      personaId: 'sober',
      voices,
      ...override,
    })
    expect(result.ok).toBe(false)
    expect(result.error.code).toBe(code)
  })
})
