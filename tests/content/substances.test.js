// @vitest-environment node
// Content contract: content/substances/*.json — Substance contract.
import { describe, it, expect } from 'vitest'
import { existsSync } from 'fs'
import { join } from 'path'
import { CONTENT_ROOT, loadJsonFiles, validateSubstance } from '../helpers/contentContracts.js'

describe('content/substances/*.json — Substance contract', () => {
  const dir = join(CONTENT_ROOT, 'substances')
  const files = loadJsonFiles(dir)

  it('content/substances/ directory exists', () => {
    expect(existsSync(dir)).toBe(true)
  })

  it('has at least one substance', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  const ids = new Set()
  for (const { file, data } of files) {
    it(`${file} — valid Substance`, () => {
      validateSubstance({ data, file })
      expect(ids.has(data.id), `${file}: duplicate substance id '${data.id}'`).toBe(false)
      ids.add(data.id)
    })
  }
})
