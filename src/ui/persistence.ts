// Local persistence for the game state (localStorage). Survives page refreshes.
// Functions take an optional Storage so they're unit-testable without a browser.

import type { GameState } from '../engine/state';

// Versioned key — bump the suffix if the GameState shape changes incompatibly.
export const STORAGE_KEY = 'dwfa.state.v1';

function safeStorage(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined; // no DOM / storage disabled
  }
}

/** Minimal structural check so a stale/foreign value doesn't crash the app. */
function looksLikeState(x: unknown): x is GameState {
  if (!x || typeof x !== 'object') return false;
  const s = x as Record<string, unknown>;
  return (
    typeof s.round === 'number' &&
    Array.isArray(s.legions) &&
    typeof s.spice === 'object' &&
    s.spice !== null &&
    'markers' in (s.spice as object)
  );
}

export function saveState(s: GameState, storage: Storage | undefined = safeStorage()): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // ignore quota / serialization errors
  }
}

export function loadState(storage: Storage | undefined = safeStorage()): GameState | null {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return looksLikeState(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function clearState(storage: Storage | undefined = safeStorage()): void {
  try {
    storage?.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
