import { describe, it, expect } from 'vitest';
// npc.js is deprecated — these tests now run against character.js which
// exports createNPC as a backward-compat alias for createCharacter.
import {
  createNPC,
  getScheduledLocation,
  adjustRelationship,
} from '../src/models/character.js';

// ---------------------------------------------------------------------------
// createNPC
// ---------------------------------------------------------------------------

describe('createNPC', () => {
  const raw = {
    id: 'carl',
    name: 'Carl',
    description: 'A man like a catcher\'s mitt.',
    habit: 'Cracks knuckles.',
    voice: 'Short sentences. Wrong facts.',
    schedule: {
      entries: [
        { locationId: 'mocks_crest', startHour: 12, endHour: 22, probability: 0.9, days: ['all'] },
      ],
    },
    relationshipScore: 10,
    currentLocationId: 'mocks_crest',
    dialogueTreeIds: ['carl_intro'],
    want: 'To be right about something.',
    fear: 'Being ignored.',
    level: 3,
  };

  it('maps all fields correctly', () => {
    const npc = createNPC(raw);
    expect(npc.id).toBe('carl');
    expect(npc.name).toBe('Carl');
    expect(npc.description).toBe("A man like a catcher's mitt.");
    expect(npc.habit).toBe('Cracks knuckles.');
    expect(npc.voice).toBe('Short sentences. Wrong facts.');
    expect(npc.schedule.entries).toHaveLength(1);
    expect(npc.relationshipScore).toBe(10);
    expect(npc.currentLocationId).toBe('mocks_crest');
    expect(npc.dialogueTreeIds).toContain('carl_intro');
    expect(npc.want).toBe('To be right about something.');
    expect(npc.fear).toBe('Being ignored.');
    expect(npc.level).toBe(3);
  });

  it('applies defaults for missing optional fields', () => {
    const npc = createNPC({ id: 'x', name: 'X' });
    expect(npc.description).toBe('');
    expect(npc.habit).toBe('');
    expect(npc.voice).toBe('');
    expect(npc.schedule).toEqual({ entries: [] });
    expect(npc.relationshipScore).toBe(0);
    expect(npc.currentLocationId).toBe(null);
    expect(npc.dialogueTreeIds).toEqual([]);
    expect(npc.want).toBe('');
    expect(npc.fear).toBe('');
    expect(npc.level).toBe(1);
  });

  it('generates an id if not provided', () => {
    const npc = createNPC({ name: 'Unknown' });
    expect(npc.id).toBeTruthy();
  });

  it('does not share dialogueTreeIds array reference', () => {
    const npc = createNPC(raw);
    npc.dialogueTreeIds.push('extra');
    expect(raw.dialogueTreeIds).toHaveLength(1);
  });

  it('serializes cleanly to JSON', () => {
    const npc = createNPC(raw);
    const serialized = JSON.parse(JSON.stringify(npc));
    expect(serialized.name).toBe('Carl');
  });
});

// ---------------------------------------------------------------------------
// getScheduledLocation
// ---------------------------------------------------------------------------

describe('getScheduledLocation', () => {
  const npc = createNPC({
    id: 'carl',
    name: 'Carl',
    schedule: {
      entries: [
        { locationId: 'mocks_crest', startHour: 12, endHour: 22, probability: 0.9, days: ['all'] },
        { locationId: 'columbia_park', startHour: 8, endHour: 12, probability: 0.6, days: ['saturday', 'sunday'] },
        { locationId: 'moms_house', startHour: 0, endHour: 8, probability: 1.0, days: ['monday'] },
      ],
    },
  });

  it('returns matching entry for "all" days within hour range', () => {
    const result = getScheduledLocation(npc, 15, 'wednesday');
    expect(result).not.toBe(null);
    expect(result.locationId).toBe('mocks_crest');
    expect(result.probability).toBe(0.9);
  });

  it('returns null when hour is outside all entries', () => {
    const result = getScheduledLocation(npc, 23, 'wednesday');
    expect(result).toBe(null);
  });

  it('returns null for wrong day on day-specific entry', () => {
    // columbia_park only on saturday/sunday; hour matches but day doesn't
    const result = getScheduledLocation(npc, 9, 'wednesday');
    expect(result).toBe(null);
  });

  it('matches day-specific entry when day matches', () => {
    const result = getScheduledLocation(npc, 9, 'saturday');
    expect(result).not.toBe(null);
    expect(result.locationId).toBe('columbia_park');
  });

  it('returns null when schedule is empty', () => {
    const bare = createNPC({ name: 'Bare' });
    expect(getScheduledLocation(bare, 12, 'monday')).toBe(null);
  });

  it('startHour boundary is inclusive', () => {
    const result = getScheduledLocation(npc, 12, 'monday');
    expect(result).not.toBe(null);
    expect(result.locationId).toBe('mocks_crest');
  });

  it('endHour boundary is exclusive', () => {
    // mocks_crest is 12-22; hour 22 should NOT match
    const result = getScheduledLocation(npc, 22, 'monday');
    expect(result).toBe(null);
  });

  it('does not roll probability — just returns candidate', () => {
    const result = getScheduledLocation(npc, 15, 'monday');
    expect(result.probability).toBeDefined();
    // Result is deterministic regardless of probability value
  });
});

// ---------------------------------------------------------------------------
// adjustRelationship
// ---------------------------------------------------------------------------

describe('adjustRelationship', () => {
  it('increases relationship score', () => {
    const npc = createNPC({ name: 'Carl', relationshipScore: 20 });
    adjustRelationship(npc, 10);
    expect(npc.relationshipScore).toBe(30);
  });

  it('decreases relationship score', () => {
    const npc = createNPC({ name: 'Carl', relationshipScore: 20 });
    adjustRelationship(npc, -30);
    expect(npc.relationshipScore).toBe(-10);
  });

  it('clamps to 100', () => {
    const npc = createNPC({ name: 'Carl', relationshipScore: 90 });
    adjustRelationship(npc, 50);
    expect(npc.relationshipScore).toBe(100);
  });

  it('clamps to -100', () => {
    const npc = createNPC({ name: 'Carl', relationshipScore: -90 });
    adjustRelationship(npc, -50);
    expect(npc.relationshipScore).toBe(-100);
  });

  it('starts from 0 when not specified', () => {
    const npc = createNPC({ name: 'Carl' });
    adjustRelationship(npc, 5);
    expect(npc.relationshipScore).toBe(5);
  });
});
