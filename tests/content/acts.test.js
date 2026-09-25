// @vitest-environment node
// Content contract: content/acts/*.json — what people start on their own.
import { describe, it, expect } from 'vitest'
import { existsSync } from 'fs'
import { join } from 'path'
import {
  CONTENT_ROOT,
  loadJsonFiles,
  getMapDirs,
  validateAct,
} from '../helpers/contentContracts.js'
import { ACT_AUTHOR_KINDS, ACT_RECIPIENT_KINDS } from '../../src/engine/acts.js'
import { MARK_TARGET_KINDS } from '../../src/engine/psyche.js'

const idsOf = (files) => new Set(files.map(({ data }) => data.id))
const actFiles = loadJsonFiles(join(CONTENT_ROOT, 'acts'))
const markFiles = loadJsonFiles(join(CONTENT_ROOT, 'marks'))
const marks = Object.fromEntries(markFiles.map(({ data }) => [data.id, data]))
const characterIds = idsOf(loadJsonFiles(join(CONTENT_ROOT, 'characters')))
const sober = loadJsonFiles(join(CONTENT_ROOT, 'voices')).find(({ data }) => data.id === 'sober')
const conditionIds = idsOf(loadJsonFiles(join(CONTENT_ROOT, 'conditions')))

/** Every persona anything can put in charge: the same list the voices are held to. */
const personaIds = new Set(['sober'])
for (const { data } of loadJsonFiles(join(CONTENT_ROOT, 'substances'))) {
  personaIds.add(data.persona?.id)
  if (data.withdrawal) personaIds.add(data.withdrawal.persona?.id)
}
for (const { data } of loadJsonFiles(join(CONTENT_ROOT, 'conditions'))) {
  personaIds.add(data.persona?.id)
}
for (const { data } of markFiles) {
  if (data.fit) personaIds.add(data.fit.persona?.id)
}

/** Where an author's id has to be found, by kind. */
const authors = {
  [ACT_AUTHOR_KINDS.character]: characterIds,
  [ACT_AUTHOR_KINDS.persona]: personaIds,
  [ACT_AUTHOR_KINDS.mark]: new Set(Object.keys(marks)),
}

describe('content/acts — what people start on their own', () => {
  it('content/acts/ directory exists, and there are acts', () => {
    expect(existsSync(join(CONTENT_ROOT, 'acts'))).toBe(true)
    expect(actFiles.length).toBeGreaterThan(0)
  })

  it('every act has its own id', () => {
    const ids = actFiles.map(({ data }) => data.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  // The map's events live under the map; acts are about people, not places.
  it('no map keeps acts of its own', () => {
    for (const mapDir of getMapDirs()) {
      expect(existsSync(join(mapDir, 'acts')), `${mapDir}: acts are not a map's`).toBe(false)
    }
  })

  for (const { file, data } of actFiles) {
    it(`${file} — valid act`, () => {
      validateAct({ data, file })
      expect(file.endsWith(`${data.id}.json`), `${file}: file name must match id`).toBe(true)
    })

    it(`${file} — is authored by somebody real`, () => {
      const known = authors[data.author.kind]
      expect(known.has(data.author.id), `${file}: no ${data.author.kind} '${data.author.id}'`).toBe(
        true
      )
    })

    it(`${file} — a mark author has a fit to be in, and a target when it needs one`, () => {
      if (data.author.kind !== ACT_AUTHOR_KINDS.mark) return
      const mark = marks[data.author.id]
      expect(
        mark.fit,
        `${file}: mark '${mark.id}' never goes off, so nobody is ever in its fit`
      ).toBeTruthy()
      if (data.to === ACT_RECIPIENT_KINDS.target) {
        expect(
          mark.targetKinds,
          `${file}: mark '${mark.id}' is never about a person to do it to`
        ).toContain(MARK_TARGET_KINDS.character)
      }
    })

    it(`${file} — a condition trigger names a real condition`, () => {
      if (data.trigger?.kind !== 'condition') return
      expect(conditionIds.has(data.trigger.conditionId), `${file}: no condition`).toBe(true)
    })

    it(`${file} — says what happens in words the sober voice has`, () => {
      for (const branch of [data.success, data.failure].filter(Boolean)) {
        for (const code of [branch.lineCode, branch.lineCodeOthers].filter(Boolean)) {
          expect(sober.data.lines, `${file}: no sober line for '${code}'`).toHaveProperty([code])
        }
      }
    })
  }
})
