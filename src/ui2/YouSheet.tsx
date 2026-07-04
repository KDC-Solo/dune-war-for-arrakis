// "You" (Atreides) sheet — the player-side tracker: prescience dials + secret objective,
// testing stations, sietch reveals (voluntary-reveal rule), settlement destruction, and the
// solo Bene Gesserit rule. Worm placement lives on the board (area sheets); moves start there too.

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
import { desertPowerAvailable } from '../engine/round';
import { ATREIDES_ACTION_DICE } from '../engine/state';
import { HOUSE_ATREIDES_CARDS, FREMEN_ALLY_CARDS } from '../engine/atreidesCards';
import { areaLabel } from '../ui/describeAction';
import { Icon } from './icons';
import type { Game } from './useGame';

export function YouSheet({ game }: { game: Game }) {
  const { s, commit } = game;
  const [stationPick, setStationPick] = useState<string | null>(null);
  const [revealPick, setRevealPick] = useState<string | null>(null);
  const [cardRef, setCardRef] = useState('');
  const refCard =
    HOUSE_ATREIDES_CARDS.find((c) => c.id === cardRef) ?? FREMEN_ALLY_CARDS.find((c) => c.id === cardRef) ?? null;
  const objective = s.atreidesObjective ?? null;

  const setMarker = (i: number, next: number) => {
    const deltas: PrescienceTriple = [0, 0, 0];
    deltas[i] = next - s.tracks.prescience[i];
    commit(advancePrescience(s, deltas), {
      headline: 'Prescience',
      text: `${PRESCIENCE_MARKERS[i].label} → ${next}`,
    });
  };
  const setObjective = (i: number, value: number) => {
    const next: PrescienceTriple = [...(objective ?? [0, 0, 0])] as PrescienceTriple;
    next[i] = Math.max(0, value);
    game.edit({ ...s, atreidesObjective: next }, 'Secret Objective');
  };

  const stations = s.testingStations.filter((t) => !t.revealed);
  const unrevealed = s.sietches.filter((si) => !si.revealed && !si.destroyed);
  const liveSettlements = s.settlements.filter((st) => !st.destroyed);
  const sgBanned = scoutingBanned(s.spice.activeBans);

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
          ? '+1 Harkonnen reinforcements card (voluntary reveal)'
          : 'Spacing Guild ban — no reinforcements card';
    }
    commit(next, { headline: 'Sietch revealed', text: `${areaLabel(area)} — rank ${rank}`, note });
    setRevealPick(null);
  };

  return (
    <>
      <h2><Icon name="prescience" size={18} /> Your side (Atreides)</h2>
      <p className="sheet-hint">
        <b>Moves &amp; worm tokens live on the board:</b> tap an area → <em>Move</em> glows your
        legal destinations (sandriding included); desert areas offer <em>Wormsign</em> /
        <em>Sandworm</em> buttons. This sheet tracks everything else.
      </p>

      <h3 className="ys-h"><Icon name="mentat" size={15} /> Your action dice <span className="sheet-hint">(tap as you spend them)</span></h3>
      <div className="as-tools ys-dice">
        <label className="bs-count">
          Used
          <span className="mini-stepper">
            <button
              type="button"
              aria-label="Atreides dice used −1"
              disabled={(s.atreidesDiceUsed ?? 0) <= 0}
              onClick={() => game.edit({ ...s, atreidesDiceUsed: (s.atreidesDiceUsed ?? 0) - 1 }, 'Atreides dice')}
            >−</button>
            <b>{s.atreidesDiceUsed ?? 0}/{ATREIDES_ACTION_DICE}</b>
            <button
              type="button"
              aria-label="Atreides dice used +1"
              onClick={() => game.edit({ ...s, atreidesDiceUsed: (s.atreidesDiceUsed ?? 0) + 1 }, 'Atreides dice')}
            >+</button>
          </span>
        </label>
        <span className={`ap-tag ${desertPowerAvailable(s) ? 'target' : ''}`}>
          ◈ Desert Power {desertPowerAvailable(s) ? 'available' : 'not available'}
        </span>
      </div>
      <p className="sheet-hint">
        You and the Harkonnen alternate actions (you act first). Desert Power needs fewer unused
        dice than the Harkonnen — cards granting it directly ignore that. A slotted Bene Gesserit
        token counts as an extra die (adjust here).
      </p>

      <div className="presc-dials">
        {PRESCIENCE_MARKERS.map((m, i) => (
          <div key={m.key} className={`dial ${m.color}`}>
            <span className="mini-stepper">
              <button type="button" aria-label={`${m.label} −1`} disabled={s.tracks.prescience[i] <= 0} onClick={() => setMarker(i, s.tracks.prescience[i] - 1)}>−</button>
              <b>{s.tracks.prescience[i]}</b>
              <button type="button" aria-label={`${m.label} +1`} onClick={() => setMarker(i, s.tracks.prescience[i] + 1)}>+</button>
            </span>
            <span>{m.label}</span>
            <label className="dial-goal">
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
      <p className="sheet-hint">
        Advance a marker when you claim a prescience card (max 2/round). Enter your Secret
        Objective's targets — the app announces your victory when all three are met.
      </p>

      <h3 className="ys-h"><Icon name="spice" size={15} /> Testing stations</h3>
      {stations.length === 0 ? (
        <p className="sheet-hint">All stations taken.</p>
      ) : (
        <div className="as-tools">
          {stations.map((t) =>
            stationPick === t.area ? (
              <span key={t.area} className="ys-pick">
                {areaLabel(t.area)} →
                {PRESCIENCE_MARKERS.map((m, i) => (
                  <button
                    key={m.key}
                    className="as-btn"
                    onClick={() => {
                      commit(takeTestingStation(s, t.area, i as 0 | 1 | 2), {
                        headline: 'Station taken',
                        text: `${areaLabel(t.area)} — ${m.label} +1`,
                      });
                      setStationPick(null);
                    }}
                  >
                    {m.label} +1
                  </button>
                ))}
                <button className="ap-close" onClick={() => setStationPick(null)}>✕</button>
              </span>
            ) : (
              <button key={t.area} className="as-btn" onClick={() => setStationPick(t.area)}>
                Take {areaLabel(t.area)}
              </button>
            ),
          )}
        </div>
      )}

      <h3 className="ys-h"><Icon name="sietch" size={15} /> Reveal a sietch</h3>
      {unrevealed.length === 0 ? (
        <p className="sheet-hint">No unrevealed sietches.</p>
      ) : (
        <div className="as-tools">
          {unrevealed.map((si) =>
            revealPick === si.area ? (
              <span key={si.area} className="ys-pick">
                {areaLabel(si.area)} rank:
                {[1, 2, 3].map((r) => (
                  <button key={r} className="as-btn" onClick={() => reveal(si.area, r as 1 | 2 | 3, false)}>
                    {r}
                  </button>
                ))}
                <button
                  className="as-btn"
                  title={sgBanned ? 'Spacing Guild ban — no reinforcements card' : 'Voluntary: +1 Harkonnen reinforcements card'}
                  onClick={() => reveal(si.area, 1, true)}
                >
                  voluntary…
                </button>
                <button className="ap-close" onClick={() => setRevealPick(null)}>✕</button>
              </span>
            ) : (
              <button key={si.area} className="as-btn" onClick={() => setRevealPick(si.area)}>
                {areaLabel(si.area)}
              </button>
            ),
          )}
        </div>
      )}

      <h3 className="ys-h"><Icon name="settlement" size={15} /> Destroy a settlement <span className="sheet-hint">(all markers +rank)</span></h3>
      <div className="as-tools">
        {liveSettlements.map((st) => (
          <button
            key={st.area}
            className="as-btn ys-danger"
            onClick={() =>
              commit(destroySettlement(s, st.area), {
                headline: 'Settlement destroyed',
                text: `${areaLabel(st.area)} — all prescience +${st.rank}`,
              })
            }
          >
            💥 {areaLabel(st.area)} ({st.rank})
          </button>
        ))}
      </div>

      <h3 className="ys-h"><Icon name="log" size={15} /> Your planning cards <span className="sheet-hint">(reference — resolve on the board)</span></h3>
      <select className="ts-select" value={cardRef} onChange={(e) => setCardRef(e.target.value)}>
        <option value="">— look up a card —</option>
        <optgroup label="House Atreides">
          {HOUSE_ATREIDES_CARDS.slice().sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)).map((c) => (
            <option key={c.id} value={c.id}>{c.name}{c.id.endsWith('_a') ? ' (Wormsigns)' : c.id.endsWith('_b') ? ' (Elites)' : c.id.endsWith('_c') ? ' (Vehicles)' : ''}</option>
          ))}
        </optgroup>
        <optgroup label="Fremen Ally">
          {FREMEN_ALLY_CARDS.slice().sort((a, b) => a.name.localeCompare(b.name)).map((c) => (
            <option key={c.id} value={c.id}>{c.name}{(c.copies ?? 1) > 1 ? ` ×${c.copies}` : ''}</option>
          ))}
        </optgroup>
      </select>
      {refCard && <p className="ys-cardtext">{refCard.text}</p>}

      <h3 className="ys-h"><Icon name="mentat" size={15} /> Harkonnen gain a Bene Gesserit token</h3>
      <p className="sheet-hint">Unused Harkonnen dice: <b>{s.harkonnenUnusedDice}</b>. Is a die still set aside on the SMF board?</p>
      <div className="as-tools">
        <button
          className="as-btn"
          onClick={() => commit(harkonnenBeneGesserit(s, true), { headline: 'Bene Gesserit', text: 'SMF die → unused Harkonnen dice' })}
        >
          Yes — move 1 die
        </button>
        <button
          className="as-btn"
          onClick={() => commit(harkonnenBeneGesserit(s, false), { headline: 'Bene Gesserit', text: 'No die left — supremacy +1' })}
        >
          No — supremacy +1
        </button>
      </div>
    </>
  );
}
