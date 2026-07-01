// Board-state editor: lets the player set the positions the Harkonnen AI needs (imperium markers,
// this round's draws, and the legions on the board). Edits flow up via `onChange`; the resolver
// and panels react to the updated state. Sietch/settlement ranks are fixed board data, so only
// their presence (legions) and the round/marker state are editable here for now.

import { useState } from 'react';
import { AREA_IDS, type SectorId } from '../engine/board';
import { activeBans } from '../engine/spiceMustFlow';
import { deployFromReserve } from '../engine/applyAction';
import {
  emptyLegion,
  type Faction,
  type GameState,
  type Leader,
  type Legion,
  type SietchState,
  type SettlementState,
  type UnitType,
} from '../engine/state';
import { areaLabel } from './describeAction';
import { isDesertArea } from '../engine/describeArea';
import { canPlaceWormsign, canPlaceSandworm } from '../engine/wormsigns';
import { NAMED_LEADERS } from '../engine/leaders';
import type { PickTarget } from './pick';
import { samePick } from './pick';
import { AreaChip } from './locate';

const NAMED_LEADER_NAMES: readonly string[] = NAMED_LEADERS.map((l) => l.name);

/** Toggle chips for picking named Harkonnen leaders (unique, by name) — all visible at once. */
function LeaderPicker({
  selected,
  onChange,
}: {
  selected: readonly string[];
  onChange: (next: string[]) => void;
}) {
  const toggle = (name: string, on: boolean) =>
    onChange(on ? [...selected, name] : selected.filter((n) => n !== name));
  return (
    <div className="leader-chips">
      {NAMED_LEADER_NAMES.map((name) => {
        const on = selected.includes(name);
        return (
          <button
            type="button"
            key={name}
            className={on ? 'leader-chip on' : 'leader-chip'}
            aria-pressed={on}
            onClick={() => toggle(name, !on)}
          >
            {name}
          </button>
        );
      })}
    </div>
  );
}

const IMPERIUM: { key: 'choam' | 'spacing_guild' | 'landsraad'; label: string }[] = [
  { key: 'choam', label: 'CHOAM' },
  { key: 'spacing_guild', label: 'Spacing Guild' },
  { key: 'landsraad', label: 'Landsraad' },
];

const HARVEST_SECTORS: (SectorId | 'central')[] = ['central', 's1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'];
const UNIT_TYPES: { key: UnitType; label: string }[] = [
  { key: 'regular', label: 'Reg' },
  { key: 'elite', label: 'Elite' },
  { key: 'special_elite', label: 'S.Elite' },
];

const SORTED_AREAS = [...AREA_IDS].sort((a, b) => areaLabel(a).localeCompare(areaLabel(b)));
// Wormsigns & sandworms only go on Desert / Deep Desert areas.
const DESERT_AREAS = SORTED_AREAS.filter(isDesertArea);

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/**
 * Numeric field that keeps its display clean. Selecting on focus makes typing replace the value
 * (so you get "3", not "03"), the value is clamped to [min,max], and the shown text is
 * re-normalized on blur — React skips the DOM update when the parsed value is unchanged, which
 * would otherwise leave a stray leading zero behind.
 */
function NumInput({
  value,
  min,
  max,
  onChange,
  className,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  className?: string;
}) {
  return (
    <input
      type="number"
      className={className}
      min={min}
      max={max}
      value={value}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => onChange(clamp(Number(e.target.value), min, max))}
      onBlur={(e) => {
        e.currentTarget.value = String(value);
      }}
    />
  );
}

