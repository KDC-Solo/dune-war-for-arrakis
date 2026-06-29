import { useEffect, useMemo, useRef, useState } from 'react';
import type { ActionResult, GameState, ImperiumPower, Legion, RoundPhase } from '../engine/state';
import { resolveAction } from '../engine/harkonnenActions';
import { applyHarkonnenAction, isAutoApplied } from '../engine/applyAction';
import {
  availability,
  resolveSpiceHarvesting,
  totalHarvesterSpice,
  TOP_ROW,
  BOTTOM_ROW,
} from '../engine/spiceMustFlow';
import { startNextRound, SUPREMACY_WIN, PHASE_ORDER, nextPhase } from '../engine/round';
import {
  beginBattle,
  battleRoundSetup,
  resolveBattleRound,
  type BattleContext,
  type BattleSession,
} from '../engine/combat';
import { resolveCombatRoll, type RawRoll } from '../engine/combatRoll';
import { commitBattle } from '../engine/battleApply';
import { combatDiceDiscardBanned } from '../engine/imperiumBans';
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
import { GamesPanel } from './GamesPanel';
import { BoardMap } from './BoardMap';
import { AREA_IDS, AREAS } from '../engine/board';
import { neighbors as boardNeighbors, airZonesOf } from '../engine/graph';
import { airZoneLabel } from '../engine/describeArea';
import {
  canPlaceWormsign,
  canPlaceSandworm,
  wormsignPlacementAreas,
  wormsignsToDiscard,
  placeWormsigns,
} from '../engine/wormsigns';
import type { PickTarget } from './pick';
import { LocateContext, AreaChip, AreaChips } from './locate';

const SORTED_AREA_IDS = [...AREA_IDS].sort((a, b) => areaLabel(a).localeCompare(areaLabel(b)));
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
        In <em>Games</em>, hit <em>New game</em> for a fresh starting position (or keep the demo to experiment).
        Then open <em>Edit game state</em> and match your table: imperium markers, every Harkonnen &amp;
        Atreides legion, sietch/settlement ranks, and the Harkonnen reserve. Back in <em>Games</em>, <em>Save</em> it under a name.
      </p>

      <h4>Each round, top to bottom</h4>
      <ul className="help-list">
        <li>
          <strong>Games</strong> — new game, export/import a backup, reset, and your named saves (load/delete).
        </li>
        <li>
          <strong>Board map</strong> — every area colored by terrain with your pieces overlaid. Tap/hover a dot for full
          details, or use <em>Find an area</em>. Pinch or use +/− to zoom (one-finger drag to pan) — handy on a phone.
          The 📍 button on a legion lets you set its area by tapping the map. Anywhere an area name shows a
          📍 pin, tap it to jump here and pulse that area — so you can always see where it is.
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
        <strong>Harvesters:</strong> <AreaChips ids={placement.harvesters} />
      </p>
      <p>
        <strong>Carryalls:</strong> {placement.carryalls.length ? placement.carryalls.map(airZoneLabel).join('; ') : 'none'}
      </p>
      <p>
        <strong>Ornithopters:</strong>{' '}
        {placement.ornithopters.length ? placement.ornithopters.map(airZoneLabel).join('; ') : 'none'}
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
  const airZones = airZonesOf(id).map((z) => airZoneLabel(z.id));

  return (
    <div className="area-card">
      <div className="area-card-title">{areaLabel(id)}</div>
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
      {airZones.length > 0 && <div className="area-card-adj"><b>Air zones:</b> {airZones.join('; ')}</div>}
    </div>
  );
}

