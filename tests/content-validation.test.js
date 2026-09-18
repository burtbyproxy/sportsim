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
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CONTENT_ROOT = resolve('content');
const VALID_STATS = ['stamina', 'toughness', 'wits', 'creativity', 'charm', 'reputation', 'luck', 'karma'];
// sobriety is derived from intoxications — it is read, never written, by content.
const VALID_STATUS_KEYS = ['hunger', 'energy', 'mood', 'health'];
const VALID_SUBSTANCE_FAMILIES = ['alcohol', 'cannabis', 'stimulant', 'nicotine'];
const VALID_SIMULATION_TIERS = ['fixed', 'routine', 'full'];
const VALID_ITEM_TYPES = ['consumable', 'tool', 'junk', 'key', 'weapon'];

/**
 * Load all JSON files from a directory path (non-recursive).
 * Returns [] if directory doesn't exist or is empty.
 * @param {string} dirPath
 * @returns {{ file: string, data: any }[]}
 */
function loadJsonFiles(dirPath) {
  if (!existsSync(dirPath)) return [];
  const files = readdirSync(dirPath).filter(f => f.endsWith('.json'));
  return files.map(file => {
    const fullPath = join(dirPath, file);
    const raw = readFileSync(fullPath, 'utf-8');
    return { file: fullPath, data: JSON.parse(raw) };
  });
}

/**
 * Load all JSON files from a directory recursively (one level deep into subdirs).
 * @param {string} dirPath
 * @returns {{ file: string, data: any }[]}
 */
function loadJsonFilesRecursive(dirPath) {
  if (!existsSync(dirPath)) return [];
  const results = [];
  const entries = readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...loadJsonFiles(fullPath));
    } else if (entry.name.endsWith('.json')) {
      const raw = readFileSync(fullPath, 'utf-8');
      results.push({ file: fullPath, data: JSON.parse(raw) });
    }
  }
  return results;
}

/**
 * Get all map directories (e.g. content/maps/kenton, content/maps/downtown).
 * @returns {string[]}
 */
