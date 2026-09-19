/**
 * An in-memory localStorage, installed where the browser's would be. It
 * behaves like the real one, key() and length included.
 */
import { vi } from 'vitest'

/**
 * Install a fresh storage, optionally holding some keys already.
 * @param {{ initial?: Object<string, string> }} [input]
 * @returns {Storage & { contents: () => Object<string, string> }} the installed storage
 */
export function storageInstall({ initial = {} } = {}) {
  let store = { ...initial }
  const storage = {
    getItem: vi.fn((key) => store[key] ?? null),
    // Storage's own signature is setItem(key, value); a rest parameter takes it as one.
    setItem: vi.fn((...keyAndValue) => {
      const [key, value] = keyAndValue
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
    contents: () => store,
  }
  globalThis.localStorage = storage
  return storage
}
