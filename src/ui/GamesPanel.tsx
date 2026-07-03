// Top-level game management: start a new game, back up / restore via JSON, reset to the demo, and
// keep multiple named saves. Kept as its own always-visible panel (these used to be buried at the
// bottom of the collapsed editor, which was hard to find).

import { type ChangeEvent, useState } from 'react';
import type { GameState } from '../engine/state';
import { importState, listSaves, saveNamedGame, loadNamedGame, deleteNamedGame, type NamedSave } from './persistence';

export function GamesPanel({
  s,
  onNewGame,
  onExport,
  onImport,
  onGuidedSetup,
}: {
  s: GameState;
  onNewGame: () => void;
  onExport: () => void;
  onImport: (next: GameState) => void;
  /** Open the step-by-step physical-setup walkthrough (ends in a fresh game). */
  onGuidedSetup: () => void;
}) {
  const pickFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-importing the same filename
    if (!file) return;
    const next = importState(await file.text());
    if (next) onImport(next);
    else alert('That file is not a valid saved game.');
  };

  const [saves, setSaves] = useState<NamedSave[]>(() => listSaves());
  const [saveName, setSaveName] = useState('');
  const refreshSaves = () => setSaves(listSaves());
  const doSave = () => {
    if (!saveName.trim()) return;
    saveNamedGame(saveName, s);
    setSaveName('');
    refreshSaves();
  };
  const doLoad = (name: string) => {
    const st = loadNamedGame(name);
    if (st) onImport(st);
  };
  const doDelete = (name: string) => {
    if (confirm(`Delete saved game "${name}"?`)) {
      deleteNamedGame(name);
      refreshSaves();
    }
  };

  return (
    <section className="panel">
      <h2>Games</h2>
      <p className="hint">Start, back up, or switch games. Your current game also auto-saves to this browser.</p>
      <div className="add-row">
        <button
          className="reset"
          onClick={() => {
            if (confirm('Start a fresh Mahdi-solo game? This replaces the current board (Undo can revert it).')) onNewGame();
          }}
        >
          New game
        </button>
        <button className="reset" onClick={onGuidedSetup}>
          🧭 Guided setup
        </button>
        <button className="reset" onClick={onExport}>
          Export
        </button>
        <label className="reset import-btn">
          Import
          <input type="file" accept="application/json,.json" onChange={pickFile} />
        </label>
      </div>

      <h3>Saved games</h3>
      <div className="save-row">
        <input
          type="text"
          placeholder="Name this game…"
          value={saveName}
          onChange={(e) => setSaveName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && doSave()}
        />
        <button className="add-mini" onClick={doSave} disabled={!saveName.trim()}>
          Save
        </button>
      </div>
      {saves.length === 0 ? (
        <p className="hint">No saved games yet.</p>
      ) : (
        <div className="save-list">
          {saves.map((sv) => (
            <div key={sv.name} className="save-item">
              <span className="save-meta">
                <strong>{sv.name}</strong>
                <span className="hint">
                  round {sv.state.round} · {new Date(sv.savedAt).toLocaleString()}
                </span>
              </span>
              <button className="add-mini" onClick={() => doLoad(sv.name)}>
                Load
              </button>
              <button className="remove" onClick={() => doDelete(sv.name)} title="Delete save">
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
