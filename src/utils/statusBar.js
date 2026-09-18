/**
 * Status bar — what the vitals panel shows and when a bar turns colour.
 * Pure. The panel renders this; it decides nothing.
 */

/** The vitals, in display order. Full words, never abbreviations. */
export const STATUS_BAR_STATS = Object.freeze([
  Object.freeze({ key: 'health', label: 'Health', icon: '♥' }),
  Object.freeze({ key: 'energy', label: 'Energy', icon: '⚡' }),
  Object.freeze({ key: 'mood', label: 'Mood', icon: '◈' }),
  Object.freeze({ key: 'sobriety', label: 'Sobriety', icon: '◎' }),
  Object.freeze({ key: 'hunger', label: 'Hunger', icon: '◆' }),
])

const FILL_DANGER = 'status-stat__fill--danger'
const FILL_WARNING = 'status-stat__fill--warning'

/** Where each bar turns. Sobriety warns early: half drunk is already news. */
const FILL_THRESHOLDS = Object.freeze({
  sobriety: Object.freeze({ danger: 25, warning: 50 }),
  default: Object.freeze({ danger: 20, warning: 40 }),
})

/**
 * The colour class for a vitals bar at a value, or '' when it is fine.
 * @param {{ key: string, value: number }} input
 * @returns {string}
 */
export function statusBarFillClass({ key, value }) {
  const { danger, warning } = FILL_THRESHOLDS[key] ?? FILL_THRESHOLDS.default
  if (value <= danger) return FILL_DANGER
  if (value <= warning) return FILL_WARNING
  return ''
}
