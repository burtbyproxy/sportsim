import { describe, it, expect, beforeEach } from 'vitest';
import {
  createPlayer,
  getEffectiveStat,
  tickModifiers,
  addModifier,
  addItem,
  removeItem,
  hasItem,
  adjustStatus,
  adjustMoney,
  addTrauma,
  feedObsession,
  updateArchetypeScore,
  incrementCounter,
} from '../src/models/player.js';

// ---------------------------------------------------------------------------
// createPlayer
// ---------------------------------------------------------------------------

describe('createPlayer', () => {
  it('returns an object with the given name', () => {
    const p = createPlayer('Dirtbag');
    expect(p.name).toBe('Dirtbag');
  });

  it('assigns a unique id', () => {
    const a = createPlayer('A');
    const b = createPlayer('B');
    expect(a.id).toBeTruthy();
    expect(b.id).toBeTruthy();
    expect(a.id).not.toBe(b.id);
  });

  it('starts at moms_house', () => {
    const p = createPlayer('X');
    expect(p.currentLocationId).toBe('moms_house');
  });

  it('has all 8 stats within 10-20 range', () => {
    // Run multiple times to catch randomization edge cases
    for (let i = 0; i < 20; i++) {
      const p = createPlayer('Test');
      for (const statName of ['stamina', 'toughness', 'wits', 'creativity', 'charm', 'reputation', 'luck', 'karma']) {
        expect(p.stats[statName].base).toBeGreaterThanOrEqual(10);
        expect(p.stats[statName].base).toBeLessThanOrEqual(20);
      }
    }
  });

  it('starts with default status values', () => {
    const p = createPlayer('X');
    expect(p.status.hunger).toBe(50);
    expect(p.status.sobriety).toBe(80);
    expect(p.status.energy).toBe(70);
    expect(p.status.mood).toBe(40);
    expect(p.status.health).toBe(100);
    expect(p.status.money).toBe(0);
  });

  it('starts with empty inventory', () => {
    const p = createPlayer('X');
    expect(p.inventory).toEqual([]);
  });

  it('starts with empty psyche arrays', () => {
    const p = createPlayer('X');
    expect(p.psyche.traumas).toEqual([]);
    expect(p.psyche.obsessions).toEqual([]);
    expect(p.psyche.insanities).toEqual([]);
    expect(p.psyche.abilities).toEqual([]);
  });

  it('starts at level 1 with 0 xp', () => {
    const p = createPlayer('X');
    expect(p.level).toBe(1);
    expect(p.xp).toBe(0);
  });

  it('serializes cleanly to JSON', () => {
    const p = createPlayer('X');
    const serialized = JSON.parse(JSON.stringify(p));
    expect(serialized.name).toBe('X');
    expect(serialized.stats.stamina.base).toBeGreaterThanOrEqual(10);
  });
});

// ---------------------------------------------------------------------------
// getEffectiveStat
// ---------------------------------------------------------------------------

