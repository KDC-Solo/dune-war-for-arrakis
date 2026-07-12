// Battle screen — a full-screen night-palette takeover for one fight (PRD §6). The two legions
// face off as icon rows; facedown tokens flip to units first; each round is entered with big
// tap counters; the engine applies casualty priority, leader strips, reinforcements, and the
// taken sietch. Commit lands in the chronicle like every other action.
//
// Works both ways: the Harkonnen AI attacking (auto-cease when outmatched, reinforcement
// discards) and the Atreides player attacking (no auto-cease — a "Cease the attack" button;
// taking a settlement destroys it and advances the prescience markers).

import { useState } from 'react';
import type { Legion } from '../engine/state';
import { emptyLegion } from '../engine/state';
import {
  beginBattle,
  battleRoundSetup,
  resolveBattleRound,
  ceaseAttack,
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
const NAME: Record<Legion['faction'], string> = { harkonnen: 'Harkonnen', atreides: 'Atreides' };

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
      <h3>{NAME[side]}</h3>
      <div className="bs-units">
        {l.units.regular > 0 && <span><Icon name="trooper" size={16} /> {l.units.regular} <em>Reg</em></span>}
        {l.units.elite > 0 && <span><Icon name="elite" size={16} /> {l.units.elite} <em>Elite</em></span>}
        {l.units.special_elite > 0 && <span><Icon name="specialElite" size={16} /> {l.units.special_elite} <em>{special}</em></span>}
        {l.deploymentTokens > 0 && <span><Icon name="token" size={16} /> {l.deploymentTokens} <em>Token{l.deploymentTokens === 1 ? '' : 's'}</em></span>}
        {generic > 0 && <span><Icon name="leader" size={16} /> {generic} <em>{side === 'harkonnen' ? 'Bashar' : 'Naib'}</em></span>}
      </div>
      {named.length > 0 && <div className="bs-named">{named.join(' · ')}</div>}
    </div>
  );
}

