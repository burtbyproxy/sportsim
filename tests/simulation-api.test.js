/**
 * Simulation API boundary tests.
 *
 * The store hands the worker Pinia reactive proxies. postMessage cannot clone
 * a Proxy, so the tick was failing on every action and every travel and the
 * world never moved. toPlainSnapshot is the translation at that boundary.
 *
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest'
import { reactive, computed } from 'vue'
import { toPlainSnapshot } from '../src/workers/simulation-api.js'

describe('toPlainSnapshot', () => {
  it('a reactive proxy cannot be structured-cloned as-is', () => {
    const state = reactive({ tick: 3, characters: [{ id: 'dale', status: { energy: 50 } }] })
    expect(() => structuredClone(state)).toThrow()
  })

  it('the snapshot of that proxy survives structured clone with the same data', () => {
    const state = reactive({ tick: 3, characters: [{ id: 'dale', status: { energy: 50 } }] })
    const snapshot = toPlainSnapshot(state)
    const cloned = structuredClone(snapshot)
    expect(cloned).toEqual({ tick: 3, characters: [{ id: 'dale', status: { energy: 50 } }] })
  })

  it('unwraps nested proxies and drops computed getters and functions', () => {
    const inner = reactive({ locationId: 'moms_house' })
    const doubled = computed(() => inner.locationId + '!')
    const state = reactive({
      inner,
      label: doubled,
      describe: () => 'not cloneable',
    })
    const snapshot = toPlainSnapshot(state)
    expect(() => structuredClone(snapshot)).not.toThrow()
    expect(snapshot.inner).toEqual({ locationId: 'moms_house' })
    expect(snapshot.describe).toBeUndefined()
  })

  it('returns an independent copy — mutating it leaves the source untouched', () => {
    const state = reactive({ characters: [{ id: 'dale', locationId: 'park' }] })
    const snapshot = toPlainSnapshot(state)
    snapshot.characters[0].locationId = 'elsewhere'
    expect(state.characters[0].locationId).toBe('park')
  })
})
