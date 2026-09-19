// @vitest-environment node
/**
 * Content Validation Tests
 *
 * Validates all JSON files in content/ against their data contracts.
 * These tests are generic — they load every file in the relevant directories
 * and check structure. New files are validated automatically.
 *
 * Tests pass with 0 content files (empty directories). They also pass when
 * files are valid. They FAIL when files violate their contract.
 *
 * Uses Node.js fs — must run in 'node' environment (not jsdom).
 *
 * Structure validated:
 *   content/characters/{id}.json               — Character contract
 *   content/maps/{map}/locations/{id}.json     — Location contract
 *   content/maps/{map}/actions/{id}.json       — Action contract (array of actions)
 *   content/items/{id}.json                    — Item contract (array of items)
 *   content/substances/{id}.json               — Substance contract
 *   content/conditions/{id}.json               — Condition contract
 *   content/mediums/{id}.json                  — Medium contract
 *   content/voices/{personaId}.json            — Voice catalog contract
 *   content/scavenge/{id}.json                 — Scavenge loot table contract
 *   content/games/{id}.json                    — Minigame contract
 */

import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, existsSync } from 'fs'
import { join, resolve } from 'path'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CONTENT_ROOT = resolve('content')
// The game's words are content. This file reads them; it does not keep its own copy.
const VOCABULARY = JSON.parse(readFileSync(join(CONTENT_ROOT, 'vocabulary.json'), 'utf-8'))
const VALID_STATS = VOCABULARY.stats.map((s) => s.id)
// sobriety is derived from intoxications — it is read, never written, by content.
const VALID_STATUS_KEYS = VOCABULARY.statuses.filter((s) => s.writable).map((s) => s.id)
const VALID_SUBSTANCE_FAMILIES = VOCABULARY.substanceFamilies
const VALID_SIMULATION_TIERS = VOCABULARY.simulationTiers
const VALID_ITEM_TYPES = VOCABULARY.itemTypes
const VALID_ACTION_KINDS = VOCABULARY.actionKinds

/**
 * Load all JSON files from a directory path (non-recursive).
 * Returns [] if directory doesn't exist or is empty.
 * @param {string} dirPath
 * @returns {{ file: string, data: any }[]}
 */
function loadJsonFiles(dirPath) {
  if (!existsSync(dirPath)) return []
  const files = readdirSync(dirPath).filter((f) => f.endsWith('.json'))
  return files.map((file) => {
    const fullPath = join(dirPath, file)
    const raw = readFileSync(fullPath, 'utf-8')
    return { file: fullPath, data: JSON.parse(raw) }
  })
}

/**
 * Get all map directories (e.g. content/maps/kenton, content/maps/downtown).
 * @returns {string[]}
 */
function getMapDirs() {
  const mapsRoot = join(CONTENT_ROOT, 'maps')
  if (!existsSync(mapsRoot)) return []
  return readdirSync(mapsRoot, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => join(mapsRoot, e.name))
}

// ---------------------------------------------------------------------------
// Character validation
// ---------------------------------------------------------------------------

/**
 * Required top-level fields for every Character.
 */
const CHARACTER_REQUIRED_FIELDS = [
  'id',
  'name',
  'description',
  'habit',
  'voice',
  'simulation',
  'schedule',
  'want',
  'fear',
]

