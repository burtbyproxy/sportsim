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

/**
 * Load several kinds of content, stopping at the first that fails.
 * @param {{ load: Function, kinds: string[], mapId?: string }} input
 * @returns {{ ok: boolean, data: Object<string, Object>|null, error: Object|null }}
 */
function _contentLoadAll({ load, kinds, mapId }) {
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
    const config = load({ kind: CONTENT_KINDS.CONFIG })
    if (!config.ok) return config
    const loaded = _contentLoadAll({
      load,
      mapId: config.data.mapId,
      kinds: [
        CONTENT_KINDS.VOCABULARY,
        CONTENT_KINDS.ITEMS,
        CONTENT_KINDS.SUBSTANCES,
        CONTENT_KINDS.CONDITIONS,
        CONTENT_KINDS.MEDIUMS,
        CONTENT_KINDS.VOICES,
        CONTENT_KINDS.SCAVENGE_TABLES,
        CONTENT_KINDS.GAMES,
        CONTENT_KINDS.ACTIONS,
        CONTENT_KINDS.EVENTS,
      ],
    })
    if (!loaded.ok) return loaded
    const content = loaded.data
    game.registerConfig({ config: config.data })
    game.registerVocabulary({ vocabulary: content[CONTENT_KINDS.VOCABULARY] })
    for (const item of Object.values(content[CONTENT_KINDS.ITEMS])) {
      game.registerItem(itemCreate(item))
    }
    for (const substance of Object.values(content[CONTENT_KINDS.SUBSTANCES])) {
      game.registerSubstance({ substance })
    }
    for (const condition of Object.values(content[CONTENT_KINDS.CONDITIONS])) {
      game.registerCondition({ condition })
    }
    for (const medium of Object.values(content[CONTENT_KINDS.MEDIUMS])) {
      game.registerMedium({ medium })
    }
    for (const voice of Object.values(content[CONTENT_KINDS.VOICES])) {
      game.registerVoice({ voice })
    }
    for (const table of Object.values(content[CONTENT_KINDS.SCAVENGE_TABLES])) {
      game.registerScavengeTable({ table })
    }
    for (const minigame of Object.values(content[CONTENT_KINDS.GAMES])) {
      game.registerGame({ game: minigame })
    }
    for (const action of Object.values(content[CONTENT_KINDS.ACTIONS])) {
      game.registerAction({ action })
    }
    for (const event of Object.values(content[CONTENT_KINDS.EVENTS])) {
      game.registerEvent({ event })
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
    const world = _contentLoadAll({
      load,
      mapId: config.mapId,
      kinds: [CONTENT_KINDS.LOCATIONS, CONTENT_KINDS.CHARACTERS],
    })
    if (!world.ok) return world
    const player = playerCreate({
      name: config.start.playerName,
      start: {
        ...config.start,
        statIds: vocabulary.stats.map((stat) => stat.id),
      },
    })
    game.startNewGame(player, config.start.locationId)
    for (const location of Object.values(world.data[CONTENT_KINDS.LOCATIONS])) {
      game.registerLocation(locationCreate(location))
    }
    for (const character of Object.values(world.data[CONTENT_KINDS.CHARACTERS])) {
      game.registerCharacter(characterCreate(character))
    }
    return resultOk({ locationId: config.start.locationId })
  }

  /**
   * Pick up the most recent save. What a place is comes from content; the
   * save only knows what happened there.
   * @returns {{ ok: boolean, data: { id: string }|null, error: Object|null }}
   */
  function gameResume() {
    const [latest] = [...save.savesList().data].sort((a, b) => b.timestamp - a.timestamp)
    if (!latest) {
      return resultFail({ code: SAVE_ERROR_CODES.NOT_FOUND, message: 'No saves' })
    }
    const read = save.saveRead({ id: latest.id })
    if (!read.ok) return read
    const locations = load({ kind: CONTENT_KINDS.LOCATIONS, mapId: game.config.mapId })
    if (!locations.ok) return locations
    game.loadSave(read.data)
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
