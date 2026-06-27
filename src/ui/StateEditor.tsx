// Board-state editor: lets the player set the positions the Harkonnen AI needs (imperium markers,
// this round's draws, and the legions on the board). Edits flow up via `onChange`; the resolver
// and panels react to the updated state. Sietch/settlement ranks are fixed board data, so only
// their presence (legions) and the round/marker state are editable here for now.

import { AREA_IDS, type SectorId } from '../engine/board';
import { activeBans } from '../engine/spiceMustFlow';
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

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

function countLeaders(l: Legion): { generic: number; named: number } {
  return {
    generic: l.leaders.filter((x) => x.kind === 'generic').length,
    named: l.leaders.filter((x) => x.kind === 'named').length,
  };
}
function makeLeaders(faction: Faction, generic: number, named: number): Leader[] {
  const out: Leader[] = [];
  for (let i = 0; i < generic; i++) out.push({ kind: 'generic', faction });
  for (let i = 0; i < named; i++) out.push({ kind: 'named', faction, name: 'Named' });
  return out;
}

export function StateEditor({
  s,
  onChange,
  onReset,
}: {
  s: GameState;
  onChange: (next: GameState) => void;
  onReset: () => void;
}) {
  const setMarker = (power: 'choam' | 'spacing_guild' | 'landsraad', value: number) => {
    const markers = { ...s.spice.markers, [power]: clamp(value, 1, 5) };
    onChange({ ...s, spice: { ...s.spice, markers, activeBans: activeBans(markers) } });
  };

  const updateLegion = (i: number, next: Legion) =>
    onChange({ ...s, legions: s.legions.map((l, idx) => (idx === i ? next : l)) });
  const removeLegion = (i: number) =>
    onChange({ ...s, legions: s.legions.filter((_, idx) => idx !== i) });
  const addLegion = (faction: Faction) =>
    onChange({
      ...s,
      legions: [...s.legions, { ...emptyLegion(faction, 'carthag'), units: { regular: 1, elite: 0, special_elite: 0 } }],
    });

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

  // Wormsigns / sandworms: arrays of { area }. First unused area is a sensible default to add.
  const firstFreeArea = (taken: { area: string }[]) =>
    SORTED_AREAS.find((id) => !taken.some((t) => t.area === id)) ?? SORTED_AREAS[0];
  const addWormsign = () => onChange({ ...s, wormsigns: [...s.wormsigns, { area: firstFreeArea(s.wormsigns) }] });
  const setWormsign = (i: number, area: string) =>
    onChange({ ...s, wormsigns: s.wormsigns.map((w, idx) => (idx === i ? { area } : w)) });
  const removeWormsign = (i: number) => onChange({ ...s, wormsigns: s.wormsigns.filter((_, idx) => idx !== i) });
  const addSandworm = () => onChange({ ...s, sandworms: [...s.sandworms, { area: firstFreeArea(s.sandworms) }] });
  const setSandworm = (i: number, area: string) =>
    onChange({ ...s, sandworms: s.sandworms.map((w, idx) => (idx === i ? { area } : w)) });
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
        </label>
      </div>

      <h3>Imperium markers (step 1 = top … 5 = ban)</h3>
      <div className="ed-grid">
        {IMPERIUM.map(({ key, label }) => (
          <label key={key}>
            {label}
            <input
              type="number"
              min={1}
              max={5}
              value={s.spice.markers[key]}
              onChange={(e) => setMarker(key, Number(e.target.value))}
            />
          </label>
        ))}
      </div>
      <p className="hint">Active bans: {s.spice.activeBans.length ? s.spice.activeBans.join(', ') : 'none'}</p>

      <h3>Sietches</h3>
      <div className="feature-list">
        {s.sietches.map((si, i) => (
          <div key={si.area} className={`feature-row ${si.destroyed ? 'destroyed' : ''}`}>
            <span className="feature-name">{areaLabel(si.area)}</span>
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
              {areaLabel(st.area)} <span className="hint">(rank {st.rank})</span>
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
            <input type="number" min={0} max={16} value={r.units[key]} onChange={(e) => setReserveUnit(key, Number(e.target.value))} />
          </label>
        ))}
        <label>
          Deploy tokens
          <input
            type="number"
            min={0}
            max={12}
            value={r.deploymentTokens}
            onChange={(e) => onChange({ ...s, harkonnenReserve: { ...r, deploymentTokens: clamp(Number(e.target.value), 0, 12) } })}
          />
        </label>
        <label>
          Bashars
          <input
            type="number"
            min={0}
            max={6}
            value={r.bashars}
            onChange={(e) => onChange({ ...s, harkonnenReserve: { ...r, bashars: clamp(Number(e.target.value), 0, 6) } })}
          />
        </label>
        <label className="grow">
          Named leaders (comma-separated)
          <input
            type="text"
            value={r.namedLeaders.join(', ')}
            onChange={(e) =>
              onChange({
                ...s,
                harkonnenReserve: {
                  ...r,
                  namedLeaders: e.target.value
                    .split(',')
                    .map((n) => n.trim())
                    .filter(Boolean),
                },
              })
            }
          />
        </label>
      </div>

      <h3>Wormsigns &amp; sandworms</h3>
      <div className="ed-grid">
        <div className="worm-col">
          <span className="hint">Wormsigns (avoided by Harkonnen moves)</span>
          {s.wormsigns.map((w, i) => (
            <div key={i} className="worm-row">
              <select value={w.area} onChange={(e) => setWormsign(i, e.target.value)}>
                {SORTED_AREAS.map((id) => (
                  <option key={id} value={id}>
                    {areaLabel(id)}
                  </option>
                ))}
              </select>
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
              <select value={w.area} onChange={(e) => setSandworm(i, e.target.value)}>
                {SORTED_AREAS.map((id) => (
                  <option key={id} value={id}>
                    {areaLabel(id)}
                  </option>
                ))}
              </select>
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
              <select value={l.area} onChange={(e) => updateLegion(i, { ...l, area: e.target.value })}>
                {SORTED_AREAS.map((id) => (
                  <option key={id} value={id}>
                    {areaLabel(id)}
                  </option>
                ))}
              </select>
              {UNIT_TYPES.map(({ key, label }) => (
                <label key={key} className="mini">
                  {label}
                  <input
                    type="number"
                    min={0}
                    max={6}
                    value={l.units[key]}
                    onChange={(e) => updateLegion(i, { ...l, units: { ...l.units, [key]: clamp(Number(e.target.value), 0, 6) } })}
                  />
                </label>
              ))}
              <label className="mini">
                Gen
                <input
                  type="number"
                  min={0}
                  max={4}
                  value={lead.generic}
                  onChange={(e) => updateLegion(i, { ...l, leaders: makeLeaders(l.faction, clamp(Number(e.target.value), 0, 4), lead.named) })}
                />
              </label>
              <label className="mini">
                Named
                <input
                  type="number"
                  min={0}
                  max={4}
                  value={lead.named}
                  onChange={(e) => updateLegion(i, { ...l, leaders: makeLeaders(l.faction, lead.generic, clamp(Number(e.target.value), 0, 4)) })}
                />
              </label>
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
        <button
          className="reset"
          onClick={() => {
            if (confirm('Reset to the demo state and clear the saved game?')) onReset();
          }}
        >
          Reset
        </button>
      </div>
    </details>
  );
}