function BoardMapPanel({
  s,
  onChange,
  pick,
  clearPick,
  locate,
  clearLocate,
  panelRef,
}: {
  s: GameState;
  onChange: (next: GameState) => void;
  pick: PickTarget | null;
  clearPick: () => void;
  locate: string | null;
  clearLocate: () => void;
  panelRef: React.RefObject<HTMLDetailsElement>;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  // When the editor requests a pick, open the map and scroll it into view.
  useEffect(() => {
    if (pick && panelRef.current) {
      panelRef.current.open = true;
      panelRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [pick, panelRef]);

  // When a locate chip is clicked, select that area, open the map, and scroll to it (the
  // highlight prop pulses it). Then clear the one-shot request.
  useEffect(() => {
    if (!locate) return;
    setPicked(locate);
    if (panelRef.current) {
      panelRef.current.open = true;
      panelRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    clearLocate();
  }, [locate, clearLocate, panelRef]);

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
    } else {
      pickArea = s.targetSietchId;
      pickWhat = 'the target sietch';
    }
  }

  // Wormsigns & sandworms have terrain + occupancy rules; valid targets stay clickable, others dim.
  const wormPick = pick?.kind === 'wormsign' || pick?.kind === 'sandworm';
  const selectable =
    pick?.kind === 'wormsign'
      ? (id: string) => canPlaceWormsign(s, id)
      : pick?.kind === 'sandworm'
        ? (id: string) => canPlaceSandworm(s, id)
        : undefined;

  const onMapSelect = (id: string) => {
    if (!pick) {
      setPicked(id);
      return;
    }
    if (selectable && !selectable(id)) return; // ignore invalid terrain
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
    clearPick();
  };

  const active = hovered ?? (pick ? pickArea : picked);

  return (
    <details className="panel" ref={panelRef}>
      <summary className="map-summary">Board map</summary>
      <p className="hint">Every area, colored by terrain, with your pieces overlaid. Hover or click a dot for full details; use <em>Find an area</em> to locate one. Any 📍 area name elsewhere in the app jumps here and pulses that area.</p>

      {pick && (
        <div className="map-pick-banner">
          Click an area to set <strong>{pickWhat}</strong>.
          {wormPick && ' Only valid Desert areas are highlighted; the rest are dimmed.'}
          <button className="die" onClick={clearPick}>Cancel</button>
        </div>
      )}

      <label className="map-pick">
        Find an area
        <select value={picked ?? ''} onChange={(e) => setPicked(e.target.value || null)}>
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
      </div>
    </details>
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
  start: 'Round setup: draw planning + prescience cards and the harvesting-sector & target-sietch tactical cards. "Start next round" does this for you.',
  vehicle_placement: 'Place the Harkonnen vehicles — see the Vehicle placement panel.',
  action_resolution: 'Alternate turns. Roll the Harkonnen action die and resolve it (Resolve Harkonnen turn), playing cards/leader abilities as they come up. Resolve any battles in the Battle panel.',
  desert_hazards: 'Place & resolve wormsigns, then roll Coriolis storms for exposed Harkonnen legions (Coriolis Storms panel).',
  spice_harvesting: 'Collect spice and advance the imperium markers in the Spice Must Flow panel.',
  end: 'Advance supremacy and reshuffle the tactical deck — use "Start next round" in This round.',
};

function PhasePanel({ s, onChange }: { s: GameState; onChange: (next: GameState) => void }) {
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

  const start = (pair: BattlePair) => {
    const sietch = s.sietches.find((si) => si.area === pair.area && !si.destroyed);
    const ctx: BattleContext = {
      attacker: pair.attacker,
      defender: pair.defender,
      defenderSettlementRank: sietch?.rank ?? undefined,
      surprise,
      reinforcements: s.decks.reinforcements,
      landsraadBan: combatDiceDiscardBanned(s.spice.activeBans),
    };
    setSession(beginBattle(ctx));
    setAtt(emptyRaw());
    setDef(emptyRaw());
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

      {!session && (
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

export function App() {
  // Load the saved game on first render; fall back to the demo state.
  const [s, setS] = useState<GameState>(() => loadState() ?? sampleState());
  // Snapshots taken before each applied Harkonnen action, for Undo (bounded).
  const [past, setPast] = useState<GameState[]>([]);
  // Active "click the map to set this area" request from the editor.
  const [pick, setPick] = useState<PickTarget | null>(null);
  // Active "show this area on the map" request from a locate chip.
  const [locate, setLocate] = useState<string | null>(null);
  const mapRef = useRef<HTMLDetailsElement>(null);

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
        <BoardMapPanel
          s={s}
          onChange={setS}
          pick={pick}
          clearPick={() => setPick(null)}
          locate={locate}
          clearLocate={() => setLocate(null)}
          panelRef={mapRef}
        />
        <StateEditor s={s} onChange={setS} onPick={setPick} pick={pick} />
        <RoundPanel s={s} onChange={commit} />
        <PhasePanel s={s} onChange={setS} />
        <VehiclePanel s={s} />
        <ResolvePanel s={s} onApply={commit} />
        <BattlePanel s={s} onApply={commit} />
        <CardPanel s={s} onApply={commit} />
        <WormsignPanel s={s} onApply={commit} />
        <StormPanel s={s} onApply={commit} />
        <SpicePanel s={s} onApply={commit} />
      </main>
      <footer>
        <small>State auto-saves to this browser. Use Undo to revert an applied action, or the editor's named saves to keep multiple games.</small>
      </footer>
    </div>
    </LocateContext.Provider>
  );
}
