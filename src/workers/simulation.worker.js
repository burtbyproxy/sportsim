/**
 * Simulation Worker
 *
 * Runs in a Web Worker thread. Accepts game time ticks and returns
 * NPC movement and event results. Real simulation logic comes from
 * Bones in Phase 3. This is a stub.
 */
import { expose } from 'comlink'

const simulation = {
  /**
   * Process a tick of the simulation.
   * @param {import('../engine/clock.js').GameTime} gameTime
   * @returns {{ npcs: Array, events: Array }}
   */
  tick(gameTime) {
    // Stub: return empty results until Bones wires in real simulation
    return {
      npcs: [],
      events: [],
    }
  },
}

expose(simulation)
