// Guided setup: a step-by-step walkthrough for laying out a fresh Mahdi-solo game on the
// physical board, ending with the matching in-app state (`newGameState`). Every area reference
// is a clickable 📍 chip that pulses the spot on the board map, so a brand-new player can see
// exactly where each piece goes. The final steps teach how a round flows.

import { useState } from 'react';
import { AREA_IDS, AREAS } from '../engine/board';
import { NAMED_LEADERS } from '../engine/leaders';
import { newGameState } from '../engine/newGame';
import type { GameState } from '../engine/state';
import { AreaChips } from './locate';

const SIETCHES = AREA_IDS.filter((id) => AREAS[id].sietch);
const SETTLEMENTS = AREA_IDS.filter((id) => AREAS[id].settlement != null);
const STATIONS = AREA_IDS.filter((id) => AREAS[id].testingStation);
const START_LEADERS = NAMED_LEADERS.filter((l) => l.entry.kind === 'start').map((l) => l.name);

interface Step {
  title: string;
  body: React.ReactNode;
}

const STEPS: Step[] = [
  {
    title: 'Welcome to Mahdi solo',
    body: (
      <>
        <p>
          You play the <strong>Atreides</strong> on the physical board. This app runs the{' '}
          <strong>Harkonnen AI</strong>: each Harkonnen turn it reads the board state you keep in
          sync and tells you exactly what the Harkonnen do — you execute it on the table.
        </p>
        <p className="hint">
          The physical board is always the source of truth; the app is a co-processor. Tap any 📍
          area name in this walkthrough to see the spot pulse on the board map.
        </p>
      </>
    ),
  },
  {
    title: 'Board & The Spice Must Flow',
    body: (
      <>
        <p>
          Lay out the main board and The Spice Must Flow board. Put the 3{' '}
          <strong>imperium markers</strong> (CHOAM, Spacing Guild, Landsraad) on the <strong>top
          row</strong>, and set the 8 Harkonnen action dice beside it — the top row makes all 8
          available.
        </p>
        <p>
          Place the <strong>supremacy marker on 0</strong> and the 3 <strong>prescience
          markers</strong> (Kwisatz Haderach, Sand Dwellers, Jihad) on 0 of the prescience track.
        </p>
      </>
    ),
  },
  {
    title: 'Your sietches (Atreides)',
    body: (
      <>
        <p>
          In each of the 8 sietches place <strong>1 facedown Atreides deployment token and 1 Naib
          leader</strong>:
        </p>
        <p>
          <AreaChips ids={[...SIETCHES]} />
        </p>
        <p className="hint">
          Sietch rank tokens stay facedown — the app tracks a rank as “?” until it's revealed.
        </p>
      </>
    ),
  },
  {
    title: 'Harkonnen settlements',
    body: (
      <>
        <p>
          In each of the 6 Harkonnen settlements place <strong>2 facedown Starting Deployment
          tokens</strong> (1 black + 1 silver):
        </p>
        <p>
          <AreaChips ids={[...SETTLEMENTS]} />
        </p>
        <p className="hint">
          The rest of the Harkonnen units wait in the reserve — the AI's Deployment action brings
          them in. Tokens count as 1 unit (combat power 2) until revealed.
        </p>
      </>
    ),
  },
  {
    title: 'Stations, worms & decks',
    body: (
      <>
        <p>
          Place the 6 <strong>ecological testing station</strong> tokens facedown on their marked
          areas:
        </p>
        <p>
          <AreaChips ids={[...STATIONS]} />
        </p>
        <p>
          Shuffle the <strong>16 wormsign tokens</strong> into a facedown pool. Set up the planning
          decks (House Harkonnen + Corrino Ally for the AI), the prescience deck, and the 8 solo
          tactical cards.
        </p>
        <p className="hint">
          Named leaders that start in play for the Harkonnen: {START_LEADERS.join(', ')} — they sit
          in the AI's pool until deployed.
        </p>
      </>
    ),
  },
  {
    title: 'Your secret objective',
    body: (
      <>
        <p>
          Shuffle the 6 <strong>Secret Objective</strong> cards and draw 1 — keep it secret and set
          the other 5 aside. You win when all 3 prescience markers reach the card's scores.
        </p>
        <p className="hint">
          After setup, enter the card's 3 target scores in <em>Your turn (Atreides) → Prescience
          &amp; secret objective</em> so the app can announce your victory.
        </p>
      </>
    ),
  },
  {
    title: 'How a round flows',
    body: (
      <>
        <ol className="wizard-flow">
          <li>
            <strong>Setup</strong> — “Begin round” draws the harvesting sector + target sietch for
            the AI.
          </li>
          <li>
            <strong>Vehicles</strong> — place the Harkonnen harvesters / carryalls / ornithopters
            where the app says.
          </li>
          <li>
            <strong>Actions</strong> — alternate turns. On the Harkonnen turn, roll their action
            die and tap the face in <em>Resolve Harkonnen turn</em>; the app decides everything.
            Record your own turns in <em>Your turn (Atreides)</em> and <em>Move a legion</em>.
          </li>
          <li>
            <strong>Hazards</strong> — wormsigns, then Coriolis storms (enter your dice).
          </li>
          <li>
            <strong>Spice</strong> — enter the harvest; the app spends it the solo way.
          </li>
          <li>
            <strong>End</strong> — supremacy +1, next round. The Harkonnen win at 10; you win on
            your objective.
          </li>
        </ol>
        <p className="hint">Mis-tap? ↶ Undo reverts any applied action. Ready?</p>
      </>
    ),
  },
];

export function SetupWizard({
  open,
  onClose,
  onFinish,
}: {
  open: boolean;
  onClose: () => void;
  onFinish: (s: GameState) => void;
}) {
  const [step, setStep] = useState(0);
  if (!open) return null;
  const last = step === STEPS.length - 1;
  const close = () => {
    setStep(0);
    onClose();
  };

  return (
    <div className="map-modal-overlay wizard-overlay" onClick={close}>
      <div className="map-modal panel wizard" role="dialog" aria-label="Guided setup" onClick={(e) => e.stopPropagation()}>
        <div className="map-modal-head">
          <h2>Guided setup — {STEPS[step].title}</h2>
          <button className="map-close" onClick={close} title="Close" aria-label="Close">
            ✕
          </button>
        </div>
        <div className="wizard-progress">
          {STEPS.map((st, i) => (
            <button
              key={st.title}
              type="button"
              className={`wizard-dot${i === step ? ' current' : ''}${i < step ? ' done' : ''}`}
              title={st.title}
              onClick={() => setStep(i)}
              aria-label={`Step ${i + 1}: ${st.title}`}
            />
          ))}
        </div>
        <div className="wizard-body">{STEPS[step].body}</div>
        <div className="directive-actions wizard-nav">
          <button className="die" disabled={step === 0} onClick={() => setStep(step - 1)}>
            ← Back
          </button>
          {last ? (
            <button
              className="confirm-btn"
              onClick={() => {
                onFinish(newGameState());
                close();
              }}
            >
              Start the game
            </button>
          ) : (
            <button className="confirm-btn" onClick={() => setStep(step + 1)}>
              Next →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
