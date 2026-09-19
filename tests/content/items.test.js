// @vitest-environment node
// Content contract: content/items/*.json — Item contract.
import { describe, it, expect } from 'vitest'
import { existsSync } from 'fs'
import { join } from 'path'
import { CONTENT_ROOT, loadJsonFiles, validateItem } from '../helpers/contentContracts.js'

describe('content/items/*.json — Item contract', () => {
  const itemsDir = join(CONTENT_ROOT, 'items')
  const files = loadJsonFiles(itemsDir)

  it('content/items/ directory exists', () => {
    expect(existsSync(itemsDir)).toBe(true)
  })

  for (const { file, data } of files) {
    // Item files can be arrays or objects keyed by item ID
    const items = Array.isArray(data) ? data : Object.values(data)

    it(`${file} — all items valid`, () => {
      for (const item of items) {
        validateItem({ data: item, file })
      }
    })
  }
})
