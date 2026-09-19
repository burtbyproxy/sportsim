/**
 * Boot: the game put together from content, and what happens when content
 * will not load.
 *
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useBoot } from '../src/composables/useBoot.js'
import { useGameStore } from '../src/stores/game.js'
import { contentLoad, CONTENT_KINDS, LOADER_ERROR_CODES } from '../src/data/loader.js'
import { SAVE_ERROR_CODES } from '../src/composables/useSave.js'
import { resultFail } from '../src/engine/result.js'
import { storageInstall } from './helpers/storage.js'
import { tuningContent } from './helpers/content.js'

const tuning = tuningContent()

/** Real content, except one kind that will not load. */
const brokenAt = (brokenKind) => (input) =>
  input.kind === brokenKind
    ? resultFail({
        code: LOADER_ERROR_CODES.entryIdMissing,
        message: 'broken on purpose',
        params: { path: `/content/${brokenKind}/bad.json` },
      })
    : contentLoad(input)

describe('useBoot', () => {
  beforeEach(() => {
    storageInstall()
    setActivePinia(createPinia())
  })

  it('content that will not load stops the boot, says which file, and registers nothing', () => {
    const boot = useBoot({ load: brokenAt(CONTENT_KINDS.voices) })
    const booted = boot.gameBoot()
    expect(booted.error).toMatchObject({
      code: LOADER_ERROR_CODES.entryIdMissing,
      params: { path: '/content/voices/bad.json' },
    })
    const game = useGameStore()
    game.tuningRegister({ tuning })
    expect(game.items).toEqual({})
    expect(game.actions).toEqual({})
  })

  it('a new game on a map whose places will not load does not start', () => {
    const boot = useBoot({ load: brokenAt(CONTENT_KINDS.locations) })
    expect(boot.gameBoot().ok).toBe(true)
    expect(boot.gameNew().error.code).toBe(LOADER_ERROR_CODES.entryIdMissing)
    expect(useGameStore().isRunning).toBe(false)
  })

  it('there is nothing to resume before anything was saved', () => {
    const boot = useBoot()
    boot.gameBoot()
    expect(boot.gameResumable().data.resumable).toBe(false)
    expect(boot.gameResume().error.code).toBe(SAVE_ERROR_CODES.notFound)
  })
})
