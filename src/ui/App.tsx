import { useEffect, useMemo, useState } from 'react';
import type { ActionResult, GameState } from '../engine/state';
import { resolveAction } from '../engine/harkonnenActions';
import { applyHarkonnenAction, isAutoApplied } from '../engine/applyAction';
import { availability } from '../engine/spiceMustFlow';
import { startNextRound, SUPREMACY_WIN } from '../engine/round';
import { placeVehicles } from '../engine/vehiclePlacement';
import { resolveCardPlay } from '../engine/cardEffects';
import { resolveLeaderSpecial } from '../engine/leaderEffects';
import { applyEffectSteps } from '../engine/effectSteps';
import { stormTargets, stormHits, resolveCoriolisStorms, type StormDice } from '../engine/storms';
import { HOUSE_HARKONNEN_CARDS, CORRINO_ALLY_CARDS } from '../engine/planningCards';
import { NAMED_LEADERS } from '../engine/leaders';
import { describeAction, actionHeadline, areaLabel } from './describeAction';
import { sampleState } from './sampleState';
import { newGameState } from '../engine/newGame';
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

const HELP_KEY = 'dwfa.helpOpen';

function HelpPanel() {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(HELP_KEY) !== 'closed';
    } catch {
      return true;
    }
  });
  const onToggle = (e: React.SyntheticEvent<HTMLDetailsElement>) => {
    const next = e.currentTarget.open;
    setOpen(next);
    try {
      localStorage.setItem(HELP_KEY, next ? 'open' : 'closed');
    } catch {
      /* ignore */
    }
  };

  return (
    <details className="panel help" open={open} onToggle={onToggle}>
      <summary>How to use this companion</summary>
      <p>
        You play <strong>Atreides</strong> on the physical board; this app runs the <strong>Harkonnen AI</strong>.
        Keep it in sync with the board, and on the Harkonnen's turn it tells you what they do. The
        <strong> physical board is always the source of truth</strong> — the app just decides Harkonnen actions.
      </p>

      <h4>First time — describe your board</h4>
      <p>
        Open <em>Edit game state</em> (bottom) and match your table: imperium markers, every Harkonnen &amp;
        Atreides legion, sietch/settlement ranks, and the Harkonnen reserve. Then <em>Save</em> it under a name.
        (What loads now is a demo game to experiment with.)
      </p>

      <h4>Each round, top to bottom</h4>
      <ul className="help-list">
        <li>
          <strong>This round</strong> — the Harkonnen's dice, vehicles, and active bans. <em>Start next round</em> when done.
        </li>
        <li>
          <strong>Vehicle placement</strong> — where to drop the Harkonnen harvesters/carryalls/ornithopters.
        </li>
        <li>
          <strong>Resolve Harkonnen turn</strong> — roll the physical action die, tap the matching face; read the
          directive, then <em>Confirm &amp; apply</em> (mechanical actions) or resolve it on the board (attacks).
        </li>
        <li>
          <strong>Resolve a card or leader ability</strong> — pick a Harkonnen planning card / leader special to see
          its steps. <span className="badge-inline auto">auto</span> steps the app applies;
          <span className="badge-inline you">you</span> steps you do.
        </li>
        <li>
          <strong>Coriolis Storms</strong> — for each exposed legion, roll 2 combat dice, enter swords + specials,
          and apply the casualties.
        </li>
      </ul>
      <p className="hint">Mis-tapped? <strong>↶ Undo</strong> (top right) reverts the last applied action.</p>
    </details>
  );
}

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
      <p className="hint">What the Harkonnen get this round, from the Spice Must Flow markers.</p>
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
      <p className="hint">Where to place the Harkonnen vehicles on the board this round.</p>
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

// The 3 "Rage Overcame Shaddam IV" cards share a name; disambiguate them in the dropdown.
const RAGE_SUFFIX: Record<string, string> = {
  rage_overcame_shaddam_iv_a: ' — +4 Regulars',
  rage_overcame_shaddam_iv_b: ' — +2 Sardaukar',
  rage_overcame_shaddam_iv_c: ' — Surprise Attack',
};
const cardLabel = (c: { id: string; name: string }) => c.name + (RAGE_SUFFIX[c.id] ?? '');

function CardPanel({ s, onApply }: { s: GameState; onApply: (next: GameState) => void }) {
  // Value is prefixed: "card:<id>" or "leader:<name>".
  const [sel, setSel] = useState('');
  const resolution = useMemo(() => {
    if (sel.startsWith('card:')) return resolveCardPlay(sel.slice(5), s);
    if (sel.startsWith('leader:')) return resolveLeaderSpecial(sel.slice(7), s);
    return null;
  }, [sel, s]);
  const autoCount = resolution?.steps.filter((st) => st.auto).length ?? 0;

  const apply = () => {
    if (!resolution) return;
    onApply(applyEffectSteps(s, resolution.steps));
    setSel(''); // resolved — clear for the next effect
  };

  return (
    <section className="panel">
      <h2>Resolve a card or leader ability</h2>
      <p className="hint">Pick a Harkonnen planning card or a named leader's special; the app applies the mechanical steps and leaves the rest to you.</p>
      <select className="card-select" value={sel} onChange={(e) => setSel(e.target.value)}>
        <option value="">— pick a card or leader ability —</option>
        <optgroup label="House Harkonnen cards">
          {HOUSE_HARKONNEN_CARDS.map((c) => (
            <option key={c.id} value={`card:${c.id}`}>
              {cardLabel(c)}
            </option>
          ))}
        </optgroup>
        <optgroup label="Corrino Ally cards">
          {CORRINO_ALLY_CARDS.map((c) => (
            <option key={c.id} value={`card:${c.id}`}>
              {cardLabel(c)}
            </option>
          ))}
        </optgroup>
        <optgroup label="Named-leader specials">
          {NAMED_LEADERS.map((l) => (
            <option key={l.name} value={`leader:${l.name}`}>
              {l.name}
            </option>
          ))}
        </optgroup>
      </select>
      {resolution && (
        <>
          <ol className="card-steps">
            {resolution.steps.map((st, i) => (
              <li key={i} className={st.auto ? 'auto' : 'manual'}>
                <span className="step-badge">{st.auto ? 'auto' : 'you'}</span>
                {st.text}
              </li>
            ))}
          </ol>
          {autoCount > 0 ? (
            <button className="confirm-btn" onClick={apply}>
              Apply {autoCount} auto step{autoCount === 1 ? '' : 's'}
            </button>
          ) : (
            <p className="manual-note">All steps are resolved by you on the board.</p>
          )}
        </>
      )}
    </section>
  );
}

