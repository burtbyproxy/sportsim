// @vitest-environment node
// Content contract: content/conditions/*.json — Condition contract.
import { describe, it, expect } from 'vitest'
import { existsSync } from 'fs'
import { join } from 'path'
import { CONTENT_ROOT, loadJsonFiles, validateCondition } from '../helpers/contentContracts.js'

describe('content/conditions/*.json — Condition contract', () => {
  const dir = join(CONTENT_ROOT, 'conditions')
  const files = loadJsonFiles(dir)

  it('content/conditions/ directory exists', () => {
    expect(existsSync(dir)).toBe(true)
  })

  const ids = new Set()
  for (const { file, data } of files) {
    it(`${file} — valid Condition`, () => {
      validateCondition({ data, file })
      expect(ids.has(data.id), `${file}: duplicate condition id '${data.id}'`).toBe(false)
      ids.add(data.id)
    })
  }
})