function validateCharacter(data, file) {
  // Required fields
  for (const field of CHARACTER_REQUIRED_FIELDS) {
    expect(data, `${file}: missing required field '${field}'`).toHaveProperty(field)
  }

  // Fields nothing reads do not come back
  for (const dead of ['level', 'dialogueTreeIds', 'descriptionVariants']) {
    expect(data, `${file}: '${dead}' is not part of a character`).not.toHaveProperty(dead)
  }

  // simulation tier
  expect(VALID_SIMULATION_TIERS, `${file}: invalid simulation tier '${data.simulation}'`).toContain(
    data.simulation
  )

  // schedule.entries is an array
  expect(Array.isArray(data.schedule?.entries), `${file}: schedule.entries must be an array`).toBe(
    true
  )

  // Each schedule entry has required fields
  for (const entry of data.schedule?.entries ?? []) {
    expect(entry, `${file}: schedule entry missing locationId`).toHaveProperty('locationId')
    expect(typeof entry.locationId, `${file}: schedule entry locationId must be string`).toBe(
      'string'
    )
    expect(entry, `${file}: schedule entry missing startHour`).toHaveProperty('startHour')
    expect(entry, `${file}: schedule entry missing endHour`).toHaveProperty('endHour')
    expect(typeof entry.startHour, `${file}: startHour must be number`).toBe('number')
    expect(typeof entry.endHour, `${file}: endHour must be number`).toBe('number')
    expect(entry.startHour, `${file}: startHour must be 0-23`).toBeGreaterThanOrEqual(0)
    expect(entry.startHour, `${file}: startHour must be 0-23`).toBeLessThanOrEqual(23)
    expect(entry, `${file}: schedule entry missing probability`).toHaveProperty('probability')
    expect(entry.probability, `${file}: probability must be 0-1`).toBeGreaterThanOrEqual(0)
    expect(entry.probability, `${file}: probability must be 0-1`).toBeLessThanOrEqual(1)
    expect(Array.isArray(entry.days), `${file}: entry.days must be array`).toBe(true)
    expect(entry.days.length, `${file}: entry.days must not be empty`).toBeGreaterThan(0)
  }

  // relationshipScore: -100 to 100
  if (data.relationshipScore !== undefined) {
    expect(
      data.relationshipScore,
      `${file}: relationshipScore out of range`
    ).toBeGreaterThanOrEqual(-100)
    expect(data.relationshipScore, `${file}: relationshipScore out of range`).toBeLessThanOrEqual(
      100
    )
  }

  // Stats: if present, validate structure
  if (data.stats) {
    for (const statName of VALID_STATS) {
      if (data.stats[statName] !== undefined) {
        const stat = data.stats[statName]
        expect(typeof stat.base, `${file}: stats.${statName}.base must be number`).toBe('number')
        expect(stat.base, `${file}: stats.${statName}.base must be 1-100`).toBeGreaterThanOrEqual(1)
        expect(stat.base, `${file}: stats.${statName}.base must be 1-100`).toBeLessThanOrEqual(100)
      }
    }
  }

  // Status: if present and not null, validate
  if (data.status !== null && data.status !== undefined) {
    for (const key of VALID_STATUS_KEYS) {
      if (data.status[key] !== undefined) {
        expect(data.status[key], `${file}: status.${key} must be 0-100`).toBeGreaterThanOrEqual(0)
        expect(data.status[key], `${file}: status.${key} must be 0-100`).toBeLessThanOrEqual(100)
      }
    }
    expect(
      data.status.sobriety,
      `${file}: status.sobriety is derived from intoxications — declare intoxications instead`
    ).toBeUndefined()
  }

  // Intoxications / habituations: per-substance levels 0-100 (ids cross-checked below)
  for (const field of ['intoxications', 'habituations']) {
    if (data[field] === undefined) continue
    for (const [substanceId, level] of Object.entries(data[field])) {
      expect(typeof level, `${file}: ${field}.${substanceId} must be number`).toBe('number')
      expect(level, `${file}: ${field}.${substanceId} must be 0-100`).toBeGreaterThanOrEqual(0)
      expect(level, `${file}: ${field}.${substanceId} must be 0-100`).toBeLessThanOrEqual(100)
    }
  }

  // full-tier: decisionWeights recommended (not required — warn via test name)
  if (data.simulation === 'full') {
    // We don't hard-require decisionWeights — a full-tier char can have null weights.
    // Just validate the shape if present.
    if (data.decisionWeights) {
      for (const key of ['low_sobriety', 'low_hunger', 'low_mood', 'low_energy']) {
        const entry = data.decisionWeights[key]
        if (entry !== null && entry !== undefined) {
          expect(typeof entry.bias, `${file}: decisionWeights.${key}.bias must be string`).toBe(
            'string'
          )
          expect(typeof entry.weight, `${file}: decisionWeights.${key}.weight must be number`).toBe(
            'number'
          )
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Location validation
// ---------------------------------------------------------------------------

const LOCATION_REQUIRED_FIELDS = [
  'id',
  'type',
  'display',
  'descriptions',
  'exits',
  'availability',
  'surfaces',
  'pieceAs',
  'outdoors',
]

function validateLocation(data, file) {
  for (const field of LOCATION_REQUIRED_FIELDS) {
    expect(data, `${file}: missing field '${field}'`).toHaveProperty(field)
  }

  // Fields nothing reads do not come back: who is here comes from schedules.
  for (const dead of ['npcSlots', 'variant']) {
    expect(data, `${file}: '${dead}' is not part of a location`).not.toHaveProperty(dead)
  }

  // An action says where it lives. A second list here is how actions got lost.
  expect(
    data,
    `${file}: actions are placed by their own locationId, not listed here`
  ).not.toHaveProperty('actionIds')

  // descriptions must have a 'default' key
  expect(data.descriptions, `${file}: descriptions must be an object`).toBeTruthy()
  expect(
    typeof data.descriptions.default,
    `${file}: descriptions.default must be a non-empty string`
  ).toBe('string')
  expect(
    data.descriptions.default.length,
    `${file}: descriptions.default must not be empty`
  ).toBeGreaterThan(0)

  // exits must be an array
  expect(Array.isArray(data.exits), `${file}: exits must be an array`).toBe(true)
  for (const exit of data.exits) {
    expect(exit, `${file}: exit missing locationId`).toHaveProperty('locationId')
    expect(exit, `${file}: exit missing label`).toHaveProperty('label')
    expect(exit, `${file}: exit missing travelTime`).toHaveProperty('travelTime')
    expect(exit.travelTime, `${file}: travelTime must be >= 1`).toBeGreaterThanOrEqual(1)
  }

  expect(
    typeof data.outdoors,
    `${file}: outdoors must be boolean — can the street find you here?`
  ).toBe('boolean')
  expect(typeof data.pieceAs, `${file}: pieceAs must be string`).toBe('string')

  // surfaces — what the place itself offers to work on ([] for nothing)
  expect(Array.isArray(data.surfaces), `${file}: surfaces must be an array`).toBe(true)
  const surfaceIds = new Set()
  for (const surface of data.surfaces) {
    for (const field of ['id', 'name', 'pieceAs']) {
      expect(typeof surface[field], `${file}: surface.${field} must be string`).toBe('string')
      expect(surface[field].length, `${file}: surface.${field} must not be empty`).toBeGreaterThan(
        0
      )
    }
    expect(surfaceIds.has(surface.id), `${file}: duplicate surface id '${surface.id}'`).toBe(false)
    surfaceIds.add(surface.id)
    expect(
      Array.isArray(surface.mediumIds),
      `${file} '${surface.id}': mediumIds must be array`
    ).toBe(true)
    expect(
      surface.mediumIds.length,
      `${file} '${surface.id}': a surface must take at least one medium`
    ).toBeGreaterThan(0)
    if (surface.artifact !== undefined) {
      expect(
        ['fixed', 'portable', 'none'],
        `${file} '${surface.id}': artifact '${surface.artifact}'`
      ).toContain(surface.artifact)
    }
    if (surface.cost !== undefined) {
      expect(typeof surface.cost, `${file} '${surface.id}': cost must be number`).toBe('number')
      expect(surface.cost, `${file} '${surface.id}': cost must be > 0`).toBeGreaterThan(0)
    }
    if (surface.hours !== undefined) {
      for (const key of ['openHour', 'closeHour']) {
        expect(
          Number.isInteger(surface.hours[key]),
          `${file} '${surface.id}': hours.${key} must be a whole number`
        ).toBe(true)
        expect(
          surface.hours[key],
          `${file} '${surface.id}': hours.${key} 0-23`
        ).toBeGreaterThanOrEqual(0)
        expect(
          surface.hours[key],
          `${file} '${surface.id}': hours.${key} 0-23`
        ).toBeLessThanOrEqual(23)
      }
    }
  }

  // availability
  const av = data.availability
  expect(av, `${file}: availability must be present`).toBeTruthy()
  expect(typeof av.openHour, `${file}: openHour must be number`).toBe('number')
  expect(typeof av.closeHour, `${file}: closeHour must be number`).toBe('number')
  expect(av.openHour, `${file}: openHour 0-23`).toBeGreaterThanOrEqual(0)
  expect(av.openHour, `${file}: openHour 0-23`).toBeLessThanOrEqual(23)
  expect(av.closeHour, `${file}: closeHour 0-23`).toBeGreaterThanOrEqual(0)
  expect(av.closeHour, `${file}: closeHour 0-23`).toBeLessThanOrEqual(23)
}

// ---------------------------------------------------------------------------
// Outcome validation (shared by actions and events)
// ---------------------------------------------------------------------------

/**
 * A dose is { substanceId, value > 0, chance? in (0, 1] }. Substance ids are
 * cross-checked against content/substances below.
 */
function validateDoses(doses, label) {
  if (doses === null || doses === undefined) return
  expect(Array.isArray(doses), `${label}: doses must be an array`).toBe(true)
  for (const dose of doses) {
    expect(typeof dose.substanceId, `${label}: dose.substanceId must be string`).toBe('string')
    expect(typeof dose.value, `${label}: dose.value must be number`).toBe('number')
    expect(dose.value, `${label}: dose.value must be > 0`).toBeGreaterThan(0)
    if (dose.chance !== undefined) {
      expect(dose.chance, `${label}: dose.chance must be in (0, 1]`).toBeGreaterThan(0)
      expect(dose.chance, `${label}: dose.chance must be in (0, 1]`).toBeLessThanOrEqual(1)
    }
  }
}

/**
 * Outcomes write status, never sobriety — what went into the player is a dose.
 */
function validateOutcome(outcome, label) {
  if (!outcome) return
  if (outcome.statusChanges) {
    expect(
      outcome.statusChanges.sobriety,
      `${label}: statusChanges.sobriety is not writable — use doses: [{ substanceId, value }]`
    ).toBeUndefined()
  }
  validateDoses(outcome.doses, label)
  // Nothing in the game can grant a trauma yet; a non-null value would be silently ignored.
  expect(
    outcome.traumaGained ?? null,
    `${label}: traumaGained is not supported — there are no trauma definitions to grant`
  ).toBeNull()
  if (outcome.inspiration !== undefined && outcome.inspiration !== null) {
    const ins = outcome.inspiration
    expect(ins.strength, `${label}: inspiration.strength must be 1-100`).toBeGreaterThanOrEqual(1)
    expect(ins.strength, `${label}: inspiration.strength must be 1-100`).toBeLessThanOrEqual(100)
    expect(
      Number.isInteger(ins.ticksTotal),
      `${label}: inspiration.ticksTotal must be a whole number`
    ).toBe(true)
    expect(ins.ticksTotal, `${label}: inspiration.ticksTotal must be >= 1`).toBeGreaterThanOrEqual(
      1
    )
    if (ins.mediumId !== null && ins.mediumId !== undefined) {
      expect(typeof ins.mediumId, `${label}: inspiration.mediumId must be string or null`).toBe(
        'string'
      )
    }
  }
}

/** Every outcome an action or event can produce, flattened. */
function outcomesOf(entry) {
  const direct = [
    entry.success,
    entry.failure,
    entry.criticalSuccess,
    entry.criticalFailure,
    entry.outcome,
  ]
  const fromChoices = (entry.choices ?? []).flatMap((c) => [c.outcome, c.failureOutcome])
  return [...direct, ...fromChoices].filter(Boolean)
}

// ---------------------------------------------------------------------------
// Action validation
// ---------------------------------------------------------------------------

const VALID_CHECK_STATS = VALID_STATS

function validateAction(data, file) {
  const required = ['id', 'label', 'timeCost', 'weight']
  for (const field of required) {
    expect(data, `${file} action '${data.id ?? '?'}': missing field '${field}'`).toHaveProperty(
      field
    )
  }

  if (data.kind === 'make') {
    // Taking stock is free; the work is what costs, and the medium says how much.
    expect(data.timeCost, `${file} '${data.id}': a 'make' action costs no time itself`).toBe(0)
    expect(
      data.requirements?.requiresInspiration,
      `${file} '${data.id}': making requires inspiration`
    ).toBe(true)
    return
  }
  expect(data.timeCost, `${file} '${data.id}': timeCost must be >= 1`).toBeGreaterThanOrEqual(1)
  expect(data.weight, `${file} '${data.id}': weight must be >= 0`).toBeGreaterThanOrEqual(0)

  // success outcome is required
  expect(data.success, `${file} '${data.id}': success outcome required`).toBeTruthy()
  expect(data.success.narrative, `${file} '${data.id}': success.narrative required`).toBeTruthy()

  // Anything that costs money must declare the price as a money floor,
  // so a broke player is told the price instead of going negative.
  const cost = data.success.moneyChange
  if (typeof cost === 'number' && cost < 0) {
    expect(
      data.requirements?.minMoney,
      `${file} '${data.id}': costs ${cost} but requirements.minMoney is not set to at least ${-cost}`
    ).toBeGreaterThanOrEqual(-cost)
  }

  // If there's a check, validate it
  if (data.check) {
    expect(typeof data.check.stat, `${file} '${data.id}': check.stat must be string`).toBe('string')
    expect(
      VALID_CHECK_STATS,
      `${file} '${data.id}': check.stat '${data.check.stat}' is not a valid stat`
    ).toContain(data.check.stat)
    expect(typeof data.check.dc, `${file} '${data.id}': check.dc must be number`).toBe('number')
    expect(data.check.dc, `${file} '${data.id}': check.dc must be > 0`).toBeGreaterThan(0)
    // If check has a stat, failure outcome is required
    expect(
      data.failure,
      `${file} '${data.id}': actions with dice checks must have a failure outcome`
    ).toBeTruthy()
  }

  for (const outcome of outcomesOf(data)) {
    validateOutcome(outcome, `${file} '${data.id}'`)
  }

  if (data.kind !== undefined) {
    expect(
      VALID_ACTION_KINDS,
      `${file} '${data.id}': unknown action kind '${data.kind}'`
    ).toContain(data.kind)
  }
  if (data.interruptsInspiration !== undefined) {
    expect(
      typeof data.interruptsInspiration,
      `${file} '${data.id}': interruptsInspiration must be boolean`
    ).toBe('boolean')
  }
  const requiresInspiration = data.requirements?.requiresInspiration
  if (requiresInspiration !== undefined && requiresInspiration !== null) {
    expect(
      typeof requiresInspiration,
      `${file} '${data.id}': requiresInspiration must be boolean`
    ).toBe('boolean')
  }
}

// ---------------------------------------------------------------------------
// Item validation
// ---------------------------------------------------------------------------

function validateItem(data, file) {
  const required = ['id', 'name', 'type']
  for (const field of required) {
    expect(data, `${file} item '${data.id ?? '?'}': missing field '${field}'`).toHaveProperty(field)
  }

  expect(VALID_ITEM_TYPES, `${file} '${data.id}': invalid type '${data.type}'`).toContain(data.type)

  if (data.effects) {
    expect(Array.isArray(data.effects), `${file} '${data.id}': effects must be array`).toBe(true)
    for (const effect of data.effects) {
      expect(effect, `${file} '${data.id}': effect missing target`).toHaveProperty('target')
      expect(effect, `${file} '${data.id}': effect missing value`).toHaveProperty('value')
      expect(typeof effect.value, `${file} '${data.id}': effect.value must be number`).toBe(
        'number'
      )
      expect(
        effect.target,
        `${file} '${data.id}': effects cannot target sobriety — declare doses instead`
      ).not.toBe('sobriety')
      // An effect lands on a status, or on a stat as a timed modifier. Nothing else exists.
      expect(
        [...VALID_STATUS_KEYS, ...VALID_STATS],
        `${file} '${data.id}': effect target '${effect.target}' is neither a status nor a stat`
      ).toContain(effect.target)
    }
  }
  validateDoses(data.doses, `${file} '${data.id}'`)

  if (data.mediumIds !== undefined) {
    expect(Array.isArray(data.mediumIds), `${file} '${data.id}': mediumIds must be array`).toBe(
      true
    )
    expect(
      ['tool', 'surface'],
      `${file} '${data.id}': only tools and surfaces name mediums`
    ).toContain(data.type)
  }
  if (data.type === 'surface') {
    expect(
      data.mediumIds?.length,
      `${file} '${data.id}': a surface must take at least one medium`
    ).toBeGreaterThan(0)
  }
  if (data.spentOnUse !== undefined) {
    expect(typeof data.spentOnUse, `${file} '${data.id}': spentOnUse must be boolean`).toBe(
      'boolean'
    )
    expect(data.type, `${file} '${data.id}': only a tool can be spent on use`).toBe('tool')
  }
  if (['tool', 'surface', 'ingredient'].includes(data.type)) {
    // Anything that can end up in a piece has to read inside the piece's sentence.
    expect(typeof data.pieceAs, `${file} '${data.id}': a ${data.type} needs a pieceAs phrase`).toBe(
      'string'
    )
    expect(data.pieceAs.length, `${file} '${data.id}': pieceAs must not be empty`).toBeGreaterThan(
      0
    )
  }
  if (data.foundAs !== undefined && data.foundAs !== null) {
    expect(typeof data.foundAs, `${file} '${data.id}': foundAs must be string`).toBe('string')
    expect(data.foundAs.length, `${file} '${data.id}': foundAs must not be empty`).toBeGreaterThan(
      0
    )
  }
}

// ---------------------------------------------------------------------------
// Scavenge table validation
// ---------------------------------------------------------------------------

const SCAVENGE_TABLE_REQUIRED_FIELDS = ['id', 'display', 'stat', 'dc', 'entries']

function validateScavengeTable(data, file) {
  for (const field of SCAVENGE_TABLE_REQUIRED_FIELDS) {
    expect(data, `${file}: missing field '${field}'`).toHaveProperty(field)
  }
  expect(VALID_STATS, `${file}: stat '${data.stat}' is not a stat`).toContain(data.stat)
  expect(data.dc, `${file}: dc must be > 0`).toBeGreaterThan(0)
  expect(Array.isArray(data.entries), `${file}: entries must be an array`).toBe(true)
  expect(data.entries.length, `${file}: a table needs entries`).toBeGreaterThan(0)
  const seen = new Set()
  for (const entry of data.entries) {
    expect(typeof entry.itemId, `${file}: entry.itemId must be string`).toBe('string')
    expect(seen.has(entry.itemId), `${file}: duplicate entry '${entry.itemId}'`).toBe(false)
    seen.add(entry.itemId)
    expect(entry.weight, `${file} '${entry.itemId}': weight must be > 0`).toBeGreaterThan(0)
    expect(typeof entry.rare, `${file} '${entry.itemId}': rare must be boolean`).toBe('boolean')
    expect(typeof entry.unique, `${file} '${entry.itemId}': unique must be boolean`).toBe('boolean')
    validateOutcome({ inspiration: entry.inspiration }, `${file} '${entry.itemId}'`)
  }
  // A table that is nothing but uniques would run dry and leave the action lying.
  expect(
    data.entries.some((e) => !e.unique),
    `${file}: a table needs at least one entry that can be found again`
  ).toBe(true)
}

// ---------------------------------------------------------------------------
// Substance / Condition validation
// ---------------------------------------------------------------------------

function validatePersona(persona, label) {
  expect(persona, `${label}: persona required`).toBeTruthy()
  expect(typeof persona.id, `${label}: persona.id must be string`).toBe('string')
  expect(typeof persona.display, `${label}: persona.display must be string`).toBe('string')
  expect(typeof persona.compulsion, `${label}: persona.compulsion must be string`).toBe('string')
}

/**
 * Everything has a cost and everything has a use. A modifier set with only
 * pluses or only minuses fails the build.
 */
function validateModifiers(modifiers, label) {
  expect(Array.isArray(modifiers), `${label}: modifiers must be an array`).toBe(true)
  expect(modifiers.length, `${label}: modifiers must not be empty`).toBeGreaterThan(0)
  for (const mod of modifiers) {
    expect(VALID_STATS, `${label}: modifier stat '${mod.stat}' is not a stat`).toContain(mod.stat)
    expect(typeof mod.value, `${label}: modifier value must be number`).toBe('number')
    expect(mod.value, `${label}: modifier value must not be 0`).not.toBe(0)
  }
  expect(
    modifiers.some((m) => m.value > 0),
    `${label}: needs at least one pro (positive modifier)`
  ).toBe(true)
  expect(
    modifiers.some((m) => m.value < 0),
    `${label}: needs at least one con (negative modifier)`
  ).toBe(true)
}

const SUBSTANCE_REQUIRED_FIELDS = [
  'id',
  'display',
  'family',
  'persona',
  'decayPerTick',
  'habituationRate',
  'habituationDecayPerTick',
  'withdrawal',
  'bands',
]

function validateSubstance(data, file) {
  for (const field of SUBSTANCE_REQUIRED_FIELDS) {
    expect(data, `${file}: missing field '${field}'`).toHaveProperty(field)
  }
  expect(VALID_SUBSTANCE_FAMILIES, `${file}: invalid family '${data.family}'`).toContain(
    data.family
  )
  validatePersona(data.persona, file)
  expect(data.decayPerTick, `${file}: decayPerTick must be > 0`).toBeGreaterThan(0)
  expect(data.habituationRate, `${file}: habituationRate must be 0-1`).toBeGreaterThanOrEqual(0)
  expect(data.habituationRate, `${file}: habituationRate must be 0-1`).toBeLessThanOrEqual(1)
  expect(
    data.habituationDecayPerTick,
    `${file}: habituationDecayPerTick must be >= 0`
  ).toBeGreaterThanOrEqual(0)

  if (data.withdrawal !== null) {
    const w = data.withdrawal
    expect(
      w.habituationAtLeast,
      `${file}: withdrawal.habituationAtLeast must be 1-100`
    ).toBeGreaterThan(0)
    expect(
      w.habituationAtLeast,
      `${file}: withdrawal.habituationAtLeast must be 1-100`
    ).toBeLessThanOrEqual(100)
    expect(
      w.intoxicationBelow,
      `${file}: withdrawal.intoxicationBelow must be > 0`
    ).toBeGreaterThan(0)
    expect(
      data.habituationRate,
      `${file}: a substance with withdrawal must habituate`
    ).toBeGreaterThan(0)
    validatePersona(w.persona, `${file} withdrawal`)
    validateModifiers(w.modifiers, `${file} withdrawal`)
  }

  expect(Array.isArray(data.bands), `${file}: bands must be an array`).toBe(true)
  expect(data.bands.length, `${file}: needs at least one band`).toBeGreaterThan(0)
  const thresholds = new Set()
  for (const band of data.bands) {
    expect(band.atLeast, `${file}: band.atLeast must be 1-100`).toBeGreaterThan(0)
    expect(band.atLeast, `${file}: band.atLeast must be 1-100`).toBeLessThanOrEqual(100)
    expect(thresholds.has(band.atLeast), `${file}: duplicate band threshold ${band.atLeast}`).toBe(
      false
    )
    thresholds.add(band.atLeast)
    validateModifiers(band.modifiers, `${file} band ${band.atLeast}`)
  }
}

const MEDIUM_REQUIRED_FIELDS = ['id', 'display', 'stat', 'description', 'pieceAs', 'making']

function validateMedium(data, file) {
  for (const field of MEDIUM_REQUIRED_FIELDS) {
    expect(data, `${file}: missing field '${field}'`).toHaveProperty(field)
  }
  expect(VALID_STATS, `${file}: stat '${data.stat}' is not a stat`).toContain(data.stat)
  expect(typeof data.description, `${file}: description must be string`).toBe('string')
  expect(data.description.length, `${file}: description must not be empty`).toBeGreaterThan(0)
  expect(typeof data.pieceAs, `${file}: pieceAs must be string`).toBe('string')
  expect(data.pieceAs.length, `${file}: pieceAs must not be empty`).toBeGreaterThan(0)

  const making = data.making
  expect(
    typeof making.gameId,
    `${file}: making.gameId must be string — every form is played somehow`
  ).toBe('string')
  expect(
    Number.isInteger(making.ticksTotal),
    `${file}: making.ticksTotal must be a whole number`
  ).toBe(true)
  expect(making.ticksTotal, `${file}: making.ticksTotal must be >= 1`).toBeGreaterThanOrEqual(1)
  expect(typeof making.dc, `${file}: making.dc must be number`).toBe('number')
  expect(making.xp, `${file}: making.xp must be > 0`).toBeGreaterThan(0)
  for (const flag of ['toolRequired', 'takesIngredient', 'leavesArtifact']) {
    expect(typeof making[flag], `${file}: making.${flag} must be boolean`).toBe('boolean')
  }
  if (making.takesIngredient) {
    expect(making.toolRequired, `${file}: an ingredient needs a tool to work it in`).toBe(true)
  }
  if (making.anywhere !== undefined) {
    // Where it can be done and what it takes in the hands are separate questions: a mime needs gloves.
    expect(typeof making.anywhere, `${file}: making.anywhere must be boolean`).toBe('boolean')
  }
  if (making.encore !== undefined) {
    expect(making.encore.chance, `${file}: encore.chance must be in (0, 1)`).toBeGreaterThan(0)
    expect(
      making.encore.chance,
      `${file}: encore.chance must be in (0, 1) — a certain encore never ends`
    ).toBeLessThan(1)
    expect(making.encore.strength, `${file}: encore.strength must be 1-100`).toBeGreaterThanOrEqual(
      1
    )
    expect(making.encore.strength, `${file}: encore.strength must be 1-100`).toBeLessThanOrEqual(
      100
    )
    expect(
      Number.isInteger(making.encore.ticksTotal),
      `${file}: encore.ticksTotal must be a whole number`
    ).toBe(true)
    expect(
      making.encore.ticksTotal,
      `${file}: the encore has to outlast the work it asks for`
    ).toBeGreaterThan(making.ticksTotal)
  }
  for (const refusal of making.refusals ?? []) {
    expect(typeof refusal.personaId, `${file}: refusal.personaId must be string`).toBe('string')
    expect(typeof refusal.reason, `${file}: a refusal says why`).toBe('string')
    expect(refusal.reason.length, `${file}: a refusal says why`).toBeGreaterThan(0)
  }
  for (const [key, delta] of Object.entries(making.statusChanges ?? {})) {
    expect(VALID_STATUS_KEYS, `${file}: making.statusChanges '${key}' is not a status`).toContain(
      key
    )
    expect(typeof delta, `${file}: making.statusChanges.${key} must be number`).toBe('number')
  }
}

const CONDITION_REQUIRED_FIELDS = ['id', 'display', 'source', 'weight', 'persona', 'modifiers']

function validateCondition(data, file) {
  for (const field of CONDITION_REQUIRED_FIELDS) {
    expect(data, `${file}: missing field '${field}'`).toHaveProperty(field)
  }
  expect(
    VALID_STATUS_KEYS,
    `${file}: source.status '${data.source.status}' is not a status`
  ).toContain(data.source.status)
  const hasBelow = typeof data.source.below === 'number'
  const hasAbove = typeof data.source.above === 'number'
  expect(hasBelow !== hasAbove, `${file}: source needs exactly one of below / above`).toBe(true)
  expect(data.weight, `${file}: weight must be in (0, 1]`).toBeGreaterThan(0)
  expect(data.weight, `${file}: weight must be in (0, 1]`).toBeLessThanOrEqual(1)
  validatePersona(data.persona, file)
  validateModifiers(data.modifiers, file)
}

// ---------------------------------------------------------------------------
// Tests — Characters
// ---------------------------------------------------------------------------

describe('content/characters/*.json — Character contract', () => {
  const charactersDir = join(CONTENT_ROOT, 'characters')
  const files = loadJsonFiles(charactersDir)

  it('content/characters/ directory exists', () => {
    expect(existsSync(charactersDir)).toBe(true)
  })

  for (const { file, data } of files) {
    it(`${file} — valid Character`, () => {
      validateCharacter(data, file)
    })

    it(`${file} — has at least one schedule entry`, () => {
      expect(
        data.schedule?.entries?.length ?? 0,
        `${file}: character must have at least one schedule entry`
      ).toBeGreaterThan(0)
    })
  }
})

// ---------------------------------------------------------------------------
// Tests — Locations (all maps)
// ---------------------------------------------------------------------------

describe('content/maps/*/locations/*.json — Location contract', () => {
  const mapDirs = getMapDirs()
  const allFiles = mapDirs.flatMap((mapDir) => loadJsonFiles(join(mapDir, 'locations')))

  it('content/maps/ directory exists', () => {
    expect(existsSync(join(CONTENT_ROOT, 'maps'))).toBe(true)
  })

  for (const { file, data } of allFiles) {
    it(`${file} — valid Location`, () => {
      validateLocation(data, file)
    })
  }
})

// ---------------------------------------------------------------------------
// Tests — Actions (all maps)
// ---------------------------------------------------------------------------

describe('content/maps/*/actions/*.json — Action contract', () => {
  const mapDirs = getMapDirs()
  const allFiles = mapDirs.flatMap((mapDir) => loadJsonFiles(join(mapDir, 'actions')))

  for (const { file, data } of allFiles) {
    // Action files can be arrays or objects (keyed by action ID)
    const actions = Array.isArray(data) ? data : Object.values(data)

    it(`${file} — all actions valid`, () => {
      expect(actions.length, `${file}: must contain at least one action`).toBeGreaterThan(0)
      for (const action of actions) {
        validateAction(action, file)
      }
    })
  }
})

// ---------------------------------------------------------------------------
// Tests — Items
// ---------------------------------------------------------------------------

function validateEvent(data, file) {
  const required = ['id', 'title', 'type', 'oneTime', 'conditions', 'narrative']
  for (const field of required) {
    expect(data, `${file} event '${data.id ?? '?'}': missing field '${field}'`).toHaveProperty(
      field
    )
  }
  expect(
    ['random', 'triggered'],
    `${file} '${data.id}': type must be random or triggered`
  ).toContain(data.type)
  if (data.type === 'random') {
    expect(typeof data.probability, `${file} '${data.id}': random events need a probability`).toBe(
      'number'
    )
    expect(data.probability, `${file} '${data.id}': probability must be in (0, 1]`).toBeGreaterThan(
      0
    )
    expect(
      data.probability,
      `${file} '${data.id}': probability must be in (0, 1]`
    ).toBeLessThanOrEqual(1)
  }
  expect(
    data.narrative?.tokens?.length,
    `${file} '${data.id}': narrative needs tokens`
  ).toBeGreaterThan(0)
  const hasChoices = Array.isArray(data.choices) && data.choices.length > 0
  expect(
    hasChoices || Boolean(data.outcome),
    `${file} '${data.id}': an event needs choices or an outcome`
  ).toBe(true)
  for (const outcome of outcomesOf(data)) {
    validateOutcome(outcome, `${file} '${data.id}'`)
  }
  if (hasChoices) {
    for (const choice of data.choices) {
      expect(typeof choice.label, `${file} '${data.id}': every choice needs a label`).toBe('string')
      expect(
        choice.outcome,
        `${file} '${data.id}': choice '${choice.label}' needs an outcome`
      ).toBeTruthy()
      if (choice.check) {
        expect(
          VALID_CHECK_STATS,
          `${file} '${data.id}': check.stat '${choice.check.stat}' is not a valid stat`
        ).toContain(choice.check.stat)
        expect(choice.check.dc, `${file} '${data.id}': check.dc must be > 0`).toBeGreaterThan(0)
        expect(
          choice.failureOutcome,
          `${file} '${data.id}': a checked choice '${choice.label}' needs a failureOutcome`
        ).toBeTruthy()
      }
    }
  }
}

describe('content/maps/*/events/*.json — Event contract', () => {
  const ids = new Set()
  for (const mapDir of getMapDirs()) {
    const dir = join(mapDir, 'events')
    for (const { file, data } of loadJsonFiles(dir)) {
      const events = Array.isArray(data) ? data : Object.values(data)
      for (const event of events) {
        it(`${file}: event '${event.id}' honours the contract`, () => {
          validateEvent(event, file)
          expect(ids.has(event.id), `${file}: duplicate event id '${event.id}'`).toBe(false)
          ids.add(event.id)
        })
      }
    }
  }
})

describe('content/items/*.json — Item contract', () => {
  const itemsDir = join(CONTENT_ROOT, 'items')
  const files = loadJsonFiles(itemsDir)

  it('content/items/ directory exists', () => {
    expect(existsSync(itemsDir)).toBe(true)
  })

  for (const { file, data } of files) {
    // Item files can be arrays or objects keyed by item ID
    const items = Array.isArray(data) ? data : Object.values(data)

    it(`${file} — all items valid`, () => {
      for (const item of items) {
        validateItem(item, file)
      }
    })
  }
})

// ---------------------------------------------------------------------------
// Tests — Substances and Conditions
// ---------------------------------------------------------------------------

describe('content/substances/*.json — Substance contract', () => {
  const dir = join(CONTENT_ROOT, 'substances')
  const files = loadJsonFiles(dir)

  it('content/substances/ directory exists', () => {
    expect(existsSync(dir)).toBe(true)
  })

  it('has at least one substance', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  const ids = new Set()
  for (const { file, data } of files) {
    it(`${file} — valid Substance`, () => {
      validateSubstance(data, file)
      expect(ids.has(data.id), `${file}: duplicate substance id '${data.id}'`).toBe(false)
      ids.add(data.id)
    })
  }
})

describe('content/conditions/*.json — Condition contract', () => {
  const dir = join(CONTENT_ROOT, 'conditions')
  const files = loadJsonFiles(dir)

  it('content/conditions/ directory exists', () => {
    expect(existsSync(dir)).toBe(true)
  })

  const ids = new Set()
  for (const { file, data } of files) {
    it(`${file} — valid Condition`, () => {
      validateCondition(data, file)
      expect(ids.has(data.id), `${file}: duplicate condition id '${data.id}'`).toBe(false)
      ids.add(data.id)
    })
  }
})

describe('content/scavenge/*.json — Scavenge table contract', () => {
  const dir = join(CONTENT_ROOT, 'scavenge')
  const files = loadJsonFiles(dir)
  const itemsById = new Map(
    loadJsonFiles(join(CONTENT_ROOT, 'items')).flatMap(({ data }) =>
      (Array.isArray(data) ? data : Object.values(data)).map((i) => [i.id, i])
    )
  )
  const mediumIds = new Set(loadJsonFiles(join(CONTENT_ROOT, 'mediums')).map(({ data }) => data.id))

  it('content/scavenge/ directory exists', () => {
    expect(existsSync(dir)).toBe(true)
  })

  const ids = new Set()
  for (const { file, data } of files) {
    it(`${file} — valid scavenge table`, () => {
      validateScavengeTable(data, file)
      expect(ids.has(data.id), `${file}: duplicate table id '${data.id}'`).toBe(false)
      ids.add(data.id)
      for (const entry of data.entries) {
        const item = itemsById.get(entry.itemId)
        expect(item, `${file}: entry '${entry.itemId}' is not an item`).toBeTruthy()
        expect(
          typeof item.foundAs,
          `${file}: '${entry.itemId}' can be found, so it needs a foundAs phrase for the prose`
        ).toBe('string')
        if (entry.inspiration?.mediumId) {
          expect(
            mediumIds.has(entry.inspiration.mediumId),
            `${file} '${entry.itemId}': unknown medium`
          ).toBe(true)
        }
      }
    })
  }

  // Every location names a table that exists (or null, for nothing to find)
  const tableIds = new Set(files.map(({ data }) => data.id))
  for (const mapDir of getMapDirs()) {
    for (const { file, data: location } of loadJsonFiles(join(mapDir, 'locations'))) {
      it(`${file}: scavengeTableId is declared and real`, () => {
        expect(
          location,
          `${file}: every location declares scavengeTableId (null for nothing)`
        ).toHaveProperty('scavengeTableId')
        if (location.scavengeTableId !== null) {
          expect(
            tableIds.has(location.scavengeTableId),
            `${file}: unknown scavenge table '${location.scavengeTableId}'`
          ).toBe(true)
        }
      })
    }
  }

  // Tools and surfaces name real mediums
  for (const [itemId, item] of itemsById) {
    for (const mediumId of item.mediumIds ?? []) {
      it(`item '${itemId}': medium '${mediumId}' exists in medium data`, () => {
        expect(mediumIds.has(mediumId), `Item '${itemId}' names unknown medium '${mediumId}'`).toBe(
          true
        )
      })
    }
  }
})

describe('content/voices/*.json — Voice catalog contract', () => {
  const dir = join(CONTENT_ROOT, 'voices')
  const files = loadJsonFiles(dir)
  const sober = files.find(({ data }) => data.id === 'sober')

  it('content/voices/ directory exists and has a sober catalog', () => {
    expect(existsSync(dir)).toBe(true)
    expect(sober, 'content/voices/sober.json is the fallback for every line').toBeTruthy()
  })

  // Every persona any substance, withdrawal, or condition can put in charge
  const personaIds = new Set(['sober'])
  for (const { data } of loadJsonFiles(join(CONTENT_ROOT, 'substances'))) {
    personaIds.add(data.persona?.id)
    if (data.withdrawal) personaIds.add(data.withdrawal.persona?.id)
  }
  for (const { data } of loadJsonFiles(join(CONTENT_ROOT, 'conditions'))) {
    personaIds.add(data.persona?.id)
  }

  for (const { file, data } of files) {
    it(`${file} — valid voice catalog`, () => {
      expect(typeof data.id, `${file}: id must be string`).toBe('string')
      expect(
        file.endsWith(`${data.id}.json`),
        `${file}: file name must match id '${data.id}'`
      ).toBe(true)
      expect(
        personaIds.has(data.id),
        `${file}: '${data.id}' is not a persona anything can put in charge`
      ).toBe(true)
      expect(data.lines && typeof data.lines === 'object', `${file}: lines must be an object`).toBe(
        true
      )
      for (const [code, text] of Object.entries(data.lines)) {
        expect(typeof text, `${file}: line '${code}' must be a string`).toBe('string')
        expect(text.length, `${file}: line '${code}' must not be empty`).toBeGreaterThan(0)
        // A persona can only re-voice a line sober already has, so the fallback always exists.
        expect(sober.data.lines, `${file}: code '${code}' has no sober fallback`).toHaveProperty([
          code,
        ])
      }
    })
  }
})

describe('content/mediums/*.json — Medium contract', () => {
  const dir = join(CONTENT_ROOT, 'mediums')
  const files = loadJsonFiles(dir)

  it('content/mediums/ directory exists', () => {
    expect(existsSync(dir)).toBe(true)
  })

  it('has at least one medium', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  const ids = new Set()
  for (const { file, data } of files) {
    it(`${file} — valid Medium`, () => {
      validateMedium(data, file)
      expect(ids.has(data.id), `${file}: duplicate medium id '${data.id}'`).toBe(false)
      ids.add(data.id)
    })
  }
})

describe("content/vocabulary.json — the game's words", () => {
  it('the screen has every word it shows, and none is blank', () => {
    const ui = VOCABULARY.ui
    const paths = [
      'menu.title',
      'menu.empty',
      'menu.emptyWith',
      'narrative.skipHint',
      'footer.idle',
      'footer.keys',
      'tabs.status',
      'tabs.inventory',
      'tabs.work',
      'sections.time',
      'sections.vitals',
      'sections.muse',
      'sections.funds',
      'sections.carrying',
      'sections.made',
      'nothing',
    ]
    for (const path of paths) {
      const word = path.split('.').reduce((node, key) => node?.[key], ui)
      expect(typeof word, `ui.${path}`).toBe('string')
      expect(word.length, `ui.${path}`).toBeGreaterThan(0)
    }
    expect(ui.menu.emptyWith, 'ui.menu.emptyWith names who').toContain('{name}')
  })

  it('every stat and vital has an id and reads as something', () => {
    for (const entry of [...VOCABULARY.stats, ...VOCABULARY.statuses]) {
      expect(typeof entry.id).toBe('string')
      expect(typeof entry.display).toBe('string')
      expect(entry.display.length).toBeGreaterThan(0)
    }
    const ids = [...VOCABULARY.stats, ...VOCABULARY.statuses].map((e) => e.id)
    expect(new Set(ids).size, 'ids are unique across stats and vitals').toBe(ids.length)
  })

  it('every vital says how it looks and where its bar turns', () => {
    for (const status of VOCABULARY.statuses) {
      expect(typeof status.icon, `${status.id}: icon`).toBe('string')
      expect(typeof status.writable, `${status.id}: writable`).toBe('boolean')
      expect(status.danger, `${status.id}: danger below warning`).toBeLessThan(status.warning)
      expect(status.warning).toBeLessThanOrEqual(100)
    }
  })

  it('the code fallbacks have not drifted from it', async () => {
    const defaults = await import('../src/models/defaults.js')
    expect([...defaults.STAT_IDS_DEFAULT]).toEqual(VALID_STATS)
    expect([...defaults.STATUS_IDS_WRITABLE_DEFAULT].sort()).toEqual([...VALID_STATUS_KEYS].sort())
    expect([...defaults.SIMULATION_TIERS_DEFAULT]).toEqual(VALID_SIMULATION_TIERS)
  })
})

describe('content/game.json — what a new game is', () => {
  const config = JSON.parse(readFileSync(join(CONTENT_ROOT, 'game.json'), 'utf-8'))

  it("has the title screen's words", () => {
    for (const field of ['title', 'tagline']) {
      expect(typeof config[field], `game.json: ${field} must be string`).toBe('string')
      expect(config[field].length).toBeGreaterThan(0)
    }
    expect(Array.isArray(config.bootLines)).toBe(true)
    expect(
      config.bootLines.some((line) => line.includes('{version}')),
      'a boot line shows {version}'
    ).toBe(true)
    expect(typeof config.menu?.new).toBe('string')
    expect(typeof config.menu?.load).toBe('string')
    expect(typeof config.menu?.loadFailed).toBe('string')
  })

  it('names a map that exists and starts the player somewhere on it', () => {
    const mapDir = join(CONTENT_ROOT, 'maps', config.mapId)
    expect(existsSync(mapDir), `game.json: no map '${config.mapId}'`).toBe(true)
    const locationIds = loadJsonFiles(join(mapDir, 'locations')).map(({ data }) => data.id)
    expect(
      locationIds,
      `game.json: start.locationId '${config.start.locationId}' is not on the map`
    ).toContain(config.start.locationId)
  })

  it('says who the player is and what they start with', () => {
    const { start } = config
    expect(typeof start.playerName).toBe('string')
    expect(typeof start.money).toBe('number')
    expect(start.statRoll.min).toBeGreaterThanOrEqual(1)
    expect(start.statRoll.max).toBeGreaterThanOrEqual(start.statRoll.min)
    expect(start.statRoll.max).toBeLessThanOrEqual(100)
    for (const key of VALID_STATUS_KEYS) {
      expect(typeof start.status[key], `game.json: start.status.${key} must be number`).toBe(
        'number'
      )
      expect(start.status[key]).toBeGreaterThanOrEqual(0)
      expect(start.status[key]).toBeLessThanOrEqual(100)
    }
  })
})

describe('content/games/*.json — Minigame contract', () => {
  const files = loadJsonFiles(join(CONTENT_ROOT, 'games'))
  const gameIds = new Set(files.map(({ data }) => data.id))
  const personaIds = new Set(['sober'])
  for (const { data } of loadJsonFiles(join(CONTENT_ROOT, 'substances'))) {
    personaIds.add(data.persona?.id)
    if (data.withdrawal) personaIds.add(data.withdrawal.persona?.id)
  }
  for (const { data } of loadJsonFiles(join(CONTENT_ROOT, 'conditions')))
    personaIds.add(data.persona?.id)

  const SHAPES = {
    steady: { choices: ['work'], lines: ['work'], params: [] },
    push_luck: {
      choices: ['press', 'stop'],
      lines: ['pressed', 'busted', 'stopped'],
      params: ['riskBase', 'riskStep', 'skillRelief', 'bankCap', 'bustModifier', 'timidModifier'],
    },
    word_pick: {
      choices: [],
      lines: ['picked'],
      params: ['picksPerRound', 'voiceCap', 'mushModifier', 'registers'],
    },
    read_room: {
      choices: ['push', 'hold', 'bow'],
      lines: ['pushed', 'held', 'bowed', 'crowd'],
      params: ['crowdStart', 'scoreCap', 'transitions'],
    },
  }

  for (const { file, data } of files) {
    it(`${file} — valid game`, () => {
      expect(
        file.endsWith(`${data.id}.json`),
        `${file}: file name must match id '${data.id}'`
      ).toBe(true)
      const shape = SHAPES[data.shape]
      expect(shape, `${file}: unknown shape '${data.shape}'`).toBeTruthy()
      expect(
        Number.isInteger(data.sittingTicks) && data.sittingTicks >= 1,
        `${file}: sittingTicks must be a whole number >= 1`
      ).toBe(true)
      expect(typeof data.description, `${file}: description must be string`).toBe('string')
      for (const id of shape.choices) {
        expect(typeof data.choices?.[id]?.label, `${file}: choice '${id}' needs a label`).toBe(
          'string'
        )
      }
      for (const key of shape.lines)
        expect(data.lines, `${file}: lines.${key} missing`).toHaveProperty(key)
      for (const key of shape.params)
        expect(data.params, `${file}: params.${key} missing`).toHaveProperty(key)

      for (const compulsion of data.compulsions ?? []) {
        expect(
          personaIds.has(compulsion.personaId),
          `${file}: compulsion names unknown persona '${compulsion.personaId}'`
        ).toBe(true)
        expect(
          shape.choices,
          `${file}: compulsion forbids unknown choice '${compulsion.choiceId}'`
        ).toContain(compulsion.choiceId)
        expect(typeof compulsion.reason, `${file}: a compulsion says why`).toBe('string')
      }
      // No persona may be left with nothing to choose in any round.
      for (const personaId of new Set((data.compulsions ?? []).map((c) => c.personaId))) {
        for (let round = 1; round <= 12; round++) {
          const forbidden = (data.compulsions ?? []).filter(
            (c) =>
              c.personaId === personaId &&
              round >= (c.fromRound ?? 1) &&
              round <= (c.toRound ?? Infinity)
          )
          expect(
            forbidden.length,
            `${file}: '${personaId}' has no choice left in round ${round}`
          ).toBeLessThan(shape.choices.length)
        }
      }

      if (data.shape === 'word_pick') {
        const registers = Object.entries(data.params.registers)
        expect(
          registers.length,
          `${file}: needs at least picksPerRound registers`
        ).toBeGreaterThanOrEqual(data.params.picksPerRound)
        const seen = new Set()
        for (const [register, words] of registers) {
          expect(
            words.length,
            `${file}: register '${register}' is too thin to draw from all game`
          ).toBeGreaterThanOrEqual(8)
          for (const word of words) {
            expect(seen.has(word), `${file}: '${word}' is in two registers`).toBe(false)
            seen.add(word)
          }
        }
        for (const [personaId, register] of Object.entries(data.params.personaLean ?? {})) {
          expect(
            personaIds.has(personaId),
            `${file}: personaLean names unknown persona '${personaId}'`
          ).toBe(true)
          expect(
            data.params.registers,
            `${file}: '${personaId}' leans on unknown register '${register}'`
          ).toHaveProperty(register)
        }
      }
      if (data.shape === 'read_room') {
        const crowds = Object.keys(data.lines.crowd)
        expect(crowds, `${file}: crowdStart must be a crowd`).toContain(data.params.crowdStart)
        for (const crowd of crowds) {
          for (const choiceId of ['push', 'hold']) {
            const move = data.params.transitions[crowd]?.[choiceId]
            expect(move, `${file}: no transition for ${choiceId} when ${crowd}`).toBeTruthy()
            expect(typeof move.score, `${file}: ${crowd}.${choiceId}.score must be number`).toBe(
              'number'
            )
            expect(move.to.length, `${file}: ${crowd}.${choiceId} leads nowhere`).toBeGreaterThan(0)
            for (const target of move.to) {
              expect(
                crowds,
                `${file}: ${crowd}.${choiceId} leads to unknown crowd '${target.crowd}'`
              ).toContain(target.crowd)
              expect(target.weight, `${file}: weights must be > 0`).toBeGreaterThan(0)
            }
          }
        }
      }
    })
  }

  // Urges: every persona's urges name a real medium and can outlast the work.
  const mediumsById = new Map(
    loadJsonFiles(join(CONTENT_ROOT, 'mediums')).map(({ data }) => [data.id, data])
  )
  const personaBlocks = [
    ...loadJsonFiles(join(CONTENT_ROOT, 'substances')).flatMap(({ file, data }) =>
      [data.persona, data.withdrawal?.persona].filter(Boolean).map((persona) => ({ file, persona }))
    ),
    ...loadJsonFiles(join(CONTENT_ROOT, 'conditions')).map(({ file, data }) => ({
      file,
      persona: data.persona,
    })),
  ]
  for (const { file, persona } of personaBlocks) {
    for (const urge of persona.urges ?? []) {
      it(`${file}: persona '${persona.id}' urge to '${urge.mediumId}' is real and can be acted on`, () => {
        const medium = mediumsById.get(urge.mediumId)
        expect(medium, `unknown medium '${urge.mediumId}'`).toBeTruthy()
        expect(urge.chancePerTick).toBeGreaterThan(0)
        expect(urge.chancePerTick).toBeLessThanOrEqual(1)
        expect(urge.strength).toBeGreaterThanOrEqual(1)
        expect(urge.strength).toBeLessThanOrEqual(100)
        expect(urge.ticksTotal, 'the urge has to outlast the work').toBeGreaterThan(
          medium.making.ticksTotal
        )
        const refuses = (medium.making.refusals ?? []).some((r) => r.personaId === persona.id)
        expect(refuses, `'${persona.id}' has the urge to do what it refuses to do`).toBe(false)
      })
    }
  }

  for (const { file, data } of loadJsonFiles(join(CONTENT_ROOT, 'mediums'))) {
    it(`${file}: gameId '${data.making?.gameId}' is a game`, () => {
      expect(
        gameIds.has(data.making?.gameId),
        `${file}: unknown game '${data.making?.gameId}'`
      ).toBe(true)
      for (const refusal of data.making?.refusals ?? []) {
        expect(
          personaIds.has(refusal.personaId),
          `${file}: refusal names unknown persona '${refusal.personaId}'`
        ).toBe(true)
      }
    })
  }
})

describe('making — every medium can actually be made in', () => {
  const mediums = loadJsonFiles(join(CONTENT_ROOT, 'mediums')).map(({ data }) => data)
  const mediumIds = new Set(mediums.map((m) => m.id))
  const items = loadJsonFiles(join(CONTENT_ROOT, 'items')).flatMap(({ data }) =>
    Array.isArray(data) ? data : Object.values(data)
  )
  const locationFiles = getMapDirs().flatMap((mapDir) => loadJsonFiles(join(mapDir, 'locations')))
  const locationSurfaces = locationFiles.flatMap(({ data }) => data.surfaces ?? [])

  for (const { file, data: location } of locationFiles) {
    for (const surface of location.surfaces ?? []) {
      for (const mediumId of surface.mediumIds ?? []) {
        it(`${file} surface '${surface.id}': medium '${mediumId}' exists in medium data`, () => {
          expect(
            mediumIds.has(mediumId),
            `Surface '${surface.id}' names unknown medium '${mediumId}'`
          ).toBe(true)
        })
      }
    }
  }

  for (const medium of mediums) {
    it(`medium '${medium.id}': the world holds what it takes to make one`, () => {
      const takes = (thing) => (thing.mediumIds ?? []).includes(medium.id)
      if (medium.making.toolRequired) {
        expect(
          items.some((i) => i.type === 'tool' && takes(i)),
          `nothing in content/items is a tool for ${medium.id}`
        ).toBe(true)
      }
      if (medium.making.anywhere) {
        // The ground is the surface, so the form must leave nothing on it and every place must read in a sentence.
        expect(
          medium.making.leavesArtifact,
          `${medium.id}: a form done anywhere leaves no artifact`
        ).toBe(false)
        for (const { file, data: location } of locationFiles) {
          expect(
            typeof location.pieceAs,
            `${file}: needs pieceAs — '${medium.id}' can be done here`
          ).toBe('string')
        }
        return
      }
      const surfaces = [...items.filter((i) => i.type === 'surface'), ...locationSurfaces].filter(
        takes
      )
      expect(surfaces.length, `nothing anywhere is a surface for ${medium.id}`).toBeGreaterThan(0)
      if (!medium.making.toolRequired) {
        // Nothing in the hands, so it happens at a place.
        expect(locationSurfaces.some(takes), `no location offers a place for ${medium.id}`).toBe(
          true
        )
      }
    })
  }

  // Every line the code asks the voices for is a line sober can say.
  const sober = JSON.parse(readFileSync(join(CONTENT_ROOT, 'voices', 'sober.json'), 'utf-8'))
  const sources = [
    'src/composables/useGameLoop.js',
    'src/stores/game.js',
    'src/engine/describer.js',
    'src/engine/actions.js',
  ]
  const codes = new Set()
  for (const source of sources) {
    const text = readFileSync(resolve(source), 'utf-8')
    for (const match of text.matchAll(
      /'((?:inspiration|scavenge|item|making|mark|piece|work|requirement|menu|save)\.[a-z_.]+)'/g
    )) {
      codes.add(match[1])
    }
  }
  for (const tier of ['botched', 'rough', 'solid', 'inspired']) codes.add(`piece.artist.${tier}`)
  // ...and every line a game says it will speak.
  const gameLineCodes = (value) =>
    typeof value === 'string' ? [value] : Object.values(value).flatMap(gameLineCodes)
  for (const { data } of loadJsonFiles(join(CONTENT_ROOT, 'games'))) {
    for (const code of gameLineCodes(data.lines ?? {})) codes.add(code)
  }

  it('finds the voice codes the code uses', () => {
    expect(codes.size).toBeGreaterThan(20)
  })
  for (const code of codes) {
    it(`voice code '${code}' has a sober line`, () => {
      expect(sober.lines, `sober.json has no line for '${code}'`).toHaveProperty([code])
    })
  }
})

// ---------------------------------------------------------------------------
// Tests — Cross-reference validation
// ---------------------------------------------------------------------------

describe('cross-reference validation', () => {
  // Collect all known location IDs from content/maps/*/locations/
  const mapDirs = getMapDirs()
  const locationFiles = mapDirs.flatMap((mapDir) => loadJsonFiles(join(mapDir, 'locations')))
  const knownLocationIds = new Set(locationFiles.map(({ data }) => data.id).filter(Boolean))

  // Collect all known character IDs from content/characters/
  const characterFiles = loadJsonFiles(join(CONTENT_ROOT, 'characters'))
  const knownCharacterIds = new Set(characterFiles.map(({ data }) => data.id).filter(Boolean))

  // Collect all known item IDs from content/items/
  const itemFiles = loadJsonFiles(join(CONTENT_ROOT, 'items'))
  const knownItemIds = new Set(
    itemFiles.flatMap(({ data }) => {
      const items = Array.isArray(data) ? data : Object.values(data)
      return items.map((i) => i.id).filter(Boolean)
    })
  )

  // Collect all known substance IDs from content/substances/
  const substanceFiles = loadJsonFiles(join(CONTENT_ROOT, 'substances'))
  const knownSubstanceIds = new Set(substanceFiles.map(({ data }) => data.id).filter(Boolean))

  // Character intoxications / habituations name real substances
  for (const { file, data: character } of characterFiles) {
    for (const field of ['intoxications', 'habituations']) {
      for (const substanceId of Object.keys(character[field] ?? {})) {
        it(`${file}: ${field} '${substanceId}' exists in substance data`, () => {
          expect(
            knownSubstanceIds.has(substanceId),
            `Character '${character.id}' ${field} references unknown substance '${substanceId}'`
          ).toBe(true)
        })
      }
    }
  }

  // Item doses name real substances
  for (const { file, data } of itemFiles) {
    const items = Array.isArray(data) ? data : Object.values(data)
    for (const item of items) {
      for (const dose of item.doses ?? []) {
        it(`${file} item '${item.id}': dose '${dose.substanceId}' exists in substance data`, () => {
          expect(
            knownSubstanceIds.has(dose.substanceId),
            `Item '${item.id}' doses unknown substance '${dose.substanceId}'`
          ).toBe(true)
        })
      }
    }
  }

  // Inspirations name real mediums
  const knownMediumIds = new Set(
    loadJsonFiles(join(CONTENT_ROOT, 'mediums'))
      .map(({ data }) => data.id)
      .filter(Boolean)
  )
  for (const { file, data } of [
    ...mapDirs.flatMap((mapDir) => loadJsonFiles(join(mapDir, 'actions'))),
    ...mapDirs.flatMap((mapDir) => loadJsonFiles(join(mapDir, 'events'))),
  ]) {
    const entries = Array.isArray(data) ? data : Object.values(data)
    for (const entry of entries) {
      for (const outcome of outcomesOf(entry)) {
        const mediumId = outcome.inspiration?.mediumId
        if (mediumId === undefined || mediumId === null) continue
        it(`${file} '${entry.id}': inspiration medium '${mediumId}' exists in medium data`, () => {
          expect(
            knownMediumIds.has(mediumId),
            `'${entry.id}' inspires unknown medium '${mediumId}'`
          ).toBe(true)
        })
      }
    }
  }

  // Action and event doses name real substances
  const eventFilesAll = mapDirs.flatMap((mapDir) => loadJsonFiles(join(mapDir, 'events')))
  const actionFilesAll = mapDirs.flatMap((mapDir) => loadJsonFiles(join(mapDir, 'actions')))
  for (const { file, data } of [...actionFilesAll, ...eventFilesAll]) {
    const entries = Array.isArray(data) ? data : Object.values(data)
    for (const entry of entries) {
      for (const outcome of outcomesOf(entry)) {
        for (const dose of outcome.doses ?? []) {
          it(`${file} '${entry.id}': dose '${dose.substanceId}' exists in substance data`, () => {
            expect(
              knownSubstanceIds.has(dose.substanceId),
              `'${entry.id}' doses unknown substance '${dose.substanceId}'`
            ).toBe(true)
          })
        }
      }
    }
  }

  // Character schedule locationIds must exist in location data
  for (const { file, data: character } of characterFiles) {
    if (!character.schedule?.entries?.length) continue
    for (const entry of character.schedule.entries) {
      it(`${file}: schedule locationId '${entry.locationId}' exists in location data`, () => {
        expect(
          knownLocationIds.has(entry.locationId),
          `Character '${character.id}' schedule references unknown location '${entry.locationId}'`
        ).toBe(true)
      })
    }
  }

  // Action itemsGained references real item IDs (string[] per contract)
  const actionFiles = mapDirs.flatMap((mapDir) => loadJsonFiles(join(mapDir, 'actions')))

  // Every action lives somewhere real, and anyone it involves exists
  for (const { file, data } of actionFiles) {
    const actions = Array.isArray(data) ? data : Object.values(data)
    for (const action of actions) {
      it(`${file} action '${action.id}': locationId '${action.locationId}' is 'any' or a real location`, () => {
        expect(
          action.locationId === 'any' || knownLocationIds.has(action.locationId),
          `Action '${action.id}' lives at unknown location '${action.locationId}'`
        ).toBe(true)
      })
      if (action.characterId === undefined || action.characterId === null) continue
      it(`${file} action '${action.id}': characterId '${action.characterId}' exists in character data`, () => {
        expect(
          knownCharacterIds.has(action.characterId),
          `Action '${action.id}' involves unknown character '${action.characterId}'`
        ).toBe(true)
      })
    }
  }
  for (const { file, data } of actionFiles) {
    const actions = Array.isArray(data) ? data : Object.values(data)
    for (const action of actions) {
      const outcomes = [
        action.success,
        action.failure,
        action.criticalSuccess,
        action.criticalFailure,
      ].filter(Boolean)
      for (const outcome of outcomes) {
        const gained = outcome.itemsGained ?? []
        const itemIds = Array.isArray(gained) ? gained.filter((i) => typeof i === 'string') : []
        for (const itemId of itemIds) {
          it(`${file} action '${action.id}': itemsGained '${itemId}' exists in item data`, () => {
            expect(
              knownItemIds.has(itemId),
              `Action '${action.id}' references unknown item '${itemId}'`
            ).toBe(true)
          })
        }
      }
    }
  }
})
