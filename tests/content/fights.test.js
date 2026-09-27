// @vitest-environment node
// Content contract: content/fights/*.json — how a fight goes.
import { describe, it, expect } from 'vitest'
import { existsSync } from 'fs'
import { join } from 'path'
import {
  CONTENT_ROOT,
  loadJsonFiles,
  validateFight,
  fightLineCodes,
} from '../helpers/contentContracts.js'

const fightFiles = loadJsonFiles(join(CONTENT_ROOT, 'fights'))
const sober = loadJsonFiles(join(CONTENT_ROOT, 'voices')).find(({ data }) => data.id === 'sober')

/** Every persona anything can put in charge: the same list the voices are held to. */
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

    it(`${file} — every compulsion is a persona something can put in charge`, () => {
      for (const compulsion of data.compulsions) {
        expect(
          personaIds.has(compulsion.personaId),
          `${file}: persona '${compulsion.personaId}'`
        ).toBe(true)
      }
    })

    it(`${file} — says how every round went in words the sober voice has`, () => {
      for (const code of fightLineCodes({ data })) {
        expect(sober.data.lines, `${file}: no sober line for '${code}'`).toHaveProperty([code])
      }
    })
  }
})
