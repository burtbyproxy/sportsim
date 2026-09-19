// @vitest-environment node
// Content contract: content/maps/*/ locations /*.json — Location contract.
import { describe, it, expect } from 'vitest'
import { existsSync } from 'fs'
import { join } from 'path'
import {
  CONTENT_ROOT,
  loadJsonFiles,
  getMapDirs,
  validateLocation,
} from '../helpers/contentContracts.js'

describe('content/maps/*/locations/*.json — Location contract', () => {
  const mapDirs = getMapDirs()
  const allFiles = mapDirs.flatMap((mapDir) => loadJsonFiles(join(mapDir, 'locations')))

  it('content/maps/ directory exists', () => {
    expect(existsSync(join(CONTENT_ROOT, 'maps'))).toBe(true)
  })

  for (const { file, data } of allFiles) {
    it(`${file} — valid Location`, () => {
      validateLocation({ data, file })
    })
  }
})
