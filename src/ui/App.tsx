import { useEffect, useMemo, useRef, useState } from 'react';
import type { ActionResult, GameState, ImperiumPower, Leader, Legion, RoundPhase } from '../engine/state';
import { resolveAction, type HarkonnenAction } from '../engine/harkonnenActions';
import { applyHarkonnenAction, isAutoApplied, moveLegionUnits, type MoveUnits } from '../engine/applyAction';
import { legalMoveDestinations } from '../engine/moveTargets';
import {
  availability,
  resolveSpiceHarvesting,
  totalHarvesterSpice,
  TOP_ROW,
  BOTTOM_ROW,
} from '../engine/spiceMustFlow';
import { setupRound, startNextRound, SUPREMACY_WIN, PHASE_ORDER, nextPhase } from '../engine/round';
import {
  beginBattle,
  battleRoundSetup,
  resolveBattleRound,
  type BattleContext,
  type BattleSession,
} from '../engine/combat';
import { resolveCombatRoll, type RawRoll } from '../engine/combatRoll';
import { commitBattle } from '../engine/battleApply';
import { revealDeploymentTokens } from '../engine/revealTokens';
import { combatDiceDiscardBanned } from '../engine/imperiumBans';
import { resolveCardPlay } from '../engine/cardEffects';
import { resolveLeaderSpecial } from '../engine/leaderEffects';
import { applyEffectSteps } from '../engine/effectSteps';
import { stormTargets, stormHits, resolveCoriolisStorms, type StormDice } from '../engine/storms';
import { HOUSE_HARKONNEN_CARDS, CORRINO_ALLY_CARDS } from '../engine/planningCards';
import { NAMED_LEADERS } from '../engine/leaders';
import { describeAction, actionHeadline, areaLabel, unitsPhrase, pathCrossesImpassable, IMPASSABLE_NOTE } from './describeAction';
import { sampleState } from './sampleState';
import { newGameState } from '../engine/newGame';
import { StateEditor } from './StateEditor';
import { GamesPanel } from './GamesPanel';
import { BoardMap } from './BoardMap';
import { AREA_IDS, AREAS } from '../engine/board';
import { neighbors as boardNeighbors, airZonesOf } from '../engine/graph';
import {
  canPlaceWormsign,
  canPlaceSandworm,
  wormsignPlacementAreas,
  wormsignsToDiscard,
  placeWormsigns,
} from '../engine/wormsigns';
import { isDesertArea } from '../engine/describeArea';
import type { PickTarget } from './pick';
import { samePick } from './pick';
import { LocateContext, AreaChip, AreaChips, AirZoneChip, AirZoneChips } from './locate';

const SORTED_AREA_IDS = [...AREA_IDS].sort((a, b) => areaLabel(a).localeCompare(areaLabel(b)));
const DESERT_AREA_IDS = SORTED_AREA_IDS.filter(isDesertArea);
import { loadState, saveState, clearState, exportState } from './persistence';

const DIE_RESULTS: ActionResult[] = ['leadership', 'strategy', 'mentat', 'deployment', 'house'];
const DIE_LABEL: Record<ActionResult, string> = {
  leadership: 'Leadership',
  strategy: 'Strategy',
  mentat: 'Mentat',
  deployment: 'Deployment',
  house: 'House',
};

// A description of an applied change, recorded in the action history (and paired 1:1 with the
// undo snapshot so Undo pops both). `result` is the Harkonnen die face, when the change came from
// resolving a turn.
export interface ActionLog {
  headline: string;
  text: string;
  note?: string;
  result?: ActionResult;
}

interface HistoryEntry extends ActionLog {
  id: number;
  round: number;
  time: number;
}

// A legion move whose destination is being chosen on the board map (started from the move panel).
interface PendingMove {
  from: string;
  faction: Legion['faction'];
  move: MoveUnits;
}

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
        In <em>Games</em>, hit <em>New game</em> for a fresh starting position (or keep the demo to experiment).
        Then open <em>Edit game state</em> and match your table: imperium markers, every Harkonnen &amp;
        Atreides legion, sietch/settlement ranks, and the Harkonnen reserve. Back in <em>Games</em>, <em>Save</em> it under a name.
      </p>

      <h4>Each round, top to bottom</h4>
      <p className="hint">
        The action panels below show only for the phase you're in (tracked in <em>Round walkthrough</em>) —
        tick <em>Show every phase's panel</em> there to see them all at once.
      </p>
      <ul className="help-list">
        <li>
          <strong>Games</strong> — new game, export/import a backup, reset, and your named saves (load/delete).
        </li>
        <li>
          <strong>Board map</strong> — open it anytime with the floating <strong>🗺</strong> button (bottom-right). Every
          area colored by terrain with your pieces overlaid; tap/hover a dot for details, or use <em>Find an area</em>.
          Pinch or use +/− to zoom (one-finger drag to pan). The 📍 button on any area field pops the map open to set
          that area by tapping — pick one and the map closes right back to where you were. Any 📍 area name elsewhere
          jumps here and pulses that area.
        </li>
        <li>
          <strong>This round</strong> — the Harkonnen's dice, vehicles, and active bans. <em>Start next round</em> when done.
        </li>
        <li>
          <strong>Round walkthrough</strong> — tracks which phase you're in and what to do; step through it as you play.
        </li>
        <li>
          <strong>Vehicle placement</strong> — where to drop the Harkonnen harvesters/carryalls/ornithopters.
        </li>
        <li>
          <strong>Resolve Harkonnen turn</strong> — roll the physical action die, tap the matching face; read the
          directive, then <em>Confirm &amp; apply</em> (mechanical actions) or resolve it on the board (attacks).
        </li>
        <li>
          <strong>Battle</strong> — pick an area where a Harkonnen and Atreides legion meet, enter each round's dice,
          and the app runs the Harkonnen cease/casualty rules, replenishes the reserve, and destroys a taken sietch.
        </li>
        <li>
          <strong>Resolve a card or leader ability</strong> — pick a Harkonnen planning card / leader special to see
          its steps. <span className="badge-inline auto">auto</span> steps the app applies;
          <span className="badge-inline you">you</span> steps you do.
        </li>
        <li>
          <strong>Wormsigns</strong> — the Desert Hazards step: discards wormsigns where an Atreides legion/sandworm
          appeared and places new ones in Desert areas with a Harkonnen legion or harvester. One tap to apply.
        </li>
        <li>
          <strong>Coriolis Storms</strong> — for each exposed legion, roll 2 combat dice, enter swords + specials,
          and apply the casualties.
        </li>
        <li>
          <strong>Spice Must Flow</strong> — enter the spice your harvesters collected; the app spends it the solo
          way (hold the markers, then raise spares) and updates the bans, reserve, and supremacy.
        </li>
      </ul>
      <p className="hint">Mis-tapped? <strong>↶ Undo</strong> (top right) reverts the last applied action.</p>
    </details>
  );
}

function RoundPanel({ s, onChange }: { s: GameState; onChange: (next: GameState) => void }) {
  const avail = availability(s.spice.markers);
  const won = s.tracks.supremacy >= SUPREMACY_WIN;
  // At the 'start' phase (a fresh game's round 1) the current round hasn't been set up yet — just
  // draw its tactical cards, without ending a round (no supremacy gain, no round increment).
  const needsSetup = s.phase === 'start';

  const beginRound = () => onChange(setupRound(s));
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
        <dd>{s.targetSietchId ? <AreaChip id={s.targetSietchId} /> : '—'}</dd>
        <dt>Harkonnen dice</dt>
        <dd>{avail.diceAvailable}</dd>
        <dt>Vehicles available</dt>
        <dd>
          {avail.harvesters} harvesters · {avail.ornithopters} ornithopters · {avail.carryalls} carryalls
        </dd>
        <dt>Active imperium bans</dt>
        <dd>{s.spice.activeBans.length ? s.spice.activeBans.join(', ') : 'none'}</dd>
      </dl>
      {needsSetup ? (
        <button className="confirm-btn" onClick={beginRound}>
          Begin round {s.round}
        </button>
      ) : (
        <button className="confirm-btn" onClick={nextRound} disabled={won}>
          Start next round
        </button>
      )}
    </section>
  );
}

