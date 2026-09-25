/**
 * Simulation API — Comlink wrapper for the main thread.
 *
 * Usage:
 *   import { sim } from './workers/simulation-api.js'
 *   const result = await sim.tick({ gameTime, ticksElapsed, characters, tuning })
 *   // result: { characters: [{id, locationId, statusChanges?, doses?}] }
 */
import { wrap } from 'comlink'

/**
 * Strip reactive proxies, getters, and functions so the value can cross the
 * structured-clone boundary into the worker. The store hands us Pinia proxies;
 * postMessage refuses them with DataCloneError and the whole tick is lost.
 * @param {unknown} value
 * @returns {unknown} a plain, clone-safe copy
 */
export function toPlainSnapshot(value) {
  return JSON.parse(JSON.stringify(value))
}

let workerInstance = null
let simulationRemote = null

function getWorker() {
  if (!workerInstance) {
    workerInstance = new Worker(new URL('./simulation.worker.js', import.meta.url), {
      type: 'module',
    })
    simulationRemote = wrap(workerInstance)
  }
  return simulationRemote
}

export const sim = {
  /**
   * Run one simulation tick in the worker. Same contract as simulation-local.js.
   * @param {{ gameTime: import('../engine/clock.js').GameTime, ticksElapsed?: number, characters: Object[], tuning: Object }} input
   * @returns {Promise<{ characters: Array<{ id: string, locationId: string|null, statusChanges?: Object, doses?: Object[] }> }>}
   */
  tick({ gameTime, ticksElapsed = 1, characters, tuning }) {
    return getWorker().tick({
      tuning: toPlainSnapshot(tuning),
      gameTime: toPlainSnapshot(gameTime),
      ticksElapsed,
      characters: toPlainSnapshot(characters),
    })
  },

  /**
   * Terminate the worker (call on app teardown if needed).
   */
  terminate() {
    if (workerInstance) {
      workerInstance.terminate()
      workerInstance = null
      simulationRemote = null
    }
  },
}
