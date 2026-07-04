// Turn sheet — this round at a glance, the imperium markers, the Harkonnen reserve, and
// planning-card / named-leader special resolution (auto steps applied by the engine).

import { useMemo, useState } from 'react';
import type { ImperiumPower, UnitType } from '../engine/state';
import { availability, activeBans } from '../engine/spiceMustFlow';
import { harkonnenFigureTally } from '../engine/figureBudget';
import { resolveCardPlay } from '../engine/cardEffects';
import { resolveLeaderSpecial } from '../engine/leaderEffects';
import { applyEffectSteps } from '../engine/effectSteps';
import { HOUSE_HARKONNEN_CARDS, CORRINO_ALLY_CARDS } from '../engine/planningCards';
import { NAMED_LEADERS } from '../engine/leaders';
import { Icon } from './icons';
import type { Game } from './useGame';
import { AreaRef, AreaRefs, AzRef } from './refs';

const RAGE: Record<string, string> = {
  rage_overcame_shaddam_iv_a: ' (+4 Regulars)',
  rage_overcame_shaddam_iv_b: ' (+2 Sardaukar)',
  rage_overcame_shaddam_iv_c: ' (Surprise)',
};
const IMPERIUM: { key: ImperiumPower; label: string }[] = [
  { key: 'choam', label: 'CHOAM' },
  { key: 'spacing_guild', label: 'Spacing Guild' },
  { key: 'landsraad', label: 'Landsraad' },
];
const UNITS: { key: UnitType; label: string }[] = [
  { key: 'regular', label: 'Reg' },
  { key: 'elite', label: 'Elite' },
  { key: 'special_elite', label: 'Sardaukar' },
];

export interface ReserveDeployPick {
  units: Record<UnitType, number>;
  leader: string | null;
}

