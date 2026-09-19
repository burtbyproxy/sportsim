// @vitest-environment node
// Content contract: content/characters/*.json — Character contract.
import { describe, it, expect } from 'vitest'
import { existsSync } from 'fs'
import { join } from 'path'
import { CONTENT_ROOT, loadJsonFiles, validateCharacter } from '../helpers/contentContracts.js'

describe('content/characters/*.json — Character contract', () => {
  const charactersDir = join(CONTENT_ROOT, 'characters')
  const files = loadJsonFiles(charactersDir)

  it('content/characters/ directory exists', () => {
    expect(existsSync(charactersDir)).toBe(true)
  })

  for (const { file, data } of files) {
    it(`${file} — valid Character`, () => {
      validateCharacter({ data, file })
    })

    it(`${file} — has at least one schedule entry`, () => {
      expect(
        data.schedule?.entries?.length ?? 0,
        `${file}: character must have at least one schedule entry`
      ).toBeGreaterThan(0)
    })
  }
})
