/**
 * Result — the one shape every boundary returns.
 *
 * `ok`, `data`, `error`. A failure carries an enumerated code (the contract)
 * and a message (for humans). Exceptions never cross a boundary; this does.
 */

/**
 * It worked.
 * @template T
 * @param {T} data
 * @returns {{ ok: true, data: T, error: null }}
 */
export function resultOk(data) {
  return { ok: true, data, error: null }
}

/**
 * It did not, and here is which way.
 * @param {{ code: string, message: string }} input
 * @returns {{ ok: false, data: null, error: { code: string, message: string } }}
 */
export function resultFail({ code, message }) {
  return { ok: false, data: null, error: { code, message } }
}
