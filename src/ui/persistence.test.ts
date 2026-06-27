import { describe, it, expect } from 'vitest';
import {
  saveState,
  loadState,
  clearState,
  exportState,
  importState,
  listSaves,
  saveNamedGame,
  loadNamedGame,
  deleteNamedGame,
  STORAGE_KEY,
} from './persistence';
import { sampleState } from './sampleState';

/** In-memory Storage stand-in for tests (node has no localStorage). */
function fakeStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => (m.has(k) ? m.get(k)! : null),
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, v),
  };
}

describe('persistence', () => {
  it('round-trips a saved state', () => {
    const st = fakeStorage();
    const s = sampleState();
    saveState(s, st);
    const loaded = loadState(st);
    expect(loaded).toEqual(s);
  });

  it('returns null when nothing is saved', () => {
    expect(loadState(fakeStorage())).toBeNull();
  });

  it('returns null for corrupt or foreign data', () => {
    const st = fakeStorage();
    st.setItem(STORAGE_KEY, '{not json');
    expect(loadState(st)).toBeNull();
    st.setItem(STORAGE_KEY, JSON.stringify({ hello: 'world' }));
    expect(loadState(st)).toBeNull();
  });

  it('clears saved state', () => {
    const st = fakeStorage();
    saveState(sampleState(), st);
    clearState(st);
    expect(loadState(st)).toBeNull();
  });

  it('no-ops gracefully when storage is unavailable', () => {
    expect(() => saveState(sampleState(), undefined)).not.toThrow();
    expect(loadState(undefined)).toBeNull();
    expect(() => clearState(undefined)).not.toThrow();
  });

  it('round-trips through export/import (envelope)', () => {
    const s = sampleState();
    const loaded = importState(exportState(s));
    expect(loaded).toEqual(s);
  });

  it('imports a bare GameState (no envelope)', () => {
    const s = sampleState();
    expect(importState(JSON.stringify(s))).toEqual(s);
  });

  it('returns null for invalid import text', () => {
    expect(importState('{not json')).toBeNull();
    expect(importState(JSON.stringify({ app: 'dwfa', version: 1, state: { hello: 1 } }))).toBeNull();
    expect(importState(JSON.stringify({ nope: true }))).toBeNull();
  });
});

describe('named saves', () => {
  it('saves, lists, loads and deletes by name', () => {
    const st = fakeStorage();
    const s = sampleState();
    saveNamedGame('My game', s, st);
    expect(listSaves(st).map((x) => x.name)).toEqual(['My game']);
    expect(loadNamedGame('My game', st)).toEqual(s);
    deleteNamedGame('My game', st);
    expect(listSaves(st)).toEqual([]);
    expect(loadNamedGame('My game', st)).toBeNull();
  });

  it('overwrites an existing name and trims whitespace', () => {
    const st = fakeStorage();
    saveNamedGame('  slot  ', sampleState(), st);
    const bumped = { ...sampleState(), round: 9 };
    saveNamedGame('slot', bumped, st);
    expect(listSaves(st)).toHaveLength(1);
    expect(loadNamedGame('slot', st)?.round).toBe(9);
  });

  it('ignores a blank name and unknown loads', () => {
    const st = fakeStorage();
    saveNamedGame('   ', sampleState(), st);
    expect(listSaves(st)).toEqual([]);
    expect(loadNamedGame('nope', st)).toBeNull();
  });

  it('orders saves most-recent first', () => {
    const st = fakeStorage();
    saveNamedGame('a', sampleState(), st);
    // Force a later timestamp for the second save.
    const realNow = Date.now;
    Date.now = () => realNow() + 1000;
    try {
      saveNamedGame('b', sampleState(), st);
    } finally {
      Date.now = realNow;
    }
    expect(listSaves(st).map((x) => x.name)).toEqual(['b', 'a']);
  });
});
