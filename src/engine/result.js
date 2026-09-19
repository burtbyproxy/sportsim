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
 * It did not, and here is which way. `params` names what the failure was
 * about (which field, which save) so the words can be written from it.
 * @param {{ code: string, message: string, params?: Object<string, *> }} input
 * @returns {{ ok: false, data: null, error: { code: string, message: string, params: Object<string, *> } }}
 */
export function resultFail({ code, message, params = {} }) {
  return { ok: false, data: null, error: { code, message, params } }
}
