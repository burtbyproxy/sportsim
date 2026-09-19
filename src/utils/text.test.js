import { describe, it, expect } from 'vitest'
import { textFill, textVariantPick, narrativeTextCreate } from './text.js'

describe('textFill', () => {
  it('replaces known variables', () => {
    expect(textFill({ text: 'Hello, {name}!', params: { name: 'Portland' } })).toBe(
      'Hello, Portland!'
    )
  })

  it('leaves unknown variables untouched', () => {
    expect(textFill({ text: '{unknown} is here', params: {} })).toBe('{unknown} is here')
  })

  it('handles multiple replacements', () => {
    expect(textFill({ text: '{a} and {b}', params: { a: 'beer', b: 'rain' } })).toBe(
      'beer and rain'
    )
  })

  it('keeps a placeholder whose value is null or missing, so the gap shows', () => {
    expect(textFill({ text: 'a {x} b {y}', params: { x: null } })).toBe('a {x} b {y}')
  })

  it('handles empty string', () => {
    expect(textFill({ text: '', params: { a: 'x' } })).toBe('')
  })

  it('coerces values to strings', () => {
    expect(textFill({ text: 'Count: {n}', params: { n: 42 } })).toBe('Count: 42')
  })
})

describe('textVariantPick', () => {
  const variants = {
    default: 'default text',
    night: 'night text',
    drunk: 'drunk text',
    repeat: 'repeat text',
  }

  it('returns default when no context matches', () => {
    expect(textVariantPick({ variants, context: {} })).toBe('default text')
  })

  it('matches period key', () => {
    expect(textVariantPick({ variants, context: { period: 'night' } })).toBe('night text')
  })

  it('matches direct truthy context key', () => {
    expect(textVariantPick({ variants, context: { drunk: true } })).toBe('drunk text')
  })

  it('ignores falsy context keys', () => {
    expect(textVariantPick({ variants, context: { drunk: false, period: 'night' } })).toBe(
      'night text'
    )
  })

  it('returns repeat variant when visitCount > 1', () => {
    expect(textVariantPick({ variants, context: { visitCount: 3 } })).toBe('repeat text')
  })

  it('does NOT return repeat when visitCount is 1', () => {
    expect(textVariantPick({ variants, context: { visitCount: 1 } })).toBe('default text')
  })

  it('returns empty string when no variants', () => {
    expect(textVariantPick({ variants: null, context: {} })).toBe('')
  })

  it('returns empty string when no default', () => {
    expect(textVariantPick({ variants: { night: 'night' }, context: {} })).toBe('')
  })
})

describe('narrativeTextCreate', () => {
  it('produces a NarrativeText with one token', () => {
    const result = narrativeTextCreate({ text: 'hello' })
    expect(result.tokens).toHaveLength(1)
    expect(result.tokens[0].text).toBe('hello')
  })

  it('applies default token values', () => {
    const token = narrativeTextCreate({ text: 'x' }).tokens[0]
    expect(token.style).toBe('normal')
    expect(token.color).toBeNull()
    expect(token.speed).toBe('normal')
    expect(token.pauseAfter).toBe(0)
    expect(token.effect).toBe('none')
  })

  it('applies style overrides', () => {
    const token = narrativeTextCreate({
      text: 'x',
      style: { style: 'bold', speed: 'slow', pauseAfter: 500 },
    }).tokens[0]
    expect(token.style).toBe('bold')
    expect(token.speed).toBe('slow')
    expect(token.pauseAfter).toBe(500)
  })
})
