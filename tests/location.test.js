import { describe, it, expect } from 'vitest';
import {
  createLocation,
  getDescription,
  getAvailableExits,
  isOpen,
  exitMeetsRequirements,
  incrementVisitCount,
} from '../src/models/location.js';

// ---------------------------------------------------------------------------
// createLocation
// ---------------------------------------------------------------------------

describe('createLocation', () => {
  const raw = {
    id: 'blue_parrot',
    type: 'bar',
    variant: 'tavern',
    display: 'The Blue Parrot',
    descriptions: { default: 'A dive bar.' },
    exits: [{ locationId: 'moms_house', label: 'Home', travelTime: 1, requirements: null }],
    npcSlots: ['carl'],
    actionIds: ['drink'],
    discovered: true,
    availability: { openHour: 11, closeHour: 2, closedMessage: 'Closed.' },
    visitCount: 3,
  };

  it('maps all fields correctly', () => {
    const loc = createLocation(raw);
    expect(loc.id).toBe('blue_parrot');
    expect(loc.type).toBe('bar');
    expect(loc.variant).toBe('tavern');
    expect(loc.display).toBe('The Blue Parrot');
    expect(loc.descriptions.default).toBe('A dive bar.');
    expect(loc.exits).toHaveLength(1);
    expect(loc.npcSlots).toContain('carl');
    expect(loc.actionIds).toContain('drink');
    expect(loc.discovered).toBe(true);
    expect(loc.availability.openHour).toBe(11);
    expect(loc.visitCount).toBe(3);
  });

  it('applies defaults for missing optional fields', () => {
    const loc = createLocation({ id: 'x', type: 'park', variant: null, display: 'X' });
    expect(loc.variant).toBe(null);
    expect(loc.descriptions).toEqual({ default: '' });
    expect(loc.exits).toEqual([]);
    expect(loc.npcSlots).toEqual([]);
    expect(loc.actionIds).toEqual([]);
    expect(loc.discovered).toBe(false);
    expect(loc.availability.openHour).toBe(0);
    expect(loc.availability.closeHour).toBe(23);
    expect(loc.visitCount).toBe(0);
  });

  it('does not share references with source data', () => {
    const loc = createLocation(raw);
    loc.exits[0].label = 'MODIFIED';
    expect(raw.exits[0].label).toBe('Home');
  });

  it('serializes cleanly to JSON', () => {
    const loc = createLocation(raw);
    const serialized = JSON.parse(JSON.stringify(loc));
    expect(serialized.id).toBe('blue_parrot');
  });
});

// ---------------------------------------------------------------------------
// getDescription
// ---------------------------------------------------------------------------

describe('getDescription', () => {
  const loc = createLocation({
    id: 'test',
    type: 'bar',
    variant: null,
    display: 'Test',
    descriptions: {
      default: 'Default desc.',
      night: 'Night desc.',
      drunk: 'Drunk desc.',
      exhausted: 'Exhausted desc.',
      starving: 'Starving desc.',
      repeat: 'Repeat desc.',
    },
  });

  it('returns default description with no context', () => {
    expect(getDescription(loc)).toBe('Default desc.');
  });

  it('returns drunk description when sobriety < 30', () => {
    expect(getDescription(loc, { playerStatus: { sobriety: 20 } })).toBe('Drunk desc.');
  });

  it('returns exhausted description when energy < 20', () => {
    expect(getDescription(loc, { playerStatus: { energy: 10 } })).toBe('Exhausted desc.');
  });

  it('returns starving description when hunger < 20', () => {
    expect(getDescription(loc, { playerStatus: { hunger: 5 } })).toBe('Starving desc.');
  });

  it('drunk takes priority over time-of-day', () => {
    expect(getDescription(loc, { timeOfDay: 'night', playerStatus: { sobriety: 10 } })).toBe('Drunk desc.');
  });

  it('returns night description for timeOfDay night', () => {
    expect(getDescription(loc, { timeOfDay: 'night' })).toBe('Night desc.');
  });

  it('returns repeat description when visitCount > 1', () => {
    expect(getDescription(loc, { visitCount: 2 })).toBe('Repeat desc.');
  });

  it('does NOT use repeat when visitCount === 1', () => {
    expect(getDescription(loc, { visitCount: 1 })).toBe('Default desc.');
  });

  it('returns empty string when no default exists', () => {
    const bare = createLocation({ id: 'bare', type: 'park', variant: null, display: 'Bare' });
    expect(getDescription(bare)).toBe('');
  });

  it('sobriety at exactly 30 does not trigger drunk', () => {
    // threshold is < 30, so exactly 30 should not match
    expect(getDescription(loc, { playerStatus: { sobriety: 30 } })).toBe('Default desc.');
  });

  it('ignores status keys that are not below threshold', () => {
    // energy = 50 should not trigger exhausted
    expect(getDescription(loc, { playerStatus: { energy: 50 } })).toBe('Default desc.');
  });
});

// ---------------------------------------------------------------------------
// getAvailableExits
// ---------------------------------------------------------------------------

