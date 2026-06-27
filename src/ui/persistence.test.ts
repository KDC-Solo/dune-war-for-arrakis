import { describe, it, expect } from 'vitest';
import { saveState, loadState, clearState, exportState, importState, STORAGE_KEY } from './persistence';
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
