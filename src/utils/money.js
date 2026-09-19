/**
 * Money as the player reads it. Pure.
 */

/**
 * An amount in dollars and cents, the sign in front: "$3.50", "-$2.00".
 * @param {{ amount: number }} input
 * @returns {string}
 */
export function moneyFormat({ amount }) {
  const sign = amount < 0 ? '-' : ''
  return `${sign}$${Math.abs(amount).toFixed(2)}`
}
