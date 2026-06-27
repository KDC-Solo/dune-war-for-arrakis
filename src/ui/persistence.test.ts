import { describe, it, expect } from 'vitest';
import { saveState, loadState, clearState, STORAGE_KEY } from './persistence';
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
});