function getMapDirs() {
  const mapsRoot = join(CONTENT_ROOT, 'maps');
  if (!existsSync(mapsRoot)) return [];
  return readdirSync(mapsRoot, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map(e => join(mapsRoot, e.name));
}

// ---------------------------------------------------------------------------
// Character validation
// ---------------------------------------------------------------------------

/**
 * Required top-level fields for every Character.
 */
const CHARACTER_REQUIRED_FIELDS = ['id', 'name', 'description', 'habit', 'voice', 'simulation', 'schedule', 'want', 'fear', 'level'];

function validateCharacter(data, file) {
  // Required fields
  for (const field of CHARACTER_REQUIRED_FIELDS) {
    expect(data, `${file}: missing required field '${field}'`).toHaveProperty(field);
  }

  // simulation tier
  expect(VALID_SIMULATION_TIERS, `${file}: invalid simulation tier '${data.simulation}'`)
    .toContain(data.simulation);

  // schedule.entries is an array
  expect(Array.isArray(data.schedule?.entries), `${file}: schedule.entries must be an array`).toBe(true);

  // Each schedule entry has required fields
  for (const entry of (data.schedule?.entries ?? [])) {
    expect(entry, `${file}: schedule entry missing locationId`).toHaveProperty('locationId');
    expect(typeof entry.locationId, `${file}: schedule entry locationId must be string`).toBe('string');
    expect(entry, `${file}: schedule entry missing startHour`).toHaveProperty('startHour');
    expect(entry, `${file}: schedule entry missing endHour`).toHaveProperty('endHour');
    expect(typeof entry.startHour, `${file}: startHour must be number`).toBe('number');
    expect(typeof entry.endHour, `${file}: endHour must be number`).toBe('number');
    expect(entry.startHour, `${file}: startHour must be 0-23`).toBeGreaterThanOrEqual(0);
    expect(entry.startHour, `${file}: startHour must be 0-23`).toBeLessThanOrEqual(23);
    expect(entry, `${file}: schedule entry missing probability`).toHaveProperty('probability');
    expect(entry.probability, `${file}: probability must be 0-1`).toBeGreaterThanOrEqual(0);
    expect(entry.probability, `${file}: probability must be 0-1`).toBeLessThanOrEqual(1);
    expect(Array.isArray(entry.days), `${file}: entry.days must be array`).toBe(true);
    expect(entry.days.length, `${file}: entry.days must not be empty`).toBeGreaterThan(0);
  }

  // relationshipScore: -100 to 100
  if (data.relationshipScore !== undefined) {
    expect(data.relationshipScore, `${file}: relationshipScore out of range`).toBeGreaterThanOrEqual(-100);
    expect(data.relationshipScore, `${file}: relationshipScore out of range`).toBeLessThanOrEqual(100);
  }

  // level: positive integer
  expect(typeof data.level, `${file}: level must be number`).toBe('number');
  expect(data.level, `${file}: level must be >= 1`).toBeGreaterThanOrEqual(1);

  // Stats: if present, validate structure
  if (data.stats) {
    for (const statName of VALID_STATS) {
      if (data.stats[statName] !== undefined) {
        const stat = data.stats[statName];
        expect(typeof stat.base, `${file}: stats.${statName}.base must be number`).toBe('number');
        expect(stat.base, `${file}: stats.${statName}.base must be 1-100`).toBeGreaterThanOrEqual(1);
        expect(stat.base, `${file}: stats.${statName}.base must be 1-100`).toBeLessThanOrEqual(100);
      }
    }
  }

  // Status: if present and not null, validate
  if (data.status !== null && data.status !== undefined) {
    for (const key of VALID_STATUS_KEYS) {
      if (data.status[key] !== undefined) {
        expect(data.status[key], `${file}: status.${key} must be 0-100`).toBeGreaterThanOrEqual(0);
        expect(data.status[key], `${file}: status.${key} must be 0-100`).toBeLessThanOrEqual(100);
      }
    }
    expect(
      data.status.sobriety,
      `${file}: status.sobriety is derived from intoxications — declare intoxications instead`
    ).toBeUndefined();
  }

  // Intoxications / habituations: per-substance levels 0-100 (ids cross-checked below)
  for (const field of ['intoxications', 'habituations']) {
    if (data[field] === undefined) continue;
    for (const [substanceId, level] of Object.entries(data[field])) {
      expect(typeof level, `${file}: ${field}.${substanceId} must be number`).toBe('number');
      expect(level, `${file}: ${field}.${substanceId} must be 0-100`).toBeGreaterThanOrEqual(0);
      expect(level, `${file}: ${field}.${substanceId} must be 0-100`).toBeLessThanOrEqual(100);
    }
  }

  // full-tier: decisionWeights recommended (not required — warn via test name)
  if (data.simulation === 'full') {
    // We don't hard-require decisionWeights — a full-tier char can have null weights.
    // Just validate the shape if present.
    if (data.decisionWeights) {
      for (const key of ['low_sobriety', 'low_hunger', 'low_mood', 'low_energy']) {
        const entry = data.decisionWeights[key];
        if (entry !== null && entry !== undefined) {
          expect(typeof entry.bias, `${file}: decisionWeights.${key}.bias must be string`).toBe('string');
          expect(typeof entry.weight, `${file}: decisionWeights.${key}.weight must be number`).toBe('number');
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Location validation
// ---------------------------------------------------------------------------

const LOCATION_REQUIRED_FIELDS = ['id', 'type', 'display', 'descriptions', 'exits', 'availability'];

function validateLocation(data, file) {
  for (const field of LOCATION_REQUIRED_FIELDS) {
    expect(data, `${file}: missing field '${field}'`).toHaveProperty(field);
  }

  // descriptions must have a 'default' key
  expect(data.descriptions, `${file}: descriptions must be an object`).toBeTruthy();
  expect(typeof data.descriptions.default, `${file}: descriptions.default must be a non-empty string`)
    .toBe('string');
  expect(data.descriptions.default.length, `${file}: descriptions.default must not be empty`)
    .toBeGreaterThan(0);

  // exits must be an array
  expect(Array.isArray(data.exits), `${file}: exits must be an array`).toBe(true);
  for (const exit of data.exits) {
    expect(exit, `${file}: exit missing locationId`).toHaveProperty('locationId');
    expect(exit, `${file}: exit missing label`).toHaveProperty('label');
    expect(exit, `${file}: exit missing travelTime`).toHaveProperty('travelTime');
    expect(exit.travelTime, `${file}: travelTime must be >= 1`).toBeGreaterThanOrEqual(1);
  }

  // availability
  const av = data.availability;
  expect(av, `${file}: availability must be present`).toBeTruthy();
  expect(typeof av.openHour, `${file}: openHour must be number`).toBe('number');
  expect(typeof av.closeHour, `${file}: closeHour must be number`).toBe('number');
  expect(av.openHour, `${file}: openHour 0-23`).toBeGreaterThanOrEqual(0);
  expect(av.openHour, `${file}: openHour 0-23`).toBeLessThanOrEqual(23);
  expect(av.closeHour, `${file}: closeHour 0-23`).toBeGreaterThanOrEqual(0);
  expect(av.closeHour, `${file}: closeHour 0-23`).toBeLessThanOrEqual(23);
}

// ---------------------------------------------------------------------------
// Outcome validation (shared by actions and events)
// ---------------------------------------------------------------------------

/**
 * A dose is { substanceId, value > 0, chance? in (0, 1] }. Substance ids are
 * cross-checked against content/substances below.
 */
function validateDoses(doses, label) {
  if (doses === null || doses === undefined) return;
  expect(Array.isArray(doses), `${label}: doses must be an array`).toBe(true);
  for (const dose of doses) {
    expect(typeof dose.substanceId, `${label}: dose.substanceId must be string`).toBe('string');
    expect(typeof dose.value, `${label}: dose.value must be number`).toBe('number');
    expect(dose.value, `${label}: dose.value must be > 0`).toBeGreaterThan(0);
    if (dose.chance !== undefined) {
      expect(dose.chance, `${label}: dose.chance must be in (0, 1]`).toBeGreaterThan(0);
      expect(dose.chance, `${label}: dose.chance must be in (0, 1]`).toBeLessThanOrEqual(1);
    }
  }
}

/**
 * Outcomes write status, never sobriety — what went into the player is a dose.
 */
function validateOutcome(outcome, label) {
  if (!outcome) return;
  if (outcome.statusChanges) {
    expect(
      outcome.statusChanges.sobriety,
      `${label}: statusChanges.sobriety is not writable — use doses: [{ substanceId, value }]`
    ).toBeUndefined();
  }
  validateDoses(outcome.doses, label);
  if (outcome.inspiration !== undefined && outcome.inspiration !== null) {
    const ins = outcome.inspiration;
    expect(ins.strength, `${label}: inspiration.strength must be 1-100`).toBeGreaterThanOrEqual(1);
    expect(ins.strength, `${label}: inspiration.strength must be 1-100`).toBeLessThanOrEqual(100);
    expect(Number.isInteger(ins.ticksTotal), `${label}: inspiration.ticksTotal must be a whole number`).toBe(true);
    expect(ins.ticksTotal, `${label}: inspiration.ticksTotal must be >= 1`).toBeGreaterThanOrEqual(1);
    if (ins.mediumId !== null && ins.mediumId !== undefined) {
      expect(typeof ins.mediumId, `${label}: inspiration.mediumId must be string or null`).toBe('string');
    }
  }
}

/** Every outcome an action or event can produce, flattened. */
function outcomesOf(entry) {
  const direct = [entry.success, entry.failure, entry.criticalSuccess, entry.criticalFailure, entry.outcome];
  const fromChoices = (entry.choices ?? []).flatMap(c => [c.outcome, c.failureOutcome]);
  return [...direct, ...fromChoices].filter(Boolean);
}

// ---------------------------------------------------------------------------
// Action validation
// ---------------------------------------------------------------------------

const VALID_CHECK_STATS = VALID_STATS;

function validateAction(data, file) {
  const required = ['id', 'label', 'timeCost', 'weight'];
  for (const field of required) {
    expect(data, `${file} action '${data.id ?? '?'}': missing field '${field}'`).toHaveProperty(field);
  }

  expect(data.timeCost, `${file} '${data.id}': timeCost must be >= 1`).toBeGreaterThanOrEqual(1);
  expect(data.weight, `${file} '${data.id}': weight must be >= 0`).toBeGreaterThanOrEqual(0);

  // success outcome is required
  expect(data.success, `${file} '${data.id}': success outcome required`).toBeTruthy();
  expect(data.success.narrative, `${file} '${data.id}': success.narrative required`).toBeTruthy();

  // Anything that costs money must declare the price as a money floor,
  // so a broke player is told the price instead of going negative.
  const cost = data.success.moneyChange;
  if (typeof cost === 'number' && cost < 0) {
    expect(
      data.requirements?.minMoney,
      `${file} '${data.id}': costs ${cost} but requirements.minMoney is not set to at least ${-cost}`
    ).toBeGreaterThanOrEqual(-cost);
  }

  // If there's a check, validate it
  if (data.check) {
    expect(typeof data.check.stat, `${file} '${data.id}': check.stat must be string`).toBe('string');
    expect(VALID_CHECK_STATS, `${file} '${data.id}': check.stat '${data.check.stat}' is not a valid stat`)
      .toContain(data.check.stat);
    expect(typeof data.check.dc, `${file} '${data.id}': check.dc must be number`).toBe('number');
    expect(data.check.dc, `${file} '${data.id}': check.dc must be > 0`).toBeGreaterThan(0);
    // If check has a stat, failure outcome is required
    expect(data.failure, `${file} '${data.id}': actions with dice checks must have a failure outcome`).toBeTruthy();
  }

  for (const outcome of outcomesOf(data)) {
    validateOutcome(outcome, `${file} '${data.id}'`);
  }

  if (data.interruptsInspiration !== undefined) {
    expect(typeof data.interruptsInspiration, `${file} '${data.id}': interruptsInspiration must be boolean`).toBe('boolean');
  }
  const requiresInspiration = data.requirements?.requiresInspiration;
  if (requiresInspiration !== undefined && requiresInspiration !== null) {
    expect(typeof requiresInspiration, `${file} '${data.id}': requiresInspiration must be boolean`).toBe('boolean');
  }
}

// ---------------------------------------------------------------------------
// Item validation
// ---------------------------------------------------------------------------

function validateItem(data, file) {
  const required = ['id', 'name', 'type'];
  for (const field of required) {
    expect(data, `${file} item '${data.id ?? '?'}': missing field '${field}'`).toHaveProperty(field);
  }

  expect(VALID_ITEM_TYPES, `${file} '${data.id}': invalid type '${data.type}'`).toContain(data.type);

  if (data.effects) {
    expect(Array.isArray(data.effects), `${file} '${data.id}': effects must be array`).toBe(true);
    for (const effect of data.effects) {
      expect(effect, `${file} '${data.id}': effect missing target`).toHaveProperty('target');
      expect(effect, `${file} '${data.id}': effect missing value`).toHaveProperty('value');
      expect(typeof effect.value, `${file} '${data.id}': effect.value must be number`).toBe('number');
      expect(
        effect.target,
        `${file} '${data.id}': effects cannot target sobriety — declare doses instead`
      ).not.toBe('sobriety');
    }
  }
  validateDoses(data.doses, `${file} '${data.id}'`);
}

// ---------------------------------------------------------------------------
// Substance / Condition validation
// ---------------------------------------------------------------------------

function validatePersona(persona, label) {
  expect(persona, `${label}: persona required`).toBeTruthy();
  expect(typeof persona.id, `${label}: persona.id must be string`).toBe('string');
  expect(typeof persona.display, `${label}: persona.display must be string`).toBe('string');
  expect(typeof persona.compulsion, `${label}: persona.compulsion must be string`).toBe('string');
}

/**
 * Everything has a cost and everything has a use. A modifier set with only
 * pluses or only minuses fails the build.
 */
function validateModifiers(modifiers, label) {
  expect(Array.isArray(modifiers), `${label}: modifiers must be an array`).toBe(true);
  expect(modifiers.length, `${label}: modifiers must not be empty`).toBeGreaterThan(0);
  for (const mod of modifiers) {
    expect(VALID_STATS, `${label}: modifier stat '${mod.stat}' is not a stat`).toContain(mod.stat);
    expect(typeof mod.value, `${label}: modifier value must be number`).toBe('number');
    expect(mod.value, `${label}: modifier value must not be 0`).not.toBe(0);
  }
  expect(modifiers.some(m => m.value > 0), `${label}: needs at least one pro (positive modifier)`).toBe(true);
  expect(modifiers.some(m => m.value < 0), `${label}: needs at least one con (negative modifier)`).toBe(true);
}

const SUBSTANCE_REQUIRED_FIELDS = [
  'id', 'display', 'family', 'persona', 'decayPerTick', 'habituationRate',
  'habituationDecayPerTick', 'withdrawal', 'bands',
];

function validateSubstance(data, file) {
  for (const field of SUBSTANCE_REQUIRED_FIELDS) {
    expect(data, `${file}: missing field '${field}'`).toHaveProperty(field);
  }
  expect(VALID_SUBSTANCE_FAMILIES, `${file}: invalid family '${data.family}'`).toContain(data.family);
  validatePersona(data.persona, file);
  expect(data.decayPerTick, `${file}: decayPerTick must be > 0`).toBeGreaterThan(0);
  expect(data.habituationRate, `${file}: habituationRate must be 0-1`).toBeGreaterThanOrEqual(0);
  expect(data.habituationRate, `${file}: habituationRate must be 0-1`).toBeLessThanOrEqual(1);
  expect(data.habituationDecayPerTick, `${file}: habituationDecayPerTick must be >= 0`).toBeGreaterThanOrEqual(0);

  if (data.withdrawal !== null) {
    const w = data.withdrawal;
    expect(w.habituationAtLeast, `${file}: withdrawal.habituationAtLeast must be 1-100`).toBeGreaterThan(0);
    expect(w.habituationAtLeast, `${file}: withdrawal.habituationAtLeast must be 1-100`).toBeLessThanOrEqual(100);
    expect(w.intoxicationBelow, `${file}: withdrawal.intoxicationBelow must be > 0`).toBeGreaterThan(0);
    expect(data.habituationRate, `${file}: a substance with withdrawal must habituate`).toBeGreaterThan(0);
    validatePersona(w.persona, `${file} withdrawal`);
    validateModifiers(w.modifiers, `${file} withdrawal`);
  }

  expect(Array.isArray(data.bands), `${file}: bands must be an array`).toBe(true);
  expect(data.bands.length, `${file}: needs at least one band`).toBeGreaterThan(0);
  const thresholds = new Set();
  for (const band of data.bands) {
    expect(band.atLeast, `${file}: band.atLeast must be 1-100`).toBeGreaterThan(0);
    expect(band.atLeast, `${file}: band.atLeast must be 1-100`).toBeLessThanOrEqual(100);
    expect(thresholds.has(band.atLeast), `${file}: duplicate band threshold ${band.atLeast}`).toBe(false);
    thresholds.add(band.atLeast);
    validateModifiers(band.modifiers, `${file} band ${band.atLeast}`);
  }
}

const MEDIUM_REQUIRED_FIELDS = ['id', 'display', 'stat', 'description'];

function validateMedium(data, file) {
  for (const field of MEDIUM_REQUIRED_FIELDS) {
    expect(data, `${file}: missing field '${field}'`).toHaveProperty(field);
  }
  expect(VALID_STATS, `${file}: stat '${data.stat}' is not a stat`).toContain(data.stat);
  expect(typeof data.description, `${file}: description must be string`).toBe('string');
  expect(data.description.length, `${file}: description must not be empty`).toBeGreaterThan(0);
}

const CONDITION_REQUIRED_FIELDS = ['id', 'display', 'source', 'weight', 'persona', 'modifiers'];

function validateCondition(data, file) {
  for (const field of CONDITION_REQUIRED_FIELDS) {
    expect(data, `${file}: missing field '${field}'`).toHaveProperty(field);
  }
  expect(VALID_STATUS_KEYS, `${file}: source.status '${data.source.status}' is not a status`).toContain(data.source.status);
  const hasBelow = typeof data.source.below === 'number';
  const hasAbove = typeof data.source.above === 'number';
  expect(hasBelow !== hasAbove, `${file}: source needs exactly one of below / above`).toBe(true);
  expect(data.weight, `${file}: weight must be in (0, 1]`).toBeGreaterThan(0);
  expect(data.weight, `${file}: weight must be in (0, 1]`).toBeLessThanOrEqual(1);
  validatePersona(data.persona, file);
  validateModifiers(data.modifiers, file);
}

// ---------------------------------------------------------------------------
// Tests — Characters
// ---------------------------------------------------------------------------

describe('content/characters/*.json — Character contract', () => {
  const charactersDir = join(CONTENT_ROOT, 'characters');
  const files = loadJsonFiles(charactersDir);

  it('content/characters/ directory exists', () => {
    expect(existsSync(charactersDir)).toBe(true);
  });

  if (files.length === 0) {
    it('(no character files yet — validation will run when files are added)', () => {
      expect(true).toBe(true);
    });
  }

  for (const { file, data } of files) {
    it(`${file} — valid Character`, () => {
      validateCharacter(data, file);
    });

    it(`${file} — has at least one schedule entry`, () => {
      expect(
        data.schedule?.entries?.length ?? 0,
        `${file}: character must have at least one schedule entry`
      ).toBeGreaterThan(0);
    });
  }
});

// ---------------------------------------------------------------------------
// Tests — Locations (all maps)
// ---------------------------------------------------------------------------

describe('content/maps/*/locations/*.json — Location contract', () => {
  const mapDirs = getMapDirs();
  const allFiles = mapDirs.flatMap(mapDir =>
    loadJsonFiles(join(mapDir, 'locations'))
  );

  it('content/maps/ directory exists', () => {
    expect(existsSync(join(CONTENT_ROOT, 'maps'))).toBe(true);
  });

  if (allFiles.length === 0) {
    it('(no location files yet — validation will run when files are added)', () => {
      expect(true).toBe(true);
    });
  }

  for (const { file, data } of allFiles) {
    it(`${file} — valid Location`, () => {
      validateLocation(data, file);
    });
  }
});

// ---------------------------------------------------------------------------
// Tests — Actions (all maps)
// ---------------------------------------------------------------------------

describe('content/maps/*/actions/*.json — Action contract', () => {
  const mapDirs = getMapDirs();
  const allFiles = mapDirs.flatMap(mapDir =>
    loadJsonFiles(join(mapDir, 'actions'))
  );

  if (allFiles.length === 0) {
    it('(no action files yet — validation will run when files are added)', () => {
      expect(true).toBe(true);
    });
  }

  for (const { file, data } of allFiles) {
    // Action files can be arrays or objects (keyed by action ID)
    const actions = Array.isArray(data) ? data : Object.values(data);

    it(`${file} — all actions valid`, () => {
      expect(actions.length, `${file}: must contain at least one action`).toBeGreaterThan(0);
      for (const action of actions) {
        validateAction(action, file);
      }
    });
  }
});

// ---------------------------------------------------------------------------
// Tests — Items
// ---------------------------------------------------------------------------

function validateEvent(data, file) {
  const required = ['id', 'title', 'type', 'oneTime', 'conditions', 'narrative'];
  for (const field of required) {
    expect(data, `${file} event '${data.id ?? '?'}': missing field '${field}'`).toHaveProperty(field);
  }
  expect(['random', 'triggered'], `${file} '${data.id}': type must be random or triggered`).toContain(data.type);
  if (data.type === 'random') {
    expect(typeof data.probability, `${file} '${data.id}': random events need a probability`).toBe('number');
    expect(data.probability, `${file} '${data.id}': probability must be in (0, 1]`).toBeGreaterThan(0);
    expect(data.probability, `${file} '${data.id}': probability must be in (0, 1]`).toBeLessThanOrEqual(1);
  }
  expect(data.narrative?.tokens?.length, `${file} '${data.id}': narrative needs tokens`).toBeGreaterThan(0);
  const hasChoices = Array.isArray(data.choices) && data.choices.length > 0;
  expect(
    hasChoices || Boolean(data.outcome),
    `${file} '${data.id}': an event needs choices or an outcome`
  ).toBe(true);
  for (const outcome of outcomesOf(data)) {
    validateOutcome(outcome, `${file} '${data.id}'`);
  }
  if (hasChoices) {
    for (const choice of data.choices) {
      expect(typeof choice.label, `${file} '${data.id}': every choice needs a label`).toBe('string');
      expect(choice.outcome, `${file} '${data.id}': choice '${choice.label}' needs an outcome`).toBeTruthy();
      if (choice.check) {
        expect(VALID_CHECK_STATS, `${file} '${data.id}': check.stat '${choice.check.stat}' is not a valid stat`)
          .toContain(choice.check.stat);
        expect(choice.check.dc, `${file} '${data.id}': check.dc must be > 0`).toBeGreaterThan(0);
        expect(
          choice.failureOutcome,
          `${file} '${data.id}': a checked choice '${choice.label}' needs a failureOutcome`
        ).toBeTruthy();
      }
    }
  }
}

describe('content/maps/*/events/*.json — Event contract', () => {
  const ids = new Set();
  for (const mapDir of getMapDirs()) {
    const dir = join(mapDir, 'events');
    for (const { file, data } of loadJsonFiles(dir)) {
      const events = Array.isArray(data) ? data : Object.values(data);
      for (const event of events) {
        it(`${file}: event '${event.id}' honours the contract`, () => {
          validateEvent(event, file);
          expect(ids.has(event.id), `${file}: duplicate event id '${event.id}'`).toBe(false);
          ids.add(event.id);
        });
      }
    }
  }
});

describe('content/items/*.json — Item contract', () => {
  const itemsDir = join(CONTENT_ROOT, 'items');
  const files = loadJsonFiles(itemsDir);

  it('content/items/ directory exists', () => {
    expect(existsSync(itemsDir)).toBe(true);
  });

  if (files.length === 0) {
    it('(no item files yet — validation will run when files are added)', () => {
      expect(true).toBe(true);
    });
  }

  for (const { file, data } of files) {
    // Item files can be arrays or objects keyed by item ID
    const items = Array.isArray(data) ? data : Object.values(data);

    it(`${file} — all items valid`, () => {
      for (const item of items) {
        validateItem(item, file);
      }
    });
  }
});

// ---------------------------------------------------------------------------
// Tests — Substances and Conditions
// ---------------------------------------------------------------------------

describe('content/substances/*.json — Substance contract', () => {
  const dir = join(CONTENT_ROOT, 'substances');
  const files = loadJsonFiles(dir);

  it('content/substances/ directory exists', () => {
    expect(existsSync(dir)).toBe(true);
  });

  it('has at least one substance', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  const ids = new Set();
  for (const { file, data } of files) {
    it(`${file} — valid Substance`, () => {
      validateSubstance(data, file);
      expect(ids.has(data.id), `${file}: duplicate substance id '${data.id}'`).toBe(false);
      ids.add(data.id);
    });
  }
});

describe('content/conditions/*.json — Condition contract', () => {
  const dir = join(CONTENT_ROOT, 'conditions');
  const files = loadJsonFiles(dir);

  it('content/conditions/ directory exists', () => {
    expect(existsSync(dir)).toBe(true);
  });

  const ids = new Set();
  for (const { file, data } of files) {
    it(`${file} — valid Condition`, () => {
      validateCondition(data, file);
      expect(ids.has(data.id), `${file}: duplicate condition id '${data.id}'`).toBe(false);
      ids.add(data.id);
    });
  }
});

describe('content/voices/*.json — Voice catalog contract', () => {
  const dir = join(CONTENT_ROOT, 'voices');
  const files = loadJsonFiles(dir);
  const sober = files.find(({ data }) => data.id === 'sober');

  it('content/voices/ directory exists and has a sober catalog', () => {
    expect(existsSync(dir)).toBe(true);
    expect(sober, 'content/voices/sober.json is the fallback for every line').toBeTruthy();
  });

  // Every persona any substance, withdrawal, or condition can put in charge
  const personaIds = new Set(['sober']);
  for (const { data } of loadJsonFiles(join(CONTENT_ROOT, 'substances'))) {
    personaIds.add(data.persona?.id);
    if (data.withdrawal) personaIds.add(data.withdrawal.persona?.id);
  }
  for (const { data } of loadJsonFiles(join(CONTENT_ROOT, 'conditions'))) {
    personaIds.add(data.persona?.id);
  }

  for (const { file, data } of files) {
    it(`${file} — valid voice catalog`, () => {
      expect(typeof data.id, `${file}: id must be string`).toBe('string');
      expect(file.endsWith(`${data.id}.json`), `${file}: file name must match id '${data.id}'`).toBe(true);
      expect(personaIds.has(data.id), `${file}: '${data.id}' is not a persona anything can put in charge`).toBe(true);
      expect(data.lines && typeof data.lines === 'object', `${file}: lines must be an object`).toBe(true);
      for (const [code, text] of Object.entries(data.lines)) {
        expect(typeof text, `${file}: line '${code}' must be a string`).toBe('string');
        expect(text.length, `${file}: line '${code}' must not be empty`).toBeGreaterThan(0);
        // A persona can only re-voice a line sober already has, so the fallback always exists.
        expect(sober.data.lines, `${file}: code '${code}' has no sober fallback`).toHaveProperty([code]);
      }
    });
  }
});

describe('content/mediums/*.json — Medium contract', () => {
  const dir = join(CONTENT_ROOT, 'mediums');
  const files = loadJsonFiles(dir);

  it('content/mediums/ directory exists', () => {
    expect(existsSync(dir)).toBe(true);
  });

  it('has at least one medium', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  const ids = new Set();
  for (const { file, data } of files) {
    it(`${file} — valid Medium`, () => {
      validateMedium(data, file);
      expect(ids.has(data.id), `${file}: duplicate medium id '${data.id}'`).toBe(false);
      ids.add(data.id);
    });
  }
});

// ---------------------------------------------------------------------------
// Tests — Cross-reference validation
// ---------------------------------------------------------------------------

describe('cross-reference validation', () => {
  // Collect all known location IDs from content/maps/*/locations/
  const mapDirs = getMapDirs();
  const locationFiles = mapDirs.flatMap(mapDir =>
    loadJsonFiles(join(mapDir, 'locations'))
  );
  const knownLocationIds = new Set(locationFiles.map(({ data }) => data.id).filter(Boolean));

  // Collect all known character IDs from content/characters/
  const characterFiles = loadJsonFiles(join(CONTENT_ROOT, 'characters'));
  const knownCharacterIds = new Set(characterFiles.map(({ data }) => data.id).filter(Boolean));

  // Collect all known item IDs from content/items/
  const itemFiles = loadJsonFiles(join(CONTENT_ROOT, 'items'));
  const knownItemIds = new Set(
    itemFiles.flatMap(({ data }) => {
      const items = Array.isArray(data) ? data : Object.values(data);
      return items.map(i => i.id).filter(Boolean);
    })
  );

  // Collect all known substance IDs from content/substances/
  const substanceFiles = loadJsonFiles(join(CONTENT_ROOT, 'substances'));
  const knownSubstanceIds = new Set(substanceFiles.map(({ data }) => data.id).filter(Boolean));

  if (characterFiles.length === 0 && locationFiles.length === 0) {
    it('(no content files yet — cross-reference validation will run when files are added)', () => {
      expect(true).toBe(true);
    });
  }

  // Character intoxications / habituations name real substances
  for (const { file, data: character } of characterFiles) {
    for (const field of ['intoxications', 'habituations']) {
      for (const substanceId of Object.keys(character[field] ?? {})) {
        it(`${file}: ${field} '${substanceId}' exists in substance data`, () => {
          expect(knownSubstanceIds.has(substanceId), `Character '${character.id}' ${field} references unknown substance '${substanceId}'`).toBe(true);
        });
      }
    }
  }

  // Item doses name real substances
  for (const { file, data } of itemFiles) {
    const items = Array.isArray(data) ? data : Object.values(data);
    for (const item of items) {
      for (const dose of item.doses ?? []) {
        it(`${file} item '${item.id}': dose '${dose.substanceId}' exists in substance data`, () => {
          expect(knownSubstanceIds.has(dose.substanceId), `Item '${item.id}' doses unknown substance '${dose.substanceId}'`).toBe(true);
        });
      }
    }
  }

  // Inspirations name real mediums
  const knownMediumIds = new Set(
    loadJsonFiles(join(CONTENT_ROOT, 'mediums')).map(({ data }) => data.id).filter(Boolean)
  );
  for (const { file, data } of [
    ...mapDirs.flatMap(mapDir => loadJsonFiles(join(mapDir, 'actions'))),
    ...mapDirs.flatMap(mapDir => loadJsonFiles(join(mapDir, 'events'))),
  ]) {
    const entries = Array.isArray(data) ? data : Object.values(data);
    for (const entry of entries) {
      for (const outcome of outcomesOf(entry)) {
        const mediumId = outcome.inspiration?.mediumId;
        if (mediumId === undefined || mediumId === null) continue;
        it(`${file} '${entry.id}': inspiration medium '${mediumId}' exists in medium data`, () => {
          expect(knownMediumIds.has(mediumId), `'${entry.id}' inspires unknown medium '${mediumId}'`).toBe(true);
        });
      }
    }
  }

  // Action and event doses name real substances
  const eventFilesAll = mapDirs.flatMap(mapDir => loadJsonFiles(join(mapDir, 'events')));
  const actionFilesAll = mapDirs.flatMap(mapDir => loadJsonFiles(join(mapDir, 'actions')));
  for (const { file, data } of [...actionFilesAll, ...eventFilesAll]) {
    const entries = Array.isArray(data) ? data : Object.values(data);
    for (const entry of entries) {
      for (const outcome of outcomesOf(entry)) {
        for (const dose of outcome.doses ?? []) {
          it(`${file} '${entry.id}': dose '${dose.substanceId}' exists in substance data`, () => {
            expect(knownSubstanceIds.has(dose.substanceId), `'${entry.id}' doses unknown substance '${dose.substanceId}'`).toBe(true);
          });
        }
      }
    }
  }

  // Character schedule locationIds must exist in location data
  for (const { file, data: character } of characterFiles) {
    if (!character.schedule?.entries?.length) continue;
    for (const entry of character.schedule.entries) {
      it(`${file}: schedule locationId '${entry.locationId}' exists in location data`, () => {
        expect(
          knownLocationIds.has(entry.locationId),
          `Character '${character.id}' schedule references unknown location '${entry.locationId}'`
        ).toBe(true);
      });
    }
  }

  // Location npcSlots reference real characters
  for (const { file, data: location } of locationFiles) {
    const slots = location.npcSlots ?? [];
    for (const charId of slots) {
      it(`${file}: npcSlot '${charId}' exists in character data`, () => {
        expect(
          knownCharacterIds.has(charId),
          `Location '${location.id}' npcSlots references unknown character '${charId}'`
        ).toBe(true);
      });
    }
  }

  // Action itemsGained references real item IDs (string[] per contract)
  const actionFiles = mapDirs.flatMap(mapDir =>
    loadJsonFiles(join(mapDir, 'actions'))
  );
  for (const { file, data } of actionFiles) {
    const actions = Array.isArray(data) ? data : Object.values(data);
    for (const action of actions) {
      const outcomes = [action.success, action.failure, action.criticalSuccess, action.criticalFailure]
        .filter(Boolean);
      for (const outcome of outcomes) {
        const gained = outcome.itemsGained ?? [];
        const itemIds = Array.isArray(gained)
          ? gained.filter(i => typeof i === 'string')
          : [];
        for (const itemId of itemIds) {
          it(`${file} action '${action.id}': itemsGained '${itemId}' exists in item data`, () => {
            expect(
              knownItemIds.has(itemId),
              `Action '${action.id}' references unknown item '${itemId}'`
            ).toBe(true);
          });
        }
      }
    }
  }
});
