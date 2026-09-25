/**
 * Simulation, in the thread it is called from. The worker exposes exactly
 * this; the game loop takes either, since they keep the same contract.
 *
 * tick: { gameTime, ticksElapsed, characters, tuning } → { characters: CharacterUpdate[] }
 * CharacterUpdate: { id: string, locationId: string|null, statusChanges?: Object, doses?: Object[] }
 */
import { simulationTick } from '../engine/simulation.js'

export const simulationLocal = {
  /**
   * Route each character through its fixed / routine / full tier over the
   * ticks that just passed.
   * @param {{ gameTime: import('../engine/clock.js').GameTime, ticksElapsed?: number, characters: Object[], tuning: Object }} input
   * @returns {{ characters: Array<{ id: string, locationId: string|null, statusChanges?: Object, doses?: Object[] }> }}
   */
  tick({ gameTime, ticksElapsed = 1, characters, tuning }) {
    return { characters: simulationTick({ tuning, characters, gameTime, ticksElapsed }) }
  },
}
