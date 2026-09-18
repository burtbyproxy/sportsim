/**
 * Component tests — the real single-file components, mounted.
 *
 * These replace a file that tested copies of component logic pasted into the
 * test. Everything here imports the component a player actually sees.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { readdirSync } from 'fs'
import { resolve } from 'path'
import GameFooter from '../src/components/layout/GameFooter.vue'
import NarrativeLog from '../src/components/game/NarrativeLog.vue'
import TitleScreen from '../src/components/layout/TitleScreen.vue'
import { useGameStore } from '../src/stores/game.js'
import { createPlayer } from '../src/models/player.js'

const contentIds = (dir) =>
  readdirSync(resolve(dir))
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace('.json', ''))
    .sort()

function installLocalStorage(initial = {}) {
  let store = { ...initial }
  globalThis.localStorage = {
    getItem: (key) => store[key] ?? null,
    setItem: (key, value) => {
      store[key] = String(value)
    },
    removeItem: (key) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
  }
}

describe('GameFooter', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('says there is no game when there is no game', () => {
    const wrapper = mount(GameFooter)
    expect(wrapper.text()).toBe('no active game')
  })

  it('documents number keys for actions, letters for exits, and space to skip', () => {
    const game = useGameStore()
    game.startNewGame(createPlayer('Tester'), 'moms_house')
    const text = mount(GameFooter).text()
    expect(text).toContain('1–9 actions')
    expect(text).toContain('a–z go')
    expect(text).toContain('space skip')
  })
})

describe('NarrativeLog', () => {
  it('is a polite live log a screen reader can name', () => {
    const root = mount(NarrativeLog).find('.narrative-log')
    expect(root.attributes('role')).toBe('log')
    expect(root.attributes('aria-live')).toBe('polite')
    expect(root.attributes('aria-label')).toBe('Game narrative')
  })

  it('renders every completed entry, token by token', () => {
    const log = [
      { id: 1, tokens: [{ rendered: 'You eat the cheese. ' }, { rendered: "It's fine." }] },
      { id: 2, tokens: [{ rendered: 'Dave watches.' }] },
    ]
    const entries = mount(NarrativeLog, { props: { log } }).findAll('.narrative-entry')
    expect(entries.map((e) => e.text())).toEqual([
      "You eat the cheese. It's fine.",
      'Dave watches.',
    ])
  })

  it('a click skips only while something is animating', async () => {
    const idle = mount(NarrativeLog, { props: { isAnimating: false } })
    await idle.find('.narrative-log').trigger('click')
    expect(idle.emitted('skip')).toBeUndefined()

    const busy = mount(NarrativeLog, { props: { isAnimating: true } })
    await busy.find('.narrative-log').trigger('click')
    expect(busy.emitted('skip')).toHaveLength(1)
  })
})

describe('TitleScreen', () => {
  async function mountTitle({ saves = {} } = {}) {
    installLocalStorage(saves)
    const pinia = createPinia()
    setActivePinia(pinia)
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: TitleScreen },
        { path: '/game', component: { template: '<div>game</div>' } },
      ],
    })
    router.push('/')
    await router.isReady()
    const wrapper = mount(TitleScreen, { global: { plugins: [pinia, router] } })
    return { wrapper, router, game: useGameStore() }
  }

  it('offers New Game and Load Game, and nothing that does not exist', async () => {
    const { wrapper } = await mountTitle()
    const labels = wrapper.findAll('.title-menu-item').map((b) => b.text())
    expect(labels).toEqual(['[N]ew Game', '[L]oad Game'])
  })

  it('Load Game is disabled until there is a save to load', async () => {
    const { wrapper } = await mountTitle()
    const load = wrapper.findAll('.title-menu-item')[1]
    expect(load.attributes('disabled')).toBeDefined()
  })

  it('registers every definition in content before anyone presses anything', async () => {
    const { game } = await mountTitle()
    expect(Object.keys(game.substances).sort()).toEqual(contentIds('content/substances'))
    expect(Object.keys(game.conditions).sort()).toEqual(contentIds('content/conditions'))
    expect(Object.keys(game.mediums).sort()).toEqual(contentIds('content/mediums'))
    expect(Object.keys(game.voices).sort()).toEqual(contentIds('content/voices'))
    expect(Object.keys(game.scavengeTables).sort()).toEqual(contentIds('content/scavenge'))
    expect(game.items.sharpie).toMatchObject({ type: 'tool', mediumIds: expect.any(Array) })
    expect(game.items.tallboy_oly.doses).toEqual([{ substanceId: 'beer', value: 20 }])
  })

  it('New Game starts a sober player in the basement with Kenton and its people around them', async () => {
    const { wrapper, router, game } = await mountTitle()

    await wrapper.findAll('.title-menu-item')[0].trigger('click')
    await flushPromises()

    expect(game.isRunning).toBe(true)
    expect(game.currentLocationId).toBe('moms_house')
    expect(game.player.status.sobriety).toBe(100)
    expect(router.currentRoute.value.path).toBe('/game')
    expect(Object.keys(game.locations).sort()).toEqual(contentIds('content/maps/kenton/locations'))
    expect(Object.keys(game.characters).sort()).toEqual(contentIds('content/characters'))
    // Locations come through the model factory: unworked, with a table to draw from.
    expect(game.locations.moms_house.scavenge).toEqual({ depletion: 0, updatedAtTick: 0 })
    expect(game.locations.moms_house.scavengeTableId).toBe('basement')
    // Characters carry the blend: Maurice arrives mid-beer.
    expect(game.characters.maurice.status.sobriety).toBe(60)
  })
})
