import { describe, it, expect, beforeEach } from 'vitest';
import {
  createCharacter,
  getScheduledLocation,
  getCharacterDescription,
  adjustRelationship,
} from '../src/models/character.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeFixedCharacter(overrides = {}) {
  return createCharacter({
    id: 'bartender_parrot',
    name: 'The Bartender',
    description: 'A woman with a face like she has heard every story twice.',
    habit: 'Wipes the bar in slow circles.',
    voice: 'Economical. Correct change without being asked.',
    simulation: 'fixed',
    schedule: {
      entries: [
        { locationId: 'blue_parrot', startHour: 16, endHour: 2, probability: 0.95, days: ['all'] },
      ],
    },
    relationshipScore: 0,
    want: 'To close on time.',
    fear: 'The 2am crowd.',
    level: 2,
    ...overrides,
  });
}

function makeRoutineCharacter(overrides = {}) {
  return createCharacter({
    id: 'carl',
    name: 'Carl',
    description: 'A man shaped like a question mark.',
    habit: 'Cracks knuckles.',
    voice: 'Short sentences. Wrong facts.',
    simulation: 'routine',
    schedule: {
      entries: [
        { locationId: 'mocks_crest', startHour: 11, endHour: 23, probability: 0.9, days: ['all'] },
        { locationId: 'ainsworth_plaid', startHour: 23, endHour: 0, probability: 0.7, days: ['all'] },
      ],
    },
    want: 'To be right about something.',
    fear: 'Being ignored.',
    ...overrides,
  });
}

