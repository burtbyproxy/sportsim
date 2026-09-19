/**
 * The title screen when content is broken: it shows the code and the file,
 * and offers no game. The loader is replaced for this file only.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'

vi.mock('../src/data/loader.js', async (importOriginal) => {
  const real = await importOriginal()
  const { resultFail } = await import('../src/engine/result.js')
  return {
    ...real,
    contentLoad: (input) =>
      input.kind === real.CONTENT_KINDS.ITEMS
        ? resultFail({
            code: real.LOADER_ERROR_CODES.ENTRY_ID_DUPLICATE,
            message: 'broken on purpose',
            params: { path: '/content/items/twice.json' },
          })
        : real.contentLoad(input),
  }
})

const { default: TitleScreen } = await import('../src/components/layout/TitleScreen.vue')

describe('TitleScreen — broken content', () => {
  it('names the code and the file, and offers nothing to start', async () => {
    globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} }
    const pinia = createPinia()
    setActivePinia(pinia)
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: TitleScreen }],
    })
    router.push('/')
    await router.isReady()
    const wrapper = mount(TitleScreen, { global: { plugins: [pinia, router] } })

    expect(wrapper.find('[role="alert"]').text()).toBe(
      '[CONTENT_ENTRY_ID_DUPLICATE] /content/items/twice.json'
    )
    expect(wrapper.findAll('.title-menu-item')).toHaveLength(0)
  })
})
