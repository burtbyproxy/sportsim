/**
 * Vocabulary fallbacks — the ONE place code spells out the game's words.
 *
 * The vocabulary is content (content/vocabulary.json): which stats exist,
 * which vitals, which simulation tiers. A running game reads it from there.
 * These lists exist so a model can be built with nothing loaded (tests,
 * workers), and tests/content-validation.test.js fails if they ever drift
 * from the content file. Change the content; then change these to match.
 */

/** Every stat a player or character has. */
export const STAT_IDS_DEFAULT = Object.freeze([
  'stamina',
  'toughness',
  'wits',
  'creativity',
  'charm',
  'reputation',
  'luck',
  'karma',
])

/** Vitals content may change directly. Sobriety is derived; money has its own door. */
export const STATUS_IDS_WRITABLE_DEFAULT = Object.freeze(['hunger', 'energy', 'mood', 'health'])

/** How closely a character is simulated. */
export const SIMULATION_TIERS_DEFAULT = Object.freeze(['fixed', 'routine', 'full'])
