/**
 * An in-memory localStorage, installed where the browser's would be. It
 * behaves like the real one, key() and length included.
 */
import { vi } from 'vitest'

/**
 * Install a fresh storage, optionally holding some keys already.
 * @param {{ initial?: Object<string, string> }} [input]
 * @returns {Storage & { _store: () => Object<string, string> }} the installed storage
 */
export function storageInstall({ initial = {} } = {}) {
  let store = { ...initial }
  const storage = {
    getItem: vi.fn((key) => store[key] ?? null),
    setItem: vi.fn((key, value) => {
      store[key] = String(value)
    }),
    removeItem: vi.fn((key) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    }),
    key: vi.fn((i) => Object.keys(store)[i] ?? null),
    get length() {
      return Object.keys(store).length
    },
    _store: () => store,
  }
  globalThis.localStorage = storage
  return storage
}
