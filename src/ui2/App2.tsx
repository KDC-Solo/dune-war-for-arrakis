// v2 app shell (M0): status ribbon · board stage · guide bar · dock with bottom sheets.
// The stage hosts the existing BoardMap (extracted & upgraded in M1); the guide bar runs the
// round skeleton (die resolution lands in M2). Design tokens in tokens.css; PRD.md is the spec.

import { useEffect, useMemo, useState } from 'react';
import '@fontsource/rajdhani/500.css';
import '@fontsource/rajdhani/700.css';
// v1 stylesheet still powers BoardMap internals (M1 extracts the stage + its styles into ui2);
// imported FIRST so ui2 tokens/shell win any shared selector or custom-property collisions.
import '../ui/styles.css';
import './tokens.css';
import './shell.css';
import type { ActionResult, GameState } from '../engine/state';
import { newGameState } from '../engine/newGame';
import { setupRound, startNextRound, nextPhase, SUPREMACY_WIN, PHASE_ORDER } from '../engine/round';
import { availability } from '../engine/spiceMustFlow';
import { gameOutcome, PRESCIENCE_MARKERS } from '../engine/victory';
import { loadState, saveState } from '../ui/persistence';
import { areaLabel } from '../ui/describeAction';
import { BoardMap } from '../ui/BoardMap';
import { AREAS } from '../engine/board';
import { Icon, type IconName } from './icons';
import { guideFor } from './flow';

const DIE: { face: ActionResult; icon: IconName; label: string }[] = [
  { face: 'leadership', icon: 'leadership', label: 'Leadership' },
  { face: 'strategy', icon: 'strategy', label: 'Strategy' },
  { face: 'mentat', icon: 'mentat', label: 'Mentat' },
  { face: 'deployment', icon: 'deployment', label: 'Deployment' },
  { face: 'house', icon: 'house', label: 'House' },
];

type SheetId = 'turn' | 'you' | 'log' | 'more' | null;

const PHASE_SHORT: Record<GameState['phase'], string> = {
  start: 'Setup',
  vehicle_placement: 'Vehicles',
  action_resolution: 'Actions',
  desert_hazards: 'Hazards',
  spice_harvesting: 'Spice',
  end: 'End',
};

