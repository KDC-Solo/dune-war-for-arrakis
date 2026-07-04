// Area sheet — tap any area on the stage: what's there, quick edits, and contextual actions
// (move a legion with rule-filtered destinations; worm tokens on desert). The board stays the
// interface: actions that need a "where" hand back to the stage with glowing legal targets.

import { useState } from 'react';
import type { GameState, Legion, UnitType } from '../engine/state';
import { emptyLegion, unitCount } from '../engine/state';
import { AREAS } from '../engine/board';
import { canPlaceSandworm, canPlaceWormsign } from '../engine/wormsigns';
import { harkonnenNeighbors } from '../engine/movement';
import { areaLabel } from '../ui/describeAction';
import { Icon } from './icons';
import type { Game } from './useGame';

export interface MovePick {
  from: string;
  faction: Legion['faction'];
  move: { units: Record<UnitType, number>; deploymentTokens: number; leaderIndices: number[] };
}

const UNIT_ROWS: { key: UnitType | 'deploymentTokens' | 'generic'; label: (f: Legion['faction']) => string }[] = [
  { key: 'regular', label: () => 'Regulars' },
  { key: 'elite', label: () => 'Elites' },
  { key: 'special_elite', label: (f) => (f === 'harkonnen' ? 'Sardaukar' : 'Fedaykin') },
  { key: 'deploymentTokens', label: () => 'Tokens' },
  { key: 'generic', label: (f) => (f === 'harkonnen' ? 'Bashars' : 'Naibs') },
];

function Step({ value, onChange, max = 16, label }: { value: number; onChange: (n: number) => void; max?: number; label: string }) {
  return (
    <span className="mini-stepper as-step" role="group" aria-label={label}>
      <button type="button" aria-label={`${label} −1`} disabled={value <= 0} onClick={() => onChange(value - 1)}>−</button>
      <b>{value}</b>
      <button type="button" aria-label={`${label} +1`} disabled={value >= max} onClick={() => onChange(value + 1)}>+</button>
    </span>
  );
}

function upsert(s: GameState, faction: Legion['faction'], area: string, patch: (l: Legion) => Legion): GameState {
  const existing = s.legions.find((l) => l.faction === faction && l.area === area);
  const base = existing ?? emptyLegion(faction, area);
  const next = patch(base);
  const empty = unitCount(next) + next.leaders.length === 0;
  let legions = s.legions.filter((l) => l !== existing);
  if (!empty) legions = [...legions, next];
  return { ...s, legions };
}

