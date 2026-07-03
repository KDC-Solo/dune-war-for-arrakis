// v2 game store: one hook owning GameState + the apply/undo/chronicle machinery every surface
// shares. Mirrors v1's commit semantics (snapshot → apply → log → toast → cue) so behavior and
// saves stay identical; only the presentation is new.

import { useEffect, useRef, useState } from 'react';
import type { GameState } from '../engine/state';
import { newGameState } from '../engine/newGame';
import { loadState, saveState } from '../ui/persistence';
import { sampleState } from '../ui/sampleState';
import { play } from '../ui/sound';

export interface LogEntry {
  id: number;
  round: number;
  time: number;
  headline: string;
  text: string;
  note?: string;
}

export interface ApplyLog {
  headline: string;
  text?: string;
  note?: string;
  /** Skip the toast/cue (e.g. silent edits). */
  quiet?: boolean;
}

const UNDO_LIMIT = 30;

export function useGame() {
  const [s, setS] = useState<GameState>(() => loadState() ?? sampleState());
  const [past, setPast] = useState<GameState[]>([]);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const nextId = useRef(1);

  useEffect(() => saveState(s), [s]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  /** Apply a change with undo + chronicle + toast + cue. */
  const commit = (next: GameState, l: ApplyLog) => {
    setPast((p) => [...p.slice(-(UNDO_LIMIT - 1)), s]);
    setLog((h) => [
      ...h.slice(-(UNDO_LIMIT - 1)),
      {
        id: nextId.current++,
        round: s.round,
        time: Date.now(),
        headline: l.headline,
        text: l.text ?? '',
        note: l.note,
      },
    ]);
    setS(next);
    if (!l.quiet) {
      setToast(`${l.headline}`);
      play('apply');
    }
  };

  /** Silent state edit (drag-style edits that shouldn't spam the chronicle). */
  const edit = (next: GameState) => setS(next);

  const undo = () => {
    setPast((p) => {
      if (p.length === 0) return p;
      setS(p[p.length - 1]);
      return p.slice(0, -1);
    });
    setLog((h) => h.slice(0, -1));
    setToast('Undone');
  };

  /** Load/import/new game: fresh undo history. */
  const loadGame = (next: GameState) => {
    setPast([]);
    setLog([]);
    setS(next);
  };
  const startNew = () => {
    loadGame(newGameState());
    setToast('New game');
  };

  return { s, commit, edit, undo, canUndo: past.length > 0, log, toast, setToast, loadGame, startNew };
}

export type Game = ReturnType<typeof useGame>;
