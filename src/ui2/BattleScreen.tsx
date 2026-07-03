// Battle screen — a full-screen night-palette takeover for one fight (PRD §6). The two legions
// face off as icon rows; facedown tokens flip to units first; each round is entered with big
// tap counters; the engine applies casualty priority, leader strips, reinforcements, and the
// taken sietch. Commit lands in the chronicle like every other action.

import { useState } from 'react';
import type { Legion } from '../engine/state';
import {
  beginBattle,
  battleRoundSetup,
  resolveBattleRound,
  type BattleContext,
  type BattleSession,
} from '../engine/combat';
import { resolveCombatRoll, type RawRoll } from '../engine/combatRoll';
import { commitBattle } from '../engine/battleApply';
import { revealDeploymentTokens } from '../engine/revealTokens';
import { combatDiceDiscardBanned } from '../engine/imperiumBans';
import { areaLabel } from '../ui/describeAction';
import { Icon } from './icons';
import type { Game } from './useGame';

const emptyRaw = (): RawRoll => ({ hits: 0, shields: 0, specials: 0 });

function Count({ label, value, onChange, max = 8 }: { label: string; value: number; onChange: (n: number) => void; max?: number }) {
  return (
    <label className="bs-count">
      {label}
      <span className="mini-stepper">
        <button type="button" aria-label={`${label} −1`} disabled={value <= 0} onClick={() => onChange(value - 1)}>−</button>
        <b>{value}</b>
        <button type="button" aria-label={`${label} +1`} disabled={value >= max} onClick={() => onChange(value + 1)}>+</button>
      </span>
    </label>
  );
}

function LegionCol({ l, side }: { l: Legion; side: 'harkonnen' | 'atreides' }) {
  const special = side === 'harkonnen' ? 'Sardaukar' : 'Fedaykin';
  const named = l.leaders.filter((x) => x.kind === 'named' && x.name && x.name !== 'Named').map((x) => x.name);
  const generic = l.leaders.filter((x) => x.kind === 'generic').length;
  return (
    <div className={`bs-col ${side}`}>
      <h3>{side === 'harkonnen' ? 'Harkonnen' : 'Atreides'}</h3>
      <div className="bs-units">
        {l.units.regular > 0 && <span><Icon name="trooper" size={16} /> {l.units.regular}</span>}
        {l.units.elite > 0 && <span><Icon name="elite" size={16} /> {l.units.elite}</span>}
        {l.units.special_elite > 0 && <span><Icon name="specialElite" size={16} /> {l.units.special_elite} <em>{special}</em></span>}
        {l.deploymentTokens > 0 && <span><Icon name="token" size={16} /> {l.deploymentTokens}</span>}
        {generic > 0 && <span><Icon name="leader" size={16} /> {generic}</span>}
      </div>
      {named.length > 0 && <div className="bs-named">{named.join(' · ')}</div>}
    </div>
  );
}

