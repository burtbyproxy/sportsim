/**
 * Menu entries — the single navigable list the action menu drives.
 * Pure. Actions come first with number keys, exits follow with letter keys.
 */

export const EXIT_KEYS = 'abcdefghijklmnopqrstuvwxyz'

/**
 * Build the flat entry list for the action menu.
 * @param {{
 *   actions: Object[],
 *   exits: Object[],
 *   exitAvailable: (exit: Object) => boolean,
 * }} input
 * @returns {Array<{ kind: 'action'|'exit', key: string, label: string, available: boolean, action?: Object, exit?: Object }>}
 */
export function menuEntriesBuild({ actions, exits, exitAvailable }) {
  const actionEntries = actions.map((action, i) => ({
    kind: 'action',
    key: i < 9 ? String(i + 1) : '',
    label: action.label,
    available: Boolean(action.available),
    action,
  }))
  const exitEntries = exits.map((exit, i) => ({
    kind: 'exit',
    key: EXIT_KEYS[i] ?? '',
    label: exit.label,
    available: exitAvailable(exit),
    exit,
  }))
  return [...actionEntries, ...exitEntries]
}
