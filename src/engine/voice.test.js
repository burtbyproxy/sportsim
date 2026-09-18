import { describe, it, expect } from 'vitest'
import { voiceLine, VOICE_ERROR_CODES } from './voice.js'

const voices = {
  sober: {
    id: 'sober',
    lines: {
      'inspiration.struck': 'Something catches.',
      'inspiration.expired': 'Whatever it was, it is gone.',
    },
  },
  priest: {
    id: 'priest',
    lines: {
      'inspiration.struck': 'The Lord has a job for you.',
    },
  },
}

describe('voiceLine', () => {
  it('speaks in the voice of the persona in charge', () => {
    const { data } = voiceLine({ code: 'inspiration.struck', personaId: 'priest', voices })
    expect(data).toEqual({ text: 'The Lord has a job for you.', personaId: 'priest' })
  })

  it('falls back to sober when the persona has no line for the code', () => {
    const { data } = voiceLine({ code: 'inspiration.expired', personaId: 'priest', voices })
    expect(data).toEqual({ text: 'Whatever it was, it is gone.', personaId: 'sober' })
  })

  it('falls back to sober for a persona with no catalog at all', () => {
    const { data } = voiceLine({ code: 'inspiration.struck', personaId: 'telepath', voices })
    expect(data.personaId).toBe('sober')
  })

  it('defaults to sober when no persona is given', () => {
    expect(voiceLine({ code: 'inspiration.struck', voices }).data.text).toBe('Something catches.')
  })

  it('a code nobody has a line for is an error', () => {
    const result = voiceLine({ code: 'inspiration.nope', personaId: 'priest', voices })
    expect(result.ok).toBe(false)
    expect(result.error.code).toBe(VOICE_ERROR_CODES.CODE_UNKNOWN)
  })

  it('a catalog without a sober voice cannot speak', () => {
    const result = voiceLine({
      code: 'inspiration.struck',
      personaId: 'priest',
      voices: { priest: voices.priest },
    })
    expect(result.error.code).toBe(VOICE_ERROR_CODES.SOBER_MISSING)
  })
})