export function App2() {
  const [s, setS] = useState<GameState>(() => loadState() ?? newGameState());
  const [sheet, setSheet] = useState<SheetId>(null);
  const [inspect, setInspect] = useState<string | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      return localStorage.getItem('dwfa.theme') === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });
  const [atmosphere, setAtmosphere] = useState(() => {
    try {
      return localStorage.getItem('dwfa.atmosphere') !== 'off';
    } catch {
      return true;
    }
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('dwfa.theme', theme);
    } catch {
      /* ignore */
    }
  }, [theme]);
  useEffect(() => {
    try {
      localStorage.setItem('dwfa.atmosphere', atmosphere ? 'on' : 'off');
    } catch {
      /* ignore */
    }
  }, [atmosphere]);
  useEffect(() => saveState(s), [s]);

  const guide = useMemo(() => guideFor(s), [s]);
  const avail = useMemo(() => availability(s.spice.markers), [s.spice.markers]);
  const outcome = gameOutcome(s);

  const onGuideAction = () => {
    if (guide.action === 'begin-round') setS(setupRound(s));
    else if (guide.action === 'next-phase') {
      const n = nextPhase(s.phase);
      if (n) setS({ ...s, phase: n });
    } else if (guide.action === 'next-round') setS(startNextRound(s).state);
  };

  const phaseIndex = PHASE_ORDER.indexOf(s.phase);

  return (
    <div className="ui2">
      {atmosphere && <div className="dunes" aria-hidden />}

      {/* Status ribbon — where you are, at a glance (tap items to open the Turn sheet). */}
      <header className="ribbon" onClick={() => setSheet('turn')}>
        <span className="rb-round">R{s.round}</span>
        <span className="rb-phases">
          {PHASE_ORDER.map((p, i) => (
            <span key={p} className={`rb-phase${i === phaseIndex ? ' on' : i < phaseIndex ? ' done' : ''}`}>
              {PHASE_SHORT[p]}
            </span>
          ))}
        </span>
        <span className="rb-tracks">
          <span title="Supremacy — the Harkonnen win at 10">
            <Icon name="supremacy" size={15} /> {s.tracks.supremacy}/{SUPREMACY_WIN}
          </span>
          <span title={PRESCIENCE_MARKERS.map((m, i) => `${m.label}: ${s.tracks.prescience[i]}`).join(' · ')}>
            <Icon name="prescience" size={15} /> {s.tracks.prescience.join('·')}
          </span>
        </span>
      </header>

      {/* Board stage — the app's canvas. */}
      <main className="stage">
        <BoardMap
          state={s}
          highlight={inspect}
          onSelect={(id) => setInspect((cur) => (cur === id ? null : id))}
        />

        {/* Area sheet (M0: inspection; contextual actions land in M1). */}
        {inspect && (
          <div className="area-peek" role="dialog" aria-label={areaLabel(inspect)}>
            <div className="ap-head">
              <Icon name={AREAS[inspect]?.sietch ? 'sietch' : AREAS[inspect]?.settlement ? 'settlement' : 'map'} size={18} />
              <strong>{areaLabel(inspect)}</strong>
              <button className="ap-close" onClick={() => setInspect(null)} aria-label="Close">✕</button>
            </div>
            <div className="ap-body">
              {AREAS[inspect]?.deep ? 'Deep desert' : AREAS[inspect]?.terrain}
              {s.legions.filter((l) => l.area === inspect).map((l, i) => (
                <span key={i} className={`ap-tag ${l.faction}`}>
                  <Icon name="trooper" size={14} /> {l.faction === 'harkonnen' ? 'Harkonnen' : 'Atreides'}
                </span>
              ))}
              {s.targetSietchId === inspect && <span className="ap-tag target"><Icon name="objective" size={14} /> Target</span>}
            </div>
          </div>
        )}

        {/* Guide bar — the one next action, always (spice-colored). */}
        <div className={`guide${outcome.winner ? ' won' : ''}`}>
          <div className="g-text">
            <span className="g-now">{guide.now}</span>
            {guide.detail && <span className="g-detail">{guide.detail}</span>}
          </div>
          {guide.showDice && (
            <div className="g-dice" role="group" aria-label="Harkonnen die result">
              {DIE.map((d) => (
                <button key={d.face} className="g-die" title={`${d.label} — directive cards arrive in M2`} disabled>
                  <Icon name={d.icon} size={20} />
                  <span>{d.label}</span>
                </button>
              ))}
            </div>
          )}
          {guide.action && (
            <button className="g-primary" onClick={onGuideAction}>
              {guide.actionLabel}
            </button>
          )}
        </div>
      </main>

      {/* Dock — four fixed entries opening bottom sheets. */}
      <nav className="dock">
        <DockBtn icon="leadership" label="Turn" on={sheet === 'turn'} onClick={() => setSheet(sheet === 'turn' ? null : 'turn')} />
        <DockBtn icon="prescience" label="You" on={sheet === 'you'} onClick={() => setSheet(sheet === 'you' ? null : 'you')} />
        <DockBtn icon="log" label="Log" on={sheet === 'log'} onClick={() => setSheet(sheet === 'log' ? null : 'log')} />
        <DockBtn icon="settings" label="More" on={sheet === 'more'} onClick={() => setSheet(sheet === 'more' ? null : 'more')} />
      </nav>

      {sheet && (
        <div className="sheet-veil" onClick={() => setSheet(null)}>
          <section className="sheet" role="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-grip" />
            {sheet === 'turn' && (
              <>
                <h2><Icon name="leadership" size={18} /> This round</h2>
                <div className="kv2">
                  <span><Icon name="mentat" size={16} /> Dice</span><b>{avail.diceAvailable}</b>
                  <span><Icon name="harvester" size={16} /> Harvesters</span><b>{avail.harvesters}</b>
                  <span><Icon name="ornithopter" size={16} /> Ornithopters</span><b>{avail.ornithopters}</b>
                  <span><Icon name="carryall" size={16} /> Carryalls</span><b>{avail.carryalls}</b>
                  <span><Icon name="objective" size={16} /> Target</span>
                  <b>{s.targetSietchId ? areaLabel(s.targetSietchId) : '—'}</b>
                  <span><Icon name="ban" size={16} /> Bans</span>
                  <b>{s.spice.activeBans.length ? s.spice.activeBans.join(', ') : 'none'}</b>
                </div>
              </>
            )}
            {sheet === 'you' && (
              <>
                <h2><Icon name="prescience" size={18} /> Your side (Atreides)</h2>
                <div className="presc-dials">
                  {PRESCIENCE_MARKERS.map((m, i) => (
                    <div key={m.key} className={`dial ${m.color}`}>
                      <b>{s.tracks.prescience[i]}</b>
                      <span>{m.label}</span>
                      <em>{s.atreidesObjective ? `goal ${s.atreidesObjective[i]}` : 'goal —'}</em>
                    </div>
                  ))}
                </div>
                <p className="sheet-hint">The full tracker (objective, stations, reveals, Desert Power) lands in M4.</p>
              </>
            )}
            {sheet === 'log' && (
              <>
                <h2><Icon name="log" size={18} /> Chronicle</h2>
                <p className="sheet-hint">The action timeline with Undo arrives with the directive flow (M2).</p>
              </>
            )}
            {sheet === 'more' && (
              <>
                <h2><Icon name="settings" size={18} /> More</h2>
                <div className="more-rows">
                  <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
                    {theme === 'dark' ? '☀' : '🌙'} {theme === 'dark' ? 'Day theme' : 'Night on Arrakis'}
                  </button>
                  <button onClick={() => setAtmosphere(!atmosphere)}>
                    <Icon name="wormsign" size={16} /> Atmosphere {atmosphere ? 'on' : 'off'}
                  </button>
                  <button onClick={() => { if (confirm('Start a fresh Mahdi-solo game?')) setS(newGameState()); }}>
                    <Icon name="objective" size={16} /> New game
                  </button>
                  <a href="?classic">↩ Classic interface (v1)</a>
                </div>
                <p className="sheet-hint">
                  Unofficial fan companion — not affiliated with CMON, Gale Force Nine, or Herbert
                  Properties LLC. v{__APP_VERSION__}.
                </p>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function DockBtn({ icon, label, on, onClick }: { icon: IconName; label: string; on: boolean; onClick: () => void }) {
  return (
    <button className={`dock-btn${on ? ' on' : ''}`} onClick={onClick}>
      <Icon name={icon} size={22} />
      <span>{label}</span>
    </button>
  );
}
