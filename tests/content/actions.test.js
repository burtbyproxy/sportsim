// @vitest-environment node
// Content contract: content/maps/*/ actions /*.json — Action contract.
import { describe, it, expect } from 'vitest'
import { join } from 'path'
import { loadJsonFiles, getMapDirs, validateAction } from '../helpers/contentContracts.js'

describe('content/maps/*/actions/*.json — Action contract', () => {
  const mapDirs = getMapDirs()
  const allFiles = mapDirs.flatMap((mapDir) => loadJsonFiles(join(mapDir, 'actions')))

  for (const { file, data } of allFiles) {
    // Action files can be arrays or objects (keyed by action ID)
    const actions = Array.isArray(data) ? data : Object.values(data)

    it(`${file} — all actions valid`, () => {
      expect(actions.length, `${file}: must contain at least one action`).toBeGreaterThan(0)
      for (const action of actions) {
        validateAction({ data: action, file })
      }
    })
  }
})
