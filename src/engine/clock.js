/**
 * Game Clock
 * How long a tick is, when the first day starts, and where the periods of
 * the day begin are content (tuning.json `clock`). Tick 0 is Monday.
 */

const DAYS_OF_WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

/**
 * Minutes of game time in one tick (content/tuning.json `clock.ticksPerHour`).
 * @param {{ tuning: Object }} input
 * @returns {number}
 */
function minutesPerTick({ tuning }) {
  return 60 / tuning.clock.ticksPerHour
}

/**
 * The period of day an hour falls in: the last period (tuning `clock.periods`,
 * in order) that has begun by then.
 * @param {{ hour: number, tuning: Object }} input
 * @returns {string}
 */
function periodAt({ hour, tuning }) {
  let current = tuning.clock.periods[0].id
  for (const period of tuning.clock.periods) {
    if (hour >= period.fromHour) current = period.id
  }
  return current
}

/**
 * A fresh clock at game start: tick 0, the first day, at the start hour.
 * @param {{ tuning: Object }} input
 * @returns {GameTime}
 */
export function clockCreate({ tuning }) {
  return clockAt({ tick: 0, tuning })
}

/**
 * The GameTime an absolute tick count comes to.
 * @param {{ tick: number, tuning: Object }} input
 * @returns {GameTime}
 */
function clockAt({ tick, tuning }) {
  const perTick = minutesPerTick({ tuning })
  const totalMinutes = (tick + tuning.clock.startHour * tuning.clock.ticksPerHour) * perTick
  const totalHours = Math.floor(totalMinutes / 60)
  const hour = totalHours % 24
  return {
    tick,
    day: Math.floor(totalHours / 24) + 1,
    hour,
    minute: totalMinutes % 60,
    period: periodAt({ hour, tuning }),
    dayOfWeek: DAYS_OF_WEEK[Math.floor(totalHours / 24) % 7],
  }
}

/**
 * Advance a GameTime by N ticks.
 * @param {{ gameTime: GameTime, ticks: number, tuning: Object }} input
 * @returns {GameTime}
 */
export function clockAdvance({ gameTime, ticks, tuning }) {
  return clockAt({ tick: gameTime.tick + ticks, tuning })
}

/**
 * Format GameTime as a human-readable string.
 * @param {{ gameTime: GameTime }} input
 * @returns {string} e.g. "Monday 8:00 AM"
 */
export function clockFormat({ gameTime }) {
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

/**
 * A span of ticks as the menu shows it: "15m", "1h", "2h 30m". Nothing for
 * no time at all.
 * @param {{ ticks: number, tuning: Object }} input
 * @returns {string}
 */
export function durationFormat({ ticks, tuning }) {
  if (!ticks) return ''
  const minutes = ticks * minutesPerTick({ tuning })
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const rem = minutes % 60
  return rem > 0 ? `${hours}h ${rem}m` : `${hours}h`
}
