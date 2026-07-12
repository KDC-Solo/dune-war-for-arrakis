// Area sheet — tap any area on the stage: what's there, quick edits, and contextual actions
// (move a legion with rule-filtered destinations; worm tokens on desert). The board stays the
// interface: actions that need a "where" hand back to the stage with glowing legal targets.

import { useState } from 'react';
import type { GameState, Legion, UnitType } from '../engine/state';
import { emptyLegion, unitCount, COMPONENTS } from '../engine/state';
import { AREAS } from '../engine/board';
import { canPlaceSandworm, canPlaceWormsign } from '../engine/wormsigns';
import { hasCarryallForSector, removeCarryallForSector } from '../engine/vehiclePlacement';
import { revealDeploymentTokens } from '../engine/revealTokens';
import { ADJACENCY } from '../engine/board';
import { harkonnenNeighbors } from '../engine/movement';
import { NAMED_LEADERS } from '../engine/leaders';
import { ATREIDES_LEADERS } from '../engine/atreidesLeaders';
import { areaLabel } from '../ui/describeAction';
import { Icon } from './icons';
import type { Game } from './useGame';

export interface MovePick {
  from: string;
  faction: Legion['faction'];
  move: { units: Record<UnitType, number>; deploymentTokens: number; leaderIndices: number[] };
}