const UNDO_LIMIT = 20;

function StormPanel({ s, onApply }: { s: GameState; onApply: (next: GameState) => void }) {
  const targets = useMemo(() => stormTargets(s), [s]);
  const [dice, setDice] = useState<Record<number, StormDice>>({});
  const get = (i: number) => dice[i] ?? { swords: 0, specials: 0 };
  const set = (i: number, patch: Partial<StormDice>) =>
    setDice((d) => ({ ...d, [i]: { ...get(i), ...patch } }));

  const apply = () => {
    const { state } = resolveCoriolisStorms(s, (t) => get(t.legionIndex));
    onApply(state);
    setDice({});
  };

  return (
    <section className="panel">
      <h2>Coriolis Storms</h2>
      {targets.length === 0 ? (
        <p className="hint">No Harkonnen legions are exposed to storms this phase.</p>
      ) : (
        <>
          <p className="hint">Roll 2 Combat dice per exposed legion and enter the results (swords + specials, max 2 total). Each sword = 1 hit; each special = the terrain value shown.</p>
          {targets.map((t) => {
            const d = get(t.legionIndex);
            const hits = stormHits(t.area, d);
            return (
              <div key={t.legionIndex} className="storm-row">
                <div className="storm-area">
                  <strong>{t.areaLabel}</strong>
                  <span className="hint">
                    {t.deep ? 'deep desert' : t.terrain} · special = {t.specialHitValue} hit{t.specialHitValue === 1 ? '' : 's'}
                  </span>
                </div>
                <label className="mini">
                  Swords
                  <input
                    type="number"
                    min={0}
                    max={2}
                    value={d.swords}
                    onChange={(e) => set(t.legionIndex, { swords: Math.max(0, Math.min(2, Number(e.target.value))) })}
                  />
                </label>
                <label className="mini">
                  Specials
                  <input
                    type="number"
                    min={0}
                    max={2}
                    value={d.specials}
                    onChange={(e) => set(t.legionIndex, { specials: Math.max(0, Math.min(2, Number(e.target.value))) })}
                  />
                </label>
                <span className={`storm-hits ${hits > 0 ? 'hot' : ''}`}>
                  {hits} hit{hits === 1 ? '' : 's'}
                </span>
              </div>
            );
          })}
          <button className="confirm-btn" onClick={apply}>
            Apply storm casualties
          </button>
        </>
      )}
    </section>
  );
}

export function App() {
  // Load the saved game on first render; fall back to the demo state.
  const [s, setS] = useState<GameState>(() => loadState() ?? sampleState());
  // Snapshots taken before each applied Harkonnen action, for Undo (bounded).
  const [past, setPast] = useState<GameState[]>([]);

  // Persist on every change.
  useEffect(() => {
    saveState(s);
  }, [s]);

  // Apply an AI action: snapshot the current state first so it can be undone.
  const commit = (next: GameState) => {
    setPast((p) => [...p.slice(-(UNDO_LIMIT - 1)), s]);
    setS(next);
  };
  const undo = () => {
    setPast((p) => {
      if (p.length === 0) return p;
      setS(p[p.length - 1]);
      return p.slice(0, -1);
    });
  };

  // Switching to a different game (import / load / reset) starts a fresh undo history.
  const loadGame = (next: GameState) => {
    setPast([]);
    setS(next);
  };
  const reset = () => {
    clearState();
    loadGame(sampleState());
  };
  const startNewGame = () => commit(newGameState()); // snapshot first so Undo can restore the old game

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
        <div className="header-row">
          <div>
            <h1>Dune: War for Arrakis</h1>
            <p className="subtitle">Mahdi solo companion — Harkonnen AI</p>
          </div>
          <button className="undo-btn" onClick={undo} disabled={past.length === 0} title="Undo the last applied Harkonnen action">
            ↶ Undo
          </button>
        </div>
      </header>
      <main>
        <HelpPanel />
        <RoundPanel s={s} onChange={commit} />
        <ResolvePanel s={s} onApply={commit} />
        <CardPanel s={s} onApply={commit} />
        <StormPanel s={s} onApply={commit} />
        <VehiclePanel s={s} />
        <StateEditor
          s={s}
          onChange={setS}
          onReset={reset}
          onNewGame={startNewGame}
          onExport={exportGame}
          onImport={loadGame}
        />
      </main>
      <footer>
        <small>State auto-saves to this browser. Use Undo to revert an applied action, or the editor's named saves to keep multiple games.</small>
      </footer>
    </div>
  );
}
