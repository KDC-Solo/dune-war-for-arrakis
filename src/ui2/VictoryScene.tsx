// End-of-game scene — a full-screen faction moment (PRD §6): sigil, reason, the game's numbers,
// and the two ways out. Dismissible to keep reviewing the board; Undo naturally un-wins.

import type { GameState } from '../engine/state';
import { SUPREMACY_WIN } from '../engine/round';
import { gameOutcome } from '../engine/victory';
import { Icon } from './icons';

export function VictoryScene({
  s,
  onNewGame,
  onDismiss,
}: {
  s: GameState;
  onNewGame: () => void;
  onDismiss: () => void;
}) {
  const outcome = gameOutcome(s);
  if (!outcome.winner) return null;
  const atreides = outcome.winner === 'atreides';
  const battlesLogged = s.sietches.filter((x) => x.destroyed).length + s.settlements.filter((x) => x.destroyed).length;

  return (
    <div className={`victory ${outcome.winner}`} role="dialog" aria-label="Game over">
      <div className="vc-sigil">
        <Icon name={atreides ? 'prescience' : 'supremacy'} size={64} />
      </div>
      <h1>{atreides ? 'The Sleeper Awakens' : 'Arrakis Belongs to the Baron'}</h1>
      <p className="vc-reason">{outcome.reason}</p>
      <div className="vc-stats">
        <span><Icon name="leadership" size={16} /> Round {s.round}</span>
        <span><Icon name="supremacy" size={16} /> Supremacy {s.tracks.supremacy}/{SUPREMACY_WIN}</span>
        <span><Icon name="prescience" size={16} /> Prescience {s.tracks.prescience.join(' · ')}</span>
        <span><Icon name="storm" size={16} /> {battlesLogged} strongholds fell</span>
      </div>
      <div className="vc-actions">
        <button className="g-primary" onClick={onNewGame}>Begin a new campaign</button>
        <button className="as-btn vc-review" onClick={onDismiss}>Review the board</button>
      </div>
    </div>
  );
}