function makeFullCharacter(overrides = {}) {
  return createCharacter({
    id: 'rival',
    name: 'The Rival',
    description: 'You know them. They know you.',
    simulation: 'full',
    want: 'Recognition.',
    fear: 'Irrelevance.',
    status: { hunger: 60, sobriety: 70, energy: 65, mood: 45, health: 90 },
    decisionWeights: {
      low_sobriety: { bias: 'bar', weight: 0.7 },
      low_hunger: { bias: 'food', weight: 0.8 },
      low_mood: { bias: 'alone', weight: 0.5 },
      low_energy: null,
    },
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// createCharacter
// ---------------------------------------------------------------------------

describe('createCharacter', () => {
  it('maps all fields for a fixed character', () => {
    const c = makeFixedCharacter();
    expect(c.id).toBe('bartender_parrot');
    expect(c.name).toBe('The Bartender');
    expect(c.simulation).toBe('fixed');
    expect(c.level).toBe(2);
    expect(c.want).toBe('To close on time.');
    expect(c.fear).toBe('The 2am crowd.');
  });

  it('fixed tier has null status by default', () => {
    const c = makeFixedCharacter();
    expect(c.status).toBeNull();
  });

  it('fixed tier retains explicit status if provided', () => {
    const c = makeFixedCharacter({ status: { hunger: 50, sobriety: 80, energy: 70, mood: 50, health: 100 } });
    expect(c.status).not.toBeNull();
    expect(c.status.hunger).toBe(50);
  });

  it('routine tier gets default status when not provided', () => {
    const c = makeRoutineCharacter();
    expect(c.status).not.toBeNull();
    expect(c.status.sobriety).toBe(80);
  });

  it('full tier gets default status when not provided', () => {
    const c = createCharacter({ name: 'X', simulation: 'full' });
    expect(c.status).not.toBeNull();
  });

  it('full tier retains decisionWeights', () => {
    const c = makeFullCharacter();
    expect(c.decisionWeights).not.toBeNull();
    expect(c.decisionWeights.low_sobriety.bias).toBe('bar');
    expect(c.decisionWeights.low_energy).toBeNull();
  });

  it('non-full tiers have null decisionWeights', () => {
    expect(makeFixedCharacter().decisionWeights).toBeNull();
    expect(makeRoutineCharacter().decisionWeights).toBeNull();
  });

  it('invalid simulation tier defaults to fixed', () => {
    const c = createCharacter({ name: 'X', simulation: 'turbo' });
    expect(c.simulation).toBe('fixed');
  });

  it('missing simulation defaults to fixed', () => {
    const c = createCharacter({ name: 'X' });
    expect(c.simulation).toBe('fixed');
  });

  it('generates id when not provided', () => {
    const c = createCharacter({ name: 'X' });
    expect(c.id).toBeTruthy();
  });

  it('applies default stat values when stats not provided', () => {
    const c = createCharacter({ name: 'X' });
    expect(c.stats.charm.base).toBe(10);
    expect(c.stats.stamina.modifiers).toEqual([]);
  });

  it('does not share schedule entry references with source', () => {
    const raw = { name: 'X', schedule: { entries: [{ locationId: 'y', startHour: 0, endHour: 24, probability: 1, days: ['all'] }] } };
    const c = createCharacter(raw);
    c.schedule.entries[0].locationId = 'CHANGED';
    expect(raw.schedule.entries[0].locationId).toBe('y');
  });

  it('does not share dialogueTreeIds array reference', () => {
    const raw = { name: 'X', dialogueTreeIds: ['intro'] };
    const c = createCharacter(raw);
    c.dialogueTreeIds.push('extra');
    expect(raw.dialogueTreeIds).toHaveLength(1);
  });

  it('serializes cleanly to JSON', () => {
    const c = makeFullCharacter();
    const restored = JSON.parse(JSON.stringify(c));
    expect(restored.simulation).toBe('full');
    expect(restored.decisionWeights.low_sobriety.weight).toBe(0.7);
  });
});

// ---------------------------------------------------------------------------
// getScheduledLocation
// ---------------------------------------------------------------------------

describe('getScheduledLocation', () => {
  it('returns matching entry for "all" days within hour range', () => {
    const c = makeFixedCharacter();
    // schedule: blue_parrot 16-2
    // Hour 20, any day
    const result = getScheduledLocation(c, 20, 'wednesday');
    expect(result).not.toBeNull();
    expect(result.locationId).toBe('blue_parrot');
    expect(result.probability).toBe(0.95);
  });

  it('returns null when hour is outside all entries', () => {
    const c = makeFixedCharacter();
    // schedule: 16-2 (overnight). Hour 10 is outside this window.
    // Note: startHour=16, endHour=2. engine reads hour >= 16 OR hour < 2.
    // But getScheduledLocation uses hour >= startHour && hour < endHour.
    // endHour=2, startHour=16: hour 10 fails both checks. null expected.
    const result = getScheduledLocation(c, 10, 'monday');
    expect(result).toBeNull();
  });

  it('returns null when schedule is empty', () => {
    const c = createCharacter({ name: 'Ghost', simulation: 'fixed' });
    expect(getScheduledLocation(c, 12, 'monday')).toBeNull();
  });

  it('first matching entry wins (priority order)', () => {
    const c = makeRoutineCharacter();
    // mocks_crest 11-23, ainsworth_plaid 23-0
    const at14 = getScheduledLocation(c, 14, 'monday');
    expect(at14.locationId).toBe('mocks_crest');
  });

  it('does not roll probability — returns candidate', () => {
    const c = makeFixedCharacter();
    const result = getScheduledLocation(c, 20, 'monday');
    expect(result.probability).toBeDefined();
  });

  it('startHour is inclusive', () => {
    const c = makeRoutineCharacter();
    const result = getScheduledLocation(c, 11, 'monday');
    expect(result?.locationId).toBe('mocks_crest');
  });

  it('endHour is exclusive', () => {
    const c = makeRoutineCharacter();
    // mocks_crest endHour=23; hour 23 should NOT match
    const result = getScheduledLocation(c, 23, 'monday');
    // ainsworth_plaid 23-0 should match
    expect(result?.locationId).toBe('ainsworth_plaid');
  });
});

// ---------------------------------------------------------------------------
// getCharacterDescription
// ---------------------------------------------------------------------------

describe('getCharacterDescription', () => {
  const c = createCharacter({
    name: 'X',
    description: 'A person.',
    descriptionVariants: {
      drunk: 'A person, wavering.',
      exhausted: 'A person, depleted.',
      starving: 'A person, hollow.',
      night: 'A person in the dark.',
      repeat: 'That person again.',
    },
  });

  it('returns plain description when no context', () => {
    expect(getCharacterDescription(c)).toBe('A person.');
  });

  it('returns drunk variant when player sobriety < 30', () => {
    expect(getCharacterDescription(c, { playerStatus: { sobriety: 20 } })).toBe('A person, wavering.');
  });

  it('returns exhausted variant when player energy < 20', () => {
    expect(getCharacterDescription(c, { playerStatus: { energy: 10 } })).toBe('A person, depleted.');
  });

  it('returns starving variant when player hunger < 20', () => {
    expect(getCharacterDescription(c, { playerStatus: { hunger: 5 } })).toBe('A person, hollow.');
  });

  it('drunk takes priority over time-of-day', () => {
    expect(getCharacterDescription(c, { timeOfDay: 'night', playerStatus: { sobriety: 10 } })).toBe('A person, wavering.');
  });

  it('returns night variant for timeOfDay=night', () => {
    expect(getCharacterDescription(c, { timeOfDay: 'night' })).toBe('A person in the dark.');
  });

  it('returns repeat variant when visitCount > 1', () => {
    expect(getCharacterDescription(c, { visitCount: 2 })).toBe('That person again.');
  });

  it('does NOT return repeat when visitCount === 1', () => {
    expect(getCharacterDescription(c, { visitCount: 1 })).toBe('A person.');
  });

  it('falls back to description when no variants defined', () => {
    const bare = createCharacter({ name: 'Y', description: 'Just a person.' });
    expect(getCharacterDescription(bare, { timeOfDay: 'night' })).toBe('Just a person.');
  });

  it('returns empty string when no description at all', () => {
    const bare = createCharacter({ name: 'Z' });
    expect(getCharacterDescription(bare)).toBe('');
  });
});

// ---------------------------------------------------------------------------
// adjustRelationship
// ---------------------------------------------------------------------------

describe('adjustRelationship', () => {
  it('increases relationship score', () => {
    const c = makeFixedCharacter({ relationshipScore: 20 });
    adjustRelationship(c, 10);
    expect(c.relationshipScore).toBe(30);
  });

  it('decreases relationship score', () => {
    const c = makeFixedCharacter({ relationshipScore: 20 });
    adjustRelationship(c, -30);
    expect(c.relationshipScore).toBe(-10);
  });

  it('clamps to 100', () => {
    const c = makeFixedCharacter({ relationshipScore: 90 });
    adjustRelationship(c, 50);
    expect(c.relationshipScore).toBe(100);
  });

  it('clamps to -100', () => {
    const c = makeFixedCharacter({ relationshipScore: -90 });
    adjustRelationship(c, -50);
    expect(c.relationshipScore).toBe(-100);
  });

  it('starts from 0 when not specified', () => {
    const c = createCharacter({ name: 'X' });
    adjustRelationship(c, 5);
    expect(c.relationshipScore).toBe(5);
  });
});
