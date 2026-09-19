/**
 * Boot — where the game is put together, and the only caller of the loader.
 *
 * gameBoot registers every definition content holds (once per page).
 * gameNew starts a new game on the configured map; gameResume picks up the
 * latest save. Each returns a result; the screens only say what came of it.
 */
import { useGameStore } from '../stores/game.js'
import { useSave, SAVE_ERROR_CODES } from './useSave.js'
import { contentLoad, CONTENT_KINDS } from '../data/loader.js'
import { resultOk, resultFail } from '../engine/result.js'
import { playerCreate } from '../models/player.js'
import { characterCreate } from '../models/character.js'
import { locationCreate } from '../models/location.js'
import { itemCreate } from '../models/item.js'
import { listSortBy } from '../utils/list.js'

/**
 * Load several kinds of content, stopping at the first that fails.
 * @param {{ load: Function, kinds: string[], mapId?: string }} input
 * @returns {{ ok: boolean, data: Object<string, Object>|null, error: Object|null }}
 */
function contentLoadAll({ load, kinds, mapId }) {
  const loaded = {}
  for (const kind of kinds) {
    const result = load({ kind, mapId })
    if (!result.ok) return result
    loaded[kind] = result.data
  }
  return resultOk(loaded)
}

/**
 * @param {{ load?: (input: { kind: string, mapId?: string }) => Object }} [input]
 *   load — where content comes from: the loader by default; a test can hand
 *   in content that is broken on purpose.
 */
export function useBoot({ load = contentLoad } = {}) {
  const game = useGameStore()
  const save = useSave()

  /**
   * Register what the game is made of: its config and words, and every
   * definition, the map's actions and events included. Definitions are not
   * run state; they persist across new games and loads.
   * @returns {{ ok: boolean, data: { mapId: string }|null, error: Object|null }}
   */
  function gameBoot() {
    const config = load({ kind: CONTENT_KINDS.config })
    if (!config.ok) return config
    const loaded = contentLoadAll({
      load,
      mapId: config.data.mapId,
      kinds: [
        CONTENT_KINDS.vocabulary,
        CONTENT_KINDS.tuning,
        CONTENT_KINDS.items,
        CONTENT_KINDS.substances,
        CONTENT_KINDS.conditions,
        CONTENT_KINDS.mediums,
        CONTENT_KINDS.voices,
        CONTENT_KINDS.scavengeTables,
        CONTENT_KINDS.games,
        CONTENT_KINDS.actions,
        CONTENT_KINDS.events,
      ],
    })
    if (!loaded.ok) return loaded
    const content = loaded.data
    game.configRegister({ config: config.data })
    game.vocabularyRegister({ vocabulary: content[CONTENT_KINDS.vocabulary] })
    game.tuningRegister({ tuning: content[CONTENT_KINDS.tuning] })
    for (const item of Object.values(content[CONTENT_KINDS.items])) {
      game.itemRegister({ item: itemCreate(item) })
    }
    for (const substance of Object.values(content[CONTENT_KINDS.substances])) {
      game.substanceRegister({ substance })
    }
    for (const condition of Object.values(content[CONTENT_KINDS.conditions])) {
      game.conditionRegister({ condition })
    }
    for (const medium of Object.values(content[CONTENT_KINDS.mediums])) {
      game.mediumRegister({ medium })
    }
    for (const voice of Object.values(content[CONTENT_KINDS.voices])) {
      game.voiceRegister({ voice })
    }
    for (const table of Object.values(content[CONTENT_KINDS.scavengeTables])) {
      game.scavengeTableRegister({ table })
    }
    for (const minigame of Object.values(content[CONTENT_KINDS.games])) {
      game.minigameRegister({ minigame })
    }
    for (const action of Object.values(content[CONTENT_KINDS.actions])) {
      game.actionRegister({ action })
    }
    for (const event of Object.values(content[CONTENT_KINDS.events])) {
      game.eventRegister({ event })
    }
    return resultOk({ mapId: config.data.mapId })
  }

  /**
   * A new game: the player as content starts them, on the configured map,
   * with its places and people fresh.
   * @returns {{ ok: boolean, data: { locationId: string }|null, error: Object|null }}
   */
  function gameNew() {
    const { config, vocabulary } = game
    const world = contentLoadAll({
      load,
      mapId: config.mapId,
      kinds: [CONTENT_KINDS.locations, CONTENT_KINDS.characters],
    })
    if (!world.ok) return world
    const player = playerCreate({
      name: config.start.playerName,
      start: {
        ...config.start,
        statIds: vocabulary.stats.map((stat) => stat.id),
      },
    })
    game.runStart({ player, locationId: config.start.locationId })
    for (const location of Object.values(world.data[CONTENT_KINDS.locations])) {
      game.locationRegister({ location: locationCreate(location) })
    }
    for (const character of Object.values(world.data[CONTENT_KINDS.characters])) {
      game.characterRegister({ character: characterCreate(character) })
    }
    return resultOk({ locationId: config.start.locationId })
  }

  /**
   * Pick up the most recent save. What a place is comes from content; the
   * save only knows what happened there.
   * @returns {{ ok: boolean, data: { id: string }|null, error: Object|null }}
   */
  function gameResume() {
    const [latest] = listSortBy({
      items: save.savesList().data,
      keyOf: (entry) => entry.timestamp,
      descending: true,
    })
    if (!latest) {
      return resultFail({ code: SAVE_ERROR_CODES.notFound, message: 'No saves' })
    }
    const read = save.saveRead({ id: latest.id })
    if (!read.ok) return read
    const locations = load({ kind: CONTENT_KINDS.locations, mapId: game.config.mapId })
    if (!locations.ok) return locations
    game.runLoad({ save: read.data })
    game.locationsRestore({ definitions: locations.data })
    return resultOk({ id: latest.id })
  }

  /**
   * Whether there is a save to pick up.
   * @returns {{ ok: true, data: { resumable: boolean }, error: null }}
   */
  function gameResumable() {
    return resultOk({ resumable: save.savesList().data.length > 0 })
  }

  return { gameBoot, gameNew, gameResume, gameResumable }
}
