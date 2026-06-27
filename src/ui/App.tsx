import { useEffect, useMemo, useState } from 'react';
import type { ActionResult, GameState } from '../engine/state';
import { resolveAction } from '../engine/harkonnenActions';
import { applyHarkonnenAction, isAutoApplied } from '../engine/applyAction';
import { availability } from '../engine/spiceMustFlow';
import { startNextRound, SUPREMACY_WIN } from '../engine/round';
import { placeVehicles } from '../engine/vehiclePlacement';
import { describeAction, actionHeadline, areaLabel } from './describeAction';
import { sampleState } from './sampleState';
import { StateEditor } from './StateEditor';
import { loadState, saveState, clearState, exportState } from './persistence';

const DIE_RESULTS: ActionResult[] = ['leadership', 'strategy', 'mentat', 'deployment', 'house'];
const DIE_LABEL: Record<ActionResult, string> = {
  leadership: 'Leadership',
  strategy: 'Strategy',
  mentat: 'Mentat',
  deployment: 'Deployment',
  house: 'House',
};

function RoundPanel({ s, onChange }: { s: GameState; onChange: (next: GameState) => void }) {
  const avail = availability(s.spice.markers);
  const won = s.tracks.supremacy >= SUPREMACY_WIN;

  const nextRound = () => {
    const { state, harkonnenWins } = startNextRound(s);
    onChange(state);
    if (harkonnenWins) {
      // The win banner renders from state; this just surfaces it immediately.
      setTimeout(() => alert('Harkonnen reach supremacy 10 — Harkonnen victory.'), 0);
    }
  };

  return (
    <section className="panel">
      <h2>This round</h2>
      {won && <div className="win-banner">Harkonnen victory — supremacy {SUPREMACY_WIN} reached.</div>}
      <dl className="kv">
        <dt>Round</dt>
        <dd>{s.round}</dd>
        <dt>Supremacy</dt>
        <dd>
          {s.tracks.supremacy} / {SUPREMACY_WIN}
        </dd>
        <dt>Harvesting sector</dt>
        <dd>{s.harvestingSector ?? '—'}</dd>
        <dt>Target sietch</dt>
        <dd>{s.targetSietchId ? areaLabel(s.targetSietchId) : '—'}</dd>
        <dt>Harkonnen dice</dt>
        <dd>{avail.diceAvailable}</dd>
        <dt>Vehicles available</dt>
        <dd>
          {avail.harvesters} harvesters · {avail.ornithopters} ornithopters · {avail.carryalls} carryalls
        </dd>
        <dt>Active imperium bans</dt>
        <dd>{s.spice.activeBans.length ? s.spice.activeBans.join(', ') : 'none'}</dd>
      </dl>
      <button className="confirm-btn" onClick={nextRound} disabled={won}>
        Start next round
      </button>
    </section>
  );
}

function VehiclePanel({ s }: { s: GameState }) {
  const avail = availability(s.spice.markers);
  const placement = useMemo(
    () =>
      placeVehicles(s, {
        harvesters: avail.harvesters,
        carryalls: avail.carryalls,
        ornithopters: avail.ornithopters,
      }),
    [s, avail.harvesters, avail.carryalls, avail.ornithopters],
  );
  return (
    <section className="panel">
      <h2>Vehicle placement</h2>
      <p>
        <strong>Harvesters:</strong>{' '}
        {placement.harvesters.length ? placement.harvesters.map(areaLabel).join(', ') : 'none'}
      </p>
      <p>
        <strong>Carryalls:</strong> {placement.carryalls.length ? placement.carryalls.join(', ') : 'none'}
      </p>
      <p>
        <strong>Ornithopters:</strong>{' '}
        {placement.ornithopters.length ? placement.ornithopters.join(', ') : 'none'}
      </p>
    </section>
  );
}

function ResolvePanel({ s, onApply }: { s: GameState; onApply: (next: GameState) => void }) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const action = useMemo(() => (result ? resolveAction(s, result) : null), [s, result]);

  const pick = (r: ActionResult) => {
    setResult(r);
    setNote(null);
  };

  const confirm = () => {
    if (!action) return;
    const res = applyHarkonnenAction(s, action);
    setNote(res.note ?? null);
    if (res.applied) {
      onApply(res.state);
      setResult(null); // ready for the next die roll
    }
  };

  return (
    <section className="panel">
      <h2>Resolve Harkonnen turn</h2>
      <p className="hint">Roll the Harkonnen action die, then tap the result:</p>
      <div className="die-row">
        {DIE_RESULTS.map((r) => (
          <button key={r} className={r === result ? 'die selected' : 'die'} onClick={() => pick(r)}>
            {DIE_LABEL[r]}
          </button>
        ))}
      </div>
      {action && (
        <div className="directive">
          <div className="directive-head">{actionHeadline(action)}</div>
          <p className="directive-text">{describeAction(action)}</p>
          <div className="directive-actions">
            {isAutoApplied(action) ? (
              <button className="confirm-btn" onClick={confirm}>
                Confirm &amp; apply
              </button>
            ) : action.kind === 'none' ? null : (
              <span className="manual-note">Resolve this on the board, then update the state below.</span>
            )}
          </div>
        </div>
      )}
      {note && <p className="apply-note">{note}</p>}
    </section>
  );
}

export function App() {
  // Load the saved game on first render; fall back to the demo state.
  const [s, setS] = useState<GameState>(() => loadState() ?? sampleState());

  // Persist on every change.
  useEffect(() => {
    saveState(s);
  }, [s]);

  const reset = () => {
    clearState();
    setS(sampleState());
  };

  // Download the current game as a JSON file the player can back up or share.
  const exportGame = () => {
    const blob = new Blob([exportState(s)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dwfa-round${s.round}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="app">
      <header>
        <h1>Dune: War for Arrakis</h1>
        <p className="subtitle">Mahdi solo companion — Harkonnen AI</p>
      </header>
      <main>
        <RoundPanel s={s} onChange={setS} />
        <ResolvePanel s={s} onApply={setS} />
        <VehiclePanel s={s} />
        <StateEditor s={s} onChange={setS} onReset={reset} onExport={exportGame} onImport={setS} />
      </main>
      <footer>
        <small>State auto-saves to this browser. Round driver &amp; turn-confirm next.</small>
      </footer>
    </div>
  );
}
