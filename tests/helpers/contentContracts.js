/**
 * Content contracts: the checks every content file is held to, shared by the
 * tests under tests/content/. New files are checked automatically. They pass
 * with no files, pass when files are valid, and fail when a file breaks its
 * contract. Node's fs, so the tests that use them run in the node environment.
 */
import { expect } from 'vitest'
import { readdirSync, readFileSync, existsSync } from 'fs'
import { join, resolve } from 'path'
import { FIT_TRIGGER_KINDS, MARK_KINDS, MARK_TARGET_KINDS } from '../../src/engine/psyche.js'
import { ACT_AUTHOR_KINDS, ACT_RECIPIENT_KINDS } from '../../src/engine/acts.js'

export const CONTENT_ROOT = resolve('content')
// The game's words are content. This file reads them; it does not keep its own copy.
export const VOCABULARY = JSON.parse(readFileSync(join(CONTENT_ROOT, 'vocabulary.json'), 'utf-8'))
// The game's numbers are content too. What a schedule stop can be is what tuning gives a stop.
export const TUNING = JSON.parse(readFileSync(join(CONTENT_ROOT, 'tuning.json'), 'utf-8'))
export const VALID_STOP_TYPES = Object.keys(TUNING.simulation.stops)
export const VALID_STATS = VOCABULARY.stats.map((s) => s.id)
// sobriety is derived from intoxications — it is read, never written, by content.
export const VALID_STATUS_KEYS = VOCABULARY.statuses.filter((s) => s.writable).map((s) => s.id)
export const VALID_SUBSTANCE_FAMILIES = VOCABULARY.substanceFamilies
export const VALID_SIMULATION_TIERS = VOCABULARY.simulationTiers
export const VALID_ITEM_TYPES = VOCABULARY.itemTypes
export const VALID_ACTION_KINDS = VOCABULARY.actionKinds
// What a mark can be about, and what sets a fit off: the engine's own lists.
export const VALID_MARK_TARGET_KINDS = Object.values(MARK_TARGET_KINDS)
export const VALID_MARK_KINDS = Object.values(MARK_KINDS)
export const VALID_FIT_TRIGGER_KINDS = Object.values(FIT_TRIGGER_KINDS)
// Who can start something, and whom it can be done to: the engine's own lists.
export const VALID_ACT_AUTHOR_KINDS = Object.values(ACT_AUTHOR_KINDS)
export const VALID_ACT_RECIPIENT_KINDS = Object.values(ACT_RECIPIENT_KINDS)

/**
 * Load all JSON files from a directory path (non-recursive).
 * Returns [] if directory doesn't exist or is empty.
 * @param {string} dirPath
 * @returns {{ file: string, data: any }[]}
 */
