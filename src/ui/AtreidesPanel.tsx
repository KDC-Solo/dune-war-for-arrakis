// The Atreides-turn sync panel: record the few Atreides-side changes the Harkonnen AI and the
// victory check depend on, without digging into the state editor mid-game. Everything applies
// through `onApply` (undoable + logged). Legion moves live in the Move-a-legion panel and
// wormsigns in the Desert Power panel; this covers the rest:
//  - the prescience markers + the Secret Objective targets (Atreides win condition),
//  - taking an ecological testing station (+1 to the marker on the token's back),
//  - destroying a Harkonnen settlement (all markers advance by its rank),
//  - revealing a sietch (rank entry; a voluntary reveal gives the Harkonnen +1 reinforcements
//    card unless the Spacing Guild ban is active),
//  - the Harkonnen gaining a Bene Gesserit token (solo rule: SMF die → unused dice, else
//    +1 supremacy).

import { useState } from 'react';
import type { GameState } from '../engine/state';
import {
  PRESCIENCE_MARKERS,
  advancePrescience,
  destroySettlement,
  takeTestingStation,
  voluntaryRevealBonus,
  harkonnenBeneGesserit,
  type PrescienceTriple,
} from '../engine/victory';
import { scoutingBanned } from '../engine/imperiumBans';
import { areaLabel } from './describeAction';
import { AreaChip } from './locate';
import type { ActionLog } from './App';

/** Small +/− stepper for a marker value. */
function MiniStepper({
  value,
  onChange,
  min = 0,
  max = 99,
  label,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  label: string;
}) {
  return (
    <span className="mini-stepper" role="group" aria-label={label}>
      <button type="button" aria-label={`${label} −1`} disabled={value <= min} onClick={() => onChange(value - 1)}>
        −
      </button>
      <b>{value}</b>
      <button type="button" aria-label={`${label} +1`} disabled={value >= max} onClick={() => onChange(value + 1)}>
        +
      </button>
    </span>
  );
}