function VehiclePanel({
  s,
  onChange,
  editable = false,
}: {
  s: GameState;
  onChange: (next: GameState) => void;
  /** Action phase: allow removing vehicles destroyed on the board. Vehicle-placement phase: read-only list. */
  editable?: boolean;
}) {
  const removeVehicle = (v: import('../engine/state').Vehicle) =>
    onChange({ ...s, vehicles: s.vehicles.filter((x) => x !== v) });

  const harvesters = s.vehicles.filter((v) => v.type === 'harvester');
  const carryalls = s.vehicles.filter((v) => v.type === 'carryall');
  const ornithopters = s.vehicles.filter((v) => v.type === 'ornithopter');

  const renderVehicle = (v: import('../engine/state').Vehicle, i: number) => (
    <span key={i} style={{ marginRight: '0.4em' }}>
      {v.type === 'harvester' ? <AreaChip id={v.location} /> : <AirZoneChip id={v.location} />}{' '}
      {editable && (
        <button className="remove" title={`Remove ${v.type}`} onClick={() => removeVehicle(v)}>✕</button>
      )}
    </span>
  );

  return (
    <section className="panel">
      <h2>{editable ? 'Vehicles on the board' : 'Vehicle placement'}</h2>
      <p className="hint">
        {editable
          ? 'Remove any vehicle destroyed by an Atreides legion or sandworm. New vehicles are placed by the House action and planning cards.'
          : 'Place the Harkonnen harvesters/carryalls/ornithopters as listed below.'}
      </p>
      {harvesters.length > 0 && <p><strong>Harvesters:</strong>{' '}{harvesters.map(renderVehicle)}</p>}
      {carryalls.length > 0 && <p><strong>Carryalls:</strong>{' '}{carryalls.map(renderVehicle)}</p>}
      {ornithopters.length > 0 && <p><strong>Ornithopters:</strong>{' '}{ornithopters.map(renderVehicle)}</p>}
      {s.vehicles.length === 0 && <p className="hint">No vehicles on the board.</p>}
    </section>
  );
}

const clampInt = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, Math.floor(Number.isFinite(n) ? n : lo)));

const leaderLabel = (ld: Leader) =>
  ld.kind === 'named' ? ld.name : ld.faction === 'harkonnen' ? 'Bashar' : 'Naib';

// One legion's move/split form: choose which figures to move (all by default); the destination is
// then picked on the board map (only legal move areas are selectable).
function MoveLegionRow({
  l,
  onPickDestination,
}: {
  l: Legion;
  onPickDestination: (move: MoveUnits) => void;
}) {
  const [open, setOpen] = useState(false);
  const [reg, setReg] = useState(l.units.regular);
  const [eli, setEli] = useState(l.units.elite);
  const [spe, setSpe] = useState(l.units.special_elite);
  const [tok, setTok] = useState(l.deploymentTokens);
  const [leaderSel, setLeaderSel] = useState<boolean[]>([]);

  // Open with everything selected (default: move the whole legion).
  const openForm = () => {
    setReg(l.units.regular);
    setEli(l.units.elite);
    setSpe(l.units.special_elite);
    setTok(l.deploymentTokens);
    setLeaderSel(l.leaders.map(() => true));
    setOpen(true);
  };

  const movedUnits = reg + eli + spe + tok;
  const movedLeaders = leaderSel.filter(Boolean).length;
  const leaderAlone = movedLeaders > 0 && movedUnits === 0; // leaders can't travel without a unit/token
  const canMove = movedUnits + movedLeaders > 0 && !leaderAlone;

  const pickDestination = () => {
    if (!canMove) return;
    onPickDestination({
      units: { regular: reg, elite: eli, special_elite: spe },
      deploymentTokens: tok,
      leaderIndices: leaderSel.map((on, i) => (on ? i : -1)).filter((i) => i >= 0),
    });
    setOpen(false);
  };

  const num = (
    label: string,
    value: number,
    max: number,
    set: (n: number) => void,
  ) =>
    max > 0 ? (
      <label>
        {label} <span className="hint">/ {max}</span>
        <input
          type="number"
          min={0}
          max={max}
          value={value}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => set(clampInt(Number(e.target.value), 0, max))}
        />
      </label>
    ) : null;

  return (
    <div className="feature-row move-row">
      <div className="move-row-head">
        <span className="feature-name">
          <span className={`faction-pill ${l.faction}`}>{l.faction === 'harkonnen' ? 'Harkonnen' : 'Atreides'}</span>{' '}
          <AreaChip id={l.area} />
          <span className="feature-sub">{legionSummary(l)}</span>
        </span>
        <button type="button" className="add-mini" onClick={open ? () => setOpen(false) : openForm}>
          {open ? 'Cancel' : 'Move / split'}
        </button>
      </div>
      {open && (
        <div className="deploy-form move-form">
          <div className="ed-grid">
            {num('Reg', reg, l.units.regular, setReg)}
            {num('Elite', eli, l.units.elite, setEli)}
            {num('S.Elite', spe, l.units.special_elite, setSpe)}
            {num('Tokens', tok, l.deploymentTokens, setTok)}
          </div>
          {l.leaders.length > 0 && (
            <div className="move-leaders">
              <span className="hint">Leaders:</span>{' '}
              {l.leaders.map((ld, i) => (
                <label key={i} className="mini check">
                  <input
                    type="checkbox"
                    checked={leaderSel[i] ?? false}
                    onChange={(e) => setLeaderSel((sel) => sel.map((v, j) => (j === i ? e.target.checked : v)))}
                  />
                  {leaderLabel(ld)}
                </label>
              ))}
            </div>
          )}
          {leaderAlone && <p className="apply-note">A leader can't move alone — include at least 1 unit or token.</p>}
          <button className="add-mini" disabled={!canMove} onClick={pickDestination}>
            📍 Pick destination on map ({movedUnits + movedLeaders} figure{movedUnits + movedLeaders === 1 ? '' : 's'})
          </button>
        </div>
      )}
    </div>
  );
}

// Move (and optionally split) any legion, for either faction. Splitting leaves the rest behind.
// The destination is chosen on the board map, restricted to legal move areas.
function MoveLegionPanel({
  s,
  onStartMapMove,
}: {
  s: GameState;
  onStartMapMove: (pm: PendingMove) => void;
}) {
  const legions = s.legions.filter(
    (l) => l.units.regular + l.units.elite + l.units.special_elite + l.deploymentTokens + l.leaders.length > 0,
  );

  return (
    <section className="panel">
      <h2>Move a legion</h2>
      <p className="hint">
        Choose which figures to move (all by default), then tap the destination on the board map — only legal
        moves are highlighted. Splitting leaves the rest behind. Harkonnen may cross impassable borders and
        troop-transport with an ornithopter; Atreides may sandride along wormsign/sandworm chains.
      </p>
      {legions.length === 0 ? (
        <p className="hint">No legions on the board.</p>
      ) : (
        <div className="feature-list">
          {legions.map((l) => (
            <MoveLegionRow
              key={`${l.faction}:${l.area}`}
              l={l}
              onPickDestination={(move) => onStartMapMove({ from: l.area, faction: l.faction, move })}
            />
          ))}
        </div>
      )}
    </section>
  );
}

