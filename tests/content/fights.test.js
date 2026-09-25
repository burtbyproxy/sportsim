// @vitest-environment node
// Content contract: content/fights/*.json — how a fight goes.
import { describe, it, expect } from 'vitest'
import { existsSync } from 'fs'
import { join } from 'path'
import {
  CONTENT_ROOT,
  loadJsonFiles,
  validateFight,
  FIGHT_LINE_KEYS,
} from '../helpers/contentContracts.js'

const fightFiles = loadJsonFiles(join(CONTENT_ROOT, 'fights'))
const sober = loadJsonFiles(join(CONTENT_ROOT, 'voices')).find(({ data }) => data.id === 'sober')

describe('content/fights — how a fight goes', () => {
  it('content/fights/ directory exists, and there are fights', () => {
    expect(existsSync(join(CONTENT_ROOT, 'fights'))).toBe(true)
    expect(fightFiles.length).toBeGreaterThan(0)
  })

  for (const { file, data } of fightFiles) {
    it(`${file} — valid fight`, () => {
      validateFight({ data, file })
      expect(file.endsWith(`${data.id}.json`), `${file}: file name must match id`).toBe(true)
    })

    it(`${file} — says how every round went in words the sober voice has`, () => {
      const codes = [
        ...data.jabs.flatMap((jab) => [jab.lineWon, jab.lineLost]),
        data.swing.lineCode,
        data.walk.lineCode,
        ...FIGHT_LINE_KEYS.map((key) => data.lines[key]),
      ]
      for (const code of codes) {
        expect(sober.data.lines, `${file}: no sober line for '${code}'`).toHaveProperty([code])
      }
    })
  }
})
