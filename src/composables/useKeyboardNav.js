import { ref } from 'vue'
import { numberClamp } from '../utils/number.js'

/**
 * Reusable arrow-key list navigation.
 *
 * @param {{ items: import('vue').Ref<Array>, onSelect: Function, skip?: Function, loop?: boolean }} input
 *   items — reactive list of items to navigate
 *   onSelect — called with items[selectedIndex] on Enter
 *   skip — (item) => bool; true skips this item
 *   loop — wrap around at the ends (default true)
 *
 * @returns {{ selectedIndex: Ref<number>, onKeydown: function }}
 */
export function useKeyboardNav({ items, onSelect, skip = null, loop = true }) {
  const selectedIndex = ref(0)

  /** Move to the next non-skipped index in a given direction (+1 or -1). */
  function move(dir) {
    const list = items.value
    if (!list || list.length === 0) return

    let next = selectedIndex.value
    let attempts = 0

    do {
      next = next + dir
      if (loop) {
        next = ((next % list.length) + list.length) % list.length
      } else {
        next = numberClamp({ value: next, min: 0, max: list.length - 1 })
      }
      attempts++
      // Bail if we've looped all the way around (all items skipped)
      if (attempts >= list.length) return
    } while (skip && skip(list[next]))

    selectedIndex.value = next
  }

  function onKeydown(e) {
    const list = items.value
    if (!list || list.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      move(1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      move(-1)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = list[selectedIndex.value]
      if (item && onSelect) onSelect(item)
    }
  }

  /** Ensure selectedIndex stays valid when item list changes. */
  function clamp() {
    const list = items.value
    if (!list || list.length === 0) {
      selectedIndex.value = 0
      return
    }
    if (selectedIndex.value >= list.length) {
      selectedIndex.value = list.length - 1
    }
  }

  return { selectedIndex, onKeydown, clamp }
}
