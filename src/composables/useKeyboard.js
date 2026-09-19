import { onMounted, onUnmounted } from 'vue'

/**
 * useKeyboard — document-level key bindings scoped to a component's lifetime.
 *
 * Takes a list of bindings, each a key name (KeyboardEvent.key) and its handler.
 * Handlers receive the raw KeyboardEvent so they can call preventDefault if they want.
 *
 * Auto-excludes INPUT, TEXTAREA, SELECT, and contentEditable elements.
 * Ignores key repeat events (e.repeat).
 * Binds on mount, unbinds on unmount — Vue lifecycle IS the scope system.
 * Only mounted components have active listeners. Unmount a component and its keys go dark.
 *
 * @param {{ bindings: Array<{ key: string, handler: (e: KeyboardEvent) => void }> }} input
 *
 * @example
 * useKeyboard({
 *   bindings: [
 *     { key: 'n', handler: () => runStart() },
 *     { key: 'ArrowUp', handler: (e) => { e.preventDefault(); moveUp() } },
 *   ],
 * })
 */
export function useKeyboard({ bindings }) {
  const handlers = new Map(bindings.map((binding) => [binding.key, binding.handler]))

  function onKeydown(e) {
    // Ignore key repeat — only fire on the initial press
    if (e.repeat) return

    // Don't fire when the user is typing in a form element
    const tag = e.target?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
    if (e.target?.isContentEditable) return

    const handler = handlers.get(e.key)
    if (handler) handler(e)
  }

  onMounted(() => document.addEventListener('keydown', onKeydown))
  onUnmounted(() => document.removeEventListener('keydown', onKeydown))
}
