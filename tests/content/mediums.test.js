// @vitest-environment node
// Content contract: content/mediums/*.json — Medium contract.
import { describe, it, expect } from 'vitest'
import { existsSync } from 'fs'
import { join } from 'path'
import { CONTENT_ROOT, loadJsonFiles, validateMedium } from '../helpers/contentContracts.js'

describe('content/mediums/*.json — Medium contract', () => {
  const dir = join(CONTENT_ROOT, 'mediums')
  const files = loadJsonFiles(dir)

  it('content/mediums/ directory exists', () => {
    expect(existsSync(dir)).toBe(true)
  })

  it('has at least one medium', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  const ids = new Set()
  for (const { file, data } of files) {
    it(`${file} — valid Medium`, () => {
      validateMedium({ data, file })
      expect(ids.has(data.id), `${file}: duplicate medium id '${data.id}'`).toBe(false)
      ids.add(data.id)
    })
  }
})