describe('getEffectiveStat', () => {
  let player;

  beforeEach(() => {
    player = createPlayer('Test');
    player.stats.stamina.base = 15;
    player.stats.stamina.modifiers = [];
  });

  it('returns base when no modifiers', () => {
    expect(getEffectiveStat(player, 'stamina')).toBe(15);
  });

  it('adds positive modifiers', () => {
    player.stats.stamina.modifiers.push({ source: 'test', value: 5, duration: 3 });
    expect(getEffectiveStat(player, 'stamina')).toBe(20);
  });

  it('subtracts negative modifiers', () => {
    player.stats.stamina.modifiers.push({ source: 'test', value: -10, duration: 2 });
    expect(getEffectiveStat(player, 'stamina')).toBe(5);
  });

  it('sums multiple modifiers', () => {
    player.stats.stamina.modifiers.push({ source: 'a', value: 5, duration: 1 });
    player.stats.stamina.modifiers.push({ source: 'b', value: -3, duration: 1 });
    expect(getEffectiveStat(player, 'stamina')).toBe(17);
  });

  it('clamps to 0 minimum', () => {
    player.stats.stamina.base = 5;
    player.stats.stamina.modifiers.push({ source: 'test', value: -100, duration: 1 });
    expect(getEffectiveStat(player, 'stamina')).toBe(0);
  });

  it('clamps to 100 maximum', () => {
    player.stats.stamina.base = 95;
    player.stats.stamina.modifiers.push({ source: 'test', value: 20, duration: 1 });
    expect(getEffectiveStat(player, 'stamina')).toBe(100);
  });

  it('returns 0 for unknown stat', () => {
    expect(getEffectiveStat(player, 'nonexistent')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// tickModifiers
// ---------------------------------------------------------------------------

describe('tickModifiers', () => {
  let player;

  beforeEach(() => {
    player = createPlayer('Test');
  });

  it('decrements duration by 1', () => {
    player.stats.stamina.modifiers.push({ source: 'test', value: 5, duration: 3 });
    tickModifiers(player);
    expect(player.stats.stamina.modifiers[0].duration).toBe(2);
  });

  it('removes modifiers at duration 0 after decrement', () => {
    player.stats.stamina.modifiers.push({ source: 'test', value: 5, duration: 1 });
    tickModifiers(player);
    expect(player.stats.stamina.modifiers).toHaveLength(0);
  });

  it('does not remove permanent modifiers (duration null)', () => {
    player.stats.stamina.modifiers.push({ source: 'perm', value: 5, duration: null });
    tickModifiers(player);
    expect(player.stats.stamina.modifiers).toHaveLength(1);
    expect(player.stats.stamina.modifiers[0].duration).toBe(null);
  });

  it('handles multiple stats simultaneously', () => {
    player.stats.stamina.modifiers.push({ source: 'a', value: 1, duration: 1 });
    player.stats.wits.modifiers.push({ source: 'b', value: 2, duration: 2 });
    tickModifiers(player);
    expect(player.stats.stamina.modifiers).toHaveLength(0);
    expect(player.stats.wits.modifiers[0].duration).toBe(1);
  });

  it('handles player with no modifiers', () => {
    expect(() => tickModifiers(player)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// addModifier
// ---------------------------------------------------------------------------

describe('addModifier', () => {
  let player;

  beforeEach(() => {
    player = createPlayer('Test');
    player.stats.charm.modifiers = [];
  });

  it('adds a modifier to the stat', () => {
    addModifier(player, 'charm', { source: 'beer', value: 3, duration: 4 });
    expect(player.stats.charm.modifiers).toHaveLength(1);
    expect(player.stats.charm.modifiers[0].value).toBe(3);
  });

  it('does not mutate the original modifier object', () => {
    const mod = { source: 'beer', value: 3, duration: 4 };
    addModifier(player, 'charm', mod);
    player.stats.charm.modifiers[0].value = 99;
    expect(mod.value).toBe(3);
  });

  it('is a no-op for unknown stat', () => {
    expect(() => addModifier(player, 'fakestat', { source: 'x', value: 1, duration: 1 })).not.toThrow();
  });

  it('allows permanent modifiers (duration null)', () => {
    addModifier(player, 'charm', { source: 'perk', value: 10, duration: null });
    expect(player.stats.charm.modifiers[0].duration).toBe(null);
  });
});

// ---------------------------------------------------------------------------
// addItem / removeItem / hasItem
// ---------------------------------------------------------------------------

describe('addItem', () => {
  let player;

  beforeEach(() => {
    player = createPlayer('Test');
  });

  it('adds a non-stackable item to inventory', () => {
    addItem(player, { id: 'knife', name: 'Knife', stackable: false, quantity: 1 });
    expect(player.inventory).toHaveLength(1);
    expect(player.inventory[0].id).toBe('knife');
  });

  it('stacks stackable items with same id', () => {
    addItem(player, { id: 'beer', name: 'Beer', stackable: true, quantity: 1 });
    addItem(player, { id: 'beer', name: 'Beer', stackable: true, quantity: 2 });
    expect(player.inventory).toHaveLength(1);
    expect(player.inventory[0].quantity).toBe(3);
  });

  it('adds separate entries for non-stackable duplicates', () => {
    addItem(player, { id: 'rock', name: 'Rock', stackable: false, quantity: 1 });
    addItem(player, { id: 'rock', name: 'Rock', stackable: false, quantity: 1 });
    expect(player.inventory).toHaveLength(2);
  });

  it('does not mutate the source item', () => {
    const item = { id: 'beer', name: 'Beer', stackable: true, quantity: 1 };
    addItem(player, item);
    player.inventory[0].quantity = 99;
    expect(item.quantity).toBe(1);
  });
});

describe('removeItem', () => {
  let player;

  beforeEach(() => {
    player = createPlayer('Test');
  });

  it('removes a non-stackable item', () => {
    addItem(player, { id: 'knife', name: 'Knife', stackable: false, quantity: 1 });
    removeItem(player, 'knife');
    expect(player.inventory).toHaveLength(0);
  });

  it('decrements quantity for stackable items', () => {
    addItem(player, { id: 'beer', name: 'Beer', stackable: true, quantity: 3 });
    removeItem(player, 'beer');
    expect(player.inventory[0].quantity).toBe(2);
  });

  it('removes stackable item when quantity hits 0', () => {
    addItem(player, { id: 'beer', name: 'Beer', stackable: true, quantity: 1 });
    removeItem(player, 'beer');
    expect(player.inventory).toHaveLength(0);
  });

  it('is a no-op when item not in inventory', () => {
    expect(() => removeItem(player, 'ghost_item')).not.toThrow();
    expect(player.inventory).toHaveLength(0);
  });
});

describe('hasItem', () => {
  let player;

  beforeEach(() => {
    player = createPlayer('Test');
  });

  it('returns true when item is in inventory', () => {
    addItem(player, { id: 'knife', name: 'Knife', stackable: false, quantity: 1 });
    expect(hasItem(player, 'knife')).toBe(true);
  });

  it('returns false when item is not in inventory', () => {
    expect(hasItem(player, 'knife')).toBe(false);
  });

  it('returns false after item removed', () => {
    addItem(player, { id: 'knife', name: 'Knife', stackable: false, quantity: 1 });
    removeItem(player, 'knife');
    expect(hasItem(player, 'knife')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// adjustStatus
// ---------------------------------------------------------------------------

describe('adjustStatus', () => {
  let player;

  beforeEach(() => {
    player = createPlayer('Test');
    player.status.hunger = 50;
    player.status.sobriety = 50;
    player.status.energy = 50;
    player.status.mood = 50;
    player.status.health = 50;
  });

  it('increases a status by delta', () => {
    adjustStatus(player, 'hunger', 20);
    expect(player.status.hunger).toBe(70);
  });

  it('decreases a status by negative delta', () => {
    adjustStatus(player, 'hunger', -30);
    expect(player.status.hunger).toBe(20);
  });

  it('clamps to 0 on underflow', () => {
    adjustStatus(player, 'hunger', -200);
    expect(player.status.hunger).toBe(0);
  });

  it('clamps to 100 on overflow', () => {
    adjustStatus(player, 'hunger', 200);
    expect(player.status.hunger).toBe(100);
  });

  it('delegates money to adjustMoney (no clamping)', () => {
    player.status.money = 0;
    adjustStatus(player, 'money', -999);
    expect(player.status.money).toBe(-999);
  });

  it('is a no-op for unknown status key', () => {
    expect(() => adjustStatus(player, 'fakekey', 10)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// adjustMoney
// ---------------------------------------------------------------------------

describe('adjustMoney', () => {
  let player;

  beforeEach(() => {
    player = createPlayer('Test');
    player.status.money = 0;
  });

  it('adds money', () => {
    adjustMoney(player, 50);
    expect(player.status.money).toBe(50);
  });

  it('goes negative (debt)', () => {
    adjustMoney(player, -100);
    expect(player.status.money).toBe(-100);
  });

  it('accumulates correctly', () => {
    adjustMoney(player, 25);
    adjustMoney(player, -10);
    expect(player.status.money).toBe(15);
  });
});

// ---------------------------------------------------------------------------
// addTrauma
// ---------------------------------------------------------------------------

describe('addTrauma', () => {
  let player;

  beforeEach(() => {
    player = createPlayer('Test');
  });

  it('adds a trauma to psyche.traumas', () => {
    addTrauma(player, { id: 'mugged', name: 'Mugged', description: 'Someone took your wallet.', source: 'event_mugging', effects: {} });
    expect(player.psyche.traumas).toHaveLength(1);
    expect(player.psyche.traumas[0].id).toBe('mugged');
  });

  it('does not mutate the original trauma object', () => {
    const t = { id: 'mugged', name: 'Mugged', description: 'X', source: 'Y', effects: {} };
    addTrauma(player, t);
    player.psyche.traumas[0].name = 'Different';
    expect(t.name).toBe('Mugged');
  });

  it('accumulates multiple traumas', () => {
    addTrauma(player, { id: 'a', name: 'A', description: '', source: '', effects: {} });
    addTrauma(player, { id: 'b', name: 'B', description: '', source: '', effects: {} });
    expect(player.psyche.traumas).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// feedObsession
// ---------------------------------------------------------------------------

describe('feedObsession', () => {
  let player;

  beforeEach(() => {
    player = createPlayer('Test');
    player.psyche.obsessions = [
      { id: 'booze', name: 'Booze', strength: 50, relatedActions: [], effects: {} },
    ];
  });

  it('increases obsession strength', () => {
    feedObsession(player, 'booze', 10);
    expect(player.psyche.obsessions[0].strength).toBe(60);
  });

  it('clamps to 100 on overflow', () => {
    feedObsession(player, 'booze', 200);
    expect(player.psyche.obsessions[0].strength).toBe(100);
  });

  it('clamps to 0 on underflow (negative feed)', () => {
    feedObsession(player, 'booze', -200);
    expect(player.psyche.obsessions[0].strength).toBe(0);
  });

  it('is a no-op for unknown obsession id', () => {
    expect(() => feedObsession(player, 'nonexistent', 10)).not.toThrow();
    expect(player.psyche.obsessions[0].strength).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// updateArchetypeScore
// ---------------------------------------------------------------------------

describe('updateArchetypeScore', () => {
  let player;

  beforeEach(() => {
    player = createPlayer('Test');
  });

  it('creates and increments a new archetype', () => {
    updateArchetypeScore(player, 'burnout', 5);
    expect(player.archetypeScores.burnout).toBe(5);
  });

  it('accumulates on existing archetype', () => {
    updateArchetypeScore(player, 'burnout', 5);
    updateArchetypeScore(player, 'burnout', 3);
    expect(player.archetypeScores.burnout).toBe(8);
  });

  it('handles negative delta', () => {
    updateArchetypeScore(player, 'burnout', 10);
    updateArchetypeScore(player, 'burnout', -4);
    expect(player.archetypeScores.burnout).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// incrementCounter
// ---------------------------------------------------------------------------

describe('incrementCounter', () => {
  let player;

  beforeEach(() => {
    player = createPlayer('Test');
  });

  it('creates a counter starting at delta', () => {
    incrementCounter(player, 'fights_won', 1);
    expect(player.counters.fights_won).toBe(1);
  });

  it('defaults delta to 1', () => {
    incrementCounter(player, 'fights_won');
    expect(player.counters.fights_won).toBe(1);
  });

  it('accumulates', () => {
    incrementCounter(player, 'fights_won', 3);
    incrementCounter(player, 'fights_won', 2);
    expect(player.counters.fights_won).toBe(5);
  });

  it('handles multiple different counters independently', () => {
    incrementCounter(player, 'a', 1);
    incrementCounter(player, 'b', 5);
    expect(player.counters.a).toBe(1);
    expect(player.counters.b).toBe(5);
  });
});
