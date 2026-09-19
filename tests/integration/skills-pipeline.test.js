/**
 * Integration: the skill grid at the boundary.
 *
 * Mediums, substances, and conditions come from content/. Doses go in
 * through the store, practice goes through the store, and the assertions are
 * on what the rest of the game reads: the grid on the player, the effective
 * skill under the blend, and an itemized check.
 *
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createPinia, setActivePinia } from 'pinia'
import { useGameStore } from '../../src/stores/game.js'
import { playerCreate } from '../../src/models/player.js'
import { locationCreate } from '../../src/models/location.js'
import { skillEffective, skillCheckRoll } from '../../src/engine/skills.js'
import { saveMigrate, SAVE_VERSION } from '../../src/composables/useSave.js'
import { contentDir, contentIds, tuningContent } from '../helpers/content.js'

const tuning = tuningContent()

const substances = contentDir({ dir: 'content/substances' })
const conditions = contentDir({ dir: 'content/conditions' })
const mediums = contentDir({ dir: 'content/mediums' })
const momsHouse = JSON.parse(
  readFileSync(resolve('content/maps/kenton/locations/moms_house.json'), 'utf-8')
)

function startGame() {
  setActivePinia(createPinia())
  const game = useGameStore()
  game.tuningRegister({ tuning })
  for (const substance of substances) game.substanceRegister({ substance })
  for (const condition of conditions) game.conditionRegister({ condition })
  for (const medium of mediums) game.mediumRegister({ medium })
  game.locationRegister({ location: locationCreate(momsHouse) })
  game.runStart({ player: playerCreate({ name: 'Tester' }), locationId: 'moms_house' })
  return game
}

const effective = ({ game, mediumId }) =>
  skillEffective({ player: game.player, mediumId, mediums: game.mediums }).data.value

describe('skills pipeline', () => {
  it('every medium in content is registered and a new player has an empty grid', () => {
    const game = startGame()
    // One file per medium, named for it: adding a form is adding a file.
    const mediumIdsInContent = contentIds({ dir: 'content/mediums' })
    expect(mediumIdsInContent.length).toBeGreaterThan(0)
    expect(Object.keys(game.mediums).sort()).toEqual(mediumIdsInContent.sort())
    expect(game.player.skills).toEqual({})
    expect(effective({ game, mediumId: 'painting' })).toBe(0)
  })

  it('painting sober trains the sober cell, and only the sober cell', () => {
    const game = startGame()
    const result = game.skillGainApply({ mediumId: 'painting', amount: 8 })
    expect(result.ok).toBe(true)
    expect(game.player.skills.painting).toEqual({ sober: { base: 0, modifiers: [], xp: 8 } })
  })

  it('painting stoned trains painting-stoned; sober painting stays where it was', () => {
    const game = startGame()
    for (let n = 0; n < 5; n++) game.skillGainApply({ mediumId: 'painting', amount: 10 })
    const soberBefore = game.player.skills.painting.sober.base
    expect(soberBefore).toBeGreaterThan(0)

    game.playerDosesApply({ doses: [{ substanceId: 'weed', value: 100 }] })
    for (let n = 0; n < 5; n++) game.skillGainApply({ mediumId: 'painting', amount: 10 })

    expect(game.player.skills.painting.sober.base).toBe(soberBefore)
    expect(game.player.skills.painting.telepath.base).toBeGreaterThan(0)
  })

  it('the effective skill follows the blend, not the best cell', () => {
    const game = startGame()
    for (let n = 0; n < 10; n++) game.skillGainApply({ mediumId: 'carving', amount: 10 })
    const soberCarving = effective({ game, mediumId: 'carving' })
    expect(soberCarving).toBeGreaterThan(0)

    game.playerDosesApply({ doses: [{ substanceId: 'whiskey', value: 100 }] })
    expect(effective({ game, mediumId: 'carving' })).toBe(0) // the priest has never held a knife
    expect(effective({ game, mediumId: 'painting' })).toBe(0) // and carving was never painting
  })

  it('forty whiskey, forty weed, twenty you: practice splits three ways', () => {
    const game = startGame()
    game.playerDosesApply({
      doses: [
        { substanceId: 'whiskey', value: 40 },
        { substanceId: 'weed', value: 40 },
      ],
    })
    const { data } = game.skillGainApply({ mediumId: 'drawing', amount: 10 })
    expect(data.allocations.map((a) => a.xp)).toEqual([4, 4, 2])
    expect(Object.keys(game.player.skills.drawing).sort()).toEqual(['priest', 'sober', 'telepath'])
  })

  it('a check itemizes the skill cells, the stat, and every persona touching it', () => {
    const game = startGame()
    for (let n = 0; n < 5; n++) game.skillGainApply({ mediumId: 'painting', amount: 10 })
    game.playerDosesApply({ doses: [{ substanceId: 'weed', value: 50 }] })
    game.playerStatusApply({ changes: { hunger: -45 } }) // starving joins the blend

    const { data } = skillCheckRoll({
      tuning,
      player: game.player,
      mediumId: 'painting',
      mediums: game.mediums,
      dc: 12,
      modifiers: [{ sourceId: 'found_board', value: 1 }],
      rng: () => 0.5,
    })

    const sources = data.modifierItems.map((i) => `${i.source}:${i.sourceId}`)
    expect(sources).toEqual([
      'skill:telepath',
      'skill:hollow',
      'skill:sober',
      'base:creativity',
      'substance:telepath',
      'condition:hollow',
      'situational:found_board',
    ])
    expect(data.modifierItems.find((i) => i.sourceId === 'found_board').value).toBe(1)
    // weed band 50: creativity +6; starving: creativity +3 — the story can see both
    expect(data.modifierItems.find((i) => i.source === 'substance').value).toBe(6)
    expect(data.modifierItems.find((i) => i.source === 'condition').value).toBe(3)
  })

  it('a v2 save migrates to an empty grid', () => {
    const v2 = {
      id: 'x',
      name: 'x',
      timestamp: 1,
      version: 2,
      player: { id: 'p', status: {}, intoxications: {}, habituations: {} },
      time: {},
      locations: {},
      characters: { maurice: { id: 'maurice', status: {} } },
      firedEventIds: [],
      counters: {},
    }
    const migrated = saveMigrate({ save: v2 })
    expect(migrated.version).toBe(SAVE_VERSION)
    expect(migrated.player.skills).toEqual({})
    expect(migrated.characters.maurice.skills).toEqual({})
    expect(migrated.player.intoxications).toEqual({}) // v2 fields untouched
  })
})