export function AreaSheet({
  game,
  area,
  onClose,
  onStartMove,
  onBattleHere,
}: {
  game: Game;
  area: string;
  onClose: () => void;
  onStartMove: (pick: MovePick) => void;
  /** Start a battle: attacker's area (adjacent, or here for legacy states) vs this area. */
  onBattleHere: (attackerArea: string, defenderArea: string) => void;
}) {
  const { s, commit, edit } = game;
  const [editing, setEditing] = useState<Legion['faction'] | null>(null);
  const a = AREAS[area];
  const legions = s.legions.filter((l) => l.area === area);
  const hk = legions.find((l) => l.faction === 'harkonnen');
  const at = legions.find((l) => l.faction === 'atreides');
  const sietch = s.sietches.find((x) => x.area === area);
  const settlement = s.settlements.find((x) => x.area === area);
  const station = s.testingStations.find((x) => x.area === area);
  const worm = s.wormsigns.findIndex((w) => w.area === area);
  const sand = s.sandworms.findIndex((w) => w.area === area);
  const desert = a?.terrain === 'desert' || a?.terrain === 'minor_erg';

  const counts = (l: Legion) => ({
    regular: l.units.regular,
    elite: l.units.elite,
    special_elite: l.units.special_elite,
    deploymentTokens: l.deploymentTokens,
    generic: l.leaders.filter((x) => x.kind === 'generic').length,
  });

  const setCount = (faction: Legion['faction'], key: string, n: number) => {
    edit(
      upsert(s, faction, area, (l) => {
        if (key === 'deploymentTokens') return { ...l, deploymentTokens: n };
        if (key === 'generic') {
          const named = l.leaders.filter((x) => x.kind === 'named');
          const gens = Array.from({ length: n }, () => ({ kind: 'generic' as const, faction }));
          return { ...l, leaders: [...gens, ...named] };
        }
        return { ...l, units: { ...l.units, [key]: n } };
      }),
      `Edited ${areaLabel(area)}`,
    );
  };

  const legionRow = (l: Legion) => {
    const total = unitCount(l) + l.leaders.length;
    const named = l.leaders.filter((x) => x.kind === 'named' && x.name && x.name !== 'Named');
    return (
      <div key={l.faction} className={`as-legion ${l.faction}`}>
        <div className="as-legion-head">
          <Icon name="trooper" size={18} />
          <strong>{l.faction === 'harkonnen' ? 'Harkonnen' : 'Atreides'}</strong>
          <span className="as-sub">
            {l.units.regular > 0 && `${l.units.regular} reg `}
            {l.units.elite > 0 && `${l.units.elite} elite `}
            {l.units.special_elite > 0 && `${l.units.special_elite} ${l.faction === 'harkonnen' ? 'Sardaukar' : 'Fedaykin'} `}
            {l.deploymentTokens > 0 && `${l.deploymentTokens} tok `}
            {l.leaders.length > 0 && `${l.leaders.length} ldr`}
          </span>
          <div className="as-actions">
            <button
              type="button"
              className="as-btn"
              onClick={() =>
                onStartMove({
                  from: area,
                  faction: l.faction,
                  move: {
                    units: { ...l.units },
                    deploymentTokens: l.deploymentTokens,
                    leaderIndices: l.leaders.map((_, i) => i),
                  },
                })
              }
              disabled={total === 0}
            >
              <Icon name="deployment" size={15} /> Move
            </button>
            <button type="button" className="as-btn" onClick={() => setEditing(editing === l.faction ? null : l.faction)}>
              ✎ Edit
            </button>
          </div>
        </div>
        {named.length > 0 && <div className="as-named">{named.map((x) => x.name).join(' · ')}</div>}
        {editing === l.faction && (
          <div className="as-edit">
            {UNIT_ROWS.map((r) => (
              <label key={r.key}>
                {r.label(l.faction)}
                <Step
                  label={r.label(l.faction)}
                  value={counts(l)[r.key as keyof ReturnType<typeof counts>]}
                  onChange={(n) => setCount(l.faction, r.key, n)}
                />
              </label>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="sheet-veil" onClick={onClose}>
      <section className="sheet area-sheet" role="dialog" aria-label={areaLabel(area)} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        <h2>
          <Icon name={sietch ? 'sietch' : settlement ? 'settlement' : desert ? 'spice' : 'map'} size={18} />
          {areaLabel(area)}
          <span className="as-terrain">{a?.deep ? 'deep desert' : a?.terrain?.replace('_', ' ')}</span>
        </h2>

        <div className="as-badges">
          {sietch && (
            <span className="ap-tag atreides">
              <Icon name="sietch" size={13} /> Sietch {sietch.destroyed ? '· destroyed' : sietch.revealed ? `· rank ${sietch.rank}` : '· rank ?'}
            </span>
          )}
          {settlement && (
            <span className="ap-tag harkonnen">
              <Icon name="settlement" size={13} /> Settlement {settlement.destroyed ? '· destroyed' : `· rank ${settlement.rank}`}
            </span>
          )}
          {s.targetSietchId === area && <span className="ap-tag target"><Icon name="objective" size={13} /> Target sietch</span>}
          {station && <span className="ap-tag target"><Icon name="prescience" size={13} /> Station{station.revealed ? ' · taken' : ''}</span>}
          {worm >= 0 && <span className="ap-tag target"><Icon name="wormsign" size={13} /> Wormsign</span>}
          {sand >= 0 && <span className="ap-tag target"><Icon name="sandworm" size={13} /> Sandworm</span>}
          {s.vehicles.filter((v) => v.location === area && v.type === 'harvester').length > 0 && (
            <span className="ap-tag harkonnen"><Icon name="harvester" size={13} /> Harvester</span>
          )}
        </div>

        {legions.length === 0 ? <p className="sheet-hint">No legions here.</p> : legions.map(legionRow)}
        {at && (() => {
          // Battles come from adjacent Harkonnen legions (solo adjacency ignores impassable);
          // a co-located attacker (legacy states) fights in place.
          const nbrs = new Set(harkonnenNeighbors(area));
          const attackers = s.legions.filter(
            (l) => l.faction === 'harkonnen' && unitCount(l) > 0 && (l.area === area || nbrs.has(l.area)),
          );
          return attackers.map((l) => (
            <button key={l.area} type="button" className="g-primary as-battle" onClick={() => onBattleHere(l.area, area)}>
              ⚔ Battle — Harkonnen attack from {l.area === area ? 'here' : areaLabel(l.area)}
            </button>
          ));
        })()}

        <div className="as-tools">
          {!hk && (
            <button type="button" className="as-btn" onClick={() => setEditing('harkonnen')}>
              + Harkonnen legion
            </button>
          )}
          {!at && (
            <button type="button" className="as-btn" onClick={() => setEditing('atreides')}>
              + Atreides legion
            </button>
          )}
          {desert && worm < 0 && canPlaceWormsign(s, area) && (
            <button
              type="button"
              className="as-btn"
              onClick={() => commit({ ...s, wormsigns: [...s.wormsigns, { area }] }, { headline: 'Wormsign placed', text: areaLabel(area) })}
            >
              <Icon name="wormsign" size={15} /> Wormsign
            </button>
          )}
          {worm >= 0 && (
            <button
              type="button"
              className="as-btn"
              onClick={() => commit({ ...s, wormsigns: s.wormsigns.filter((_, i) => i !== worm) }, { headline: 'Wormsign removed', text: areaLabel(area) })}
            >
              − Wormsign
            </button>
          )}
          {desert && sand < 0 && canPlaceSandworm(s, area) && (
            <button
              type="button"
              className="as-btn"
              onClick={() => commit({ ...s, sandworms: [...s.sandworms, { area }] }, { headline: 'Sandworm placed', text: areaLabel(area) })}
            >
              <Icon name="sandworm" size={15} /> Sandworm
            </button>
          )}
          {sand >= 0 && (
            <button
              type="button"
              className="as-btn"
              onClick={() => commit({ ...s, sandworms: s.sandworms.filter((_, i) => i !== sand) }, { headline: 'Sandworm removed', text: areaLabel(area) })}
            >
              − Sandworm
            </button>
          )}
        </div>

        {(editing === 'harkonnen' && !hk) || (editing === 'atreides' && !at) ? (
          <div className="as-edit">
            {UNIT_ROWS.map((r) => (
              <label key={r.key}>
                {r.label(editing!)}
                <Step label={r.label(editing!)} value={0} onChange={(n) => setCount(editing!, r.key, n)} />
              </label>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