// The directive rendered with area references as clickable chips (tap → open/find on the board map).
function DirectiveText({ a }: { a: HarkonnenAction }) {
  switch (a.kind) {
    case 'attack_sietch':
      return (
        <>
          Attack the sietch at <AreaChip id={a.sietch} /> with the Harkonnen legion in{' '}
          <AreaChip id={a.attacker} />
          {a.useOrnithopter ? ', using an ornithopter (troop-transport)' : ''}.
        </>
      );
    case 'attack_legion':
      return (
        <>
          Attack the Atreides legion in <AreaChip id={a.defender} /> with the Harkonnen legion in{' '}
          <AreaChip id={a.attacker} />.
        </>
      );
    case 'move':
      return (
        <>
          Move the Harkonnen legion from <AreaChip id={a.path[0]} /> to{' '}
          <AreaChip id={a.path[a.path.length - 1]} />.
          {pathCrossesImpassable(a.path) && (
            <em className="cross-impassable"> ({IMPASSABLE_NOTE})</em>
          )}
        </>
      );
    case 'deploy':
      return (
        <>
          Deploy
          {a.placements.map((p, i) => (
            <span key={i}>
              {i > 0 ? '; ' : ' '}
              {unitsPhrase(p.units)}
              {p.leader ? ` and ${p.leader}` : ''} in <AreaChip id={p.settlement} />
            </span>
          ))}
          .
        </>
      );
    case 'house_replace':
      return (
        <>
          House: replace {a.count} regular unit{a.count === 1 ? '' : 's'} with elite
          {a.count === 1 ? '' : 's'} in the legion at <AreaChip id={a.legion} />.
        </>
      );
    default:
      // mentat, house_place_vehicles, none — no area references to linkify
      return <>{describeAction(a)}</>;
  }
}

