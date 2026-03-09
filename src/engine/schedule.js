/**
 * Schedule Resolution — shared across all simulation tiers.
 * Pure functions. No side effects. No Vue. No DOM.
 */

/**
 * Returns true if `hour` falls within a schedule entry's time window.
 * Handles midnight crossover: if endHour < startHour, the window spans midnight.
 *
 * Examples:
 *   startHour=16, endHour=2  → active from 16:00 to 02:00 (bar shift)
 *   startHour=8,  endHour=17 → active from 08:00 to 17:00
 *
 * endHour is exclusive: a window ending at 2 expires at 02:00 (i.e. hour must be < 2).
 *
 * @param {Object} entry - ScheduleEntry
 * @param {number} hour - 0-23
 * @returns {boolean}
 */
export function isHourInWindow(entry, hour) {
  const { startHour, endHour } = entry
  if (startHour === endHour) return false // zero-length window
  if (startHour < endHour) {
    // Normal window: does not cross midnight
    return hour >= startHour && hour < endHour
  } else {
    // Crosses midnight: active from startHour to 24, and from 0 to endHour
    return hour >= startHour || hour < endHour
  }
}

/**
 * Returns true if the schedule entry applies to a given day of week.
 * @param {Object} entry - ScheduleEntry
 * @param {string} dayOfWeek - "monday" through "sunday"
 * @returns {boolean}
 */
export function entryMatchesDay(entry, dayOfWeek) {
  if (!entry.days || entry.days.length === 0) return false
  return entry.days.includes('all') || entry.days.includes(dayOfWeek)
}

/**
 * Resolves a character's schedule to find the matching entry for the current time.
 * Returns the first matching entry (entries should not overlap; first match wins).
 * Returns null if no entry matches.
 *
 * @param {Object} schedule - CharacterSchedule ({ entries: ScheduleEntry[] })
 * @param {number} hour - 0-23
 * @param {string} dayOfWeek
 * @returns {Object|null} - ScheduleEntry or null
 */
export function resolveSchedule(schedule, hour, dayOfWeek) {
  if (!schedule || !schedule.entries || schedule.entries.length === 0) return null
  for (const entry of schedule.entries) {
    if (entryMatchesDay(entry, dayOfWeek) && isHourInWindow(entry, hour)) {
      return entry
    }
  }
  return null
}

/**
 * Returns true if a character is between schedule stops (in transit).
 * A character is in transit when the current time is past their current stop's endHour
 * but within the travel window before their next stop's startHour.
 *
 * For routine and full simulation only — fixed characters are either there or not.
 *
 * @param {Object} schedule - CharacterSchedule
 * @param {number} hour - 0-23
 * @param {number} minute - 0-45
 * @returns {boolean}
 */
export function isInTransit(schedule, hour, minute) {
  if (!schedule || !schedule.entries || schedule.entries.length < 2) return false

  // Find the entry that just ended
  const justEnded = schedule.entries.find((entry) => {
    // The entry ends at exactly this hour and the minute is past the boundary
    // OR the current time is between this entry's end and the next entry's start
    return entry.endHour === hour && minute > 0
  })

  return !!justEnded
}

/**
 * Returns the destination of a character currently in transit.
 * Finds the next schedule stop after the one that just ended.
 *
 * @param {Object} schedule - CharacterSchedule
 * @param {number} hour
 * @param {number} minute
 * @returns {string|null} - locationId of destination, or null
 */
export function getTransitDestination(schedule, hour, minute) {
  if (!schedule || !schedule.entries || schedule.entries.length < 2) return null

  const entries = schedule.entries
  for (let i = 0; i < entries.length; i++) {
    if (entries[i].endHour === hour && minute > 0) {
      // Next entry is the destination
      const next = entries[(i + 1) % entries.length]
      return next.locationId
    }
  }
  return null
}