export function BattleScreen({
  game,
  attackerArea,
  area,
  onClose,
}: {
  game: Game;
  /** Where the Harkonnen attack FROM (adjacent per the rules; equal to `area` only for legacy
   *  co-located states). Survivors return here on a cease; victors advance into `area`. */
  attackerArea: string;
  area: string;
  onClose: () => void;
}) {
  const { s, commit } = game;
  const attacker = s.legions.find((l) => l.faction === 'harkonnen' && l.area === attackerArea);
  const defender = s.legions.find((l) => l.faction === 'atreides' && l.area === area);

  const needReveal = (attacker?.deploymentTokens ?? 0) > 0 || (defender?.deploymentTokens ?? 0) > 0;
  const [reveal, setReveal] = useState(
    needReveal
      ? {
          atk: { regular: attacker?.deploymentTokens ?? 0, elite: 0, special_elite: 0 },
          def: { regular: defender?.deploymentTokens ?? 0, elite: 0, special_elite: 0 },
        }
      : null,
  );
  const [session, setSession] = useState<BattleSession | null>(null);
  const [surprise, setSurprise] = useState(false);
  const [att, setAtt] = useState<RawRoll>(emptyRaw);
  const [def, setDef] = useState<RawRoll>(emptyRaw);

  const sietch = s.sietches.find((si) => si.area === area && !si.destroyed);
  // Attacking a sietch flips its rank token (rulebook): an unrevealed rank must be entered
  // before the battle starts — the defender adds it to their combat dice.
  const needRank = !!sietch && !sietch.revealed;
  const chooseRank = (rank: 1 | 2 | 3) => {
    commit(
      { ...s, sietches: s.sietches.map((si) => (si.area === area ? { ...si, revealed: true, rank } : si)) },
      { headline: 'Sietch revealed', text: `${areaLabel(area)} — rank ${rank}` },
    );
  };

  const start = (atkL: Legion, defL: Legion) => {
    const ctx: BattleContext = {
      attacker: atkL,
      defender: defL,
      defenderSettlementRank: sietch?.rank ?? undefined,
      surprise,
      reinforcements: s.decks.reinforcements,
      landsraadBan: combatDiceDiscardBanned(s.spice.activeBans),
    };
    setSession(beginBattle(ctx));
    setAtt(emptyRaw());
    setDef(emptyRaw());
  };

  const confirmReveal = () => {
    if (!reveal || !attacker || !defender) return;
    let next = s;
    if (attacker.deploymentTokens > 0) next = revealDeploymentTokens(next, attackerArea, 'harkonnen', reveal.atk);
    if (defender.deploymentTokens > 0) next = revealDeploymentTokens(next, area, 'atreides', reveal.def);
    commit(next, { headline: 'Tokens revealed', text: areaLabel(area) });
    const a = next.legions.find((l) => l.faction === 'harkonnen' && l.area === attackerArea)!;
    const d = next.legions.find((l) => l.faction === 'atreides' && l.area === area)!;
    setReveal(null);
    start(a, d);
  };

  const applyRound = () => {
    if (!session) return;
    const aRoll = resolveCombatRoll(att, session.attacker.leaders, session.defender.units.special_elite);
    const dRoll = resolveCombatRoll(def, session.defender.leaders, session.attacker.units.special_elite);
    setSession(resolveBattleRound(session, { attacker: aRoll, defender: dRoll }));
    setAtt(emptyRaw());
    setDef(emptyRaw());
  };

  const finish = () => {
    if (!session) return;
    const { state } = commitBattle(s, session);
    const outcomes: Record<Exclude<BattleSession['status'], 'ongoing'>, string> = {
      attacker_won: 'Harkonnen victory — defender eliminated',
      defender_survived: 'Harkonnen cease the attack',
      attacker_eliminated: 'Harkonnen attackers wiped out',
    };
    commit(state, {
      headline: 'Battle',
      text: `${areaLabel(area)} — ${outcomes[session.status as Exclude<BattleSession['status'], 'ongoing'>] ?? 'resolved'}`,
    });
    onClose();
  };

  const setup = session && session.status === 'ongoing' ? battleRoundSetup(session) : null;

  return (
    <div className="battle-screen" role="dialog" aria-label={`Battle at ${areaLabel(area)}`}>
      <header className="bs-head">
        <Icon name="strategy" size={20} />
        <h2>
          Battle — {areaLabel(area)}
          {attackerArea !== area && <span className="bs-from"> ⚔ from {areaLabel(attackerArea)}</span>}
        </h2>
        <button className="ap-close bs-close" onClick={onClose} aria-label="Close">✕</button>
      </header>

      {!attacker || !defender ? (
        <p className="bs-note">The attacking Harkonnen legion or the Atreides defenders are missing.</p>
      ) : (
        <>
          <div className="bs-cols">
            <LegionCol l={session?.attacker ?? attacker} side="harkonnen" />
            <div className="bs-vs">
              {session ? <span className="bs-round">R{session.rounds + (session.status === 'ongoing' ? 1 : 0)}</span> : 'VS'}
              {sietch && <span className="bs-sietch"><Icon name="sietch" size={14} /> rank {sietch.rank ?? '?'}</span>}
            </div>
            <LegionCol l={session?.defender ?? defender} side="atreides" />
          </div>

          {needRank && (
            <div className="bs-panel">
              <p className="bs-note">
                The attack flips the sietch's rank token — what does it show? (The defender adds
                the rank to their combat dice.)
              </p>
              <div className="bs-rankrow">
                {[1, 2, 3].map((r) => (
                  <button key={r} className="g-primary bs-rank" onClick={() => chooseRank(r as 1 | 2 | 3)}>
                    Rank {r}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!needRank && reveal && (
            <div className="bs-panel">
              <p className="bs-note">Flip the facedown tokens — enter the units they reveal.</p>
              {attacker.deploymentTokens > 0 && (
                <div className="bs-rollrow">
                  <strong>Harkonnen ×{attacker.deploymentTokens}</strong>
                  <Count label="Reg" value={reveal.atk.regular} onChange={(n) => setReveal({ ...reveal, atk: { ...reveal.atk, regular: n } })} />
                  <Count label="Elite" value={reveal.atk.elite} onChange={(n) => setReveal({ ...reveal, atk: { ...reveal.atk, elite: n } })} />
                  <Count label="Sardaukar" value={reveal.atk.special_elite} onChange={(n) => setReveal({ ...reveal, atk: { ...reveal.atk, special_elite: n } })} />
                </div>
              )}
              {defender.deploymentTokens > 0 && (
                <div className="bs-rollrow">
                  <strong>Atreides ×{defender.deploymentTokens}</strong>
                  <Count label="Reg" value={reveal.def.regular} onChange={(n) => setReveal({ ...reveal, def: { ...reveal.def, regular: n } })} />
                  <Count label="Elite" value={reveal.def.elite} onChange={(n) => setReveal({ ...reveal, def: { ...reveal.def, elite: n } })} />
                  <Count label="Fedaykin" value={reveal.def.special_elite} onChange={(n) => setReveal({ ...reveal, def: { ...reveal.def, special_elite: n } })} />
                </div>
              )}
              <button className="g-primary" onClick={confirmReveal}>Reveal &amp; begin</button>
            </div>
          )}

          {!needRank && !reveal && !session && (
            <div className="bs-panel">
              <label className="bs-surprise">
                <input type="checkbox" checked={surprise} onChange={(e) => setSurprise(e.target.checked)} />
                Surprise attack (+1 Harkonnen result, first round)
              </label>
              <button className="g-primary" onClick={() => start(attacker, defender)}>⚔ Begin battle</button>
            </div>
          )}

          {session && setup && (
            <div className="bs-panel">
              <p className="bs-note">
                Roll <b>{setup.attackerDice}</b> Harkonnen {setup.discards > 0 ? `(+${setup.discards} reinforcement discards) ` : ''}
                and <b>{setup.defenderDice}</b> Atreides dice, then enter the results:
              </p>
              <div className="bs-rollrow harkonnen">
                <strong>Harkonnen</strong>
                <Count label="Swords" value={att.hits} onChange={(n) => setAtt({ ...att, hits: n })} />
                <Count label="Shields" value={att.shields} onChange={(n) => setAtt({ ...att, shields: n })} />
                <Count label="Specials" value={att.specials} onChange={(n) => setAtt({ ...att, specials: n })} />
              </div>
              <div className="bs-rollrow atreides">
                <strong>Atreides</strong>
                <Count label="Swords" value={def.hits} onChange={(n) => setDef({ ...def, hits: n })} />
                <Count label="Shields" value={def.shields} onChange={(n) => setDef({ ...def, shields: n })} />
                <Count label="Specials" value={def.specials} onChange={(n) => setDef({ ...def, specials: n })} />
              </div>
              <button className="g-primary" onClick={applyRound}>Apply round</button>
            </div>
          )}

          {session && session.status !== 'ongoing' && (
            <div className="bs-panel bs-outcome">
              <h3 className={session.status === 'attacker_won' ? 'hk' : 'at'}>
                {session.status === 'attacker_won'
                  ? '☠ The Harkonnen take the field'
                  : session.status === 'attacker_eliminated'
                    ? '☀ The attackers are wiped out'
                    : '🛡 The defenders hold'}
              </h3>
              {sietch && session.status === 'attacker_won' && <p className="bs-note">The sietch is destroyed.</p>}
              <button className="g-primary" onClick={finish}>Apply to the game</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