function countLeaders(l: Legion): { generic: number; named: number } {
  return {
    generic: l.leaders.filter((x) => x.kind === 'generic').length,
    named: l.leaders.filter((x) => x.kind === 'named').length,
  };
}
/** One-line summary of the Atreides legion defending a sietch (units, tokens, Naib/named leaders). */
function defenderSummary(l: Legion | undefined): string {
  if (!l) return 'no defenders';
  const parts: string[] = [];
  if (l.units.regular) parts.push(`${l.units.regular} reg`);
  if (l.units.elite) parts.push(`${l.units.elite} elite`);
  if (l.units.special_elite) parts.push(`${l.units.special_elite} Fedaykin`);
  if (l.deploymentTokens) parts.push(`${l.deploymentTokens} token${l.deploymentTokens === 1 ? '' : 's'}`);
  const naibs = l.leaders.filter((x) => x.kind === 'generic').length;
  if (naibs) parts.push(`${naibs} Naib${naibs === 1 ? '' : 's'}`);
  for (const ld of l.leaders) if (ld.kind === 'named' && ld.name && ld.name !== 'Named') parts.push(ld.name);
  return parts.length ? parts.join(', ') : 'present';
}
/** Named-leader names present on a legion (placeholder/blank names dropped). */
function namedLeaderNames(l: Legion): string[] {
  return l.leaders.filter((x) => x.kind === 'named' && x.name && x.name !== 'Named').map((x) => x.name as string);
}
function makeLeaders(faction: Faction, generic: number, named: number): Leader[] {
  const out: Leader[] = [];
  for (let i = 0; i < generic; i++) out.push({ kind: 'generic', faction });
  for (let i = 0; i < named; i++) out.push({ kind: 'named', faction, name: 'Named' });
  return out;
}
/** Build a legion's leaders from a generic count plus specific named-leader names. */
function makeNamedLeaders(faction: Faction, generic: number, names: readonly string[]): Leader[] {
  const out: Leader[] = [];
  for (let i = 0; i < generic; i++) out.push({ kind: 'generic', faction });
  for (const name of names) out.push({ kind: 'named', faction, name });
  return out;
}
/** Set the generic-leader count while preserving the legion's existing named leaders. */
function setGenericLeaders(l: Legion, generic: number): Leader[] {
  const named = l.leaders.filter((x) => x.kind === 'named');
  const gens: Leader[] = [];
  for (let i = 0; i < generic; i++) gens.push({ kind: 'generic', faction: l.faction });
  return [...gens, ...named];
}

/**
 * Move units + an optional leader from the Harkonnen reserve onto the board, drawing them down
 * from the pool so board and reserve totals stay in sync (instead of editing a legion's counts by
 * hand, which leaves the reserve untouched). Drops into a live Harkonnen settlement or any area
 * that already holds a Harkonnen legion, merging into it.
 */
