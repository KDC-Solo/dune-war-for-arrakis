import { useEffect, useMemo, useState } from 'react';
import type { ActionResult, GameState } from '../engine/state';
import { resolveAction } from '../engine/harkonnenActions';
import { availability } from '../engine/spiceMustFlow';
import { placeVehicles } from '../engine/vehiclePlacement';
import { describeAction, actionHeadline, areaLabel } from './describeAction';
import { sampleState } from './sampleState';
import { StateEditor } from './StateEditor';
import { loadState, saveState, clearState } from './persistence';

const DIE_RESULTS: ActionResult[] = ['leadership', 'strategy', 'mentat', 'deployment', 'house'];
const DIE_LABEL: Record<ActionResult, string> = {
  leadership: 'Leadership',
  strategy: 'Strategy',
  mentat: 'Mentat',
  deployment: 'Deployment',
  house: 'House',
};

function RoundPanel({ s }: { s: GameState }) {
  const avail = availability(s.spice.markers);
  return (
    <section className="panel">
      <h2>This round</h2>
      <dl className="kv">
        <dt>Round</dt>
        <dd>{s.round}</dd>
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

function ResolvePanel({ s }: { s: GameState }) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const action = useMemo(() => (result ? resolveAction(s, result) : null), [s, result]);
  return (
    <section className="panel">
      <h2>Resolve Harkonnen turn</h2>
      <p className="hint">Roll the Harkonnen action die, then tap the result:</p>
      <div className="die-row">
        {DIE_RESULTS.map((r) => (
          <button
            key={r}
            className={r === result ? 'die selected' : 'die'}
            onClick={() => setResult(r)}
          >
            {DIE_LABEL[r]}
          </button>
        ))}
      </div>
      {action && (
        <div className="directive">
          <div className="directive-head">{actionHeadline(action)}</div>
          <p className="directive-text">{describeAction(action)}</p>
        </div>
      )}
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

  return (
    <div className="app">
      <header>
        <h1>Dune: War for Arrakis</h1>
        <p className="subtitle">Mahdi solo companion — Harkonnen AI</p>
      </header>
      <main>
        <RoundPanel s={s} />
        <ResolvePanel s={s} />
        <VehiclePanel s={s} />
        <StateEditor s={s} onChange={setS} onReset={reset} />
      </main>
      <footer>
        <small>State auto-saves to this browser. Round driver &amp; turn-confirm next.</small>
      </footer>
    </div>
  );
}