// Named-leader cards per side (v1 StateEditor parity): chip label + a combat-strip tooltip.
const NAMED_BY_FACTION: Record<Legion['faction'], readonly { name: string; hint: string }[]> = {
  harkonnen: NAMED_LEADERS.map((l) => ({
    name: l.name,
    hint: `Special ⚔${l.combatAbility.hits} 🛡${l.combatAbility.shields} — ${l.special}`,
  })),
  atreides: ATREIDES_LEADERS.map((l) => ({
    name: l.name,
    hint: `Special ⚔${l.combatAbility.hits} 🛡${l.combatAbility.shields} — ${l.entry}`,
  })),
};

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
  onBattleHere: (attackerArea: string, defenderArea: string, attackerFaction: Legion['faction']) => void;
}) {
  const { s, commit, edit } = game;
  const [editing, setEditing] = useState<Legion['faction'] | null>(null);
  // Revealing Harkonnen tokens outside battle (a Planning-card effect makes it necessary, p42).
  const [revealing, setRevealing] = useState<{ regular: number; elite: number; special_elite: number; bashars: number } | null>(null);
  const a = AREAS[area];
  const legions = s.legions.filter((l) => l.area === area);
  const hk = legions.find((l) => l.faction === 'harkonnen');
  const at = legions.find((l) => l.faction === 'atreides');
  const sietch = s.sietches.find((x) => x.area === area);
  const settlement = s.settlements.find((x) => x.area === area);
  const station = s.testingStations.find((x) => x.area === area);
  const worm = s.wormsigns.findIndex((w) => w.area === area);
  const sand = s.sandworms.findIndex((w) => w.area === area);
  const harvester = s.vehicles.findIndex((v) => v.type === 'harvester' && v.location === area);
  const desert = a?.terrain === 'desert' || a?.terrain === 'minor_erg';
  // A carryall in a connected air zone can rescue the harvester (Desert Hazards only).
  const carryallNearby = a ? hasCarryallForSector(s, a.sector) : false;

  // A sandworm arrives (wormsign reveal / sandworm attack): one commit places the worm and
  // shuffles the sign back into the pool. The harvester in the area is devoured — unless a
  // connected carryall is spent to save it (Desert Hazards rescue rule).
  const sandwormArrives = (opts: { saveHarvester?: boolean } = {}) => {
    let vehicles = s.vehicles;
    let headline = 'Sandworm placed';
    if (harvester >= 0) {
      if (opts.saveHarvester && a) {
        const saved = removeCarryallForSector({ ...s, vehicles }, a.sector);
        vehicles = saved ? saved.vehicles : vehicles;
        headline = 'Carryall saves the harvester';
      } else {
        vehicles = vehicles.filter((_, i) => i !== harvester);
        headline = 'Sandworm devours the harvester';
      }
    }
    commit(
      {
        ...s,
        sandworms: [...s.sandworms, { area }],
        vehicles,
        wormsigns: worm >= 0 ? s.wormsigns.filter((_, i) => i !== worm) : s.wormsigns,
        decks: worm >= 0 ? { ...s.decks, wormsignPool: s.decks.wormsignPool + 1 } : s.decks,
      },
      { headline, text: areaLabel(area) },
    );
  };

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

  const toggleNamed = (faction: Legion['faction'], name: string) => {
    edit(
      upsert(s, faction, area, (l) => {
        const has = l.leaders.some((x) => x.kind === 'named' && x.name === name);
        return {
          ...l,
          leaders: has
            ? l.leaders.filter((x) => !(x.kind === 'named' && x.name === name))
            : [...l.leaders, { kind: 'named' as const, faction, name }],
        };
      }),
      `Edited ${areaLabel(area)}`,
    );
  };

  // Named-leader chips for the edit panels — tap to add/remove the leader card from this legion.
  const namedChips = (faction: Legion['faction']) => {
    const l = s.legions.find((x) => x.faction === faction && x.area === area);
    const have = new Set(l?.leaders.filter((x) => x.kind === 'named').map((x) => x.name));
    return (
      <div className="as-chips" role="group" aria-label="Named leaders">
        {NAMED_BY_FACTION[faction].map((n) => (
          <button
            key={n.name}
            type="button"
            title={n.hint}
            className={`as-chip${have.has(n.name) ? ' on' : ''}`}
            onClick={() => toggleNamed(faction, n.name)}
          >
            {n.name}
          </button>
        ))}
      </div>
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
            {namedChips(l.faction)}
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
        {(at || (sietch && !sietch.destroyed)) && (() => {
          // Battles come from adjacent Harkonnen legions (solo adjacency ignores impassable);
          // a co-located attacker (legacy states) fights in place. An undefended sietch can still
          // be attacked — the battle is then automatically won (rulebook p27).
          const nbrs = new Set(harkonnenNeighbors(area));
          const attackers = s.legions.filter(
            (l) => l.faction === 'harkonnen' && unitCount(l) > 0 && (l.area === area || nbrs.has(l.area)),
          );
          return attackers.map((l) => (
            <button key={l.area} type="button" className="g-primary as-battle" onClick={() => onBattleHere(l.area, area, 'harkonnen')}>
              ⚔ Battle — Harkonnen attack from {l.area === area ? 'here' : areaLabel(l.area)}{!at ? ' (undefended)' : ''}
            </button>
          ));
        })()}
        {(hk || (settlement && !settlement.destroyed)) && (() => {
          // The player can attack too: adjacent Atreides legions (physical adjacency — impassable
          // borders block you, unlike the Harkonnen AI) or a co-located legion (legacy states).
          // An undefended settlement is likewise an automatic win.
          const nbrs = new Set(ADJACENCY[area] ?? []);
          const attackers = s.legions.filter(
            (l) => l.faction === 'atreides' && unitCount(l) > 0 && (l.area === area || nbrs.has(l.area)),
          );
          return attackers.map((l) => (
            <button key={l.area} type="button" className="g-primary as-battle at" onClick={() => onBattleHere(l.area, area, 'atreides')}>
              ⚔ Battle — Atreides attack from {l.area === area ? 'here' : areaLabel(l.area)}{!hk ? ' (undefended)' : ''}
            </button>
          ));
        })()}

        <div className="as-tools">
          {hk && hk.deploymentTokens > 0 && (
            <button
              type="button"
              className="as-btn"
              onClick={() => setRevealing({ regular: hk.deploymentTokens, elite: 0, special_elite: 0, bashars: 0 })}
            >
              <Icon name="token" size={15} /> Reveal tokens
            </button>
          )}
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
              onClick={() =>
                commit(
                  {
                    ...s,
                    wormsigns: s.wormsigns.filter((_, i) => i !== worm),
                    decks: { ...s.decks, wormsignPool: s.decks.wormsignPool + 1 },
                  },
                  { headline: 'Wormsign removed', text: areaLabel(area) },
                )
              }
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
          {desert && sand < 0 && worm >= 0 && harvester < 0 && legions.length === 0 && (
            <button type="button" className="as-btn" onClick={() => sandwormArrives()}>
              <Icon name="sandworm" size={15} /> Sandworm appears (discard sign)
            </button>
          )}
          {desert && sand < 0 && harvester >= 0 && legions.length === 0 && (
            <button type="button" className="as-btn" onClick={() => sandwormArrives()}>
              <Icon name="sandworm" size={15} /> Sandworm (devours harvester)
            </button>
          )}
          {desert && sand < 0 && harvester >= 0 && legions.length === 0 && carryallNearby && (
            <button type="button" className="as-btn" onClick={() => sandwormArrives({ saveHarvester: true })}>
              <Icon name="sandworm" size={15} /> Sandworm (carryall saves harvester)
            </button>
          )}
          {desert && harvester < 0 && sand < 0 &&
            s.vehicles.filter((v) => v.type === 'harvester').length < COMPONENTS.vehicles.harvester && (
              <button
                type="button"
                className="as-btn"
                onClick={() =>
                  commit(
                    { ...s, vehicles: [...s.vehicles, { type: 'harvester', location: area }] },
                    { headline: 'Harvester placed', text: areaLabel(area) },
                  )
                }
              >
                <Icon name="harvester" size={15} /> Harvester
              </button>
            )}
          {harvester >= 0 && (
            <button
              type="button"
              className="as-btn"
              onClick={() =>
                commit(
                  { ...s, vehicles: s.vehicles.filter((_, i) => i !== harvester) },
                  { headline: 'Harvester removed', text: areaLabel(area) },
                )
              }
            >
              − Harvester
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

        {revealing && hk && (
          <div className="as-edit">
            <p className="sheet-hint">
              Flip the {hk.deploymentTokens} facedown token{hk.deploymentTokens === 1 ? '' : 's'} — enter what
              they show (units and/or a Bashar). The markers shuffle back into the pool. Needed when a
              Planning card requires it, e.g. a Legion that must contain a Sardaukar.
            </p>
            {(['regular', 'elite', 'special_elite'] as const).map((k) => (
              <label key={k}>
                {k === 'regular' ? 'Regulars' : k === 'elite' ? 'Elites' : 'Sardaukar'}
                <Step
                  label={k}
                  value={revealing[k]}
                  onChange={(n) => setRevealing({ ...revealing, [k]: n })}
                />
              </label>
            ))}
            <label>
              Bashars
              <Step label="Bashars" value={revealing.bashars} onChange={(n) => setRevealing({ ...revealing, bashars: n })} />
            </label>
            <button
              type="button"
              className="g-primary"
              onClick={() => {
                commit(
                  revealDeploymentTokens(
                    s,
                    area,
                    'harkonnen',
                    { regular: revealing.regular, elite: revealing.elite, special_elite: revealing.special_elite },
                    revealing.bashars,
                  ),
                  {
                    headline: 'Tokens revealed',
                    text: `${areaLabel(area)} — markers return to the pool`,
                  },
                );
                setRevealing(null);
              }}
            >
              Reveal
            </button>
            <button type="button" className="as-btn" onClick={() => setRevealing(null)}>Cancel</button>
          </div>
        )}

        {(editing === 'harkonnen' && !hk) || (editing === 'atreides' && !at) ? (
          <div className="as-edit">
            {UNIT_ROWS.map((r) => (
              <label key={r.key}>
                {r.label(editing!)}
                <Step label={r.label(editing!)} value={0} onChange={(n) => setCount(editing!, r.key, n)} />
              </label>
            ))}
            {namedChips(editing!)}
          </div>
        ) : null}
      </section>
    </div>
  );
}
