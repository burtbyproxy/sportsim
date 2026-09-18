/**
 * Simulation Worker
 *
 * Runs in a Web Worker thread. Receives game state each tick, runs the
 * three-tier simulation engine, returns character updates.
 *
 * Tier routing is handled inside simulateTick() — this worker just calls it.
 *
 * Message in:  tick(gameTime, characters)
 * Message out: { characters: CharacterUpdate[] }
 *
 * CharacterUpdate: { id: string, locationId: string|null, statusChanges?: Object }
 */
import { expose } from 'comlink'
import { simulateTick } from '../engine/simulation.js'

const simulation = {
  /**
   * Process a tick of the simulation.
   * Routes each character through fixed / routine / full tier logic.
   *
   * @param {import('../engine/clock.js').GameTime} gameTime
   * @param {Object[]} characters - Character objects from game state
   * @returns {{ characters: Array<{id: string, locationId: string|null, statusChanges?: Object}> }}
   */
  tick(gameTime, characters = []) {
    const updates = simulateTick(characters, gameTime)

    return { characters: updates }
  },
}

expose(simulation)
