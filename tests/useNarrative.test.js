/**
 * useNarrative composable tests — the fixes from the first live run.
 *
 * Covers: clearLog aborting an in-flight render, the normal-tier throughput
 * contract, and the screen-wide space-to-skip bindings.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import {
  useNarrative,
  narrativeSkipBindings,
  meanCharDelayMs,
} from '../src/composables/useNarrative.js'
import { useKeyboard } from '../src/composables/useKeyboard.js'
import { narrativeTextCreate } from '../src/utils/text.js'
import { tuningContent } from './helpers/content.js'

const tuning = tuningContent()

const SAMPLE_PROSE =
  'The basement has a cot, a space heater that smells like burning dust, and a window ' +
  'well full of leaves. Your mom is upstairs. She is kind. You are not sure you deserve it.'

// ── clearLog ─────────────────────────────────────────────────────────────────

describe('useNarrative clearLog', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('drops the in-flight render and everything queued, keeping only what comes after', async () => {
    const narrative = useNarrative({ tuning })
    narrative.enqueue(narrativeTextCreate({ text: 'Old scene, first paragraph.' }))
    narrative.enqueue(narrativeTextCreate({ text: 'Old scene, second paragraph.' }))

    // Let a few characters of the first paragraph land
    await vi.advanceTimersByTimeAsync(40)
    expect(narrative.isAnimating.value).toBe(true)
    expect(narrative.queue.value.length).toBe(1)

    narrative.clearLog()
    narrative.enqueue(narrativeTextCreate({ text: 'New scene.' }))

    await vi.advanceTimersByTimeAsync(5000)

    expect(narrative.isAnimating.value).toBe(false)
    expect(narrative.log.value.length).toBe(1)
    expect(narrative.log.value[0].tokens[0].rendered).toBe('New scene.')
  })

  it('leaves no partial token text behind', async () => {
    const narrative = useNarrative({ tuning })
    narrative.enqueue(narrativeTextCreate({ text: 'Some prose that gets cut off.' }))
    await vi.advanceTimersByTimeAsync(40)
    expect(narrative.currentTokenProgress.value.length).toBeGreaterThan(0)

    narrative.clearLog()

    expect(narrative.currentTokenProgress.value).toBe('')
    expect(narrative.activeEntryState.value).toBeNull()
  })

  it('does not emit animation-complete for a render that was cleared', async () => {
    const narrative = useNarrative({ tuning })
    const completed = vi.fn()
    narrative.on({ event: 'animation-complete', handler: completed })

    narrative.enqueue(narrativeTextCreate({ text: 'Cleared before it finishes.' }))
    await vi.advanceTimersByTimeAsync(40)
    narrative.clearLog()
    await vi.advanceTimersByTimeAsync(5000)

    expect(completed).not.toHaveBeenCalled()
  })
})

// ── Throughput contract ──────────────────────────────────────────────────────

describe('narrative typing speed', () => {
  it('normal tier sustains the minimum characters per second on ordinary prose', () => {
    const meanMs = meanCharDelayMs({ tuning, text: SAMPLE_PROSE, speed: 'normal' })
    const charsPerSecond = 1000 / meanMs
    expect(charsPerSecond).toBeGreaterThanOrEqual(tuning.narrative.normalMinCharsPerSecond)
  })

  it('fast is faster than normal, which is faster than slow, which is faster than crawl', () => {
    const rate = (speed) => meanCharDelayMs({ tuning, text: SAMPLE_PROSE, speed })
    expect(rate('fast')).toBeLessThan(rate('normal'))
    expect(rate('normal')).toBeLessThan(rate('slow'))
    expect(rate('slow')).toBeLessThan(rate('crawl'))
  })

  it('instant tier costs nothing', () => {
    expect(tuning.narrative.speedsMs.instant).toEqual({ min: 0, max: 0 })
    expect(meanCharDelayMs({ tuning, text: SAMPLE_PROSE, speed: 'instant' })).toBe(0)
  })

  it('word boundaries carry no pause', () => {
    expect(tuning.narrative.punctuationPauseMs.find((pause) => pause.char === ' ')).toBeUndefined()
  })
})

// ── Screen-wide skip ─────────────────────────────────────────────────────────

function mountWithBindings(bindings) {
  const TestComponent = defineComponent({
    setup() {
      useKeyboard({ bindings })
      return () => null
    },
  })
  return mount(TestComponent, { attachTo: document.body })
}

function pressSpace() {
  const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true })
  document.body.dispatchEvent(event)
  return event
}

describe('narrativeSkipBindings', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('space on the document skips a running animation', async () => {
    const narrative = useNarrative({ tuning })
    const wrapper = mountWithBindings(narrativeSkipBindings({ narrative }))

    narrative.enqueue(narrativeTextCreate({ text: SAMPLE_PROSE }))
    await vi.advanceTimersByTimeAsync(40)
    expect(narrative.isAnimating.value).toBe(true)

    const event = pressSpace()
    await vi.advanceTimersByTimeAsync(200)

    expect(event.defaultPrevented).toBe(true)
    expect(narrative.isAnimating.value).toBe(false)
    expect(narrative.log.value[0].tokens[0].rendered).toBe(SAMPLE_PROSE)
    wrapper.unmount()
  })

  it('space is left alone when nothing is animating', () => {
    const narrative = useNarrative({ tuning })
    const skip = vi.spyOn(narrative, 'skip')
    const wrapper = mountWithBindings(narrativeSkipBindings({ narrative }))

    const event = pressSpace()

    expect(event.defaultPrevented).toBe(false)
    expect(skip).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})