function ResolvePanel({ s, onApply }: { s: GameState; onApply: (next: GameState, log?: ActionLog) => void }) {
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
      onApply(res.state, {
        headline: actionHeadline(action),
        text: describeAction(action),
        note: res.note ?? undefined,
        result: result ?? undefined,
      });
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
          <p className="directive-text"><DirectiveText a={action} /></p>
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

function CardPanel({ s, onApply }: { s: GameState; onApply: (next: GameState, log?: ActionLog) => void }) {
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
    let headline = 'Card / leader';
    let text = sel;
    if (sel.startsWith('card:')) {
      const id = sel.slice(5);
      const card = [...HOUSE_HARKONNEN_CARDS, ...CORRINO_ALLY_CARDS].find((c) => c.id === id);
      headline = 'Play card';
      text = card ? cardLabel(card) : id;
    } else if (sel.startsWith('leader:')) {
      headline = 'Leader ability';
      text = sel.slice(7);
    }
    onApply(applyEffectSteps(s, resolution.steps), { headline, text });
    setSel(''); // resolved — clear for the next effect
  };

  return (
    <section className="panel">
      <h2>Resolve a card or leader ability</h2>
      <p className="hint">Pick a Harkonnen planning card or a named leader's special; the app applies the mechanical steps and leaves the rest to you.</p>
      <select className="card-select" value={sel} onChange={(e) => setSel(e.target.value)}>
        <option value="">— pick a card or leader ability —</option>
        <optgroup label="House Harkonnen cards">
          {HOUSE_HARKONNEN_CARDS.slice().sort((a, b) => cardLabel(a).localeCompare(cardLabel(b))).map((c) => (
            <option key={c.id} value={`card:${c.id}`}>
              {cardLabel(c)}
            </option>
          ))}
        </optgroup>
        <optgroup label="Corrino Ally cards">
          {CORRINO_ALLY_CARDS.slice().sort((a, b) => cardLabel(a).localeCompare(cardLabel(b))).map((c) => (
            <option key={c.id} value={`card:${c.id}`}>
              {cardLabel(c)}
            </option>
          ))}
        </optgroup>
        <optgroup label="Named-leader specials">
          {NAMED_LEADERS.slice().sort((a, b) => a.name.localeCompare(b.name)).map((l) => (
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
                {st.groundLocations && st.groundLocations.length > 0 && (
                  <> <AreaChips ids={st.groundLocations} /></>
                )}
                {st.airLocations && st.airLocations.length > 0 && (
                  <> <AirZoneChips ids={st.airLocations} /></>
                )}
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

function WormsignPanel({ s, onApply }: { s: GameState; onApply: (next: GameState) => void }) {
  const place = useMemo(() => wormsignPlacementAreas(s), [s]);
  const discard = useMemo(() => wormsignsToDiscard(s), [s]);
  const nothing = place.length === 0 && discard.length === 0;
  const apply = () => onApply(placeWormsigns(s).state);
  return (
    <section className="panel">
      <h2>Wormsigns</h2>
      <p className="hint">Desert Hazards: discard wormsigns where an Atreides legion or sandworm now sits, then place 1 in each Desert area holding a Harkonnen legion or harvester (no worm/sandworm already).</p>
      <dl className="kv">
        <dt>Token pool</dt>
        <dd>{s.decks.wormsignPool}</dd>
        <dt>Discard</dt>
        <dd><AreaChips ids={discard} /></dd>
        <dt>Place</dt>
        <dd><AreaChips ids={place} /></dd>
      </dl>
      <button className="confirm-btn" onClick={apply} disabled={nothing}>
        {nothing ? 'No wormsigns to place' : 'Place wormsigns'}
      </button>
    </section>
  );
}

// Desert Power (action phase): the Atreides may place wormsign tokens in desert areas. Exposed
// here so it doesn't require digging into the editor; adding one opens the map to pick its area.
function DesertPowerPanel({
  s,
  onChange,
  onPick,
  pick,
}: {
  s: GameState;
  onChange: (next: GameState) => void;
  onPick: (t: PickTarget) => void;
  pick: PickTarget | null;
}) {
  const addWormsign = () => {
    const area = DESERT_AREA_IDS.find((id) => canPlaceWormsign(s, id)) ?? DESERT_AREA_IDS[0];
    onChange({ ...s, wormsigns: [...s.wormsigns, { area }] });
    onPick({ kind: 'wormsign', index: s.wormsigns.length }); // pick the just-added one on the map
  };
  const removeWormsign = (i: number) =>
    onChange({ ...s, wormsigns: s.wormsigns.filter((_, idx) => idx !== i) });

  return (
    <section className="panel">
      <h2>Desert Power — wormsigns</h2>
      <p className="hint">
        When the Atreides take a Desert Power action (or a card / special calls for it), place wormsign
        tokens in desert areas. Add one, then tap the board to choose where it goes.
      </p>
      {s.wormsigns.length === 0 ? (
        <p className="hint">No wormsigns on the board.</p>
      ) : (
        <ul className="wormsign-list">
          {s.wormsigns.map((w, i) => (
            <li key={i} className="wormsign-item">
              <AreaChip id={w.area} />
              <button
                type="button"
                className={`pick-map-btn${samePick(pick, { kind: 'wormsign', index: i }) ? ' active' : ''}`}
                title="Set this wormsign's area on the board map"
                onClick={() => onPick({ kind: 'wormsign', index: i })}
              >
                📍
              </button>
              <button className="remove" onClick={() => removeWormsign(i)} title="Remove wormsign">
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      <button className="add-mini" onClick={addWormsign}>
        + Add wormsign (pick on map)
      </button>
    </section>
  );
}

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
                  <strong><AreaChip id={t.area} label={t.areaLabel} /></strong>
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

// ---------------------------------------------------------------------------
// Spice Must Flow: collect harvested spice and advance the imperium markers.
// ---------------------------------------------------------------------------

const POWER_LABEL: Record<ImperiumPower, string> = {
  choam: 'CHOAM',
  spacing_guild: 'Spacing Guild',
  landsraad: 'Landsraad',
};

/** ▲ = marker moved up (better), ▼ = dropped, · = held. Row 1 is the top (best). */
function markerArrow(from: number, to: number): string {
  if (to < from) return '▲';
  if (to > from) return '▼';
  return '·';
}

function SpicePanel({ s, onApply }: { s: GameState; onApply: (next: GameState) => void }) {
  // Default the collected spice from harvesters on the board (deep desert = 2, desert = 1);
  // the player can override it for harvesters lost to combat or worms.
  const harvesters = useMemo(
    () => s.vehicles.filter((v) => v.type === 'harvester').map((v) => ({ deep: !!AREAS[v.location]?.deep })),
    [s.vehicles],
  );
  const autoSpice = useMemo(() => totalHarvesterSpice(harvesters), [harvesters]);
  const [collected, setCollected] = useState(autoSpice);
  // Re-sync to the auto total when the board changes (e.g. a new round's harvesters).
  useEffect(() => setCollected(autoSpice), [autoSpice]);

  const outcome = useMemo(
    () => resolveSpiceHarvesting(s.spice.markers, collected, s.spice.spiceReserve),
    [s.spice.markers, s.spice.spiceReserve, collected],
  );
  const powers = Object.keys(s.spice.markers) as ImperiumPower[];

  const apply = () => {
    onApply({
      ...s,
      spice: {
        ...s.spice,
        markers: outcome.markers,
        spiceReserve: outcome.reserve,
        activeBans: outcome.activeBans,
      },
      tracks: {
        ...s.tracks,
        supremacy: Math.min(SUPREMACY_WIN, s.tracks.supremacy + outcome.supremacyGained),
      },
    });
  };

  return (
    <section className="panel">
      <h2>Spice Must Flow</h2>
      <p className="hint">
        Collect the surviving harvesters' spice, then spend it to hold the imperium markers in place
        (2 each, lowermost first) and raise any spare (3 each). The app picks the solo allocation for you.
      </p>
      <label className="mini smf-collected">
        Spice collected
        <input
          type="number"
          min={0}
          value={collected}
          onChange={(e) => setCollected(Math.max(0, Number(e.target.value)))}
        />
      </label>
      <p className="hint">
        {harvesters.length
          ? `Auto: ${autoSpice} from ${harvesters.length} placed harvester${harvesters.length === 1 ? '' : 's'} (${harvesters.filter((h) => h.deep).length} on deep desert). Adjust for any lost to combat or worms.`
          : 'No harvesters on the board — enter the spice your surviving harvesters collected.'}
        {s.spice.spiceReserve ? ` +${s.spice.spiceReserve} carried over = ${collected + s.spice.spiceReserve} to spend.` : ''}
      </p>

      <table className="smf-table">
        <thead>
          <tr>
            <th>Imperium power</th>
            <th>Row now</th>
            <th></th>
            <th>After</th>
          </tr>
        </thead>
        <tbody>
          {powers.map((p) => {
            const before = s.spice.markers[p];
            const after = outcome.markers[p];
            const arrow = markerArrow(before, after);
            return (
              <tr key={p} className={after >= BOTTOM_ROW ? 'smf-banned' : ''}>
                <td>{POWER_LABEL[p]}</td>
                <td>{before === TOP_ROW ? `${before} (top)` : before === BOTTOM_ROW ? `${before} (ban)` : before}</td>
                <td className={`smf-arrow ${arrow === '▲' ? 'up' : arrow === '▼' ? 'down' : ''}`}>{arrow}</td>
                <td>{after === TOP_ROW ? `${after} (top)` : after === BOTTOM_ROW ? `${after} (ban)` : after}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <dl className="kv">
        <dt>Reserve after</dt>
        <dd>{outcome.reserve} spice</dd>
        {outcome.supremacyGained > 0 && (
          <>
            <dt>Supremacy gained</dt>
            <dd>+{outcome.supremacyGained} (markers all at top)</dd>
          </>
        )}
        <dt>Active bans after</dt>
        <dd>{outcome.activeBans.length ? outcome.activeBans.map((p) => POWER_LABEL[p]).join(', ') : 'none'}</dd>
      </dl>

      <button className="confirm-btn" onClick={apply}>
        Apply harvesting
      </button>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Board map: a schematic reference of every area, overlaid with the game state.
// ---------------------------------------------------------------------------

const TERRAIN_WORD: Record<string, string> = {
  desert: 'Desert',
  minor_erg: 'Minor erg',
  plateau: 'Plateau',
  mountain: 'Mountain',
};

function legionLine(l: Legion): string {
  const parts: string[] = [];
  if (l.units.regular) parts.push(`${l.units.regular} regular`);
  if (l.units.elite) parts.push(`${l.units.elite} elite`);
  if (l.units.special_elite) parts.push(`${l.units.special_elite} ${l.faction === 'harkonnen' ? 'Sardaukar' : 'Fedaykin'}`);
  if (l.deploymentTokens) parts.push(`${l.deploymentTokens} token${l.deploymentTokens === 1 ? '' : 's'}`);
  for (const ld of l.leaders) parts.push(ld.kind === 'named' && ld.name ? ld.name : l.faction === 'harkonnen' ? 'Bashar' : 'Naib');
  return parts.length ? parts.join(', ') : 'present';
}

/** Rich details card for the hovered / selected area (replaces the clipping in-map tooltip). */
function AreaInfoCard({ id, s }: { id: string | null; s: GameState }) {
  if (!id) return <div className="area-card empty">Hover or click an area for details.</div>;
  const a = AREAS[id];
  if (!a) return <div className="area-card empty">{id}</div>;

  const terrain = a.deep ? 'Deep desert' : (a.terrain ? TERRAIN_WORD[a.terrain] : 'Unknown');
  const si = s.sietches.find((x) => x.area === id);
  const st = s.settlements.find((x) => x.area === id);
  const ts = s.testingStations.find((x) => x.area === id);
  const hk = s.legions.find((l) => l.area === id && l.faction === 'harkonnen');
  const at = s.legions.find((l) => l.area === id && l.faction === 'atreides');
  const hasWorm = s.wormsigns.some((w) => w.area === id);
  const hasSandworm = s.sandworms.some((w) => w.area === id);
  const neighbors = [...boardNeighbors(id)].sort((a, b) => areaLabel(a).localeCompare(areaLabel(b)));
  const airZones = airZonesOf(id).map((z) => z.id);

  return (
    <div className="area-card">
      <div className="area-card-title">
        {areaLabel(id)} <code className="area-card-id">{id}</code>
      </div>
      <div className="area-card-meta">
        {terrain} · sector {a.sector}
        {a.deep && ' · worm/spice'}
      </div>
      <div className="area-card-tags">
        {st && <span className={`atag st${st.destroyed ? ' gone' : ''}`}>Settlement rank {st.rank}{st.destroyed ? ' (destroyed)' : ''}</span>}
        {si && <span className={`atag si${si.destroyed ? ' gone' : ''}`}>Sietch{si.rank ? ` rank ${si.rank}` : ' (rank hidden)'}{si.destroyed ? ' (destroyed)' : si.revealed ? ' (revealed)' : ''}</span>}
        {id === s.targetSietchId && <span className="atag tgt">Target sietch</span>}
        {ts && <span className="atag">Testing station{ts.revealed ? ' (revealed)' : ''}</span>}
        {hasWorm && <span className="atag worm">Wormsign</span>}
        {hasSandworm && <span className="atag worm">Sandworm</span>}
      </div>
      {(hk || at) && (
        <div className="area-card-occ">
          {hk && <div><b className="occ-h">Harkonnen:</b> {legionLine(hk)}</div>}
          {at && <div><b className="occ-a">Atreides:</b> {legionLine(at)}</div>}
        </div>
      )}
      <div className="area-card-adj"><b>Adjacent:</b> <AreaChips ids={neighbors} /></div>
      {airZones.length > 0 && <div className="area-card-adj"><b>Air zones:</b> <AirZoneChips ids={airZones} sep="; " /></div>}
    </div>
  );
}

/** A short confirmation for the toast after a pick is assigned to an area. */
function describePicked(p: PickTarget, id: string): string {
  const label = areaLabel(id);
  switch (p.kind) {
    case 'legion':
      return `Legion set to ${label}`;
    case 'wormsign':
      return `Wormsign ${p.index + 1} placed at ${label}`;
    case 'sandworm':
      return `Sandworm ${p.index + 1} placed at ${label}`;
    case 'target':
      return `Target sietch set to ${label}`;
    case 'move':
      return `Moved to ${label}`;
  }
}

// The board map lives in a floating overlay (opened by the 🗺 button or whenever an area pick
// starts) rather than an inline panel, so picking never scrolls you away from your place: choose
// an area and the overlay closes, leaving you exactly where you were with a confirmation toast.
function BoardMapPanel({
  s,
  onChange,
  onMove,
  pendingMove,
  clearPendingMove,
  pick,
  clearPick,
  locate,
  clearLocate,
  open,
  onOpen,
  onClose,
  onConfirm,
}: {
  s: GameState;
  onChange: (next: GameState) => void;
  onMove: (next: GameState, log: ActionLog) => void;
  pendingMove: PendingMove | null;
  clearPendingMove: () => void;
  pick: PickTarget | null;
  clearPick: () => void;
  locate: string | null;
  clearLocate: () => void;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onConfirm: (msg: string) => void;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  // One-shot request to zoom/pan the map onto an area (nonce re-fires identical locates).
  const [focus, setFocus] = useState<{ id: string; nonce: number } | null>(null);

  // Legal destinations for a pending move (empty set otherwise) — highlighted on the map.
  const moveLegion =
    pick?.kind === 'move' && pendingMove
      ? s.legions.find((l) => l.faction === pendingMove.faction && l.area === pendingMove.from)
      : undefined;
  const moveDestinations = moveLegion ? legalMoveDestinations(s, moveLegion) : new Set<string>();

  // Select an area (or air zone), pulse it, and centre the map on it. Air zones aren't areas, so
  // they don't drive the area selection/info card — only the map focus.
  const focusArea = (id: string | null) => {
    if (!id || AREAS[id]) setPicked(id);
    if (id) setFocus({ id, nonce: Date.now() });
  };

  // The area currently held by the pick target (to highlight while picking), and a description.
  let pickArea: string | null = null;
  let pickWhat = '';
  if (pick) {
    if (pick.kind === 'legion') {
      const l = s.legions[pick.index];
      pickArea = l?.area ?? null;
      pickWhat = l ? `the ${l.faction === 'harkonnen' ? 'Harkonnen' : 'Atreides'} legion now at ${areaLabel(l.area)}` : 'this legion';
    } else if (pick.kind === 'wormsign') {
      pickArea = s.wormsigns[pick.index]?.area ?? null;
      pickWhat = `wormsign ${pick.index + 1}`;
    } else if (pick.kind === 'sandworm') {
      pickArea = s.sandworms[pick.index]?.area ?? null;
      pickWhat = `sandworm ${pick.index + 1}`;
    } else if (pick.kind === 'move') {
      pickArea = pendingMove?.from ?? null;
      pickWhat = pendingMove
        ? `the move destination for the ${pendingMove.faction === 'harkonnen' ? 'Harkonnen' : 'Atreides'} legion at ${areaLabel(pendingMove.from)}`
        : 'the move destination';
    } else {
      pickArea = s.targetSietchId;
      pickWhat = 'the target sietch';
    }
  }

  // A pick starts → open the overlay and centre it on the target's current area.
  useEffect(() => {
    if (!pick) return;
    onOpen();
    if (pickArea) setFocus({ id: pickArea, nonce: Date.now() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pick]);

  // A locate chip is clicked → open the overlay, select + pulse that area, then clear the request.
  useEffect(() => {
    if (!locate) return;
    focusArea(locate);
    onOpen();
    clearLocate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locate]);

  // While open: lock background scroll and let Escape close the overlay (cancelling any pick).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeOverlay();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pick]);

  // Closing the overlay also cancels an in-progress pick (nothing gets assigned).
  const closeOverlay = () => {
    if (pick) clearPick();
    if (pendingMove) clearPendingMove();
    onClose();
  };

  // Some picks restrict which areas are valid: wormsigns/sandworms by terrain + occupancy, the
  // target sietch must be a live sietch, and a move must be a legal destination. Rest dim.
  const wormPick = pick?.kind === 'wormsign' || pick?.kind === 'sandworm';
  const selectable =
    pick?.kind === 'wormsign'
      ? (id: string) => canPlaceWormsign(s, id)
      : pick?.kind === 'sandworm'
        ? (id: string) => canPlaceSandworm(s, id)
        : pick?.kind === 'target'
          ? (id: string) => s.sietches.some((si) => si.area === id && !si.destroyed)
          : pick?.kind === 'move'
            ? (id: string) => moveDestinations.has(id)
            : undefined;
  // Hint shown in the pick banner describing what's selectable.
  const pickHint = wormPick
    ? ' Only valid Desert areas are highlighted; the rest are dimmed.'
    : pick?.kind === 'target'
      ? ' Only sietches (not destroyed) are selectable; the rest are dimmed.'
      : pick?.kind === 'move'
        ? moveDestinations.size > 0
          ? ' Only legal move destinations are highlighted (ground, troop-transport, or sandriding); the rest are dimmed.'
          : ' This legion has no legal move — close to cancel.'
        : '';

  const onMapSelect = (id: string) => {
    if (!pick) {
      setPicked(id);
      return; // browsing: just show the info card, keep the overlay open
    }
    if (selectable && !selectable(id)) return; // ignore invalid terrain
    if (pick.kind === 'move') {
      if (pendingMove && moveLegion) {
        const label = `${pendingMove.faction === 'harkonnen' ? 'Harkonnen' : 'Atreides'} ${areaLabel(pendingMove.from)} → ${areaLabel(id)}`;
        onMove(moveLegionUnits(s, pendingMove.faction, pendingMove.from, id, pendingMove.move), {
          headline: 'Move (manual)',
          text: label,
        });
        onConfirm(`Moved: ${label}`);
      }
      clearPendingMove();
      clearPick();
      onClose();
      return;
    }
    if (pick.kind === 'legion') {
      onChange({ ...s, legions: s.legions.map((l, i) => (i === pick.index ? { ...l, area: id } : l)) });
    } else if (pick.kind === 'wormsign') {
      onChange({ ...s, wormsigns: s.wormsigns.map((w, i) => (i === pick.index ? { ...w, area: id } : w)) });
    } else if (pick.kind === 'sandworm') {
      onChange({ ...s, sandworms: s.sandworms.map((w, i) => (i === pick.index ? { ...w, area: id } : w)) });
    } else {
      onChange({ ...s, targetSietchId: id });
    }
    setPicked(id);
    onConfirm(describePicked(pick, id));
    clearPick();
    onClose(); // pick done → dismiss the overlay, returning to where the player was
  };

  const active = hovered ?? (pick ? pickArea : picked);

  return (
    <>
      {!open && (
        <button className="map-fab" title="Open board map" aria-label="Open board map" onClick={onOpen}>
          🗺
        </button>
      )}
      {open && (
        <div className="map-modal-overlay" onClick={closeOverlay}>
          <div className="map-modal panel" role="dialog" aria-label="Board map" onClick={(e) => e.stopPropagation()}>
            <div className="map-modal-head">
              <h2>Board map</h2>
              <button className="map-close" onClick={closeOverlay} title="Close map" aria-label="Close map">
                ✕
              </button>
            </div>
            <p className="hint">Every area, colored by terrain, with your pieces overlaid. Hover or click a dot for full details; use <em>Find an area</em> to locate one.</p>

            {pick && (
              <div className="map-pick-banner">
                Click an area to set <strong>{pickWhat}</strong>.
                {pickHint}
                <button className="die" onClick={closeOverlay}>Cancel</button>
              </div>
            )}

            <label className="map-pick">
              Find an area
              <select value={picked ?? ''} onChange={(e) => focusArea(e.target.value || null)}>
                <option value="">— select —</option>
                {SORTED_AREA_IDS.map((id) => (
                  <option key={id} value={id}>
                    {areaLabel(id)}
                  </option>
                ))}
              </select>
            </label>

            <BoardMap
              state={s}
              highlight={pick ? pickArea : picked}
              focus={focus}
              onSelect={onMapSelect}
              onHover={setHovered}
              picking={!!pick}
              selectable={selectable}
            />

            <AreaInfoCard id={active} s={s} />

            <div className="map-legend">
              <span><i className="lg-h" /> Harkonnen</span>
              <span><i className="lg-a" /> Atreides</span>
              <span><i className="lg-si" /> Sietch</span>
              <span><i className="lg-st" /> Settlement</span>
              <span><i className="lg-tgt" /> Target sietch</span>
              <span><i className="lg-az" /> Air zone</span>
              <span><i className="lg-imp" /> Impassable</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Round walkthrough: a phase tracker that explains the current step.
// ---------------------------------------------------------------------------

const PHASE_LABEL: Record<RoundPhase, string> = {
  start: 'Setup',
  vehicle_placement: 'Vehicles',
  action_resolution: 'Actions',
  desert_hazards: 'Hazards',
  spice_harvesting: 'Spice',
  end: 'End',
};

const PHASE_GUIDE: Record<RoundPhase, string> = {
  start: 'Round setup: draw planning + prescience cards and the harvesting-sector & target-sietch tactical cards. "Begin round" in This round draws the tactical cards for you (no supremacy gain — that comes at the end of the round).',
  vehicle_placement: 'Place the Harkonnen vehicles — see the Vehicle placement panel.',
  action_resolution: 'Alternate turns. Roll the Harkonnen action die and resolve it (Resolve Harkonnen turn), playing cards/leader abilities as they come up. Resolve any battles in the Battle panel.',
  desert_hazards: 'Place & resolve wormsigns, then roll Coriolis storms for exposed Harkonnen legions (Coriolis Storms panel).',
  spice_harvesting: 'Collect spice and advance the imperium markers in the Spice Must Flow panel.',
  end: 'Advance supremacy and reshuffle the tactical deck — use "Start next round" in This round.',
};

function PhasePanel({
  s,
  onChange,
  showAll,
  onToggleShowAll,
}: {
  s: GameState;
  onChange: (next: GameState) => void;
  showAll: boolean;
  onToggleShowAll: (next: boolean) => void;
}) {
  const phase = s.phase;
  const i = PHASE_ORDER.indexOf(phase);
  const prev = i > 0 ? PHASE_ORDER[i - 1] : null;
  const next = nextPhase(phase);

  return (
    <section className="panel">
      <h2>Round walkthrough</h2>
      <p className="hint">Where you are in the round. Advance as you finish each phase.</p>
      <ol className="phase-steps">
        {PHASE_ORDER.map((p) => (
          <li key={p} className={p === phase ? 'phase-step current' : 'phase-step'}>
            {PHASE_LABEL[p]}
          </li>
        ))}
      </ol>
      <p className="directive-text">{PHASE_GUIDE[phase]}</p>
      <div className="phase-nav">
        <button className="die" disabled={!prev} onClick={() => prev && onChange({ ...s, phase: prev })}>
          ← {prev ? PHASE_LABEL[prev] : 'Back'}
        </button>
        <button className="confirm-btn" disabled={!next} onClick={() => next && onChange({ ...s, phase: next })}>
          {next ? `Next: ${PHASE_LABEL[next]} →` : 'Round complete'}
        </button>
      </div>
      <label className="check phase-showall">
        <input type="checkbox" checked={showAll} onChange={(e) => onToggleShowAll(e.target.checked)} />
        Show every phase's panel (otherwise only the current phase's are shown)
      </label>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Battle: resolve a Harkonnen attack round by round, then commit it to the state.
// ---------------------------------------------------------------------------

const emptyRaw = (): RawRoll => ({ hits: 0, shields: 0, specials: 0 });

interface BattlePair {
  area: string;
  attacker: Legion;
  defender: Legion;
}

/** Compact one-line legion summary: units, deployment tokens, and leaders. */
function legionSummary(l: Legion): string {
  const parts: string[] = [];
  if (l.units.regular) parts.push(`${l.units.regular} reg`);
  if (l.units.elite) parts.push(`${l.units.elite} elite`);
  if (l.units.special_elite) parts.push(`${l.units.special_elite} special`);
  if (l.deploymentTokens) parts.push(`${l.deploymentTokens} token${l.deploymentTokens === 1 ? '' : 's'}`);
  if (l.leaders.length) parts.push(`${l.leaders.length} leader${l.leaders.length === 1 ? '' : 's'}`);
  return parts.length ? parts.join(', ') : 'empty';
}

const OUTCOME_LABEL: Record<Exclude<BattleSession['status'], 'ongoing'>, string> = {
  attacker_won: 'Harkonnen win — defender eliminated.',
  defender_survived: 'Harkonnen cease the attack — defender survives.',
  attacker_eliminated: 'Harkonnen attackers wiped out.',
};

function BattlePanel({ s, onApply }: { s: GameState; onApply: (next: GameState) => void }) {
  const pairs = useMemo<BattlePair[]>(() => {
    const out: BattlePair[] = [];
    for (const atk of s.legions) {
      if (atk.faction !== 'harkonnen') continue;
      const def = s.legions.find((l) => l.faction === 'atreides' && l.area === atk.area);
      if (def) out.push({ area: atk.area, attacker: atk, defender: def });
    }
    return out;
  }, [s.legions]);

  const [surprise, setSurprise] = useState(false);
  const [session, setSession] = useState<BattleSession | null>(null);
  const [att, setAtt] = useState<RawRoll>(emptyRaw);
  const [def, setDef] = useState<RawRoll>(emptyRaw);
  // Pending token reveal: a battle whose legions still have facedown deployment tokens. The
  // rulebook flips them to units before the first round; the player reads the units off the
  // physical tokens, so we collect the revealed composition here first.
  const [reveal, setReveal] = useState<{
    pair: BattlePair;
    atk: Legion['units'];
    def: Legion['units'];
  } | null>(null);

  const beginWith = (attacker: Legion, defender: Legion, area: string) => {
    const sietch = s.sietches.find((si) => si.area === area && !si.destroyed);
    const ctx: BattleContext = {
      attacker,
      defender,
      defenderSettlementRank: sietch?.rank ?? undefined,
      surprise,
      reinforcements: s.decks.reinforcements,
      landsraadBan: combatDiceDiscardBanned(s.spice.activeBans),
    };
    setSession(beginBattle(ctx));
    setAtt(emptyRaw());
    setDef(emptyRaw());
  };

  const start = (pair: BattlePair) => {
    if (pair.attacker.deploymentTokens > 0 || pair.defender.deploymentTokens > 0) {
      setReveal({
        pair,
        atk: { regular: pair.attacker.deploymentTokens, elite: 0, special_elite: 0 },
        def: { regular: pair.defender.deploymentTokens, elite: 0, special_elite: 0 },
      });
      return;
    }
    beginWith(pair.attacker, pair.defender, pair.area);
  };

  // Commit the reveal (tokens → units, Harkonnen markers back to the pool) as its own game step,
  // then open the battle on the now token-free legions.
  const confirmReveal = () => {
    if (!reveal) return;
    const { pair, atk, def: defUnits } = reveal;
    let next = s;
    if (pair.attacker.deploymentTokens > 0) next = revealDeploymentTokens(next, pair.area, 'harkonnen', atk);
    if (pair.defender.deploymentTokens > 0) next = revealDeploymentTokens(next, pair.area, 'atreides', defUnits);
    onApply(next);
    const attacker = next.legions.find((l) => l.faction === 'harkonnen' && l.area === pair.area)!;
    const defender = next.legions.find((l) => l.faction === 'atreides' && l.area === pair.area)!;
    setReveal(null);
    beginWith(attacker, defender, pair.area);
  };

  const applyRound = () => {
    if (!session) return;
    const aRoll = resolveCombatRoll(att, session.attacker.leaders, session.defender.units.special_elite);
    const dRoll = resolveCombatRoll(def, session.defender.leaders, session.attacker.units.special_elite);
    setSession(resolveBattleRound(session, { attacker: aRoll, defender: dRoll }));
    setAtt(emptyRaw());
    setDef(emptyRaw());
  };

  const commit = () => {
    if (!session) return;
    const { state } = commitBattle(s, session);
    onApply(state);
    setSession(null);
  };

  const unitInputs = (label: string, u: Legion['units'], setU: (u: Legion['units']) => void) => (
    <div className="storm-row">
      <div className="storm-area">
        <strong>{label}</strong>
      </div>
      {(['regular', 'elite', 'special_elite'] as const).map((k) => (
        <label key={k} className="mini">
          {k === 'regular' ? 'Regular' : k === 'elite' ? 'Elite' : 'Sardaukar'}
          <input
            type="number"
            min={0}
            value={u[k]}
            onChange={(e) => setU({ ...u, [k]: Math.max(0, Number(e.target.value)) })}
          />
        </label>
      ))}
    </div>
  );

  const rawInputs = (label: string, raw: RawRoll, setRaw: (r: RawRoll) => void) => (
    <div className="storm-row">
      <div className="storm-area">
        <strong>{label}</strong>
      </div>
      {(['hits', 'shields', 'specials'] as const).map((k) => (
        <label key={k} className="mini">
          {k === 'hits' ? 'Swords' : k === 'shields' ? 'Shields' : 'Specials'}
          <input
            type="number"
            min={0}
            value={raw[k]}
            onChange={(e) => setRaw({ ...raw, [k]: Math.max(0, Number(e.target.value)) })}
          />
        </label>
      ))}
    </div>
  );

  return (
    <section className="panel">
      <h2>Battle</h2>
      <p className="hint">Resolve a Harkonnen attack on an Atreides legion sharing an area. Enter each round's physical dice; the Harkonnen casualties, reserve, and any destroyed sietch are applied for you.</p>

      {reveal && (
        <>
          <p className="directive-text">
            Flip the facedown deployment tokens at <strong><AreaChip id={reveal.pair.area} /></strong> and enter the units they reveal — they fight (and can be lost) as those units this battle.
          </p>
          {reveal.pair.attacker.deploymentTokens > 0 &&
            unitInputs(`Harkonnen ${reveal.pair.attacker.deploymentTokens} token${reveal.pair.attacker.deploymentTokens === 1 ? '' : 's'} reveal`, reveal.atk, (u) => setReveal({ ...reveal, atk: u }))}
          {reveal.pair.defender.deploymentTokens > 0 &&
            unitInputs(`Atreides ${reveal.pair.defender.deploymentTokens} token${reveal.pair.defender.deploymentTokens === 1 ? '' : 's'} reveal`, reveal.def, (u) => setReveal({ ...reveal, def: u }))}
          <div className="directive-actions">
            <button className="confirm-btn" onClick={confirmReveal}>Reveal &amp; begin battle</button>
            <button className="die" onClick={() => setReveal(null)}>Cancel</button>
          </div>
        </>
      )}

      {!session && !reveal && (
        pairs.length === 0 ? (
          <p className="hint">No area has a Harkonnen and an Atreides legion together. Move a Harkonnen legion onto a defender first.</p>
        ) : (
          <>
            <label className="check">
              <input type="checkbox" checked={surprise} onChange={(e) => setSurprise(e.target.checked)} />
              First-round surprise attack (+1 Harkonnen die)
            </label>
            <ul className="legion-list">
              {pairs.map((p) => (
                <li key={p.area} className="legion-row">
                  <span>
                    <strong><AreaChip id={p.area} /></strong> — Harkonnen ({legionSummary(p.attacker)}) vs Atreides ({legionSummary(p.defender)})
                  </span>
                  <button className="confirm-btn" onClick={() => start(p)}>
                    Fight
                  </button>
                </li>
              ))}
            </ul>
          </>
        )
      )}

      {session && (
        <>
          <dl className="kv">
            <dt>Area</dt>
            <dd><AreaChip id={session.ctx.defender.area} /></dd>
            <dt>Round</dt>
            <dd>{session.rounds + (session.status === 'ongoing' ? 1 : 0)}</dd>
            <dt>Harkonnen</dt>
            <dd>{legionSummary(session.attacker)}</dd>
            <dt>Atreides</dt>
            <dd>{legionSummary(session.defender)}</dd>
            <dt>Reinforcements left</dt>
            <dd>{session.reinforcements}</dd>
          </dl>

          {session.status === 'ongoing' ? (
            <>
              {(() => {
                const setup = battleRoundSetup(session);
                return (
                  <p className="directive-text">
                    Roll <strong>{setup.attackerDice}</strong> Harkonnen dice{setup.discards > 0 ? ` (incl. ${setup.discards} reinforcement discard${setup.discards === 1 ? '' : 's'})` : ''}
                    {setup.surprise ? ' +surprise' : ''} and <strong>{setup.defenderDice}</strong> Atreides dice, then enter the results:
                  </p>
                );
              })()}
              {rawInputs('Harkonnen roll', att, setAtt)}
              {rawInputs('Atreides roll', def, setDef)}
              <p className="hint">Specials are converted by leaders / cancelled by enemy Sardaukar &amp; Fedaykin automatically. Atreides casualties default to the cheapest figures — adjust in the editor if you removed others.</p>
              <div className="directive-actions">
                <button className="confirm-btn" onClick={applyRound}>Apply round</button>
                <button className="die" onClick={() => setSession(null)}>Cancel</button>
              </div>
            </>
          ) : (
            <>
              <div className="win-banner">{OUTCOME_LABEL[session.status]}</div>
              <div className="directive-actions">
                <button className="confirm-btn" onClick={commit}>Apply to game state</button>
                <button className="die" onClick={() => setSession(null)}>Discard</button>
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}

// Floating action-history overlay (mirrors the board-map FAB). Lists every applied change,
// newest first, and offers Undo of the most recent one.
function HistoryPanel({
  history,
  open,
  onOpen,
  onClose,
  onUndo,
  canUndo,
}: {
  history: HistoryEntry[];
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onUndo: () => void;
  canUndo: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  const entries = [...history].reverse(); // newest first

  return (
    <>
      {!open && (
        <button className="history-fab" title="Action history" aria-label="Action history" onClick={onOpen}>
          📜
          {history.length > 0 && <span className="history-fab-count">{history.length}</span>}
        </button>
      )}
      {open && (
        <div className="map-modal-overlay" onClick={onClose}>
          <div className="map-modal panel" role="dialog" aria-label="Action history" onClick={(e) => e.stopPropagation()}>
            <div className="map-modal-head">
              <h2>Action history</h2>
              <button className="map-close" onClick={onClose} title="Close" aria-label="Close">✕</button>
            </div>
            <p className="hint">Every applied action, newest first — useful for reviewing the Harkonnen's automatic moves. Undo reverts the most recent one.</p>
            <div className="history-actions">
              <button className="confirm-btn" onClick={onUndo} disabled={!canUndo}>↶ Undo last action</button>
            </div>
            {entries.length === 0 ? (
              <p className="hint">No actions applied yet.</p>
            ) : (
              <ol className="history-list">
                {entries.map((e, i) => (
                  <li key={e.id} className={`history-item${i === 0 ? ' latest' : ''}`}>
                    <div className="history-item-head">
                      <span className="history-round">R{e.round}</span>
                      {e.result && <span className="history-die">{DIE_LABEL[e.result]}</span>}
                      <strong>{e.headline}</strong>
                      <span className="history-time">{new Date(e.time).toLocaleTimeString()}</span>
                    </div>
                    {e.text && <div className="history-text">{e.text}</div>}
                    {e.note && <div className="history-note">{e.note}</div>}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export function App() {
  // Load the saved game on first render; fall back to the demo state.
  const [s, setS] = useState<GameState>(() => loadState() ?? sampleState());
  // Snapshots taken before each applied Harkonnen action, for Undo (bounded).
  const [past, setPast] = useState<GameState[]>([]);
  // Action history (parallel to `past`): a log of every applied change, newest last. Undo pops both.
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const nextLogId = useRef(1);
  // Whether the floating action-history overlay is open.
  const [historyOpen, setHistoryOpen] = useState(false);
  // Active "click the map to set this area" request from the editor.
  const [pick, setPick] = useState<PickTarget | null>(null);
  // Active "show this area on the map" request from a locate chip.
  const [locate, setLocate] = useState<string | null>(null);
  // A legion move awaiting a destination pick on the board map.
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
  // Whether the floating board-map overlay is open.
  const [mapOpen, setMapOpen] = useState(false);
  // Transient confirmation toast (e.g. after placing a wormsign via the map).
  const [toast, setToast] = useState<string | null>(null);
  // Show only the current phase's action panels, or all of them (escape hatch).
  const [showAllPanels, setShowAllPanels] = useState(false);
  const inPhase = (...phases: RoundPhase[]) => showAllPanels || phases.includes(s.phase);

  // Persist on every change.
  useEffect(() => {
    saveState(s);
  }, [s]);

  // Auto-dismiss the confirmation toast.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  // Apply an AI action: snapshot the current state first so it can be undone, and log it to the
  // action history (kept 1:1 with the undo stack). `log` describes the change for the history panel.
  const commit = (next: GameState, log?: ActionLog) => {
    setPast((p) => [...p.slice(-(UNDO_LIMIT - 1)), s]);
    setHistory((h) => [
      ...h.slice(-(UNDO_LIMIT - 1)),
      {
        id: nextLogId.current++,
        round: s.round,
        time: Date.now(),
        headline: log?.headline ?? 'Board update',
        text: log?.text ?? '',
        note: log?.note,
        result: log?.result,
      },
    ]);
    setS(next);
  };
  const undo = () => {
    setPast((p) => {
      if (p.length === 0) return p;
      setS(p[p.length - 1]);
      return p.slice(0, -1);
    });
    setHistory((h) => h.slice(0, -1));
  };

  // Switching to a different game (import / load / reset) starts a fresh undo history.
  const loadGame = (next: GameState) => {
    setPast([]);
    setHistory([]);
    setS(next);
  };
  const reset = () => {
    clearState();
    loadGame(sampleState());
  };
  const startNewGame = () => commit(newGameState(), { headline: 'New game', text: 'Started a fresh game.' });

  // Begin choosing a move's destination on the board map (the pick opens the overlay).
  const startMapMove = (pm: PendingMove) => {
    setPendingMove(pm);
    setPick({ kind: 'move' });
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
    <LocateContext.Provider value={setLocate}>
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
        <GamesPanel s={s} onReset={reset} onNewGame={startNewGame} onExport={exportGame} onImport={loadGame} />
        <StateEditor s={s} onChange={setS} onPick={setPick} pick={pick} />
        <RoundPanel s={s} onChange={commit} />
        <PhasePanel s={s} onChange={setS} showAll={showAllPanels} onToggleShowAll={setShowAllPanels} />
        {inPhase('vehicle_placement') && <VehiclePanel s={s} onChange={commit} editable={false} />}
        {inPhase('action_resolution') && <ResolvePanel s={s} onApply={commit} />}
        {inPhase('action_resolution') && <VehiclePanel s={s} onChange={commit} editable={true} />}
        {inPhase('action_resolution') && <MoveLegionPanel s={s} onStartMapMove={startMapMove} />}
        {inPhase('action_resolution') && <BattlePanel s={s} onApply={commit} />}
        {inPhase('action_resolution') && <CardPanel s={s} onApply={commit} />}
        {inPhase('action_resolution') && <DesertPowerPanel s={s} onChange={setS} onPick={setPick} pick={pick} />}
        {inPhase('desert_hazards') && <WormsignPanel s={s} onApply={commit} />}
        {inPhase('desert_hazards') && <StormPanel s={s} onApply={commit} />}
        {inPhase('spice_harvesting') && <SpicePanel s={s} onApply={commit} />}
      </main>
      <footer>
        <small>State auto-saves to this browser. Use Undo to revert an applied action, or the editor's named saves to keep multiple games.</small>
      </footer>

      <BoardMapPanel
        s={s}
        onChange={setS}
        onMove={commit}
        pendingMove={pendingMove}
        clearPendingMove={() => setPendingMove(null)}
        pick={pick}
        clearPick={() => setPick(null)}
        locate={locate}
        clearLocate={() => setLocate(null)}
        open={mapOpen}
        onOpen={() => setMapOpen(true)}
        onClose={() => setMapOpen(false)}
        onConfirm={setToast}
      />
      <HistoryPanel
        history={history}
        open={historyOpen}
        onOpen={() => setHistoryOpen(true)}
        onClose={() => setHistoryOpen(false)}
        onUndo={undo}
        canUndo={past.length > 0}
      />
      {toast && <div className="toast" role="status">✓ {toast}</div>}
    </div>
    </LocateContext.Provider>
  );
}
