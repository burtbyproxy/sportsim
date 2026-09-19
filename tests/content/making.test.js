// @vitest-environment node
// Content contract: making — every medium can actually be made in.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join, resolve } from 'path'
import { CONTENT_ROOT, loadJsonFiles, getMapDirs } from '../helpers/contentContracts.js'

describe('making — every medium can actually be made in', () => {
  const mediums = loadJsonFiles(join(CONTENT_ROOT, 'mediums')).map(({ data }) => data)
  const mediumIds = new Set(mediums.map((m) => m.id))
  const items = loadJsonFiles(join(CONTENT_ROOT, 'items')).flatMap(({ data }) =>
    Array.isArray(data) ? data : Object.values(data)
  )
  const locationFiles = getMapDirs().flatMap((mapDir) => loadJsonFiles(join(mapDir, 'locations')))
  const locationSurfaces = locationFiles.flatMap(({ data }) => data.surfaces ?? [])

  for (const { file, data: location } of locationFiles) {
    for (const surface of location.surfaces ?? []) {
      for (const mediumId of surface.mediumIds ?? []) {
        it(`${file} surface '${surface.id}': medium '${mediumId}' exists in medium data`, () => {
          expect(
            mediumIds.has(mediumId),
            `Surface '${surface.id}' names unknown medium '${mediumId}'`
          ).toBe(true)
        })
      }
    }
  }

  for (const medium of mediums) {
    it(`medium '${medium.id}': the world holds what it takes to make one`, () => {
      const takes = (thing) => (thing.mediumIds ?? []).includes(medium.id)
      if (medium.making.toolRequired) {
        expect(
          items.some((i) => i.type === 'tool' && takes(i)),
          `nothing in content/items is a tool for ${medium.id}`
        ).toBe(true)
      }
      if (medium.making.anywhere) {
        // The ground is the surface, so the form must leave nothing on it and every place must read in a sentence.
        expect(
          medium.making.leavesArtifact,
          `${medium.id}: a form done anywhere leaves no artifact`
        ).toBe(false)
        for (const { file, data: location } of locationFiles) {
          expect(
            typeof location.pieceAs,
            `${file}: needs pieceAs — '${medium.id}' can be done here`
          ).toBe('string')
        }
        return
      }
      const surfaces = [...items.filter((i) => i.type === 'surface'), ...locationSurfaces].filter(
        takes
      )
      expect(surfaces.length, `nothing anywhere is a surface for ${medium.id}`).toBeGreaterThan(0)
      if (!medium.making.toolRequired) {
        // Nothing in the hands, so it happens at a place.
        expect(locationSurfaces.some(takes), `no location offers a place for ${medium.id}`).toBe(
          true
        )
      }
    })
  }

  // Every line the code asks the voices for is a line sober can say.
  const sober = JSON.parse(readFileSync(join(CONTENT_ROOT, 'voices', 'sober.json'), 'utf-8'))
  const sources = [
    'src/composables/useGameLoop.js',
    'src/stores/game.js',
    'src/engine/describer.js',
    'src/engine/actions.js',
  ]
  const codes = new Set()
  for (const source of sources) {
    const text = readFileSync(resolve(source), 'utf-8')
    for (const match of text.matchAll(
      /'((?:inspiration|scavenge|item|making|mark|piece|work|requirement|menu|save)\.[a-z_.]+)'/g
    )) {
      codes.add(match[1])
    }
  }
  for (const tier of ['botched', 'rough', 'solid', 'inspired']) codes.add(`piece.artist.${tier}`)
  // ...and every line a game says it will speak.
  const gameLineCodes = (value) =>
    typeof value === 'string' ? [value] : Object.values(value).flatMap(gameLineCodes)
  for (const { data } of loadJsonFiles(join(CONTENT_ROOT, 'games'))) {
    for (const code of gameLineCodes(data.lines ?? {})) codes.add(code)
  }

  it('finds the voice codes the code uses', () => {
    expect(codes.size).toBeGreaterThan(20)
  })
  for (const code of codes) {
    it(`voice code '${code}' has a sober line`, () => {
      expect(sober.lines, `sober.json has no line for '${code}'`).toHaveProperty([code])
    })
  }
})
