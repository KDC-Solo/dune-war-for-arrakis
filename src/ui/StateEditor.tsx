// Board-state editor: lets the player set the positions the Harkonnen AI needs (imperium markers,
// this round's draws, and the legions on the board). Edits flow up via `onChange`; the resolver
// and panels react to the updated state. Sietch/settlement ranks are fixed board data, so only
// their presence (legions) and the round/marker state are editable here for now.

import { AREA_IDS, type SectorId } from '../engine/board';
import { activeBans } from '../engine/spiceMustFlow';
import { emptyLegion, type Faction, type GameState, type Leader, type Legion, type UnitType } from '../engine/state';
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
