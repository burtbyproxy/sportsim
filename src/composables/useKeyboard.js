import { onMounted, onUnmounted } from 'vue'

/**
 * useKeyboard — Old Gregg's keyboard composable.
 *
 * Takes a bindings object mapping key names (KeyboardEvent.key) to handler functions.
 * Handlers receive the raw KeyboardEvent so they can call preventDefault if they want.
 *
 * Auto-excludes INPUT, TEXTAREA, SELECT, and contentEditable elements.
 * Ignores key repeat events (e.repeat).
 * Binds on mount, unbinds on unmount — Vue lifecycle IS the scope system.
 * Only mounted components have active listeners. Unmount a component and its keys go dark.
 *
 * @param {Record<string, (e: KeyboardEvent) => void>} bindings
 *   Object mapping key names to handlers: { 'n': handler, 'ArrowUp': handler }
 *
 * @example
 * useKeyboard({
 *   'n': () => startNewGame(),
 *   'ArrowUp': (e) => { e.preventDefault(); moveUp() },
 *   'Enter': (e) => { e.preventDefault(); select() },
 * })
 */
export function useKeyboard(bindings) {
  function onKeydown(e) {
    // Ignore key repeat — only fire on the initial press
    if (e.repeat) return

    // Don't fire when the user is typing in a form element
    const tag = e.target?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
    if (e.target?.isContentEditable) return

    const handler = bindings[e.key]
    if (handler) handler(e)
  }

  onMounted(() => document.addEventListener('keydown', onKeydown))
  onUnmounted(() => document.removeEventListener('keydown', onKeydown))
}
