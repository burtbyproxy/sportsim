/**
 * Integration: Player lifecycle
 *
 * Tests the full pipeline:
 *   createPlayer() -> mutate via model functions -> serialize to JSON -> deserialize ->
 *   all model functions still work on the deserialized object.
 *
 * This validates the localStorage save/load contract.
 */

import { describe, it, expect } from 'vitest';
import {
  createPlayer,
  getEffectiveStat,
  addModifier,
  tickModifiers,
  addItem,
  removeItem,
  hasItem,
  adjustStatus,
  adjustMoney,
  addTrauma,
  feedObsession,
  updateArchetypeScore,
  incrementCounter,
} from '../../src/models/player.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Round-trip a player through JSON serialization.
 * Simulates saving to and loading from localStorage.
 */
function saveAndLoad(player) {
  return JSON.parse(JSON.stringify(player));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('player lifecycle — create, mutate, serialize, restore', () => {
  it('player survives a full JSON round-trip', () => {
    const player = createPlayer('Portland');
    const loaded = saveAndLoad(player);

    expect(loaded.id).toBe(player.id);
    expect(loaded.name).toBe('Portland');
    expect(loaded.currentLocationId).toBe('moms_house');
    expect(loaded.level).toBe(1);
  });

  it('stats survive round-trip with modifiers intact', () => {
    const player = createPlayer('Test');
    addModifier(player, 'charm', { source: 'beer', value: 5, duration: 3 });

    const loaded = saveAndLoad(player);

    expect(loaded.stats.charm.modifiers).toHaveLength(1);
    expect(loaded.stats.charm.modifiers[0].value).toBe(5);
    expect(loaded.stats.charm.modifiers[0].duration).toBe(3);
  });

  it('getEffectiveStat works on deserialized player', () => {
    const player = createPlayer('Test');
    player.stats.wits.base = 15;
    addModifier(player, 'wits', { source: 'test', value: -3, duration: 2 });

    const loaded = saveAndLoad(player);
    expect(getEffectiveStat(loaded, 'wits')).toBe(12);
  });

  it('tickModifiers works on deserialized player — expires correctly', () => {
    const player = createPlayer('Test');
    addModifier(player, 'luck', { source: 'coffee', value: 4, duration: 2 });

    let loaded = saveAndLoad(player);
    tickModifiers(loaded);
    expect(loaded.stats.luck.modifiers[0].duration).toBe(1);

    loaded = saveAndLoad(loaded);
    tickModifiers(loaded);
    expect(loaded.stats.luck.modifiers).toHaveLength(0);
  });

  it('permanent modifiers survive round-trip and never expire', () => {
    const player = createPlayer('Test');
    addModifier(player, 'karma', { source: 'scar', value: -2, duration: null });

    const loaded = saveAndLoad(player);
    tickModifiers(loaded);
    tickModifiers(loaded);
    tickModifiers(loaded);

    expect(loaded.stats.karma.modifiers).toHaveLength(1);
    expect(loaded.stats.karma.modifiers[0].duration).toBe(null);
  });

  it('inventory survives round-trip — hasItem and removeItem work', () => {
    const player = createPlayer('Test');
    addItem(player, { id: 'pabst', name: 'Pabst', stackable: true, quantity: 3 });

    const loaded = saveAndLoad(player);
    expect(hasItem(loaded, 'pabst')).toBe(true);

    removeItem(loaded, 'pabst');
    expect(loaded.inventory[0].quantity).toBe(2);
  });

  it('status adjustments survive round-trip', () => {
    const player = createPlayer('Test');
    adjustStatus(player, 'hunger', -20);
    adjustMoney(player, -50);

    const loaded = saveAndLoad(player);
    expect(loaded.status.hunger).toBe(30);
    expect(loaded.status.money).toBe(-50);
  });

  it('psyche state survives round-trip', () => {
    const player = createPlayer('Test');
    addTrauma(player, { id: 'mugged', name: 'Mugged', description: 'X', source: 'Y', effects: {} });
    player.psyche.obsessions.push({ id: 'booze', name: 'Booze', strength: 20, relatedActions: [], effects: {} });
    feedObsession(player, 'booze', 15);

    const loaded = saveAndLoad(player);
    expect(loaded.psyche.traumas).toHaveLength(1);
    expect(loaded.psyche.traumas[0].id).toBe('mugged');
    expect(loaded.psyche.obsessions[0].strength).toBe(35);
  });

  it('archetype scores and counters survive round-trip', () => {
    const player = createPlayer('Test');
    updateArchetypeScore(player, 'burnout', 10);
    incrementCounter(player, 'drinks_consumed', 5);

    const loaded = saveAndLoad(player);
    expect(loaded.archetypeScores.burnout).toBe(10);
    expect(loaded.counters.drinks_consumed).toBe(5);

    // Can continue accumulating on the loaded player
    updateArchetypeScore(loaded, 'burnout', 5);
    incrementCounter(loaded, 'drinks_consumed', 1);
    expect(loaded.archetypeScores.burnout).toBe(15);
    expect(loaded.counters.drinks_consumed).toBe(6);
  });

  it('status clamping still enforced after round-trip', () => {
    const player = createPlayer('Test');
    player.status.mood = 5;
    const loaded = saveAndLoad(player);

    adjustStatus(loaded, 'mood', -100);
    expect(loaded.status.mood).toBe(0);

    adjustStatus(loaded, 'mood', 200);
    expect(loaded.status.mood).toBe(100);
  });

  it('money can go deeply negative after round-trip (debt)', () => {
    const player = createPlayer('Test');
    adjustMoney(player, -1000);
    const loaded = saveAndLoad(player);

    expect(loaded.status.money).toBe(-1000);
    adjustMoney(loaded, -500);
    expect(loaded.status.money).toBe(-1500);
  });
});
