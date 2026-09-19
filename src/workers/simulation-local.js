/**
 * Simulation, in the thread it is called from. The worker exposes exactly
 * this; the game loop takes either, since they keep the same contract.
 *
 * tick: { gameTime, characters } → { characters: CharacterUpdate[] }
 * CharacterUpdate: { id: string, locationId: string|null, statusChanges?: Object }
 */
import { simulationTick } from '../engine/simulation.js'

export const simulationLocal = {
  /**
   * Route each character through its fixed / routine / full tier for one tick.
   * @param {{ gameTime: import('../engine/clock.js').GameTime, characters: Object[], tuning: Object }} input
   * @returns {{ characters: Array<{ id: string, locationId: string|null, statusChanges?: Object }> }}
   */
  tick({ gameTime, characters, tuning }) {
    return { characters: simulationTick({ tuning, characters, gameTime }) }
  },
}
