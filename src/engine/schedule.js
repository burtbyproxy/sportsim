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
 * @param {{ entry: Object, hour: number }} input
 *   entry — ScheduleEntry
 *   hour — 0-23
 * @returns {boolean}
 */
export function scheduleEntryCoversHour({ entry, hour }) {
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
 * @param {{ entry: Object, dayOfWeek: string }} input
 *   entry — ScheduleEntry
 *   dayOfWeek — "monday" through "sunday"
 * @returns {boolean}
 */
export function scheduleEntryCoversDay({ entry, dayOfWeek }) {
  if (!entry.days || entry.days.length === 0) return false
  return entry.days.includes('all') || entry.days.includes(dayOfWeek)
}

/**
 * Resolves a character's schedule to find the matching entry for the current time.
 * Returns the first matching entry (entries should not overlap; first match wins).
 * Returns null if no entry matches.
 *
 * @param {{ schedule: Object, hour: number, dayOfWeek: string }} input
 *   schedule — CharacterSchedule ({ entries: ScheduleEntry[] })
 *   hour — 0-23
 * @returns {Object|null} - ScheduleEntry or null
 */
export function scheduleEntryResolve({ schedule, hour, dayOfWeek }) {
  if (!schedule || !schedule.entries || schedule.entries.length === 0) return null
  for (const entry of schedule.entries) {
    if (scheduleEntryCoversDay({ entry, dayOfWeek }) && scheduleEntryCoversHour({ entry, hour })) {
      return entry
    }
  }
  return null
}

/**
 * Whether a character is between schedule stops (in transit): during the
 * hour one of their stops ends, once that hour is under way (minute > 0).
 *
 * For routine and full simulation only — fixed characters are either there or not.
 *
 * @param {{ schedule: Object, hour: number, minute: number }} input
 *   schedule — CharacterSchedule
 *   hour — 0-23
 *   minute — 0-45
 * @returns {boolean}
 */
export function scheduleTransitActive({ schedule, hour, minute }) {
  if (!schedule || !schedule.entries || schedule.entries.length < 2) return false

  // A stop that ends this hour, with the hour under way.
  const justEnded = schedule.entries.find((entry) => entry.endHour === hour && minute > 0)

  return !!justEnded
}

/**
 * Returns the destination of a character currently in transit.
 * Finds the next schedule stop after the one that just ended.
 *
 * @param {{ schedule: Object, hour: number, minute: number }} input
 *   schedule — CharacterSchedule
 * @returns {string|null} - locationId of destination, or null
 */
export function scheduleTransitDestination({ schedule, hour, minute }) {
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
