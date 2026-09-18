/**
 * Game Clock
 * Tick granularity: 15 minutes per tick.
 * Day starts at tick 0 = Monday, 8:00 AM.
 */

const TICKS_PER_HOUR = 4

const DAYS_OF_WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

const MINUTES = [0, 15, 30, 45]

/** Starting hour offset — game starts at 8:00 AM */
const START_HOUR = 8
const START_TICK_OFFSET = START_HOUR * TICKS_PER_HOUR

/**
 * Determine the period of day from hour.
 * @param {number} hour - 0-23
 * @returns {string}
 */
function getPeriod(hour) {
  if (hour >= 5 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 17) return 'afternoon'
  if (hour >= 17 && hour < 21) return 'evening'
  if (hour >= 21 && hour < 24) return 'night'
  return 'late_night' // 0-4
}

/**
 * Create a fresh clock at game start (Monday 8:00 AM, tick 0).
 * @returns {GameTime}
 */
export function createClock() {
  return ticksToGameTime(0)
}

/**
 * Convert absolute tick count to a GameTime object.
 * @param {number} tick
 * @returns {GameTime}
 */
function ticksToGameTime(tick) {
  const adjustedTick = tick + START_TICK_OFFSET

  const totalMinutes = adjustedTick * 15
  const totalHours = Math.floor(totalMinutes / 60)

  const hour = totalHours % 24
  const minute = MINUTES[adjustedTick % TICKS_PER_HOUR]
  const dayIndex = Math.floor(totalHours / 24) % 7
  const day = Math.floor(totalHours / 24) + 1 // 1-indexed

  return {
    tick,
    day,
    hour,
    minute,
    period: getPeriod(hour),
    dayOfWeek: DAYS_OF_WEEK[dayIndex],
  }
}

/**
 * Advance a GameTime by N ticks.
 * @param {GameTime} gameTime
 * @param {number} ticks
 * @returns {GameTime}
 */
export function advanceClock(gameTime, ticks) {
  return ticksToGameTime(gameTime.tick + ticks)
}

/**
 * Format GameTime as a human-readable string.
 * @param {GameTime} gameTime
 * @returns {string} e.g. "Monday 8:00 AM"
 */
export function formatTime(gameTime) {
  const { hour, minute, dayOfWeek } = gameTime
  const h = hour % 12 || 12
  const m = String(minute).padStart(2, '0')
  const ampm = hour < 12 ? 'AM' : 'PM'
  const day = dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1)
  return `${day} ${h}:${m} ${ampm}`
}

/**
 * @typedef {Object} GameTime
 * @property {number} tick - total ticks since game start
 * @property {number} day - current day number (1-indexed)
 * @property {number} hour - 0-23
 * @property {number} minute - 0, 15, 30, or 45
 * @property {string} period - "morning" | "afternoon" | "evening" | "night" | "late_night"
 * @property {string} dayOfWeek - "monday" through "sunday"
 */
