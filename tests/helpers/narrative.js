/**
 * The narrative log as the player would read it, once it has finished typing.
 */
import { vi } from 'vitest'

/**
 * Let the typewriter finish (fake timers) and read every entry back as text.
 * @param {{ narrative: Object }} input - a useNarrative() instance
 * @returns {Promise<string[]>} one string per log entry
 */
export async function narrativeSettle({ narrative }) {
  await vi.advanceTimersByTimeAsync(120000)
  return narrative.log.value.map((entry) => entry.tokens.map((t) => t.rendered).join(''))
}
