// v2 app shell: status ribbon · board stage (camera-fill) · guide bar · dock sheets.
// M1: area sheet with quick edits + rule-filtered move flow. PRD.md is the spec.

import { useEffect, useMemo, useState } from 'react';
import '@fontsource/rajdhani/500.css';
import '@fontsource/rajdhani/700.css';
// v1 stylesheet still powers BoardMap internals (extracted fully before M7);
// imported FIRST so ui2 tokens/shell win any shared selector or custom-property collisions.
import '../ui/styles.css';
import './tokens.css';
import './shell.css';
import type { ActionResult, GameState } from '../engine/state';
import { setupRound, startNextRound, nextPhase, SUPREMACY_WIN, PHASE_ORDER } from '../engine/round';
import { availability } from '../engine/spiceMustFlow';
import { gameOutcome, PRESCIENCE_MARKERS } from '../engine/victory';
import { legalMoveDestinations } from '../engine/moveTargets';
import { moveLegionUnits, applyHarkonnenAction, isAutoApplied, tokenPoolShortNote, WORMSIGN_ENTRY_NOTE, deployFromReserve, reserveDeployAreas } from '../engine/applyAction';
import { type HarkonnenAction } from '../engine/harkonnenActions';
import { decideHarkonnenAction, BRAIN_LABELS, type BrainId } from '../engine/harkonnenBrain';
import { describeAction, actionHeadline } from '../ui/describeAction';
import { areaLabel } from '../ui/describeAction';
import { BoardMap } from '../ui/BoardMap';
import { Icon, type IconName } from './icons';
import { guideFor } from './flow';
import { useGame } from './useGame';
import { AreaSheet, type MovePick } from './AreaSheet';
import { StageFocusContext, AreaRef } from './refs';
import { BattleScreen } from './BattleScreen';
import { YouSheet } from './YouSheet';
import { VictoryScene } from './VictoryScene';
import { TurnSheet, type ReserveDeployPick } from './TurnSheet';
import { SetupWizard } from '../ui/SetupWizard';
import { play } from '../ui/sound';
import { VehiclesPanel, HazardsPanel, SpicePanel } from './PhasePanels';
import { exportState, importState, listSaves, saveNamedGame, loadNamedGame, deleteNamedGame } from '../ui/persistence';
import { setSoundEnabled, soundEnabled } from '../ui/sound';

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
  const game = useGame();
  const { s, commit, undo, canUndo, toast, setToast, startNew } = game;
  const [sheet, setSheet] = useState<SheetId>(null);
  const [areaOpen, setAreaOpen] = useState<string | null>(null);
  const [movePick, setMovePick] = useState<MovePick | null>(null);
  // Deploy-from-reserve: units chosen in the Turn sheet, destination picked on the stage.
  const [deployPick, setDeployPick] = useState<ReserveDeployPick | null>(null);
  // The Harkonnen directive being reviewed (die tapped → AI order → confirm/battle/done).
  const [directive, setDirective] = useState<HarkonnenAction | null>(null);
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
  const [sound, setSound] = useState(soundEnabled());
  // Which Harkonnen brain resolves the dice — Mahdi (official bot) or a human-like difficulty.
  const [brain, setBrain] = useState<BrainId>(() => {
    try {
      const v = localStorage.getItem('dwfa.aiBrain');
      return v === 'recruit' || v === 'bashar' || v === 'baron' ? v : 'mahdi';
    } catch {
      return 'mahdi';
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('dwfa.aiBrain', brain);
    } catch {
      /* ignore */
    }
  }, [brain]);

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

  const guide = useMemo(() => guideFor(s), [s]);
  const winner = gameOutcome(s).winner;
  useEffect(() => {
    if (!winner) setSceneDismissed(false);
    else play('win');
  }, [winner]);
  const outcome = gameOutcome(s);

  // Move flow: legal destinations glow; tapping one applies the move.
  const moveDests = useMemo(() => {
    if (!movePick) return null;
    const legion = s.legions.find((l) => l.faction === movePick.faction && l.area === movePick.from);
    return legion ? legalMoveDestinations(s, legion) : new Set<string>();
  }, [movePick, s]);
  const deployDests = useMemo(() => (deployPick ? reserveDeployAreas(s) : null), [deployPick, s]);

  // Areas a pending directive touches — glowed on the stage behind the card.
  const directiveGlow = useMemo(() => {
    if (!directive) return null;
    switch (directive.kind) {
      case 'attack_sietch':
        return [directive.attacker, directive.sietch];
      case 'attack_legion':
        return [directive.attacker, directive.defender];
      case 'move':
        return [directive.path[0], directive.path[directive.path.length - 1]];
      case 'deploy':
        return directive.placements.map((p) => p.settlement);
      case 'house_replace':
        return [directive.legion];
      default:
        return [];
    }
  }, [directive]);

  // Tapping a face = one physical die spent: count it (quiet commit → chronicle line + undo).
  const diceUsed = s.harkonnenDiceUsed ?? 0;
  const diceAvail = availability(s.spice.markers).diceAvailable;
  const rollDie = (face: ActionResult) => {
    const next = { ...s, harkonnenDiceUsed: diceUsed + 1 };
    commit(next, { headline: `Harkonnen die ${diceUsed + 1}/${diceAvail}: ${face}`, quiet: true });
    setDirective(decideHarkonnenAction(next, face, brain));
  };

  const confirmDirective = () => {
    if (!directive) return;
    const res = applyHarkonnenAction(s, directive);
    if (res.applied) {
      commit(res.state, { headline: actionHeadline(directive), text: describeAction(directive), note: res.note });
    } else {
      setToast(res.note ?? 'Nothing to apply');
    }
    setDirective(null);
  };

  // An attack directive: battles are fought from the attacker's area (rulebook) — no pre-move.
  // Survivors stay put on a cease; the engine advances the victor.
  const directiveToBattle = () => {
    if (!directive || (directive.kind !== 'attack_sietch' && directive.kind !== 'attack_legion')) return;
    const defArea = directive.kind === 'attack_sietch' ? directive.sietch : directive.defender;
    setBattlePair({ atk: directive.attacker, def: defArea, faction: 'harkonnen' });
    setDirective(null);
  };
  const [battlePair, setBattlePair] = useState<{ atk: string; def: string; faction: 'harkonnen' | 'atreides' } | null>(null);
  const [sceneDismissed, setSceneDismissed] = useState(false);
  // One-shot stage focus (pan + pulse) driven by location chips anywhere in the UI.
  const [stageFocus, setStageFocus] = useState<{ id: string; nonce: number } | null>(null);
  const focusStage = (id: string) => {
    setSheet(null);
    setAreaOpen(null);
    setStageFocus({ id, nonce: Date.now() });
  };
  const [wizardOpen, setWizardOpen] = useState(false);
  // Entering a different game (new campaign, load, import): drop every transient surface so the
  // fresh board isn't covered by a sheet/pick/battle left over from the previous one.
  const clearOverlays = () => {
    setSheet(null);
    setAreaOpen(null);
    setMovePick(null);
    setDeployPick(null);
    setDirective(null);
    setBattlePair(null);
  };
  // First visit (no saved game yet): offer the guided setup once.
  const [welcome, setWelcome] = useState(() => {
    try {
      return !localStorage.getItem('dwfa.state.v1') && !localStorage.getItem('dwfa.v2.welcomed');
    } catch {
      return false;
    }
  });
  const dismissWelcome = () => {
    setWelcome(false);
    try {
      localStorage.setItem('dwfa.v2.welcomed', 'yes');
    } catch {
      /* ignore */
    }
  };

  const onStageSelect = (id: string) => {
    if (deployPick && deployDests) {
      if (!deployDests.has(id)) return;
      const n = deployPick.units.regular + deployPick.units.elite + deployPick.units.special_elite;
      commit(deployFromReserve(s, { settlement: id, units: deployPick.units, leader: deployPick.leader }), {
        headline: 'Deployed from reserve',
        text: `${n} unit${n === 1 ? '' : 's'}${deployPick.leader ? ` + ${deployPick.leader}` : ''} → ${areaLabel(id)}`,
      });
      setDeployPick(null);
      return;
    }
    if (movePick && moveDests) {
      if (!moveDests.has(id)) return;
      const next = moveLegionUnits(s, movePick.faction, movePick.from, id, movePick.move);
      // Physical-table reminders the engine can't resolve: a Harkonnen legion entering a
      // wormsign reveals it, and a garrison drop from an empty token pool needs board reveals.
      const notes: string[] = [];
      if (movePick.faction === 'harkonnen') {
        if (s.wormsigns.some((w) => w.area === id)) notes.push(WORMSIGN_ENTRY_NOTE);
        const fullyLeft = !next.legions.some(
          (l) =>
            l.faction === 'harkonnen' &&
            l.area === movePick.from &&
            l.units.regular + l.units.elite + l.units.special_elite + l.leaders.length > 0,
        );
        const fromSettlement = s.settlements.some((st) => st.area === movePick.from && !st.destroyed);
        if (fullyLeft && fromSettlement && s.harkonnenReserve.deploymentTokens < 2) {
          notes.push(tokenPoolShortNote(2 - s.harkonnenReserve.deploymentTokens));
        }
      }
      commit(next, {
        headline: 'Legion moved',
        text: `${movePick.faction === 'harkonnen' ? 'Harkonnen' : 'Atreides'}: ${areaLabel(movePick.from)} → ${areaLabel(id)}`,
        note: notes.length > 0 ? notes.join(' ') : undefined,
      });
      setMovePick(null);
      return;
    }
    setAreaOpen(id);
  };

  const onGuideAction = () => {
    if (guide.action === 'begin-round') commit(setupRound(s), { headline: `Round ${s.round} begun` });
    else if (guide.action === 'next-phase') {
      const n = nextPhase(s.phase);
      // A quiet commit (not a silent edit): the step lands in the chronicle and undoes cleanly.
      if (n) commit({ ...s, phase: n }, { headline: guide.actionLabel?.replace(/\s*→$/, '') ?? 'Next phase', quiet: true });
    } else if (guide.action === 'next-round') {
      commit(startNextRound(s).state, { headline: `Round ${s.round + 1} begun` });
    }
  };

  const phaseIndex = PHASE_ORDER.indexOf(s.phase);

  return (
    <StageFocusContext.Provider value={focusStage}>
    <div className="ui2">
      {atmosphere && <div className="dunes" aria-hidden />}

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

      <main className="stage">
        <BoardMap
          state={s}
          fill
          focus={stageFocus}
          highlight={areaOpen}
          glow={deployDests ? [...deployDests] : moveDests ? [...moveDests] : directiveGlow ?? undefined}
          picking={!!movePick || !!deployPick}
          selectable={deployDests ? (id) => deployDests.has(id) : moveDests ? (id) => moveDests.has(id) : undefined}
          onSelect={onStageSelect}
        />

        {/* Guide bar — during a move pick it narrates the pick; otherwise the flow step. */}
        <div className={`guide${outcome.winner ? ' won' : ''}`}>
          {directive ? (
            <div className="directive-card">
              <div className="dc-head">
                <Icon name="leadership" size={16} /> {actionHeadline(directive)}
              </div>
              <p className="dc-text">
                {directive.kind === 'attack_sietch' ? (
                  <>Attack the sietch at <AreaRef id={directive.sietch} /> with the legion in <AreaRef id={directive.attacker} />{directive.useOrnithopter ? ' (troop-transport)' : ''}.</>
                ) : directive.kind === 'attack_legion' ? (
                  <>Attack the Atreides legion in <AreaRef id={directive.defender} /> with the legion in <AreaRef id={directive.attacker} />.</>
                ) : directive.kind === 'move' ? (
                  <>Move the legion from <AreaRef id={directive.path[0]} /> to <AreaRef id={directive.path[directive.path.length - 1]} />.</>
                ) : directive.kind === 'deploy' ? (
                  <>Deploy{directive.placements.map((pl, i) => (
                    <span key={i}>{i > 0 ? ';' : ''} in <AreaRef id={pl.settlement} /></span>
                  ))} — {describeAction(directive)}</>
                ) : directive.kind === 'house_replace' ? (
                  <>House: upgrade {directive.count} regular{directive.count === 1 ? '' : 's'} to elite in <AreaRef id={directive.legion} />.</>
                ) : (
                  describeAction(directive)
                )}
              </p>
              <div className="dc-actions">
                {directive.kind === 'attack_sietch' || directive.kind === 'attack_legion' ? (
                  <button className="g-primary dc-battle" onClick={directiveToBattle}>⚔ To battle</button>
                ) : isAutoApplied(directive) ? (
                  <button className="g-primary" onClick={confirmDirective}>Confirm &amp; apply</button>
                ) : directive.kind === 'none' ? null : (
                  <span className="dc-manual">Resolve this on the board, then record any changes.</span>
                )}
                <button className="as-btn" onClick={() => setDirective(null)}>Dismiss</button>
              </div>
            </div>
          ) : deployPick ? (
            <>
              <div className="g-text">
                <span className="g-now">Choose where to deploy</span>
                <span className="g-detail">
                  Glowing areas can take the reserve units: live settlements or existing Harkonnen
                  legions with stacking room.
                </span>
              </div>
              <button className="g-primary" onClick={() => setDeployPick(null)}>
                Cancel
              </button>
            </>
          ) : movePick ? (
            <>
              <div className="g-text">
                <span className="g-now">Choose a destination</span>
                <span className="g-detail">
                  Glowing areas are the legal moves for the {movePick.faction === 'harkonnen' ? 'Harkonnen' : 'Atreides'} legion at{' '}
                  <AreaRef id={movePick.from} /> (ground, transport or sandride, with stacking room).
                </span>
              </div>
              <button className="g-primary" onClick={() => setMovePick(null)}>
                Cancel
              </button>
            </>
          ) : (
            <>
              <div className="g-text">
                <span className="g-now">{guide.now}</span>
                {guide.detail && <span className="g-detail">{guide.detail}</span>}
              </div>
              {s.phase === 'vehicle_placement' && <VehiclesPanel game={game} />}
              {s.phase === 'desert_hazards' && <HazardsPanel game={game} />}
              {s.phase === 'spice_harvesting' && <SpicePanel game={game} />}
              {guide.showDice && (
                <div className="g-dice" role="group" aria-label="Harkonnen die result">
                  {DIE.map((d) => (
                    <button
                      key={d.face}
                      className="g-die"
                      disabled={diceUsed >= diceAvail}
                      title={diceUsed >= diceAvail ? 'All Harkonnen dice for this round are spent (adjust in the Turn sheet if needed)' : undefined}
                      onClick={() => rollDie(d.face)}
                    >
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
            </>
          )}
        </div>
      </main>

      <nav className="dock">
        <DockBtn icon="leadership" label="Turn" on={sheet === 'turn'} onClick={() => setSheet(sheet === 'turn' ? null : 'turn')} />
        <DockBtn icon="prescience" label="You" on={sheet === 'you'} onClick={() => setSheet(sheet === 'you' ? null : 'you')} />
        <DockBtn icon="log" label="Log" on={sheet === 'log'} onClick={() => setSheet(sheet === 'log' ? null : 'log')} />
        <DockBtn icon="settings" label="More" on={sheet === 'more'} onClick={() => setSheet(sheet === 'more' ? null : 'more')} />
      </nav>

      {areaOpen && (
        <AreaSheet
          game={game}
          area={areaOpen}
          onClose={() => setAreaOpen(null)}
          onStartMove={(pick) => {
            setAreaOpen(null);
            setMovePick(pick);
          }}
          onBattleHere={(atk, def, faction) => {
            setAreaOpen(null);
            setBattlePair({ atk, def, faction });
          }}
        />
      )}

      {sheet && (
        <div className="sheet-veil" onClick={() => setSheet(null)}>
          <section className="sheet" role="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-grip" />
            {sheet === 'turn' && (
              <TurnSheet
                game={game}
                onStartDeploy={(pick) => {
                  setSheet(null);
                  setDeployPick(pick);
                }}
              />
            )}
            {sheet === 'you' && <YouSheet game={game} />}
            {sheet === 'log' && (
              <>
                <h2><Icon name="log" size={18} /> Chronicle</h2>
                <button className="as-btn" disabled={!canUndo} onClick={undo}>
                  <Icon name="undo" size={15} /> Undo last
                </button>
                {game.log.length === 0 ? (
                  <p className="sheet-hint">Nothing applied yet.</p>
                ) : (
                  <ol className="chron">
                    {[...game.log].reverse().map((e) => (
                      <li key={e.id}>
                        <span className="chron-round">R{e.round}</span>
                        <div>
                          <strong>{e.headline}</strong>
                          {e.text && <div className="chron-text">{e.text}</div>}
                          {e.note && <div className="chron-note">{e.note}</div>}
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </>
            )}
            {sheet === 'more' && (
              <>
                <h2><Icon name="settings" size={18} /> More</h2>
                <div className="more-rows">
                  <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
                    {theme === 'dark' ? '☀' : '🌙'} {theme === 'dark' ? 'Day theme' : 'Night on Arrakis'}
                  </button>
                  <button onClick={() => { setSoundEnabled(!sound); setSound(!sound); }}>
                    <Icon name="sound" size={16} /> Sound {sound ? 'on' : 'off'}
                  </button>
                  <button onClick={() => setAtmosphere(!atmosphere)}>
                    <Icon name="wormsign" size={16} /> Atmosphere {atmosphere ? 'on' : 'off'}
                  </button>
                  <label className="more-brain">
                    <Icon name="mentat" size={16} /> Harkonnen AI
                    <select
                      className="ts-select"
                      value={brain}
                      onChange={(e) => {
                        setBrain(e.target.value as BrainId);
                        setToast(`Harkonnen AI: ${BRAIN_LABELS[e.target.value as BrainId]}`);
                      }}
                    >
                      {(Object.keys(BRAIN_LABELS) as BrainId[]).map((id) => (
                        <option key={id} value={id}>{BRAIN_LABELS[id]}</option>
                      ))}
                    </select>
                  </label>
                  <button onClick={() => { setSheet(null); setWizardOpen(true); }}>
                    🧭 Guided setup
                  </button>
                  <button onClick={() => { if (confirm('Start a fresh Mahdi-solo game?')) { clearOverlays(); startNew(); } }}>
                    <Icon name="objective" size={16} /> New game
                  </button>
                  <button
                    onClick={() => {
                      const blob = new Blob([exportState(s)], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `dwfa-round${s.round}.json`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                  >
                    <Icon name="map" size={16} /> Export game
                  </button>
                  <label className="more-import">
                    <Icon name="deployment" size={16} /> Import game
                    <input
                      type="file"
                      accept="application/json,.json"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        e.target.value = '';
                        if (!f) return;
                        const next = importState(await f.text());
                        if (next) {
                          game.loadGame(next);
                          clearOverlays();
                        } else alert('Not a valid saved game.');
                      }}
                    />
                  </label>
                </div>
                <h3 className="ys-h"><Icon name="log" size={15} /> Named saves</h3>
                <div className="more-rows">
                  <button
                    onClick={() => {
                      const name = prompt('Save as…', `Round ${s.round}`);
                      if (name === null) return; // cancelled
                      if (!name.trim()) {
                        setToast('Not saved — the name was blank');
                        return;
                      }
                      saveNamedGame(name.trim(), s);
                      setToast(`Saved "${name.trim()}"`);
                      setSheet(null);
                    }}
                  >
                    + Save current game
                  </button>
                  {listSaves().map((sv) => (
                    <div key={sv.name} className="more-save">
                      <span>{sv.name}</span>
                      <button
                        className="as-btn"
                        onClick={() => {
                          const st = loadNamedGame(sv.name);
                          if (st) {
                            game.loadGame(st);
                            clearOverlays();
                          }
                        }}
                      >
                        Load
                      </button>
                      <button
                        className="as-btn ys-danger"
                        onClick={() => {
                          if (confirm(`Delete "${sv.name}"?`)) {
                            deleteNamedGame(sv.name);
                            setToast('Deleted');
                            setSheet(null);
                          }
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
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

      {battlePair && (
        <BattleScreen
          game={game}
          attackerArea={battlePair.atk}
          area={battlePair.def}
          attackerFaction={battlePair.faction}
          onClose={() => setBattlePair(null)}
        />
      )}

      <SetupWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onFinish={(next) => {
          game.loadGame(next);
          clearOverlays();
          setToast('The board is set — begin round 1');
        }}
      />

      {welcome && (
        <div className="sheet-veil" onClick={dismissWelcome}>
          <section className="sheet welcome" role="dialog" aria-label="Welcome" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-grip" />
            <h2><Icon name="prescience" size={18} /> First time on Arrakis?</h2>
            <p className="sheet-hint">
              You play the Atreides on your physical board; this app runs the Harkonnen AI and always
              shows the one next thing to do, down in the spice-orange bar.
            </p>
            <div className="more-rows">
              <button
                onClick={() => {
                  dismissWelcome();
                  setWizardOpen(true);
                }}
              >
                🧭 Walk me through the setup
              </button>
              <button onClick={dismissWelcome}>I know the drill — explore the demo</button>
            </div>
          </section>
        </div>
      )}

      {outcome.winner && !sceneDismissed && (
        <VictoryScene
          s={s}
          onNewGame={() => {
            setSceneDismissed(false);
            clearOverlays();
            startNew();
          }}
          onDismiss={() => setSceneDismissed(true)}
        />
      )}

      {toast && <div className="toast2" role="status">✓ {toast}</div>}
    </div>
    </StageFocusContext.Provider>
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
