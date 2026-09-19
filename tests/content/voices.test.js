// @vitest-environment node
// Content contract: content/voices/*.json — Voice catalog contract.
import { describe, it, expect } from 'vitest'
import { existsSync } from 'fs'
import { join } from 'path'
import { CONTENT_ROOT, loadJsonFiles } from '../helpers/contentContracts.js'

describe('content/voices/*.json — Voice catalog contract', () => {
  const dir = join(CONTENT_ROOT, 'voices')
  const files = loadJsonFiles(dir)
  const sober = files.find(({ data }) => data.id === 'sober')

  it('content/voices/ directory exists and has a sober catalog', () => {
    expect(existsSync(dir)).toBe(true)
    expect(sober, 'content/voices/sober.json is the fallback for every line').toBeTruthy()
  })

  // Every persona any substance, withdrawal, or condition can put in charge
  const personaIds = new Set(['sober'])
  for (const { data } of loadJsonFiles(join(CONTENT_ROOT, 'substances'))) {
    personaIds.add(data.persona?.id)
    if (data.withdrawal) personaIds.add(data.withdrawal.persona?.id)
  }
  for (const { data } of loadJsonFiles(join(CONTENT_ROOT, 'conditions'))) {
    personaIds.add(data.persona?.id)
  }
  for (const { data } of loadJsonFiles(join(CONTENT_ROOT, 'marks'))) {
    if (data.fit) personaIds.add(data.fit.persona?.id)
  }

  for (const { file, data } of files) {
    it(`${file} — valid voice catalog`, () => {
      expect(typeof data.id, `${file}: id must be string`).toBe('string')
      expect(
        file.endsWith(`${data.id}.json`),
        `${file}: file name must match id '${data.id}'`
      ).toBe(true)
      expect(
        personaIds.has(data.id),
        `${file}: '${data.id}' is not a persona anything can put in charge`
      ).toBe(true)
      expect(data.lines && typeof data.lines === 'object', `${file}: lines must be an object`).toBe(
        true
      )
      for (const [code, text] of Object.entries(data.lines)) {
        expect(typeof text, `${file}: line '${code}' must be a string`).toBe('string')
        expect(text.length, `${file}: line '${code}' must not be empty`).toBeGreaterThan(0)
        // A persona can only re-voice a line sober already has, so the fallback always exists.
        expect(sober.data.lines, `${file}: code '${code}' has no sober fallback`).toHaveProperty([
          code,
        ])
      }
    })
  }
})
