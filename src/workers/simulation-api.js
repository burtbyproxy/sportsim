/**
 * Simulation API — Comlink wrapper.
 *
 * Main thread imports this. Provides a wrapped proxy to the simulation
 * worker. Call sim.tick(gameTime) from the main thread.
 *
 * Usage:
 *   import { sim } from './workers/simulation-api.js'
 *   const result = await sim.tick(gameTime)
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
   * @param {import('../engine/clock.js').GameTime} gameTime
   * @returns {Promise<{npcs: Array, events: Array}>}
   */
  tick(gameTime) {
    return getWorker().tick(gameTime)
  },

  /**
   * Terminate the worker (call on app teardown).
   */
  terminate() {
    if (_worker) {
      _worker.terminate()
      _worker = null
      _sim = null
    }
  },
}
