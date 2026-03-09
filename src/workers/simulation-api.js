/**
 * Simulation API — Comlink wrapper for the main thread.
 *
 * Usage:
 *   import { sim } from './workers/simulation-api.js'
 *   const result = await sim.tick(gameTime, characters)
 *   // result: { characters: [{id, locationId, statusChanges?}], events: [] }
 */
import { wrap } from 'comlink'

let _worker = null
let _sim = null

function getWorker() {
  if (!_worker) {
    _worker = new Worker(new URL('./simulation.worker.js', import.meta.url), {
      type: 'module',
    })
    _sim = wrap(_worker)
  }
  return _sim
}

export const sim = {
  /**
   * Run one simulation tick.
   * @param {import('../engine/clock.js').GameTime} gameTime
   * @param {Object[]} characters - Character objects from game store
   * @returns {Promise<{
   *   characters: Array<{id: string, locationId: string|null, statusChanges?: Object}>,
   *   events: Array
   * }>}
   */
  tick(gameTime, characters = []) {
    return getWorker().tick(gameTime, characters)
  },

  /**
   * Terminate the worker (call on app teardown if needed).
   */
  terminate() {
    if (_worker) {
      _worker.terminate()
      _worker = null
      _sim = null
    }
  },
}