export function TurnSheet({ game, onStartDeploy }: { game: Game; onStartDeploy?: (pick: ReserveDeployPick) => void }) {
  const { s, commit, edit } = game;
  const avail = useMemo(() => availability(s.spice.markers), [s.spice.markers]);
  const [sel, setSel] = useState('');
  const tally = useMemo(() => harkonnenFigureTally(s), [s]);
  const [dep, setDep] = useState<Record<UnitType, number>>({ regular: 0, elite: 0, special_elite: 0 });
  const [depLeader, setDepLeader] = useState('');
  const depTotal = dep.regular + dep.elite + dep.special_elite;
  const resolution = useMemo(() => {
    if (sel.startsWith('card:')) return resolveCardPlay(sel.slice(5), s);
    if (sel.startsWith('leader:')) return resolveLeaderSpecial(sel.slice(7), s);
    return null;
  }, [sel, s]);
  const autoCount = resolution?.steps.filter((st) => st.auto).length ?? 0;
  const r = s.harkonnenReserve;

  const setMarker = (key: ImperiumPower, value: number) => {
    const markers = { ...s.spice.markers, [key]: Math.max(1, Math.min(5, value)) };
    edit({ ...s, spice: { ...s.spice, markers, activeBans: activeBans(markers) } }, 'Imperium markers');
  };
  const setReserve = (key: UnitType, value: number) =>
    edit({ ...s, harkonnenReserve: { ...r, units: { ...r.units, [key]: Math.max(0, Math.min(16, value)) } } }, 'Harkonnen reserve');

  return (
    <>
      <h2><Icon name="leadership" size={18} /> This round</h2>
      <div className="kv2">
        <span><Icon name="mentat" size={16} /> Dice</span>
        <b>
          {s.harkonnenDiceUsed ?? 0}/{avail.diceAvailable} used
          <span className="mini-stepper ts-dicefix">
            <button
              type="button"
              aria-label="Dice used −1"
              disabled={(s.harkonnenDiceUsed ?? 0) <= 0}
              onClick={() => edit({ ...s, harkonnenDiceUsed: (s.harkonnenDiceUsed ?? 0) - 1 }, 'Dice used')}
            >−</button>
            <button
              type="button"
              aria-label="Dice used +1"
              onClick={() => edit({ ...s, harkonnenDiceUsed: (s.harkonnenDiceUsed ?? 0) + 1 }, 'Dice used')}
            >+</button>
          </span>
        </b>
        <span><Icon name="harvester" size={16} /> Vehicles</span>
        <b>{avail.harvesters}·{avail.ornithopters}·{avail.carryalls}</b>
        <span><Icon name="objective" size={16} /> Target</span>
        <b>{s.targetSietchId ? <AreaRef id={s.targetSietchId} /> : '—'}</b>
        <span><Icon name="ban" size={16} /> Bans</span>
        <b>{s.spice.activeBans.length ? s.spice.activeBans.join(', ') : 'none'}</b>
      </div>

      <h3 className="ys-h"><Icon name="spice" size={15} /> Imperium markers <span className="sheet-hint">(1 top … 5 ban)</span></h3>
      <div className="as-tools">
        {IMPERIUM.map(({ key, label }) => (
          <label key={key} className="bs-count">
            {label}
            <span className="mini-stepper">
              <button type="button" disabled={s.spice.markers[key] <= 1} onClick={() => setMarker(key, s.spice.markers[key] - 1)}>−</button>
              <b>{s.spice.markers[key]}</b>
              <button type="button" disabled={s.spice.markers[key] >= 5} onClick={() => setMarker(key, s.spice.markers[key] + 1)}>+</button>
            </span>
          </label>
        ))}
      </div>

      <h3 className="ys-h"><Icon name="token" size={15} /> Harkonnen reserve</h3>
      <div className="as-tools">
        {UNITS.map(({ key, label }) => (
          <label key={key} className="bs-count">
            {label}
            <span className="mini-stepper">
              <button type="button" disabled={r.units[key] <= 0} onClick={() => setReserve(key, r.units[key] - 1)}>−</button>
              <b>{r.units[key]}</b>
              <button type="button" onClick={() => setReserve(key, r.units[key] + 1)}>+</button>
            </span>
          </label>
        ))}
        <label className="bs-count">
          Tokens
          <span className="mini-stepper">
            <button type="button" disabled={r.deploymentTokens <= 0} onClick={() => edit({ ...s, harkonnenReserve: { ...r, deploymentTokens: r.deploymentTokens - 1 } }, 'Harkonnen reserve')}>−</button>
            <b>{r.deploymentTokens}</b>
            <button type="button" onClick={() => edit({ ...s, harkonnenReserve: { ...r, deploymentTokens: r.deploymentTokens + 1 } }, 'Harkonnen reserve')}>+</button>
          </span>
        </label>
        <label className="bs-count">
          Bashars
          <span className="mini-stepper">
            <button type="button" disabled={r.bashars <= 0} onClick={() => edit({ ...s, harkonnenReserve: { ...r, bashars: r.bashars - 1 } }, 'Harkonnen reserve')}>−</button>
            <b>{r.bashars}</b>
            <button type="button" onClick={() => edit({ ...s, harkonnenReserve: { ...r, bashars: r.bashars + 1 } }, 'Harkonnen reserve')}>+</button>
          </span>
        </label>
      </div>
      <p className="sheet-hint">Leaders in the pool: {r.namedLeaders.length ? r.namedLeaders.join(', ') : 'none'}.</p>
      <p className={`ts-budget${tally.over.length > 0 ? ' over' : ''}`}>
        Figures (board + reserve): Reg {tally.total.regular}/{tally.max.regular} · Elite {tally.total.elite}/{tally.max.elite} · Sardaukar {tally.total.special_elite}/{tally.max.special_elite}
        {tally.over.length > 0
          ? ' — ⚠ more than the box contains; fix a legion or the reserve'
          : ' ✓'}
      </p>

      {onStartDeploy && (
        <>
          <h3 className="ys-h"><Icon name="deployment" size={15} /> Deploy from the reserve <span className="sheet-hint">(keeps totals in sync)</span></h3>
          <div className="as-tools">
            {UNITS.map(({ key, label }) => (
              <label key={key} className="bs-count">
                {label}
                <span className="mini-stepper">
                  <button type="button" aria-label={`Deploy ${label} −1`} disabled={dep[key] <= 0} onClick={() => setDep({ ...dep, [key]: dep[key] - 1 })}>−</button>
                  <b>{dep[key]}</b>
                  <button type="button" aria-label={`Deploy ${label} +1`} disabled={dep[key] >= r.units[key]} onClick={() => setDep({ ...dep, [key]: dep[key] + 1 })}>+</button>
                </span>
              </label>
            ))}
            <select className="ts-select ts-depleader" value={depLeader} onChange={(e) => setDepLeader(e.target.value)}>
              <option value="">no leader</option>
              {r.bashars > 0 && <option value="Bashar">Bashar (generic)</option>}
              {r.namedLeaders.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <button
              type="button"
              className="g-primary"
              disabled={depTotal === 0 && !depLeader}
              onClick={() => {
                onStartDeploy({ units: dep, leader: depLeader || null });
                setDep({ regular: 0, elite: 0, special_elite: 0 });
                setDepLeader('');
              }}
            >
              Choose where →
            </button>
          </div>
        </>
      )}

      <h3 className="ys-h"><Icon name="log" size={15} /> Play a card or leader special</h3>
      <select className="ts-select" value={sel} onChange={(e) => setSel(e.target.value)}>
        <option value="">— choose —</option>
        <optgroup label="House Harkonnen">
          {HOUSE_HARKONNEN_CARDS.slice().sort((a, b) => a.name.localeCompare(b.name)).map((c) => (
            <option key={c.id} value={`card:${c.id}`}>{c.name}{RAGE[c.id] ?? ''}</option>
          ))}
        </optgroup>
        <optgroup label="Corrino Ally">
          {CORRINO_ALLY_CARDS.slice().sort((a, b) => a.name.localeCompare(b.name)).map((c) => (
            <option key={c.id} value={`card:${c.id}`}>{c.name}{RAGE[c.id] ?? ''}</option>
          ))}
        </optgroup>
        <optgroup label="Named-leader specials">
          {NAMED_LEADERS.slice().sort((a, b) => a.name.localeCompare(b.name)).map((l) => (
            <option key={l.name} value={`leader:${l.name}`}>{l.name}</option>
          ))}
        </optgroup>
      </select>
      {resolution && (
        <>
          <ol className="ts-steps">
            {resolution.steps.map((st, i) => (
              <li key={i} className={st.auto ? 'auto' : 'manual'}>
                <span className="ts-badge">{st.auto ? 'auto' : 'you'}</span>
                {st.text}
                {st.groundLocations && st.groundLocations.length > 0 && <> — <AreaRefs ids={st.groundLocations} /></>}
                {st.airLocations && st.airLocations.length > 0 && (
                  <> — {st.airLocations.map((z, zi) => (
                    <span key={z}>{zi > 0 && ', '}<AzRef id={z} /></span>
                  ))}</>
                )}
              </li>
            ))}
          </ol>
          {autoCount > 0 ? (
            <button
              className="g-primary"
              onClick={() => {
                commit(applyEffectSteps(s, resolution.steps), { headline: sel.startsWith('card:') ? 'Card played' : 'Leader special', text: resolution.name });
                setSel('');
              }}
            >
              Apply {autoCount} auto step{autoCount === 1 ? '' : 's'}
            </button>
          ) : (
            <p className="sheet-hint">All steps are yours to resolve on the board.</p>
          )}
        </>
      )}
    </>
  );
}