export function loadJsonFiles(dirPath) {
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
export function getMapDirs() {
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
export const CHARACTER_REQUIRED_FIELDS = [
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

export function validateCharacter({ data, file }) {
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
    // Every stop says what it is: that is what it does to whoever stands in it.
    expect(VALID_STOP_TYPES, `${file}: stop '${entry.locationId}' type '${entry.type}'`).toContain(
      entry.type
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
    expect(
      data.status.confusion,
      `${file}: status.confusion is derived — it comes from what is in them and what they are going through`
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
          expect(
            VALID_STOP_TYPES,
            `${file}: decisionWeights.${key}.bias '${entry.bias}'`
          ).toContain(entry.bias)
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

export const LOCATION_REQUIRED_FIELDS = [
  'id',
  'type',
  'display',
  'displayInline',
  'appearance',
  'descriptions',
  'exits',
  'availability',
  'surfaces',
  'pieceAs',
  'outdoors',
]

export function validateLocation({ data, file }) {
  for (const field of LOCATION_REQUIRED_FIELDS) {
    expect(data, `${file}: missing field '${field}'`).toHaveProperty(field)
  }

  // Fields nothing reads do not come back: who is here comes from schedules,
  // and what the player knows is the player's.
  for (const dead of ['npcSlots', 'variant', 'discovered']) {
    expect(data, `${file}: '${dead}' is not part of a location`).not.toHaveProperty(dead)
  }

  // The name, and the looks: what the place is called, and what it is to
  // someone who does not know. The looks never lack a sentence to say.
  for (const [label, named] of [
    ['', data],
    ['appearance.', data.appearance],
  ]) {
    for (const field of ['display', 'displayInline']) {
      expect(typeof named?.[field], `${file}: ${label}${field} must be string`).toBe('string')
      expect(named[field].length, `${file}: ${label}${field} must not be empty`).toBeGreaterThan(0)
    }
  }
  expect(
    typeof data.appearance.descriptions?.default,
    `${file}: appearance.descriptions.default must be a string`
  ).toBe('string')
  expect(
    data.appearance.descriptions.default.length,
    `${file}: appearance.descriptions.default must not be empty`
  ).toBeGreaterThan(0)

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
    expect(exit.locationId, `${file}: an exit never leads back to where it starts`).not.toBe(
      data.id
    )
    // A way out names where it goes the way the player sees it: never by a name they do not know.
    expect(
      exit.label,
      `${file}: exit to '${exit.locationId}' must name it as {place}, not in words`
    ).toContain('{place}')
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
export function validateDoses({ doses, label }) {
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
export function validateOutcome({ outcome, label }) {
  if (!outcome) return
  if (outcome.statusChanges) {
    expect(
      outcome.statusChanges.sobriety,
      `${label}: statusChanges.sobriety is not writable — use doses: [{ substanceId, value }]`
    ).toBeUndefined()
  }
  validateDoses({ doses: outcome.doses, label })
  // A knock to the head: how dazed it leaves you, and it wears off.
  if (outcome.dazed !== undefined && outcome.dazed !== null) {
    expect(outcome.dazed, `${label}: dazed must be 1-100`).toBeGreaterThanOrEqual(1)
    expect(outcome.dazed, `${label}: dazed must be 1-100`).toBeLessThanOrEqual(100)
  }
  // Fields that meant nothing do not come back: marks come from a trauma's save.
  for (const dead of ['traumaGained', 'obsessionFed']) {
    expect(
      outcome,
      `${label}: '${dead}' is gone — use trauma: { save, tableId }`
    ).not.toHaveProperty(dead)
  }
  if (outcome.trauma !== undefined && outcome.trauma !== null) {
    const { save, tableId, target } = outcome.trauma
    expect(VALID_STATS, `${label}: trauma.save.stat '${save?.stat}' is not a stat`).toContain(
      save?.stat
    )
    expect(save.dc, `${label}: trauma.save.dc must be > 0`).toBeGreaterThan(0)
    expect(typeof tableId, `${label}: trauma.tableId must be string`).toBe('string')
    if (target !== undefined && target !== null) {
      expect(VALID_MARK_TARGET_KINDS, `${label}: trauma.target.kind '${target.kind}'`).toContain(
        target.kind
      )
      expect(typeof target.id, `${label}: trauma.target.id must be string`).toBe('string')
    }
  }
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
export function outcomesOf(entry) {
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

export const VALID_CHECK_STATS = VALID_STATS

export function validateAction({ data, file }) {
  const required = ['id', 'label', 'timeCost', 'weight']
  for (const field of required) {
    expect(data, `${file} action '${data.id ?? '?'}': missing field '${field}'`).toHaveProperty(
      field
    )
  }
  // What a mark pulls toward is read off the action itself; a list of obsession ids meant nothing.
  expect(data, `${file} '${data.id}': obsessionIds is gone`).not.toHaveProperty('obsessionIds')
  expect(
    data.requirements ?? {},
    `${file} '${data.id}': requiredTraumas is now requiredMarkIds`
  ).not.toHaveProperty('requiredTraumas')

  if (data.kind === 'make') {
    // Taking stock is free; the work is what costs, and the medium says how much.
    expect(data.timeCost, `${file} '${data.id}': a 'make' action costs no time itself`).toBe(0)
    expect(
      data.requirements?.requiresInspiration,
      `${file} '${data.id}': making requires inspiration`
    ).toBe(true)
    return
  }
  if (data.kind === 'cure') {
    // Walking in is free; the sessions are what cost, and the cure says how much.
    expect(data.timeCost, `${file} '${data.id}': a 'cure' action costs no time itself`).toBe(0)
    expect(typeof data.cureId, `${file} '${data.id}': a 'cure' action names its cureId`).toBe(
      'string'
    )
    expect(data.check, `${file} '${data.id}': the session has the check, not the door`).toBeNull()
  } else if (data.kind === 'look') {
    // A closer look is free; finding out what the place is costs the time.
    expect(data.timeCost, `${file} '${data.id}': a 'look' action costs no time`).toBe(0)
  } else {
    expect(data.timeCost, `${file} '${data.id}': timeCost must be >= 1`).toBeGreaterThanOrEqual(1)
  }
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
    validateOutcome({ outcome, label: `${file} '${data.id}'` })
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

export function validateItem({ data, file }) {
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
  validateDoses({ doses: data.doses, label: `${file} '${data.id}'` })

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

export const SCAVENGE_TABLE_REQUIRED_FIELDS = ['id', 'display', 'stat', 'dc', 'entries']

export function validateScavengeTable({ data, file }) {
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
    validateOutcome({
      outcome: { inspiration: entry.inspiration },
      label: `${file} '${entry.itemId}'`,
    })
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

export function validatePersona({ persona, label }) {
  expect(persona, `${label}: persona required`).toBeTruthy()
  expect(typeof persona.id, `${label}: persona.id must be string`).toBe('string')
  expect(typeof persona.display, `${label}: persona.display must be string`).toBe('string')
  expect(typeof persona.compulsion, `${label}: persona.compulsion must be string`).toBe('string')
}

/**
 * Everything has a cost and everything has a use. A modifier set with only
 * pluses or only minuses fails the build.
 */
export function validateModifiers({ modifiers, label }) {
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

export const SUBSTANCE_REQUIRED_FIELDS = [
  'id',
  'display',
  'family',
  'confusionFactor',
  'persona',
  'decayPerTick',
  'habituationRate',
  'habituationDecayPerTick',
  'withdrawal',
  'bands',
]

export function validateSubstance({ data, file }) {
  for (const field of SUBSTANCE_REQUIRED_FIELDS) {
    expect(data, `${file}: missing field '${field}'`).toHaveProperty(field)
  }
  expect(VALID_SUBSTANCE_FAMILIES, `${file}: invalid family '${data.family}'`).toContain(
    data.family
  )
  validatePersona({ persona: data.persona, label: file })
  // How much of what's in you jumbles what you see: a share of the intoxication.
  expect(data.confusionFactor, `${file}: confusionFactor must be 0-1`).toBeGreaterThanOrEqual(0)
  expect(data.confusionFactor, `${file}: confusionFactor must be 0-1`).toBeLessThanOrEqual(1)
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
    validatePersona({ persona: w.persona, label: `${file} withdrawal` })
    validateModifiers({ modifiers: w.modifiers, label: `${file} withdrawal` })
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
    validateModifiers({ modifiers: band.modifiers, label: `${file} band ${band.atLeast}` })
  }
}

export const MEDIUM_REQUIRED_FIELDS = ['id', 'display', 'stat', 'description', 'pieceAs', 'making']

export function validateMedium({ data, file }) {
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

export const CONDITION_REQUIRED_FIELDS = [
  'id',
  'display',
  'source',
  'weight',
  'confusion',
  'persona',
  'modifiers',
]

export function validateCondition({ data, file }) {
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
  expect(data.confusion, `${file}: confusion must be 0-100`).toBeGreaterThanOrEqual(0)
  expect(data.confusion, `${file}: confusion must be 0-100`).toBeLessThanOrEqual(100)
  validatePersona({ persona: data.persona, label: file })
  validateModifiers({ modifiers: data.modifiers, label: file })
}

// ---------------------------------------------------------------------------
// Mark validation (content/marks)
// ---------------------------------------------------------------------------

export const MARK_REQUIRED_FIELDS = [
  'id',
  'kind',
  'display',
  'targetKinds',
  'polarity',
  'confusion',
  'avoids',
  'draws',
  'fit',
  'lineCode',
]

/**
 * A mark: what it is, what it can be about, and what it does. Every mark
 * does something; stats it bends have a pro and a con, like everything else.
 * @param {{ data: Object, file: string, conditionIds: string[] }} input
 */
export function validateMark({ data, file, conditionIds }) {
  for (const field of MARK_REQUIRED_FIELDS) {
    expect(data, `${file}: missing field '${field}'`).toHaveProperty(field)
  }
  expect(VALID_MARK_KINDS, `${file}: kind '${data.kind}'`).toContain(data.kind)
  expect(Array.isArray(data.targetKinds), `${file}: targetKinds must be an array`).toBe(true)
  for (const kind of data.targetKinds) {
    expect(VALID_MARK_TARGET_KINDS, `${file}: target kind '${kind}'`).toContain(kind)
  }
  if (data.kind === 'obsession') {
    expect(['love', 'hate'], `${file}: an obsession is love or hate`).toContain(data.polarity)
  } else {
    expect(data.polarity, `${file}: only an obsession has a polarity`).toBeNull()
  }
  if (data.modifiers !== undefined) validateModifiers({ modifiers: data.modifiers, label: file })
  expect(data.confusion, `${file}: confusion must be 0-100`).toBeGreaterThanOrEqual(0)
  expect(data.confusion, `${file}: confusion must be 0-100`).toBeLessThanOrEqual(100)
  expect(typeof data.avoids, `${file}: avoids must be boolean`).toBe('boolean')
  if (data.avoids) {
    // Staying away is something a place or a person can be refused; nothing else is.
    expect(data.targetKinds.length, `${file}: avoiding needs something to avoid`).toBeGreaterThan(0)
    for (const kind of data.targetKinds) {
      expect(['location', 'character'], `${file}: avoids a '${kind}'`).toContain(kind)
    }
  }
  expect(data.draws, `${file}: draws must be 0-1`).toBeGreaterThanOrEqual(0)
  expect(data.draws, `${file}: draws must be 0-1`).toBeLessThanOrEqual(1)
  if (data.draws > 0) {
    expect(
      data.targetKinds.length,
      `${file}: a pull needs something to pull toward`
    ).toBeGreaterThan(0)
  }
  expect(typeof data.lineCode, `${file}: lineCode must be string`).toBe('string')

  const fit = data.fit
  if (fit !== null) {
    expect(VALID_FIT_TRIGGER_KINDS, `${file}: fit.trigger.kind '${fit.trigger?.kind}'`).toContain(
      fit.trigger?.kind
    )
    if (fit.trigger.kind === 'target') {
      expect(
        data.targetKinds.length,
        `${file}: a fit set off by its target needs one`
      ).toBeGreaterThan(0)
    }
    if (fit.trigger.kind === 'status') {
      expect(
        VALID_STATUS_KEYS.concat(['sobriety', 'confusion']),
        `${file}: fit.trigger.status`
      ).toContain(fit.trigger.status)
      const below = typeof fit.trigger.below === 'number'
      const above = typeof fit.trigger.above === 'number'
      expect(below !== above, `${file}: fit.trigger needs exactly one of below / above`).toBe(true)
    }
    if (fit.trigger.kind === 'condition') {
      expect(conditionIds, `${file}: fit.trigger.conditionId`).toContain(fit.trigger.conditionId)
    }
    expect(fit.chancePerTick, `${file}: fit.chancePerTick must be in (0, 1]`).toBeGreaterThan(0)
    expect(fit.chancePerTick, `${file}: fit.chancePerTick must be in (0, 1]`).toBeLessThanOrEqual(1)
    expect(Number.isInteger(fit.ticks), `${file}: fit.ticks must be a whole number`).toBe(true)
    expect(fit.ticks, `${file}: fit.ticks must be >= 1`).toBeGreaterThanOrEqual(1)
    expect(fit.weight, `${file}: fit.weight must be in (0, 1]`).toBeGreaterThan(0)
    expect(fit.weight, `${file}: fit.weight must be in (0, 1]`).toBeLessThanOrEqual(1)
    validatePersona({ persona: fit.persona, label: `${file} fit` })
    validateModifiers({ modifiers: fit.modifiers, label: `${file} fit` })
    expect(fit.confusion, `${file}: fit.confusion must be 0-100`).toBeGreaterThanOrEqual(0)
    expect(fit.confusion, `${file}: fit.confusion must be 0-100`).toBeLessThanOrEqual(100)
    expect(typeof fit.lineCode, `${file}: fit.lineCode must be string`).toBe('string')
  }

  const does =
    (data.modifiers?.length ?? 0) > 0 ||
    data.confusion > 0 ||
    data.avoids ||
    data.draws > 0 ||
    fit !== null
  expect(does, `${file}: a mark has to do something`).toBe(true)
}

// ---------------------------------------------------------------------------
// Tests — Characters
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Tests — Locations (all maps)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Tests — Actions (all maps)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Tests — Items
// ---------------------------------------------------------------------------

export function validateEvent({ data, file }) {
  const required = ['id', 'title', 'type', 'oneTime', 'conditions', 'narrative']
  for (const field of required) {
    expect(data, `${file} event '${data.id ?? '?'}': missing field '${field}'`).toHaveProperty(
      field
    )
  }
  expect(
    data.conditions ?? {},
    `${file} '${data.id}': requiredTraumas is now requiredMarkIds`
  ).not.toHaveProperty('requiredTraumas')
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
    validateOutcome({ outcome, label: `${file} '${data.id}'` })
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

// ---------------------------------------------------------------------------
// Acts — what people start on their own
// ---------------------------------------------------------------------------

/** What an outcome can do to anybody's body and mind. The rest is the player's alone. */
export const OUTCOME_FIELDS_SUBJECT = ['statusChanges', 'statChanges', 'doses', 'dazed', 'trauma']

export const ACT_REQUIRED_FIELDS = [
  'id',
  'display',
  'author',
  'trigger',
  'to',
  'chancePerTick',
  'check',
  'success',
  'failure',
]

/**
 * An outcome that can land on a character carries only what a character
 * has: no money, no things, no ideas, nothing the player counts.
 */
function expectOutcomeSubject({ outcome, label }) {
  if (!outcome) return
  for (const field of Object.keys(outcome)) {
    expect(
      OUTCOME_FIELDS_SUBJECT,
      `${label}: '${field}' cannot land on a character; an act done to anyone carries only ${OUTCOME_FIELDS_SUBJECT.join(', ')}`
    ).toContain(field)
  }
}

/**
 * A branch of an act (success or failure): what lands on whom, and the line
 * for it. The line for the player (or nobody) and the line for somebody
 * else are each required exactly when the act can be done to them.
 */
function validateActBranch({ act, branch, label }) {
  expect(branch, `${label}: needs an outcome, an outcomeAuthor, a lineCode and a lineCodeOthers`)
  for (const field of ['outcome', 'outcomeAuthor', 'lineCode', 'lineCodeOthers']) {
    expect(branch, `${label}: missing field '${field}'`).toHaveProperty(field)
  }
  const { to } = act
  const toPlayerOrNone = [ACT_RECIPIENT_KINDS.player, ACT_RECIPIENT_KINDS.none].includes(to)
  const toOthers = [ACT_RECIPIENT_KINDS.target, ACT_RECIPIENT_KINDS.anyone].includes(to)
  const lineNeeded = toPlayerOrNone || to === ACT_RECIPIENT_KINDS.anyone
  if (lineNeeded) {
    expect(typeof branch.lineCode, `${label}: lineCode must be a string`).toBe('string')
  } else {
    expect(
      branch.lineCode,
      `${label}: lineCode is for the player or nobody; to '${to}' has none`
    ).toBeNull()
  }
  if (toOthers) {
    expect(typeof branch.lineCodeOthers, `${label}: lineCodeOthers must be a string`).toBe('string')
  } else {
    expect(
      branch.lineCodeOthers,
      `${label}: lineCodeOthers is for somebody else; to '${to}' has none`
    ).toBeNull()
  }
  if (to === ACT_RECIPIENT_KINDS.none) {
    expect(branch.outcome, `${label}: done to nobody, so nothing lands on a recipient`).toBeNull()
  }
  validateOutcome({ outcome: branch.outcome, label: `${label} outcome` })
  validateOutcome({ outcome: branch.outcomeAuthor, label: `${label} outcomeAuthor` })
  if (toOthers) expectOutcomeSubject({ outcome: branch.outcome, label: `${label} outcome` })
  expectOutcomeSubject({ outcome: branch.outcomeAuthor, label: `${label} outcomeAuthor` })
}

export function validateAct({ data, file }) {
  for (const field of ACT_REQUIRED_FIELDS) {
    expect(data, `${file}: missing field '${field}'`).toHaveProperty(field)
  }
  expect(typeof data.id, `${file}: id must be a string`).toBe('string')
  expect(typeof data.display, `${file}: display must be a string`).toBe('string')
  expect(VALID_ACT_AUTHOR_KINDS, `${file}: author.kind '${data.author?.kind}'`).toContain(
    data.author?.kind
  )
  expect(typeof data.author.id, `${file}: author.id must be a string`).toBe('string')
  expect(VALID_ACT_RECIPIENT_KINDS, `${file}: to '${data.to}'`).toContain(data.to)
  if (data.to === ACT_RECIPIENT_KINDS.target) {
    expect(data.author.kind, `${file}: only a mark has a target to do it to`).toBe(
      ACT_AUTHOR_KINDS.mark
    )
  }
  expect(data.chancePerTick, `${file}: chancePerTick must be in (0, 1]`).toBeGreaterThan(0)
  expect(data.chancePerTick, `${file}: chancePerTick must be in (0, 1]`).toBeLessThanOrEqual(1)
  if (data.trigger !== null) {
    expect(VALID_FIT_TRIGGER_KINDS, `${file}: trigger.kind '${data.trigger.kind}'`).toContain(
      data.trigger.kind
    )
    if (data.trigger.kind === FIT_TRIGGER_KINDS.target) {
      expect(data.author.kind, `${file}: only a mark has a target to be set off by`).toBe(
        ACT_AUTHOR_KINDS.mark
      )
    }
    if (data.trigger.kind === FIT_TRIGGER_KINDS.status) {
      expect(VALID_STATUS_KEYS, `${file}: trigger.status '${data.trigger.status}'`).toContain(
        data.trigger.status
      )
      const bounds = [data.trigger.below, data.trigger.above].filter((n) => typeof n === 'number')
      expect(bounds, `${file}: a status trigger is below or above, not both`).toHaveLength(1)
    }
    if (data.trigger.kind === FIT_TRIGGER_KINDS.condition) {
      expect(typeof data.trigger.conditionId, `${file}: trigger.conditionId must be a string`).toBe(
        'string'
      )
    }
  }
  if (data.check !== null) {
    expect(
      data.to,
      `${file}: a check is against a recipient; done to nobody there is none`
    ).not.toBe(ACT_RECIPIENT_KINDS.none)
    expect(VALID_STATS, `${file}: check.stat '${data.check.stat}'`).toContain(data.check.stat)
    expect(VALID_STATS, `${file}: check.opposedStat '${data.check.opposedStat}'`).toContain(
      data.check.opposedStat
    )
  }
  validateActBranch({ act: data, branch: data.success, label: `${file} success` })
  if (data.check !== null) {
    validateActBranch({ act: data, branch: data.failure, label: `${file} failure` })
  } else {
    expect(data.failure, `${file}: without a check nothing can fail`).toBeNull()
  }
}

// ---------------------------------------------------------------------------
// Cures — how a mark ends
// ---------------------------------------------------------------------------

export const CURE_REQUIRED_FIELDS = [
  'id',
  'display',
  'markKinds',
  'sessions',
  'setbackOnFailure',
  'session',
  'cadence',
  'lapse',
  'risk',
  'lineCodes',
]

export function validateCure({ data, file }) {
  for (const field of CURE_REQUIRED_FIELDS) {
    expect(data, `${file}: missing field '${field}'`).toHaveProperty(field)
  }
  expect(typeof data.id, `${file}: id must be a string`).toBe('string')
  expect(typeof data.display, `${file}: display must be a string`).toBe('string')
  expect(Array.isArray(data.markKinds), `${file}: markKinds must be an array`).toBe(true)
  for (const kind of data.markKinds) {
    expect(VALID_MARK_KINDS, `${file}: markKinds '${kind}'`).toContain(kind)
  }
  expect(Number.isInteger(data.sessions), `${file}: sessions must be a whole number`).toBe(true)
  expect(data.sessions, `${file}: sessions must be >= 1`).toBeGreaterThanOrEqual(1)
  expect(
    Number.isInteger(data.setbackOnFailure),
    `${file}: setbackOnFailure must be a whole number`
  ).toBe(true)
  expect(data.setbackOnFailure, `${file}: setbackOnFailure must be >= 0`).toBeGreaterThanOrEqual(0)
  const { session } = data
  expect(Number.isInteger(session.ticks), `${file}: session.ticks must be a whole number`).toBe(
    true
  )
  expect(session.ticks, `${file}: session.ticks must be >= 1`).toBeGreaterThanOrEqual(1)
  expect(VALID_STATS, `${file}: session.check.stat '${session.check?.stat}'`).toContain(
    session.check?.stat
  )
  expect(session.check.dc, `${file}: session.check.dc must be > 0`).toBeGreaterThan(0)
  expect(session.money, `${file}: session.money must be >= 0`).toBeGreaterThanOrEqual(0)
  for (const key of Object.keys(session.statusChanges ?? {})) {
    expect(VALID_STATUS_KEYS, `${file}: session.statusChanges.${key}`).toContain(key)
  }
  for (const line of ['took', 'slipped', 'cured']) {
    expect(typeof data.lineCodes[line], `${file}: lineCodes.${line} must be a string`).toBe(
      'string'
    )
  }
  if (data.cadence !== null) {
    expect(data.cadence.everyHours, `${file}: cadence.everyHours must be > 0`).toBeGreaterThan(0)
  }
  if (data.lapse !== null) {
    expect(data.lapse.afterHours, `${file}: lapse.afterHours must be > 0`).toBeGreaterThan(0)
    if (data.cadence !== null) {
      expect(
        data.lapse.afterHours,
        `${file}: a lapse shorter than the cadence is a session that cannot be kept`
      ).toBeGreaterThanOrEqual(data.cadence.everyHours)
    }
    expect(Number.isInteger(data.lapse.setback), `${file}: lapse.setback must be whole`).toBe(true)
    expect(data.lapse.setback, `${file}: lapse.setback must be >= 1`).toBeGreaterThanOrEqual(1)
  }
  if (data.risk !== null) {
    expect(VALID_STATS, `${file}: risk.save.stat '${data.risk.save?.stat}'`).toContain(
      data.risk.save?.stat
    )
    expect(data.risk.save.dc, `${file}: risk.save.dc must be > 0`).toBeGreaterThan(0)
    expect(typeof data.risk.tableId, `${file}: risk.tableId must be a string`).toBe('string')
  }
  // Nothing happens in one sitting: a cure without a cadence is a shortcut, and a shortcut has a price.
  if (data.cadence === null) {
    expect(
      data.risk,
      `${file}: a cure with no cadence is a shortcut, and a shortcut carries a risk`
    ).not.toBeNull()
  }
}

// ---------------------------------------------------------------------------
// Tests — Substances and Conditions
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Tests — Cross-reference validation
// ---------------------------------------------------------------------------
