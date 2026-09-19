/**
 * Content as the tests read it: straight off disk, the same files the game loads.
 */
import { readFileSync, readdirSync } from 'fs'
import { resolve } from 'path'

/**
 * One content file, parsed.
 * @param {{ path: string }} input - relative to the repo root
 * @returns {*}
 */
export function contentFile({ path }) {
  return JSON.parse(readFileSync(resolve(path), 'utf-8'))
}

/**
 * Every JSON file in a directory, parsed, in file-name order.
 * @param {{ dir: string }} input - relative to the repo root
 * @returns {Array<*>}
 */
export function contentDir({ dir }) {
  return readdirSync(resolve(dir))
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => contentFile({ path: `${dir}/${f}` }))
}

/**
 * The ids of the files in a directory: what the game should end up registering.
 * @param {{ dir: string }} input
 * @returns {string[]}
 */
export function contentIds({ dir }) {
  return readdirSync(resolve(dir))
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace('.json', ''))
    .sort()
}

/**
 * A line from a voice catalog in content, exactly as written.
 * @param {{ personaId: string, code: string }} input
 * @returns {string}
 */
export function voiceLineOf({ personaId, code }) {
  return contentFile({ path: `content/voices/${personaId}.json` }).lines[code]
}
