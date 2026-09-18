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
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CONTENT_ROOT = resolve('content');
const VALID_STATS = ['stamina', 'toughness', 'wits', 'creativity', 'charm', 'reputation', 'luck', 'karma'];
const VALID_STATUS_KEYS = ['hunger', 'sobriety', 'energy', 'mood', 'health'];
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
    }
  }
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

  if (characterFiles.length === 0 && locationFiles.length === 0) {
    it('(no content files yet — cross-reference validation will run when files are added)', () => {
      expect(true).toBe(true);
    });
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
