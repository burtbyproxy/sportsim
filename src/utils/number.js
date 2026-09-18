/**
 * Numbers held to a range or a precision. Pure.
 */

/**
 * A value held inside [min, max].
 * @param {{ value: number, min: number, max: number }} input
 * @returns {number}
 */
export function numberClamp({ value, min, max }) {
  return Math.max(min, Math.min(max, value))
}

/**
 * A value rounded to a number of decimal places, as a number.
 * @param {{ value: number, places: number }} input
 * @returns {number}
 */
export function numberRound({ value, places }) {
  return parseFloat(value.toFixed(places))
}
