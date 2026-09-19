// @vitest-environment node
// Content contract: content/maps/*/ events /*.json — Event contract.
import { describe, it, expect } from 'vitest'
import { join } from 'path'
import { loadJsonFiles, getMapDirs, validateEvent } from '../helpers/contentContracts.js'

describe('content/maps/*/events/*.json — Event contract', () => {
  const ids = new Set()
  for (const mapDir of getMapDirs()) {
    const dir = join(mapDir, 'events')
    for (const { file, data } of loadJsonFiles(dir)) {
      const events = Array.isArray(data) ? data : Object.values(data)
      for (const event of events) {
        it(`${file}: event '${event.id}' honours the contract`, () => {
          validateEvent({ data: event, file })
          expect(ids.has(event.id), `${file}: duplicate event id '${event.id}'`).toBe(false)
          ids.add(event.id)
        })
      }
    }
  }
})