export function BattleScreen({
  game,
  attackerArea,
  area,
  attackerFaction = 'harkonnen',
  onClose,
}: {
  game: Game;
  /** Where the attack comes FROM (adjacent per the rules; equal to `area` only for legacy
   *  co-located states). Survivors return here on a cease; victors advance into `area`. */
  attackerArea: string;
  area: string;
  /** Which side is attacking — the Harkonnen AI or the Atreides player. */
  attackerFaction?: Legion['faction'];
  onClose: () => void;
}) {
  const { s, commit } = game;
  const defenderFaction: Legion['faction'] = attackerFaction === 'harkonnen' ? 'atreides' : 'harkonnen';
  const attacker = s.legions.find((l) => l.faction === attackerFaction && l.area === attackerArea);
  const realDefender = s.legions.find((l) => l.faction === defenderFaction && l.area === area);
  // An undefended stronghold can still be attacked: the battle is automatically won (rulebook
  // p27, "no combat roll is required") — model it as a fight against an empty legion.
  const defendedStronghold =
    defenderFaction === 'atreides'
      ? s.sietches.some((si) => si.area === area && !si.destroyed)
      : s.settlements.some((st) => st.area === area && !st.destroyed);
  const undefended = !realDefender && defendedStronghold;
  const defender = realDefender ?? (undefended ? emptyLegion(defenderFaction, area) : undefined);

  const needReveal = (attacker?.deploymentTokens ?? 0) > 0 || (defender?.deploymentTokens ?? 0) > 0;
  const [reveal, setReveal] = useState(
    needReveal
      ? {
          atk: { regular: attacker?.deploymentTokens ?? 0, elite: 0, special_elite: 0 },
          def: { regular: defender?.deploymentTokens ?? 0, elite: 0, special_elite: 0 },
          // Harkonnen tokens can also hide a Bashar Leader (rulebook p15 token symbols).
          atkBashars: 0,
          defBashars: 0,
        }
      : null,
  );
  const [session, setSession] = useState<BattleSession | null>(null);
  const [surprise, setSurprise] = useState(false);
  const [att, setAtt] = useState<RawRoll>(emptyRaw);
  const [def, setDef] = useState<RawRoll>(emptyRaw);
  // Planning cards the Atreides player discards from hand this round (+1 die each, rulebook
  // battle sequence step 1). The hand is physical — this only raises the dice count to roll.
  const [atCards, setAtCards] = useState(0);

  const sietch = s.sietches.find((si) => si.area === area && !si.destroyed);
  const settlement = s.settlements.find((st) => st.area === area && !st.destroyed);
  // The defender's stronghold rank: a sietch shields an Atreides defender, a settlement a
  // Harkonnen one (extra defender dice + the attacker's continue cost).
  const defenseRank = defenderFaction === 'atreides' ? sietch?.rank : settlement?.rank;
  // Attacking a sietch flips its rank token (rulebook): an unrevealed rank must be entered
  // before the battle starts — the defender adds it to their combat dice.
  const needRank = attackerFaction === 'harkonnen' && !!sietch && !sietch.revealed;
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
      defenderSettlementRank: defenseRank ?? undefined,
      surprise,
      // The bot spends reinforcement cards to reach 6 dice on WHICHEVER side it fights
      // (solo combat criteria: "If a battle starts…"), so pass the deck for both directions.
      reinforcements: s.decks.reinforcements,
      landsraadBan: combatDiceDiscardBanned(s.spice.activeBans),
    };
    setSession(beginBattle(ctx));
    setAtt(emptyRaw());
    setDef(emptyRaw());
    setAtCards(0);
  };

  const confirmReveal = () => {
    if (!reveal || !attacker || !defender) return;
    let next = s;
    if (attacker.deploymentTokens > 0)
      next = revealDeploymentTokens(next, attackerArea, attackerFaction, reveal.atk, reveal.atkBashars);
    if (defender.deploymentTokens > 0)
      next = revealDeploymentTokens(next, area, defenderFaction, reveal.def, reveal.defBashars);
    commit(next, { headline: 'Tokens revealed', text: areaLabel(area) });
    const a = next.legions.find((l) => l.faction === attackerFaction && l.area === attackerArea)!;
    const d = next.legions.find((l) => l.faction === defenderFaction && l.area === area) ?? emptyLegion(defenderFaction, area);
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
    setAtCards(0); // hand discards are chosen anew each round
  };

  const finish = () => {
    if (!session) return;
    const { state } = commitBattle(s, session);
    const who = NAME[attackerFaction];
    const outcomes: Record<Exclude<BattleSession['status'], 'ongoing'>, string> = {
      attacker_won: `${who} victory — defender eliminated`,
      defender_survived: `${who} cease the attack`,
      attacker_eliminated: `${who} attackers wiped out`,
    };
    commit(state, {
      headline: 'Battle',
      text: `${areaLabel(area)} — ${outcomes[session.status as Exclude<BattleSession['status'], 'ongoing'>] ?? 'resolved'}`,
    });
    onClose();
  };

  const setup = session && session.status === 'ongoing' ? battleRoundSetup(session) : null;
  const atkName = NAME[attackerFaction];
  const defName = NAME[defenderFaction];

  return (
    <div className="battle-screen" role="dialog" aria-label={`Battle at ${areaLabel(area)}`}>
      <header className="bs-head">
        <Icon name="strategy" size={20} />
        <h2>
          Battle — {areaLabel(area)}
          {attackerArea !== area && <span className="bs-from"> ⚔ {atkName} from {areaLabel(attackerArea)}</span>}
        </h2>
        <button className="ap-close bs-close" onClick={onClose} aria-label="Close">✕</button>
      </header>

      {!attacker || !defender ? (
        <p className="bs-note">The attacking {atkName} legion or the {defName} defenders are missing.</p>
      ) : (
        <>
          <div className="bs-cols">
            <LegionCol l={session?.attacker ?? attacker} side={attackerFaction} />
            <div className="bs-vs">
              {session ? <span className="bs-round">R{session.rounds + (session.status === 'ongoing' ? 1 : 0)}</span> : 'VS'}
              {sietch && <span className="bs-sietch"><Icon name="sietch" size={14} /> rank {sietch.rank ?? '?'}</span>}
              {settlement && defenderFaction === 'harkonnen' && (
                <span className="bs-sietch"><Icon name="settlement" size={14} /> rank {settlement.rank}</span>
              )}
            </div>
            <LegionCol l={session?.defender ?? defender} side={defenderFaction} />
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
              <label className="bs-surprise">
                <input type="checkbox" checked={surprise} onChange={(e) => setSurprise(e.target.checked)} />
                Surprise attack (+1 attacker result, first round)
              </label>
              {attacker.deploymentTokens > 0 && (
                <div className="bs-rollrow">
                  <strong>{atkName} ×{attacker.deploymentTokens}</strong>
                  <Count label="Reg" value={reveal.atk.regular} onChange={(n) => setReveal({ ...reveal, atk: { ...reveal.atk, regular: n } })} />
                  <Count label="Elite" value={reveal.atk.elite} onChange={(n) => setReveal({ ...reveal, atk: { ...reveal.atk, elite: n } })} />
                  <Count label={attackerFaction === 'harkonnen' ? 'Sardaukar' : 'Fedaykin'} value={reveal.atk.special_elite} onChange={(n) => setReveal({ ...reveal, atk: { ...reveal.atk, special_elite: n } })} />
                  {attackerFaction === 'harkonnen' && (
                    <Count label="Bashar" value={reveal.atkBashars} onChange={(n) => setReveal({ ...reveal, atkBashars: n })} />
                  )}
                </div>
              )}
              {defender.deploymentTokens > 0 && (
                <div className="bs-rollrow">
                  <strong>{defName} ×{defender.deploymentTokens}</strong>
                  <Count label="Reg" value={reveal.def.regular} onChange={(n) => setReveal({ ...reveal, def: { ...reveal.def, regular: n } })} />
                  <Count label="Elite" value={reveal.def.elite} onChange={(n) => setReveal({ ...reveal, def: { ...reveal.def, elite: n } })} />
                  <Count label={defenderFaction === 'harkonnen' ? 'Sardaukar' : 'Fedaykin'} value={reveal.def.special_elite} onChange={(n) => setReveal({ ...reveal, def: { ...reveal.def, special_elite: n } })} />
                  {defenderFaction === 'harkonnen' && (
                    <Count label="Bashar" value={reveal.defBashars} onChange={(n) => setReveal({ ...reveal, defBashars: n })} />
                  )}
                </div>
              )}
              <button className="g-primary" onClick={confirmReveal}>Reveal &amp; begin</button>
            </div>
          )}

          {!needRank && !reveal && !session && (
            <div className="bs-panel">
              {undefended ? (
                <p className="bs-note">
                  The {defenderFaction === 'atreides' ? 'sietch' : 'settlement'} is undefended — the
                  battle is automatically won, no combat roll required (rulebook p27).
                </p>
              ) : (
                <label className="bs-surprise">
                  <input type="checkbox" checked={surprise} onChange={(e) => setSurprise(e.target.checked)} />
                  Surprise attack (+1 attacker result, first round)
                </label>
              )}
              <button className="g-primary" onClick={() => start(attacker, defender)}>
                {undefended ? '⚔ Take it' : '⚔ Begin battle'}
              </button>
            </div>
          )}

          {session && setup && (() => {
            // The Atreides side may discard planning cards from hand for +1 die each (cap 6).
            const atkIsAt = attackerFaction === 'atreides';
            const atBase = atkIsAt ? setup.attackerDice : setup.defenderDice;
            const atDice = Math.min(6, atBase + atCards);
            const attackerDice = atkIsAt ? atDice : setup.attackerDice;
            const defenderDice = atkIsAt ? setup.defenderDice : atDice;
            const banned = !!session.ctx.landsraadBan;
            return (
            <div className="bs-panel">
              <p className="bs-note">
                <Icon name="mentat" size={14} /> Harkonnen reinforcements deck: <b>{session.reinforcements}</b> card{session.reinforcements === 1 ? '' : 's'}
                {banned
                  ? ' — Landsraad ban: no discards.'
                  : setup.discards > 0
                    ? ` — discards ${setup.discards} this round to reach 6 dice (remove ${setup.discards === 1 ? 'it' : 'them'} from the physical deck).`
                    : session.reinforcements > 0
                      ? ' — none needed this round.'
                      : ' — empty.'}
              </p>
              <div className="bs-rollrow atreides">
                <strong>Your planning cards</strong>
                <Count label="Discards" value={atCards} onChange={setAtCards} max={Math.max(0, 6 - atBase)} />
                <span className="bs-note">+1 die each — discard them from your hand</span>
              </div>
              <p className="bs-note">
                Roll <b>{attackerDice}</b> {atkName} and <b>{defenderDice}</b> {defName} dice, then enter the results:
              </p>
              <p className="bs-note bs-hintline">
                Dice = units in the legion + discarded cards, max 6. Leaders add no dice — each converts 1 ✴ Special
                you roll into its combat strip (a generic Naib/Bashar = 1 hit).
                {defenseRank ? ` The defender rolls +${defenseRank} for the ${defenderFaction === 'atreides' ? 'sietch' : 'settlement'} rank.` : ''}
                {setup.surprise ? ' Surprise attack: +1 attacker die this round.' : ''}
              </p>
              <div className={`bs-rollrow ${attackerFaction}`}>
                <strong>{atkName}</strong>
                <Count label="Swords" value={att.hits} onChange={(n) => setAtt({ ...att, hits: n })} />
                <Count label="Shields" value={att.shields} onChange={(n) => setAtt({ ...att, shields: n })} />
                <Count label="Specials" value={att.specials} onChange={(n) => setAtt({ ...att, specials: n })} />
              </div>
              <div className={`bs-rollrow ${defenderFaction}`}>
                <strong>{defName}</strong>
                <Count label="Swords" value={def.hits} onChange={(n) => setDef({ ...def, hits: n })} />
                <Count label="Shields" value={def.shields} onChange={(n) => setDef({ ...def, shields: n })} />
                <Count label="Specials" value={def.specials} onChange={(n) => setDef({ ...def, specials: n })} />
              </div>
              <button className="g-primary" onClick={applyRound}>Apply round</button>
              {attackerFaction === 'atreides' && session.rounds > 0 && (
                <button className="as-btn bs-cease" onClick={() => setSession(ceaseAttack(session))}>
                  🏳 Cease the attack
                </button>
              )}
              {attackerFaction === 'atreides' && defenseRank && (
                <p className="bs-note bs-hintline">
                  Assaulting a defended settlement costs 1 hit per continued round (applied automatically).
                </p>
              )}
            </div>
            );
          })()}

          {session && session.status !== 'ongoing' && (
            <div className="bs-panel bs-outcome">
              <h3 className={session.status === 'attacker_won' ? (attackerFaction === 'harkonnen' ? 'hk' : 'at') : session.status === 'attacker_eliminated' ? (attackerFaction === 'harkonnen' ? 'at' : 'hk') : 'at'}>
                {session.status === 'attacker_won'
                  ? `☠ The ${atkName} take the field`
                  : session.status === 'attacker_eliminated'
                    ? '☀ The attackers are wiped out'
                    : '🛡 The defenders hold'}
              </h3>
              {sietch && session.status === 'attacker_won' && attackerFaction === 'harkonnen' && (
                <p className="bs-note">The sietch is destroyed.</p>
              )}
              {settlement && session.status === 'attacker_won' && attackerFaction === 'atreides' && (
                <p className="bs-note">The settlement is destroyed — all prescience markers advance by {settlement.rank}.</p>
              )}
              <button className="g-primary" onClick={finish}>Apply to the game</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
