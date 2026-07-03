// Phase panels rendered inside the guide slot: vehicles (where to place), desert hazards
// (wormsigns + storms), and Spice Must Flow. Each keeps the "one next action" ethos — a short
// summary and a single spice CTA, engine-applied.

import { useEffect, useMemo, useState } from 'react';
import { AREAS } from '../engine/board';
import { wormsignPlacementAreas, wormsignsToDiscard, placeWormsigns } from '../engine/wormsigns';
import { stormTargets, stormHits, resolveCoriolisStorms, type StormDice } from '../engine/storms';
import { resolveSpiceHarvesting, totalHarvesterSpice, TOP_ROW, BOTTOM_ROW } from '../engine/spiceMustFlow';
import { SUPREMACY_WIN } from '../engine/round';
import type { ImperiumPower } from '../engine/state';
import { areaLabel } from '../ui/describeAction';
import { Icon } from './icons';
import type { Game } from './useGame';

export function VehiclesPanel({ game }: { game: Game }) {
  const { s } = game;
  const harvesters = s.vehicles.filter((v) => v.type === 'harvester');
  const zones = s.vehicles.filter((v) => v.type !== 'harvester');
  return (
    <div className="pp">
      {harvesters.length > 0 && (
        <div className="pp-row">
          <Icon name="harvester" size={16} />
          <span>{harvesters.map((v) => areaLabel(v.location)).join(' · ')}</span>
        </div>
      )}
      {zones.length > 0 && (
        <div className="pp-row">
          <Icon name="ornithopter" size={16} />
          <span>
            {zones.map((v) => `${v.type === 'ornithopter' ? 'orni' : 'carryall'} @ ${v.location}`).join(' · ')}
          </span>
        </div>
      )}
      {s.vehicles.length === 0 && <div className="pp-row">No vehicles this round.</div>}
    </div>
  );
}

export function HazardsPanel({ game }: { game: Game }) {
  const { s, commit } = game;
  const place = useMemo(() => wormsignPlacementAreas(s), [s]);
  const discard = useMemo(() => wormsignsToDiscard(s), [s]);
  const targets = useMemo(() => stormTargets(s), [s]);
  const [dice, setDice] = useState<Record<number, StormDice>>({});
  const [wormsDone, setWormsDone] = useState(false);
  useEffect(() => setWormsDone(false), [s.round]);
  const get = (i: number) => dice[i] ?? { swords: 0, specials: 0 };

  if (!wormsDone) {
    const nothing = place.length === 0 && discard.length === 0;
    return (
      <div className="pp">
        <div className="pp-row"><Icon name="wormsign" size={16} />
          <span>
            {discard.length > 0 && `Discard: ${discard.map(areaLabel).join(', ')}. `}
            {place.length > 0 && `Place: ${place.map(areaLabel).join(', ')}.`}
            {nothing && 'No wormsigns to discard or place.'}
          </span>
        </div>
        <button
          className="g-primary"
          onClick={() => {
            if (!nothing) commit(placeWormsigns(s).state, { headline: 'Wormsigns', text: `−${discard.length} / +${place.length}` });
            setWormsDone(true);
          }}
        >
          {nothing ? 'Continue to storms →' : 'Apply wormsigns →'}
        </button>
      </div>
    );
  }

  if (targets.length === 0) return <div className="pp"><div className="pp-row"><Icon name="storm" size={16} /><span>No Harkonnen legions are exposed to storms.</span></div></div>;

  return (
    <div className="pp">
      {targets.map((t) => {
        const d = get(t.legionIndex);
        const hits = stormHits(t.area, d);
        return (
          <div key={t.legionIndex} className="pp-storm">
            <span className="pp-storm-name">{areaLabel(t.area)} <em>({t.deep ? 'deep' : t.terrain}, ✴={t.specialHitValue})</em></span>
            {(['swords', 'specials'] as const).map((k) => (
              <label key={k} className="bs-count">
                {k}
                <span className="mini-stepper">
                  <button type="button" disabled={d[k] <= 0} onClick={() => setDice({ ...dice, [t.legionIndex]: { ...d, [k]: d[k] - 1 } })}>−</button>
                  <b>{d[k]}</b>
                  <button type="button" disabled={d[k] >= 2} onClick={() => setDice({ ...dice, [t.legionIndex]: { ...d, [k]: d[k] + 1 } })}>+</button>
                </span>
              </label>
            ))}
            <span className={`pp-hits${hits > 0 ? ' hot' : ''}`}>{hits} hit{hits === 1 ? '' : 's'}</span>
          </div>
        );
      })}
      <button
        className="g-primary"
        onClick={() => {
          const { state } = resolveCoriolisStorms(s, (t) => get(t.legionIndex));
          commit(state, { headline: 'Coriolis storms', text: `${targets.length} legion${targets.length === 1 ? '' : 's'} weathered the storm` });
          setDice({});
        }}
      >
        Apply storms
      </button>
    </div>
  );
}

const POWER_LABEL: Record<ImperiumPower, string> = { choam: 'CHOAM', spacing_guild: 'Guild', landsraad: 'Landsraad' };

export function SpicePanel({ game }: { game: Game }) {
  const { s, commit } = game;
  const harvesters = useMemo(
    () => s.vehicles.filter((v) => v.type === 'harvester').map((v) => ({ deep: !!AREAS[v.location]?.deep })),
    [s.vehicles],
  );
  const auto = useMemo(() => totalHarvesterSpice(harvesters), [harvesters]);
  const [collected, setCollected] = useState(auto);
  useEffect(() => setCollected(auto), [auto]);
  const outcome = useMemo(
    () => resolveSpiceHarvesting(s.spice.markers, collected, s.spice.spiceReserve),
    [s.spice.markers, s.spice.spiceReserve, collected],
  );

  return (
    <div className="pp">
      <div className="pp-row">
        <Icon name="spice" size={16} />
        <label className="bs-count pp-spice">
          Spice collected
          <span className="mini-stepper">
            <button type="button" disabled={collected <= 0} onClick={() => setCollected(collected - 1)}>−</button>
            <b>{collected}</b>
            <button type="button" onClick={() => setCollected(collected + 1)}>+</button>
          </span>
        </label>
        <span className="pp-markers">
          {(Object.keys(s.spice.markers) as ImperiumPower[]).map((p) => {
            const before = s.spice.markers[p];
            const after = outcome.markers[p];
            const dir = after < before ? '▲' : after > before ? '▼' : '·';
            return (
              <span key={p} className={`pp-marker${after >= BOTTOM_ROW ? ' ban' : ''}`}>
                {POWER_LABEL[p]} {before === TOP_ROW ? '≡' : before}{dir}{after}
              </span>
            );
          })}
        </span>
      </div>
      <button
        className="g-primary"
        onClick={() =>
          commit(
            {
              ...s,
              spice: { ...s.spice, markers: outcome.markers, spiceReserve: outcome.reserve, activeBans: outcome.activeBans },
              tracks: { ...s.tracks, supremacy: Math.min(SUPREMACY_WIN, s.tracks.supremacy + outcome.supremacyGained) },
            },
            {
              headline: 'The spice flowed',
              text: `Spent ${collected + s.spice.spiceReserve}; reserve ${outcome.reserve}${outcome.supremacyGained ? `; supremacy +${outcome.supremacyGained}` : ''}`,
            },
          )
        }
      >
        Apply harvest →
      </button>
    </div>
  );
}
