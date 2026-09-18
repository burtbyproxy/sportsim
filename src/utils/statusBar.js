/**
 * Status bar — when a vitals bar turns colour.
 * Pure. Which vitals exist, what they are called and where each one turns is
 * content (content/vocabulary.json `statuses`); the store assembles the bars
 * and the panel renders them.
 */

const FILL_DANGER = 'status-stat__fill--danger'
const FILL_WARNING = 'status-stat__fill--warning'

/**
 * The colour class for a vitals bar at a value, or '' when it is fine.
 * @param {{ value: number, danger: number, warning: number }} input
 * @returns {string}
 */
export function statusBarFillClass({ value, danger, warning }) {
  if (value <= danger) return FILL_DANGER
  if (value <= warning) return FILL_WARNING
  return ''
}
