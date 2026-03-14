/**
 * useKeyboard composable tests
 *
 * Bollo wrote these. Bollo not happy that Gregg left no tests.
 * Bollo fix. Bollo always fix.
 *
 * Tests: input exclusion, repeat filtering, binding dispatch, cleanup on unmount.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { useKeyboard } from '../src/composables/useKeyboard.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Mount a minimal component that calls useKeyboard with the given bindings.
 * Returns the wrapper so we can unmount it later.
 */
function mountWithKeyboard(bindings) {
  const TestComponent = defineComponent({
    setup() {
      useKeyboard(bindings)
      return () => null
    },
  })
  return mount(TestComponent, { attachTo: document.body })
}

/**
 * Fire a synthetic keydown event on document.
 * Optionally set properties to simulate repeat, target element tag, contentEditable.
 */
function fireKeydown(key, { repeat = false, targetTag = null, contentEditable = false } = {}) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })

  // Override repeat (KeyboardEvent.repeat is read-only in spec — patch it)
  Object.defineProperty(event, 'repeat', { value: repeat, writable: false })

  // Override target if we need to simulate a form element
  if (targetTag || contentEditable) {
    const el = document.createElement(targetTag || 'div')
    if (contentEditable) el.setAttribute('contenteditable', 'true')
    Object.defineProperty(event, 'target', { value: el, writable: false })
  }

  document.dispatchEvent(event)
  return event
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useKeyboard', () => {
  let wrapper

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
      wrapper = null
    }
  })

  // ── Basic dispatch ──────────────────────────────────────────────────────────

  describe('binding dispatch', () => {
    it('calls the correct handler when a bound key is pressed', () => {
      const handler = vi.fn()
      wrapper = mountWithKeyboard({ n: handler })

      fireKeydown('n')

      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('passes the KeyboardEvent to the handler', () => {
      const handler = vi.fn()
      wrapper = mountWithKeyboard({ Enter: handler })

      fireKeydown('Enter')

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ key: 'Enter' }))
    })

    it('does not call handler for unbound keys', () => {
      const handler = vi.fn()
      wrapper = mountWithKeyboard({ n: handler })

      fireKeydown('x')
      fireKeydown('ArrowUp')
      fireKeydown(' ')

      expect(handler).not.toHaveBeenCalled()
    })

    it('calls different handlers for different bound keys', () => {
      const handlerN = vi.fn()
      const handlerL = vi.fn()
      wrapper = mountWithKeyboard({ n: handlerN, l: handlerL })

      fireKeydown('n')
      fireKeydown('l')

      expect(handlerN).toHaveBeenCalledTimes(1)
      expect(handlerL).toHaveBeenCalledTimes(1)
    })

    it('supports special key names like ArrowUp, Enter', () => {
      const arrowHandler = vi.fn()
      const enterHandler = vi.fn()
      wrapper = mountWithKeyboard({ ArrowUp: arrowHandler, Enter: enterHandler })

      fireKeydown('ArrowUp')
      fireKeydown('Enter')

      expect(arrowHandler).toHaveBeenCalledTimes(1)
      expect(enterHandler).toHaveBeenCalledTimes(1)
    })

    it('supports numeric string keys like "1", "9"', () => {
      const handler1 = vi.fn()
      const handler9 = vi.fn()
      wrapper = mountWithKeyboard({ 1: handler1, 9: handler9 })

      fireKeydown('1')
      fireKeydown('9')

      expect(handler1).toHaveBeenCalledTimes(1)
      expect(handler9).toHaveBeenCalledTimes(1)
    })
  })

  // ── Repeat filtering ────────────────────────────────────────────────────────

  describe('repeat filtering', () => {
    it('ignores key repeat events (e.repeat === true)', () => {
      const handler = vi.fn()
      wrapper = mountWithKeyboard({ n: handler })

      fireKeydown('n', { repeat: true })

      expect(handler).not.toHaveBeenCalled()
    })

    it('fires on the initial press (e.repeat === false)', () => {
      const handler = vi.fn()
      wrapper = mountWithKeyboard({ n: handler })

      fireKeydown('n', { repeat: false })

      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('fires once per keydown even if called multiple times without repeat', () => {
      const handler = vi.fn()
      wrapper = mountWithKeyboard({ n: handler })

      fireKeydown('n')
      fireKeydown('n')
      fireKeydown('n')

      expect(handler).toHaveBeenCalledTimes(3)
    })
  })

  // ── Input exclusion ─────────────────────────────────────────────────────────

  describe('input exclusion', () => {
    it('does NOT fire when target is an INPUT element', () => {
      const handler = vi.fn()
      wrapper = mountWithKeyboard({ n: handler })

      fireKeydown('n', { targetTag: 'INPUT' })

      expect(handler).not.toHaveBeenCalled()
    })

    it('does NOT fire when target is a TEXTAREA element', () => {
      const handler = vi.fn()
      wrapper = mountWithKeyboard({ n: handler })

      fireKeydown('n', { targetTag: 'TEXTAREA' })

      expect(handler).not.toHaveBeenCalled()
    })

    it('does NOT fire when target is a SELECT element', () => {
      const handler = vi.fn()
      wrapper = mountWithKeyboard({ n: handler })

      fireKeydown('n', { targetTag: 'SELECT' })

      expect(handler).not.toHaveBeenCalled()
    })

    it('does NOT fire when target is a contentEditable element', () => {
      const handler = vi.fn()
      wrapper = mountWithKeyboard({ n: handler })

      // jsdom does not implement isContentEditable (returns undefined).
      // Patch it directly on the element so the composable's guard sees true.
      const el = document.createElement('div')
      el.setAttribute('contenteditable', 'true')
      Object.defineProperty(el, 'isContentEditable', { value: true, writable: false })
      document.body.appendChild(el)

      const event = new KeyboardEvent('keydown', { key: 'n', bubbles: true, cancelable: true })
      el.dispatchEvent(event)

      document.body.removeChild(el)

      expect(handler).not.toHaveBeenCalled()
    })

    it('DOES fire when target is a regular div (non-input)', () => {
      const handler = vi.fn()
      wrapper = mountWithKeyboard({ n: handler })

      // Default fireKeydown fires on document — no special target, handler runs
      fireKeydown('n')

      expect(handler).toHaveBeenCalledTimes(1)
    })
  })

  // ── Cleanup on unmount ──────────────────────────────────────────────────────

  describe('cleanup on unmount', () => {
    it('removes the listener when the component is unmounted', () => {
      const handler = vi.fn()
      wrapper = mountWithKeyboard({ n: handler })

      // Fires while mounted
      fireKeydown('n')
      expect(handler).toHaveBeenCalledTimes(1)

      // Unmount — listener should be gone
      wrapper.unmount()
      wrapper = null

      // Should NOT fire after unmount
      fireKeydown('n')
      fireKeydown('n')

      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('does not affect other mounted components when one unmounts', () => {
      const handlerA = vi.fn()
      const handlerB = vi.fn()

      const wrapperA = mountWithKeyboard({ n: handlerA })
      const wrapperB = mountWithKeyboard({ n: handlerB })

      // Both fire
      fireKeydown('n')
      expect(handlerA).toHaveBeenCalledTimes(1)
      expect(handlerB).toHaveBeenCalledTimes(1)

      // Unmount A — B should still work
      wrapperA.unmount()
      fireKeydown('n')

      expect(handlerA).toHaveBeenCalledTimes(1) // still 1 — did not fire again
      expect(handlerB).toHaveBeenCalledTimes(2) // fired again

      wrapperB.unmount()
    })
  })

  // ── Edge cases ──────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('handles empty bindings object without error', () => {
      expect(() => {
        wrapper = mountWithKeyboard({})
        fireKeydown('n')
        fireKeydown('Enter')
      }).not.toThrow()
    })

    it('handles undefined target (e.target is null) without error', () => {
      const handler = vi.fn()
      wrapper = mountWithKeyboard({ n: handler })

      const event = new KeyboardEvent('keydown', { key: 'n', bubbles: true, cancelable: true })
      // target will be null on document-level events in jsdom unless explicitly set
      expect(() => document.dispatchEvent(event)).not.toThrow()
    })

    it('fires handler for case-sensitive key names', () => {
      const upperHandler = vi.fn()
      const lowerHandler = vi.fn()
      // 'N' (shift+n) is a different key than 'n'
      wrapper = mountWithKeyboard({ N: upperHandler, n: lowerHandler })

      fireKeydown('N')
      fireKeydown('n')

      expect(upperHandler).toHaveBeenCalledTimes(1)
      expect(lowerHandler).toHaveBeenCalledTimes(1)
    })
  })
})
