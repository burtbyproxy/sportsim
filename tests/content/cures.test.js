// @vitest-environment node
// Content contract: content/cures/*.json — how a mark ends.
import { describe, it, expect } from 'vitest'
import { existsSync } from 'fs'
import { join } from 'path'
import { CONTENT_ROOT, loadJsonFiles, validateCure } from '../helpers/contentContracts.js'

const cureFiles = loadJsonFiles(join(CONTENT_ROOT, 'cures'))
const sober = loadJsonFiles(join(CONTENT_ROOT, 'voices')).find(({ data }) => data.id === 'sober')
const tableIds = new Set(loadJsonFiles(join(CONTENT_ROOT, 'psyche')).map(({ data }) => data.id))

describe('content/cures — how a mark ends', () => {
  it('content/cures/ directory exists, and there are cures', () => {
    expect(existsSync(join(CONTENT_ROOT, 'cures'))).toBe(true)
    expect(cureFiles.length).toBeGreaterThan(0)
  })

  it('every cure has its own id', () => {
    const ids = cureFiles.map(({ data }) => data.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('there is a cure for every kind of mark', () => {
    const anyKind = cureFiles.some(({ data }) => data.markKinds.length === 0)
    expect(anyKind, 'a cure that reaches any kind, so nothing is for life by accident').toBe(true)
  })

  for (const { file, data } of cureFiles) {
    it(`${file} — valid cure`, () => {
      validateCure({ data, file })
      expect(file.endsWith(`${data.id}.json`), `${file}: file name must match id`).toBe(true)
    })

    it(`${file} — a risk rolls down a table that exists`, () => {
      if (!data.risk) return
      expect(
        tableIds.has(data.risk.tableId),
        `${file}: no psyche table '${data.risk.tableId}'`
      ).toBe(true)
    })

    it(`${file} — says how a session went in words the sober voice has`, () => {
      for (const code of Object.values(data.lineCodes)) {
        expect(sober.data.lines, `${file}: no sober line for '${code}'`).toHaveProperty([code])
      }
    })
  }
})