export function AtreidesPanel({
  s,
  onApply,
}: {
  s: GameState;
  onApply: (next: GameState, log?: ActionLog) => void;
}) {
  const [stationPick, setStationPick] = useState<string | null>(null);
  const objective = s.atreidesObjective ?? null;

  const setMarker = (i: number, next: number) => {
    const deltas: PrescienceTriple = [0, 0, 0];
    deltas[i] = next - s.tracks.prescience[i];
    onApply(advancePrescience(s, deltas), {
      headline: 'Prescience',
      text: `${PRESCIENCE_MARKERS[i].label} marker → ${next}.`,
    });
  };

  const setObjective = (i: number, value: number) => {
    const next: PrescienceTriple = [...(objective ?? [0, 0, 0])] as PrescienceTriple;
    next[i] = Math.max(0, value);
    onApply({ ...s, atreidesObjective: next }, {
      headline: 'Secret objective',
      text: `Objective targets set to ${next.join(' / ')}.`,
    });
  };

  const stations = s.testingStations.filter((t) => !t.revealed);
  const takeStation = (area: string, markerIndex: 0 | 1 | 2) => {
    onApply(takeTestingStation(s, area, markerIndex), {
      headline: 'Testing station',
      text: `Took the station at ${areaLabel(area)} — ${PRESCIENCE_MARKERS[markerIndex].label} +1.`,
    });
    setStationPick(null);
  };

  const liveSettlements = s.settlements.filter((st) => !st.destroyed);
  const destroy = (area: string) => {
    const rank = s.settlements.find((st) => st.area === area)?.rank ?? 0;
    onApply(destroySettlement(s, area), {
      headline: 'Settlement destroyed',
      text: `${areaLabel(area)} destroyed — all prescience markers +${rank}.`,
    });
  };

  const unrevealed = s.sietches.filter((si) => !si.revealed && !si.destroyed);
  const reveal = (area: string, rank: 1 | 2 | 3, voluntary: boolean) => {
    let next: GameState = {
      ...s,
      sietches: s.sietches.map((si) => (si.area === area ? { ...si, revealed: true, rank } : si)),
    };
    let note: string | undefined;
    if (voluntary) {
      const before = next.decks.reinforcements;
      next = voluntaryRevealBonus(next);
      note =
        next.decks.reinforcements > before
          ? '+1 Harkonnen reinforcements card (voluntary reveal).'
          : 'Spacing Guild ban active — no reinforcements card added.';
    }
    onApply(next, {
      headline: 'Sietch revealed',
      text: `${areaLabel(area)} revealed as rank ${rank}${voluntary ? ' (voluntary)' : ''}.`,
      note,
    });
  };

  const beneGesserit = (dieAvailable: boolean) => {
    onApply(harkonnenBeneGesserit(s, dieAvailable), {
      headline: 'Bene Gesserit (Harkonnen)',
      text: dieAvailable
        ? 'Took 1 action die from the SMF board into the unused Harkonnen dice.'
        : 'No die set aside on the SMF board — supremacy +1.',
    });
  };

  return (
    <section className="panel atreides-panel">
      <h2>Your turn (Atreides)</h2>
      <p className="hint">
        Record what changed on your turns so the AI and the victory check stay in sync. Legion moves
        are in <em>Move a legion</em>; wormsign placement is in <em>Desert Power</em>.
      </p>

      <h3>Prescience &amp; secret objective</h3>
      <div className="prescience-row">
        {PRESCIENCE_MARKERS.map((m, i) => (
          <div key={m.key} className={`prescience-marker ${m.color}`}>
            <span className="pm-label">{m.label}</span>
            <MiniStepper
              label={m.label}
              value={s.tracks.prescience[i]}
              onChange={(n) => setMarker(i, n)}
            />
            <label className="pm-objective">
              goal
              <input
                type="number"
                min={0}
                value={objective ? objective[i] : ''}
                placeholder="?"
                onFocus={(e) => e.currentTarget.select()}
                onChange={(e) => setObjective(i, Number(e.target.value))}
              />
            </label>
          </div>
        ))}
      </div>
      <p className="hint">
        Move a marker when you claim a prescience card (max 2 cards/round). Enter your Secret
        Objective card's 3 target scores — the app announces your win when every marker reaches its
        goal.
      </p>

      <h3>Testing stations <span className="hint">(take one: +1 to the marker on its back)</span></h3>
      {stations.length === 0 ? (
        <p className="hint">All 6 stations are taken.</p>
      ) : (
        <div className="station-list">
          {stations.map((t) =>
            stationPick === t.area ? (
              <span key={t.area} className="station-take">
                <AreaChip id={t.area} /> →
                {PRESCIENCE_MARKERS.map((m, i) => (
                  <button key={m.key} type="button" className="add-mini" onClick={() => takeStation(t.area, i as 0 | 1 | 2)}>
                    {m.label} +1
                  </button>
                ))}
                <button type="button" className="remove" title="Cancel" onClick={() => setStationPick(null)}>
                  ✕
                </button>
              </span>
            ) : (
              <button key={t.area} type="button" className="add-mini" onClick={() => setStationPick(t.area)}>
                Take {areaLabel(t.area)}
              </button>
            ),
          )}
        </div>
      )}

      <h3>Reveal a sietch</h3>
      {unrevealed.length === 0 ? (
        <p className="hint">No unrevealed sietches.</p>
      ) : (
        <div className="feature-list">
          {unrevealed.map((si) => (
            <RevealRow key={si.area} area={si.area} onReveal={reveal} sgBanned={scoutingBanned(s.spice.activeBans)} />
          ))}
        </div>
      )}

      <h3>Destroy a Harkonnen settlement <span className="hint">(all markers +rank)</span></h3>
      {liveSettlements.length === 0 ? (
        <p className="hint">No settlements left.</p>
      ) : (
        <div className="station-list">
          {liveSettlements.map((st) => (
            <button key={st.area} type="button" className="add-mini danger" onClick={() => destroy(st.area)}>
              💥 {areaLabel(st.area)} (rank {st.rank})
            </button>
          ))}
        </div>
      )}

      <h3>Harkonnen gain a Bene Gesserit token <span className="hint">(solo rule)</span></h3>
      <p className="hint">
        Unused Harkonnen dice: <b>{s.harkonnenUnusedDice}</b>. Check the physical SMF board: is a
        die still set aside there?
      </p>
      <div className="station-list">
        <button type="button" className="add-mini" onClick={() => beneGesserit(true)}>
          Yes — move 1 die to unused
        </button>
        <button type="button" className="add-mini" onClick={() => beneGesserit(false)}>
          No — supremacy +1
        </button>
      </div>
    </section>
  );
}

/** One unrevealed sietch: choose its rank, then reveal (normally or voluntarily). */
function RevealRow({
  area,
  onReveal,
  sgBanned,
}: {
  area: string;
  onReveal: (area: string, rank: 1 | 2 | 3, voluntary: boolean) => void;
  sgBanned: boolean;
}) {
  const [rank, setRank] = useState<1 | 2 | 3>(1);
  return (
    <div className="feature-row">
      <span className="feature-name">
        <AreaChip id={area} />
      </span>
      <label className="mini">
        Rank
        <select value={rank} onChange={(e) => setRank(Number(e.target.value) as 1 | 2 | 3)}>
          <option value={1}>1</option>
          <option value={2}>2</option>
          <option value={3}>3</option>
        </select>
      </label>
      <button type="button" className="add-mini" onClick={() => onReveal(area, rank, false)}>
        Reveal (attacked)
      </button>
      <button
        type="button"
        className="add-mini"
        title={sgBanned ? 'Spacing Guild ban active — no reinforcements card will be added' : 'Adds 1 Harkonnen reinforcements card'}
        onClick={() => onReveal(area, rank, true)}
      >
        Reveal (voluntary)
      </button>
    </div>
  );
}
