/**
 * Menu entries — the single navigable list the action menu drives.
 * Pure. Actions come first with number keys, exits follow with letter keys.
 */

export const EXIT_KEYS = 'abcdefghijklmnopqrstuvwxyz'

/**
 * Build the flat entry list for the action menu.
 * While an event waits on the player, its choices are the whole menu.
 * @param {{
 *   actions: Object[],
 *   exits: Object[],
 *   exitAvailable: (exit: Object) => boolean,
 *   choices?: Object[],
 * }} input
 * @returns {Array<{ kind: 'action'|'exit'|'choice', key: string, label: string, available: boolean, action?: Object, exit?: Object, choiceIndex?: number }>}
 */
export function menuEntriesBuild({ actions, exits, exitAvailable, choices = [] }) {
  if (choices.length > 0) {
    return choices.map((choice, i) => ({
      kind: 'choice',
      key: i < 9 ? String(i + 1) : '',
      label: choice.label,
      available: true,
      choiceIndex: i,
    }))
  }
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

/**
 * The letter that travels through the exit at an index; '?' past the alphabet.
 * @param {{ index: number }} input
 * @returns {string}
 */
export function exitKeyFor({ index }) {
  return EXIT_KEYS[index] ?? '?'
}

/**
 * Split a label around its shortcut letter so the letter can be rendered
 * bracketed and highlighted: "New Game" with "n" → "[N]", "ew Game".
 * A shortcut the label does not contain leaves the label whole.
 * @param {{ label: string, shortcut: string|null }} input
 * @returns {{ text: string, isKey: boolean }[]}
 */
export function shortcutLabelParts({ label, shortcut }) {
  if (!shortcut) return [{ text: label, isKey: false }]
  const idx = label.toLowerCase().indexOf(shortcut.toLowerCase())
  if (idx === -1) return [{ text: label, isKey: false }]
  const parts = []
  if (idx > 0) parts.push({ text: label.slice(0, idx), isKey: false })
  parts.push({ text: `[${label[idx]}]`, isKey: true })
  if (idx + 1 < label.length) parts.push({ text: label.slice(idx + 1), isKey: false })
  return parts
}
