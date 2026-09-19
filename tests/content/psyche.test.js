// @vitest-environment node
// Content contract: content/marks, content/psyche, content/topics — what stays with you.
import { describe, it, expect } from 'vitest'
import { join } from 'path'
import {
  CONTENT_ROOT,
  loadJsonFiles,
  getMapDirs,
  outcomesOf,
  validateMark,
  VALID_STATS,
} from '../helpers/contentContracts.js'
import { tuningContent } from '../helpers/content.js'

const tuning = tuningContent()
const idsOf = (files) => new Set(files.map(({ data }) => data.id))
const markFiles = loadJsonFiles(join(CONTENT_ROOT, 'marks'))
const tableFiles = loadJsonFiles(join(CONTENT_ROOT, 'psyche'))
const topicFiles = loadJsonFiles(join(CONTENT_ROOT, 'topics'))
const marks = Object.fromEntries(markFiles.map(({ data }) => [data.id, data]))
const tables = Object.fromEntries(tableFiles.map(({ data }) => [data.id, data]))
const conditionIds = [...idsOf(loadJsonFiles(join(CONTENT_ROOT, 'conditions')))]
const sober = loadJsonFiles(join(CONTENT_ROOT, 'voices')).find(({ data }) => data.id === 'sober')
const mapDirs = getMapDirs()
const actionFiles = mapDirs.flatMap((dir) => loadJsonFiles(join(dir, 'actions')))
const eventFiles = mapDirs.flatMap((dir) => loadJsonFiles(join(dir, 'events')))
const characterFiles = loadJsonFiles(join(CONTENT_ROOT, 'characters'))

/** Every id a mark's target can name, by kind. */
const registries = {
  location: idsOf(mapDirs.flatMap((dir) => loadJsonFiles(join(dir, 'locations')))),
  character: idsOf(characterFiles),
  item: new Set(
    loadJsonFiles(join(CONTENT_ROOT, 'items')).flatMap(({ data }) => data.map((i) => i.id))
  ),
  substance: idsOf(loadJsonFiles(join(CONTENT_ROOT, 'substances'))),
  condition: new Set(conditionIds),
  topic: idsOf(topicFiles),
}

/** A target, when there is one, is a real thing of a kind that exists. */
function expectTarget({ target, label }) {
  expect(Object.keys(registries), `${label}: target kind '${target.kind}'`).toContain(target.kind)
  expect(registries[target.kind].has(target.id), `${label}: no ${target.kind} '${target.id}'`).toBe(
    true
  )
}

describe('content/marks — what a mark is and does', () => {
  it('there are marks', () => {
    expect(markFiles.length).toBeGreaterThan(0)
  })

  for (const { file, data } of markFiles) {
    it(`${file} — valid mark`, () => {
      validateMark({ data, file, conditionIds })
      expect(file.endsWith(`${data.id}.json`), `${file}: file name must match id`).toBe(true)
    })

    it(`${file} — says what it is, and what its fit is, in words the sober voice has`, () => {
      expect(sober.data.lines, `${file}: lineCode`).toHaveProperty([data.lineCode])
      if (data.fit)
        expect(sober.data.lines, `${file}: fit.lineCode`).toHaveProperty([data.fit.lineCode])
    })
  }
})

describe('content/psyche — the tables a trauma is rolled down', () => {
  for (const { file, data } of tableFiles) {
    it(`${file} — every entry is weighted and leads to a real mark or table`, () => {
      expect(typeof data.id).toBe('string')
      expect(data.entries.length, `${file}: a table needs entries`).toBeGreaterThan(0)
      for (const entry of data.entries) {
        expect(entry.weight, `${file}: weight must be > 0`).toBeGreaterThan(0)
        const leads = [entry.markId, entry.tableId].filter((x) => x !== undefined && x !== null)
        expect(leads, `${file}: an entry is a markId or a tableId, not both`).toHaveLength(1)
        if (entry.markId)
          expect(marks, `${file}: no mark '${entry.markId}'`).toHaveProperty([entry.markId])
        if (entry.tableId) {
          expect(tables, `${file}: no table '${entry.tableId}'`).toHaveProperty([entry.tableId])
        }
      }
    })
  }

  it('every table bottoms out within the depth the engine will go', () => {
    const depthOf = ({ tableId, seen }) => {
      expect(seen, `a loop through '${tableId}'`).not.toContain(tableId)
      const deeper = tables[tableId].entries
        .filter((entry) => entry.tableId)
        .map((entry) => depthOf({ tableId: entry.tableId, seen: [...seen, tableId] }))
      return 1 + Math.max(0, ...deeper)
    }
    for (const tableId of Object.keys(tables)) {
      expect(depthOf({ tableId, seen: [] }), tableId).toBeLessThanOrEqual(
        tuning.psyche.tableDepthMax
      )
    }
  })

  it("a groove's save is on a real stat, down a real table", () => {
    const { groove } = tuning.psyche
    expect(tables).toHaveProperty([groove.tableId])
    expect(VALID_STATS).toContain(groove.save.stat)
    expect(groove.save.dc).toBeGreaterThan(0)
    expect(groove.ticksInCharge).toBeGreaterThan(0)
  })
})

describe('content/topics', () => {
  for (const { file, data } of topicFiles) {
    it(`${file} — has a name`, () => {
      expect(typeof data.id).toBe('string')
      expect(typeof data.display).toBe('string')
      expect(data.display.length).toBeGreaterThan(0)
    })
  }
})

describe('cross-references — marks in the world', () => {
  for (const { file, data } of characterFiles) {
    for (const mark of data.psyche?.marks ?? []) {
      it(`${file}: mark '${mark.markId}' is real, and about something it can be about`, () => {
        const definition = marks[mark.markId]
        expect(definition, `${file}: no mark '${mark.markId}'`).toBeTruthy()
        if (definition.targetKinds.length === 0) {
          expect(mark.target, `${file}: '${mark.markId}' is about nothing`).toBeNull()
          return
        }
        expect(
          definition.targetKinds,
          `${file}: '${mark.markId}' about a ${mark.target?.kind}`
        ).toContain(mark.target?.kind)
        expectTarget({ target: mark.target, label: `${file} '${mark.markId}'` })
      })
    }
  }

  for (const { file, data } of [...actionFiles, ...eventFiles]) {
    for (const entry of data) {
      const required = [
        ...(entry.requirements?.requiredMarkIds ?? []),
        ...(entry.conditions?.requiredMarkIds ?? []),
      ]
      for (const markId of required) {
        it(`${file} '${entry.id}': requires real mark '${markId}'`, () => {
          expect(marks).toHaveProperty([markId])
        })
      }
      for (const topicId of entry.topicIds ?? []) {
        it(`${file} '${entry.id}': topic '${topicId}' is real`, () => {
          expect(registries.topic.has(topicId)).toBe(true)
        })
      }
      for (const outcome of outcomesOf(entry)) {
        if (!outcome.trauma) continue
        it(`${file} '${entry.id}': trauma rolls down a real table, about a real thing`, () => {
          expect(tables).toHaveProperty([outcome.trauma.tableId])
          if (outcome.trauma.target) {
            expectTarget({ target: outcome.trauma.target, label: `${file} '${entry.id}'` })
          }
        })
      }
    }
  }
})