function DeployForm({ s, onChange }: { s: GameState; onChange: (next: GameState) => void }) {
  const r = s.harkonnenReserve;
  const areaSet = new Set<string>();
  for (const st of s.settlements) if (!st.destroyed) areaSet.add(st.area);
  for (const l of s.legions) if (l.faction === 'harkonnen') areaSet.add(l.area);
  const areaList = [...areaSet].sort((a, b) => areaLabel(a).localeCompare(areaLabel(b)));
  const leaderOptions = [...(r.bashars > 0 ? ['Bashar'] : []), ...r.namedLeaders];

  const [area, setArea] = useState('');
  const [units, setUnits] = useState<Record<UnitType, number>>({ regular: 0, elite: 0, special_elite: 0 });
  const [leader, setLeader] = useState('');

  const dropArea = areaList.includes(area) ? area : areaList[0] ?? '';
  const total = units.regular + units.elite + units.special_elite + (leader ? 1 : 0);
  const canDeploy = !!dropArea && total > 0;

  const deploy = () => {
    if (!canDeploy) return;
    onChange(deployFromReserve(s, { settlement: dropArea, units, leader: leader || null }));
    setUnits({ regular: 0, elite: 0, special_elite: 0 });
    setLeader('');
  };

  return (
    <div className="deploy-form">
      <div className="ed-grid">
        <label>
          Into
          <select value={dropArea} onChange={(e) => setArea(e.target.value)}>
            {areaList.length === 0 && <option value="">— no Harkonnen area —</option>}
            {areaList.map((id) => (
              <option key={id} value={id}>
                {areaLabel(id)}
              </option>
            ))}
          </select>
        </label>
        {UNIT_TYPES.map(({ key, label }) => (
          <label key={key}>
            {label} <span className="hint">/ {r.units[key]}</span>
            <NumInput
              min={0}
              max={r.units[key]}
              value={units[key]}
              onChange={(n) => setUnits((u) => ({ ...u, [key]: n }))}
            />
          </label>
        ))}
        <label>
          Leader
          <select value={leader} onChange={(e) => setLeader(e.target.value)}>
            <option value="">— none —</option>
            {leaderOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <button className="add-mini" disabled={!canDeploy} onClick={deploy}>
        Deploy {total || ''} from reserve
      </button>
    </div>
  );
}

export function StateEditor({
  s,
  onChange,
  onPick,
  pick,
}: {
  s: GameState;
  onChange: (next: GameState) => void;
  /** Ask the board map to set this field's area by clicking. */
  onPick?: (target: PickTarget) => void;
  /** The pick target currently active (for button highlight). */
  pick?: PickTarget | null;
}) {
  // A 📍 button that asks the map to set `target`'s area; highlighted while that pick is active.
  const pickBtn = (target: PickTarget) =>
    onPick ? (
      <button
        type="button"
        className={`pick-map-btn${samePick(pick ?? null, target) ? ' active' : ''}`}
        title="Pick this area on the board map"
        onClick={() => onPick(target)}
      >
        📍
      </button>
    ) : null;
  // The primary area control: a labelled button showing the current area that opens the board map
  // to set it by tapping (much clearer than a dropdown of names for the many unnamed areas). Falls
  // back to a plain label if the map picker isn't wired up.
  const areaField = (area: string, target: PickTarget) =>
    onPick ? (
      <button
        type="button"
        className={`area-field${samePick(pick ?? null, target) ? ' active' : ''}`}
        title="Set this area on the board map"
        onClick={() => onPick(target)}
      >
        📍 {areaLabel(area)}
      </button>
    ) : (
      <span className="area-field static">{areaLabel(area)}</span>
    );
  const setMarker = (power: 'choam' | 'spacing_guild' | 'landsraad', value: number) => {
    const markers = { ...s.spice.markers, [power]: clamp(value, 1, 5) };
    onChange({ ...s, spice: { ...s.spice, markers, activeBans: activeBans(markers) } });
  };

  const updateLegion = (i: number, next: Legion) =>
    onChange({ ...s, legions: s.legions.map((l, idx) => (idx === i ? next : l)) });
  const removeLegion = (i: number) =>
    onChange({ ...s, legions: s.legions.filter((_, idx) => idx !== i) });
  const addLegion = (faction: Faction) => {
    onChange({
      ...s,
      legions: [...s.legions, { ...emptyLegion(faction, 'carthag'), units: { regular: 1, elite: 0, special_elite: 0 } }],
    });
    onPick?.({ kind: 'legion', index: s.legions.length }); // open the map to place the new legion
  };

  const updateSietch = (i: number, patch: Partial<SietchState>) => {
    const sietches = s.sietches.map((si, idx) => (idx === i ? { ...si, ...patch } : si));
    // A destroyed sietch can't be the target — drop it so the resolver doesn't aim at a dead one.
    const target = patch.destroyed && s.sietches[i].area === s.targetSietchId ? null : s.targetSietchId;
    onChange({ ...s, sietches, targetSietchId: target });
  };
  const updateSettlement = (i: number, patch: Partial<SettlementState>) =>
    onChange({ ...s, settlements: s.settlements.map((st, idx) => (idx === i ? { ...st, ...patch } : st)) });

  const r = s.harkonnenReserve;
  const setReserveUnit = (key: UnitType, value: number) =>
    onChange({ ...s, harkonnenReserve: { ...r, units: { ...r.units, [key]: clamp(value, 0, 16) } } });

  // Wormsigns / sandworms: arrays of { area }. Default a new one to the first rules-valid Desert area.
  const addWormsign = () => {
    onChange({ ...s, wormsigns: [...s.wormsigns, { area: DESERT_AREAS.find((id) => canPlaceWormsign(s, id)) ?? DESERT_AREAS[0] }] });
    onPick?.({ kind: 'wormsign', index: s.wormsigns.length }); // open the map to place the new one
  };
  const removeWormsign = (i: number) => onChange({ ...s, wormsigns: s.wormsigns.filter((_, idx) => idx !== i) });
  const addSandworm = () => {
    onChange({ ...s, sandworms: [...s.sandworms, { area: DESERT_AREAS.find((id) => canPlaceSandworm(s, id)) ?? DESERT_AREAS[0] }] });
    onPick?.({ kind: 'sandworm', index: s.sandworms.length }); // open the map to place the new one
  };
  const removeSandworm = (i: number) => onChange({ ...s, sandworms: s.sandworms.filter((_, idx) => idx !== i) });

  const liveSietches = s.sietches.filter((si) => !si.destroyed);

  return (
    <details className="panel editor">
      <summary>Edit game state</summary>

      <h3>This round</h3>
      <div className="ed-grid">
        <label>
          Harvesting sector
          <select
            value={s.harvestingSector ?? 'none'}
            onChange={(e) => onChange({ ...s, harvestingSector: e.target.value === 'none' ? null : (e.target.value as SectorId | 'central') })}
          >
            <option value="none">—</option>
            {HARVEST_SECTORS.map((sec) => (
              <option key={sec} value={sec}>
                {sec}
              </option>
            ))}
          </select>
        </label>
        <label>
          Target sietch
          <span className="pick-field">
            <select
              value={s.targetSietchId ?? 'none'}
              onChange={(e) => onChange({ ...s, targetSietchId: e.target.value === 'none' ? null : e.target.value })}
            >
              <option value="none">—</option>
              {liveSietches.map((si) => (
                <option key={si.area} value={si.area}>
                  {areaLabel(si.area)} (rank {si.rank ?? '?'})
                </option>
              ))}
            </select>
            {pickBtn({ kind: 'target' })}
          </span>
        </label>
      </div>

      <h3>Imperium markers (step 1 = top … 5 = ban)</h3>
      <div className="ed-grid">
        {IMPERIUM.map(({ key, label }) => (
          <label key={key}>
            {label}
            <NumInput min={1} max={5} value={s.spice.markers[key]} onChange={(n) => setMarker(key, n)} />
          </label>
        ))}
      </div>
      <p className="hint">Active bans: {s.spice.activeBans.length ? s.spice.activeBans.join(', ') : 'none'}</p>

      <h3>Sietches</h3>
      <div className="feature-list">
        {s.sietches.map((si, i) => (
          <div key={si.area} className={`feature-row ${si.destroyed ? 'destroyed' : ''}`}>
            <span className="feature-name">
              <AreaChip id={si.area} />
              <span className="feature-sub">🛡 {defenderSummary(s.legions.find((l) => l.faction === 'atreides' && l.area === si.area))}</span>
            </span>
            <label className="mini">
              Rank
              <select
                value={si.rank ?? 'hidden'}
                onChange={(e) =>
                  updateSietch(i, {
                    rank: e.target.value === 'hidden' ? null : (Number(e.target.value) as 1 | 2 | 3),
                    revealed: e.target.value !== 'hidden' ? true : si.revealed,
                  })
                }
              >
                <option value="hidden">?</option>
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
              </select>
            </label>
            <label className="mini check">
              <input
                type="checkbox"
                checked={si.revealed}
                onChange={(e) => updateSietch(i, { revealed: e.target.checked })}
              />
              Revealed
            </label>
            <label className="mini check">
              <input
                type="checkbox"
                checked={si.destroyed}
                onChange={(e) => updateSietch(i, { destroyed: e.target.checked })}
              />
              Destroyed
            </label>
          </div>
        ))}
      </div>

      <h3>Settlements</h3>
      <div className="feature-list">
        {s.settlements.map((st, i) => (
          <div key={st.area} className={`feature-row ${st.destroyed ? 'destroyed' : ''}`}>
            <span className="feature-name">
              <AreaChip id={st.area} /> <span className="hint">(rank {st.rank})</span>
            </span>
            <label className="mini check">
              <input
                type="checkbox"
                checked={st.destroyed}
                onChange={(e) => updateSettlement(i, { destroyed: e.target.checked })}
              />
              Destroyed
            </label>
          </div>
        ))}
      </div>

      <h3>Harkonnen reserve (off-board, available to deploy)</h3>
      <div className="ed-grid">
        {UNIT_TYPES.map(({ key, label }) => (
          <label key={key}>
            {label}
            <NumInput min={0} max={16} value={r.units[key]} onChange={(n) => setReserveUnit(key, n)} />
          </label>
        ))}
        <label>
          Deploy tokens
          <NumInput
            min={0}
            max={12}
            value={r.deploymentTokens}
            onChange={(n) => onChange({ ...s, harkonnenReserve: { ...r, deploymentTokens: n } })}
          />
        </label>
        <label>
          Bashars
          <NumInput
            min={0}
            max={6}
            value={r.bashars}
            onChange={(n) => onChange({ ...s, harkonnenReserve: { ...r, bashars: n } })}
          />
        </label>
      </div>
      <div className="reserve-leaders">
        <span className="reserve-leaders-label">Named leaders</span>
        <LeaderPicker
          selected={r.namedLeaders}
          onChange={(namedLeaders) => onChange({ ...s, harkonnenReserve: { ...r, namedLeaders } })}
        />
      </div>
      <div className="reserve-leaders">
        <span className="reserve-leaders-label">Regeneration tank <span className="hint">(killed named leaders)</span></span>
        <LeaderPicker
          selected={r.regenerationTank ?? []}
          onChange={(regenerationTank) => onChange({ ...s, harkonnenReserve: { ...r, regenerationTank } })}
        />
      </div>

      <h3>Deploy from reserve <span className="hint">(moves units onto the board, drawing down the pool)</span></h3>
      <DeployForm s={s} onChange={onChange} />

      <h3>Wormsigns &amp; sandworms</h3>
      <div className="ed-grid">
        <div className="worm-col">
          <span className="hint">Wormsigns (avoided by Harkonnen moves)</span>
          {s.wormsigns.map((w, i) => (
            <div key={i} className="worm-row">
              {areaField(w.area, { kind: 'wormsign', index: i })}
              <button className="remove" onClick={() => removeWormsign(i)} title="Remove wormsign">
                ✕
              </button>
            </div>
          ))}
          <button className="add-mini" onClick={addWormsign}>
            + wormsign
          </button>
        </div>
        <div className="worm-col">
          <span className="hint">Sandworms (block movement &amp; placement)</span>
          {s.sandworms.map((w, i) => (
            <div key={i} className="worm-row">
              {areaField(w.area, { kind: 'sandworm', index: i })}
              <button className="remove" onClick={() => removeSandworm(i)} title="Remove sandworm">
                ✕
              </button>
            </div>
          ))}
          <button className="add-mini" onClick={addSandworm}>
            + sandworm
          </button>
        </div>
      </div>

      <h3>Legions</h3>
      <div className="legion-list">
        {s.legions.map((l, i) => {
          const lead = countLeaders(l);
          return (
            <div key={i} className={`legion-row ${l.faction}`}>
              <span className="faction-tag">{l.faction === 'harkonnen' ? 'H' : 'A'}</span>
              {areaField(l.area, { kind: 'legion', index: i })}
              <div className="legion-units">
                {UNIT_TYPES.map(({ key, label }) => (
                  <label key={key} className="mini">
                    {label}
                    <NumInput
                      min={0}
                      max={6}
                      value={l.units[key]}
                      onChange={(n) => updateLegion(i, { ...l, units: { ...l.units, [key]: n } })}
                    />
                  </label>
                ))}
                <label className="mini">
                  Gen
                  <NumInput
                    min={0}
                    max={4}
                    value={lead.generic}
                    onChange={(n) => updateLegion(i, { ...l, leaders: setGenericLeaders(l, n) })}
                  />
                </label>
              </div>
              {l.faction === 'harkonnen' ? (
                <label className="mini grow">
                  Named
                  <LeaderPicker
                    selected={namedLeaderNames(l)}
                    onChange={(names) => updateLegion(i, { ...l, leaders: makeNamedLeaders(l.faction, lead.generic, names) })}
                  />
                </label>
              ) : (
                <label className="mini">
                  Named
                  <NumInput
                    min={0}
                    max={4}
                    value={lead.named}
                    onChange={(n) => updateLegion(i, { ...l, leaders: makeLeaders(l.faction, lead.generic, n) })}
                  />
                </label>
              )}
              <button className="remove" onClick={() => removeLegion(i)} title="Remove legion">
                ✕
              </button>
            </div>
          );
        })}
      </div>
      <div className="add-row">
        <button onClick={() => addLegion('harkonnen')}>+ Harkonnen legion</button>
        <button onClick={() => addLegion('atreides')}>+ Atreides legion</button>
      </div>
    </details>
  );
}