describe('getAvailableExits', () => {
  it('returns exits array', () => {
    const loc = createLocation({
      id: 'x', type: 'bar', variant: null, display: 'X',
      exits: [
        { locationId: 'y', label: 'Go to Y', travelTime: 1, requirements: null },
      ],
    });
    const exits = getAvailableExits(loc);
    expect(exits).toHaveLength(1);
    expect(exits[0].locationId).toBe('y');
  });

  it('returns empty array when no exits', () => {
    const loc = createLocation({ id: 'x', type: 'park', variant: null, display: 'X' });
    expect(getAvailableExits(loc)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// isOpen
// ---------------------------------------------------------------------------

describe('isOpen', () => {
  it('always open when openHour=0 and closeHour=23', () => {
    const loc = createLocation({
      id: 'x', type: 'park', variant: null, display: 'X',
      availability: { openHour: 0, closeHour: 23, closedMessage: null },
    });
    for (let h = 0; h <= 23; h++) {
      expect(isOpen(loc, h)).toBe(true);
    }
  });

  it('correct for normal daytime window', () => {
    const loc = createLocation({
      id: 'x', type: 'bar', variant: null, display: 'X',
      availability: { openHour: 11, closeHour: 22, closedMessage: null },
    });
    expect(isOpen(loc, 10)).toBe(false);
    expect(isOpen(loc, 11)).toBe(true);
    expect(isOpen(loc, 15)).toBe(true);
    expect(isOpen(loc, 22)).toBe(true);
    expect(isOpen(loc, 23)).toBe(false);
  });

  it('correct for overnight window (bar: 11pm to 2am)', () => {
    const loc = createLocation({
      id: 'x', type: 'bar', variant: null, display: 'X',
      availability: { openHour: 23, closeHour: 2, closedMessage: null },
    });
    expect(isOpen(loc, 23)).toBe(true);
    expect(isOpen(loc, 0)).toBe(true);
    expect(isOpen(loc, 1)).toBe(true);
    expect(isOpen(loc, 2)).toBe(true);
    expect(isOpen(loc, 3)).toBe(false);
    expect(isOpen(loc, 22)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// incrementVisitCount
// ---------------------------------------------------------------------------

describe('incrementVisitCount', () => {
  it('increments from 0 to 1', () => {
    const loc = createLocation({ id: 'x', type: 'park', variant: null, display: 'X' });
    incrementVisitCount(loc);
    expect(loc.visitCount).toBe(1);
  });

  it('increments repeatedly', () => {
    const loc = createLocation({ id: 'x', type: 'park', variant: null, display: 'X' });
    incrementVisitCount(loc);
    incrementVisitCount(loc);
    incrementVisitCount(loc);
    expect(loc.visitCount).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// exitMeetsRequirements
// ---------------------------------------------------------------------------

describe('exitMeetsRequirements', () => {
  const gameTime = { hour: 14 };
  const player = {
    stats: { charisma: { base: 3 } },
    status: { sobriety: 80 },
    inventory: [{ id: 'bus_pass', quantity: 1 }],
    psyche: { traumas: [], abilities: [] },
  };

  it('an exit with no requirements is always open', () => {
    const exit = { locationId: 'park', requirements: null };
    expect(exitMeetsRequirements({ exit, player, gameTime })).toEqual({ meets: true, reason: null });
  });

  it('an item requirement the player satisfies passes', () => {
    const exit = { locationId: 'downtown', requirements: { requiredItems: ['bus_pass'] } };
    expect(exitMeetsRequirements({ exit, player, gameTime }).meets).toBe(true);
  });

  it('an item requirement the player lacks fails with a reason', () => {
    const exit = { locationId: 'downtown', requirements: { requiredItems: ['car_keys'] } };
    const result = exitMeetsRequirements({ exit, player, gameTime });
    expect(result.meets).toBe(false);
    expect(result.reason).toContain('car_keys');
  });

  it('a stat requirement is judged against the base stat', () => {
    const tooHigh = { locationId: 'gallery', requirements: { minStats: { charisma: 5 } } };
    const justRight = { locationId: 'gallery', requirements: { minStats: { charisma: 3 } } };
    expect(exitMeetsRequirements({ exit: tooHigh, player, gameTime }).meets).toBe(false);
    expect(exitMeetsRequirements({ exit: justRight, player, gameTime }).meets).toBe(true);
  });

  it('a time-of-day window is honoured', () => {
    const nightOnly = { locationId: 'club', requirements: { minHour: 21 } };
    expect(exitMeetsRequirements({ exit: nightOnly, player, gameTime }).meets).toBe(false);
    expect(exitMeetsRequirements({ exit: nightOnly, player, gameTime: { hour: 22 } }).meets).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// scavenge fields
// ---------------------------------------------------------------------------

describe('createLocation — scavenge', () => {
  const base = { id: 'lot', type: 'fuel', display: 'The Lot' };

  it('carries the table the place draws from', () => {
    expect(createLocation({ ...base, scavengeTableId: 'lot' }).scavengeTableId).toBe('lot');
  });

  it('a place with no table has nothing to find', () => {
    expect(createLocation(base).scavengeTableId).toBeNull();
  });

  it('starts unworked, and copies saved wear', () => {
    expect(createLocation(base).scavenge).toEqual({ depletion: 0, updatedAtTick: 0 });
    const saved = { depletion: 3, updatedAtTick: 40 };
    const location = createLocation({ ...base, scavenge: saved });
    expect(location.scavenge).toEqual(saved);
    expect(location.scavenge).not.toBe(saved);
  });
});
