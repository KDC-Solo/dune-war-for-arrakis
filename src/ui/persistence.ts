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

// ---------------------------------------------------------------------------
// Named saves — keep several games side by side (separate from the auto-save)
// ---------------------------------------------------------------------------

/** localStorage key holding the map of named saves. */
export const SAVES_KEY = 'dwfa.saves.v1';

export interface NamedSave {
  name: string;
  savedAt: string;
  state: GameState;
}

function readSaves(storage: Storage | undefined): Record<string, NamedSave> {
  try {
    const raw = storage?.getItem(SAVES_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, NamedSave>) : {};
  } catch {
    return {};
  }
}

function writeSaves(saves: Record<string, NamedSave>, storage: Storage | undefined): void {
  try {
    storage?.setItem(SAVES_KEY, JSON.stringify(saves));
  } catch {
    // ignore quota errors
  }
}

/** Named saves sorted most-recently-saved first. */
export function listSaves(storage: Storage | undefined = safeStorage()): NamedSave[] {
  return Object.values(readSaves(storage)).sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

/** Save (or overwrite) a game under `name`. A blank name is ignored. */
export function saveNamedGame(name: string, s: GameState, storage: Storage | undefined = safeStorage()): void {
  const key = name.trim();
  if (!key) return;
  const saves = readSaves(storage);
  saves[key] = { name: key, savedAt: new Date(Date.now()).toISOString(), state: s };
  writeSaves(saves, storage);
}

export function loadNamedGame(name: string, storage: Storage | undefined = safeStorage()): GameState | null {
  const save = readSaves(storage)[name.trim()];
  return save && looksLikeState(save.state) ? save.state : null;
}

export function deleteNamedGame(name: string, storage: Storage | undefined = safeStorage()): void {
  const saves = readSaves(storage);
  delete saves[name.trim()];
  writeSaves(saves, storage);
}

// ---------------------------------------------------------------------------
// Export / import — share or back up a game as a JSON file
// ---------------------------------------------------------------------------

/** Current export-envelope version (independent of the storage key suffix). */
export const EXPORT_VERSION = 1;

interface ExportEnvelope {
  app: 'dwfa';
  version: number;
  exportedAt: string;
  state: GameState;
}

/** Serialize a game to a pretty JSON string wrapped in a recognizable envelope. */
export function exportState(s: GameState): string {
  const env: ExportEnvelope = { app: 'dwfa', version: EXPORT_VERSION, exportedAt: new Date().toISOString(), state: s };
  return JSON.stringify(env, null, 2);
}

/**
 * Parse a previously exported game. Accepts either the envelope produced by `exportState`
 * or a bare GameState object (so hand-edited / older files still load). Returns null on
 * anything that doesn't structurally look like a game state.
 */
export function importState(text: string): GameState | null {
  try {
    const parsed: unknown = JSON.parse(text);
    if (looksLikeState(parsed)) return parsed;
    if (parsed && typeof parsed === 'object' && 'state' in (parsed as object)) {
      const inner = (parsed as { state: unknown }).state;
      if (looksLikeState(inner)) return inner;
    }
    return null;
  } catch {
    return null;
  }
}
