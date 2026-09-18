import { describe, it, expect } from 'vitest'
import { template, pickVariant, toNarrativeText } from './text.js'

describe('template', () => {
  it('replaces known variables', () => {
    expect(template('Hello, {{name}}!', { name: 'Portland' })).toBe('Hello, Portland!')
  })

  it('leaves unknown variables untouched', () => {
    expect(template('{{unknown}} is here', {})).toBe('{{unknown}} is here')
  })

  it('handles multiple replacements', () => {
    expect(template('{{a}} and {{b}}', { a: 'beer', b: 'rain' })).toBe('beer and rain')
  })

  it('handles empty string', () => {
    expect(template('', { a: 'x' })).toBe('')
  })

  it('coerces values to strings', () => {
    expect(template('Count: {{n}}', { n: 42 })).toBe('Count: 42')
  })
})

describe('pickVariant', () => {
  const variants = {
    default: 'default text',
    night: 'night text',
    drunk: 'drunk text',
    repeat: 'repeat text',
  }

  it('returns default when no context matches', () => {
    expect(pickVariant(variants, {})).toBe('default text')
  })

  it('matches period key', () => {
    expect(pickVariant(variants, { period: 'night' })).toBe('night text')
  })

  it('matches direct truthy context key', () => {
    expect(pickVariant(variants, { drunk: true })).toBe('drunk text')
  })

  it('ignores falsy context keys', () => {
    expect(pickVariant(variants, { drunk: false, period: 'night' })).toBe('night text')
  })

  it('returns repeat variant when visitCount > 1', () => {
    expect(pickVariant(variants, { visitCount: 3 })).toBe('repeat text')
  })

  it('does NOT return repeat when visitCount is 1', () => {
    expect(pickVariant(variants, { visitCount: 1 })).toBe('default text')
  })

  it('returns empty string when no variants', () => {
    expect(pickVariant(null, {})).toBe('')
  })

  it('returns empty string when no default', () => {
    expect(pickVariant({ night: 'night' }, {})).toBe('')
  })
})

describe('toNarrativeText', () => {
  it('produces a NarrativeText with one token', () => {
    const result = toNarrativeText('hello')
    expect(result.tokens).toHaveLength(1)
    expect(result.tokens[0].text).toBe('hello')
  })

  it('applies default token values', () => {
    const token = toNarrativeText('x').tokens[0]
    expect(token.style).toBe('normal')
    expect(token.color).toBeNull()
    expect(token.speed).toBe('normal')
    expect(token.pauseAfter).toBe(0)
    expect(token.effect).toBe('none')
  })

  it('applies style overrides', () => {
    const token = toNarrativeText('x', { style: 'bold', speed: 'slow', pauseAfter: 500 }).tokens[0]
    expect(token.style).toBe('bold')
    expect(token.speed).toBe('slow')
    expect(token.pauseAfter).toBe(500)
  })
})
