// Schematic, clickable board map. Areas are plotted from the captured normalized coordinates
// (boardPositions.ts) and colored by terrain — no copyrighted board art is shipped. Optional game
// state overlays legions / sietches / settlements / target so the player can see where things are.
//
// Labels are shown on hover (and for the selected/highlighted area) rather than printed permanently,
// which keeps the schematic legible at small sizes.

import { useState } from 'react';
import { AREAS } from '../engine/board';
import type { Terrain } from '../engine/board';
import { AREA_POSITIONS, BOARD_ASPECT } from '../engine/boardPositions';
import { areaLabel } from '../engine/describeArea';
import type { GameState } from '../engine/state';

const W = 1000;
const H = Math.round(W * BOARD_ASPECT);

const TERRAIN_FILL: Record<Terrain, string> = {
  desert: '#e3c281',
  minor_erg: '#efdca2',
  plateau: '#bd7b3f',
  mountain: '#8c7259',
};

function fillFor(id: string): string {
  const a = AREAS[id];
  if (!a?.terrain) return '#999';
  if (a.deep) return '#c08a3a'; // deep desert — darker sand
  return TERRAIN_FILL[a.terrain];
}

const xy = (id: string): [number, number] => {
  const p = AREA_POSITIONS[id];
  return p ? [p[0] * W, p[1] * H] : [0, 0];
};

/** A readable label box floating above an area dot (used for hover + selection). */
function LabelTip({ id, accent }: { id: string; accent?: boolean }) {
  const [cx, cy] = xy(id);
  const text = areaLabel(id);
  const fs = 17;
  const w = Math.max(40, text.length * fs * 0.56 + 12);
  const x = Math.min(W - w / 2, Math.max(w / 2, cx)); // clamp inside the viewBox
  const y = cy - 16;
  return (
    <g pointerEvents="none">
      <rect x={x - w / 2} y={y - fs} width={w} height={fs + 8} rx={4} fill={accent ? '#7a1d12' : '#2b2117'} opacity={0.92} />
      <text x={x} y={y} fontSize={fs} fill="#fff" textAnchor="middle" fontWeight={700}>{text}</text>
    </g>
  );
}

export interface BoardMapProps {
  /** Area to emphasize (gold pulse + label). */
  highlight?: string | null;
  /** Called when an area dot is clicked. */
  onSelect?: (id: string) => void;
  /** Optional game state to overlay pieces. */
  state?: GameState;
  /** When true, dots show a "pick" cursor (map is acting as an area picker). */
  picking?: boolean;
}

export function BoardMap({ highlight, onSelect, state, picking }: BoardMapProps) {
  const [hover, setHover] = useState<string | null>(null);
  const ids = Object.keys(AREA_POSITIONS);

  const legionByArea = new Map<string, { h: boolean; a: boolean }>();
  for (const l of state?.legions ?? []) {
    const e = legionByArea.get(l.area) ?? { h: false, a: false };
    if (l.faction === 'harkonnen') e.h = true;
    else e.a = true;
    legionByArea.set(l.area, e);
  }
  const sietchByArea = new Map(state?.sietches.map((s) => [s.area, s]) ?? []);
  const settlementByArea = new Map(state?.settlements.map((s) => [s.area, s]) ?? []);
  const wormAreas = new Set([
    ...(state?.wormsigns ?? []).map((w) => w.area),
    ...(state?.sandworms ?? []).map((w) => w.area),
  ]);
  const target = state?.targetSietchId ?? null;

  return (
    <svg
      className={`board-map${picking ? ' picking' : ''}`}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Board map"
    >
      <rect x={0} y={0} width={W} height={H} rx={10} fill="#f3e2bd" stroke="#d8c9aa" />

      {/* Target sietch halo (under markers) */}
      {target && AREA_POSITIONS[target] && (() => {
        const [cx, cy] = xy(target);
        return <circle cx={cx} cy={cy} r={15} fill="none" stroke="#d4a017" strokeWidth={3} strokeDasharray="4 3" />;
      })()}

      {/* Area dots */}
      {ids.map((id) => {
        const [cx, cy] = xy(id);
        const big = hover === id || highlight === id;
        return (
          <circle
            key={id}
            className="map-dot"
            cx={cx}
            cy={cy}
            r={big ? 11 : 8}
            fill={fillFor(id)}
            stroke={big ? '#7a1d12' : '#6b5a3c'}
            strokeWidth={big ? 2.2 : 1}
            onClick={() => onSelect?.(id)}
            onMouseEnter={() => setHover(id)}
            onMouseLeave={() => setHover((h) => (h === id ? null : h))}
          />
        );
      })}

      {/* Sietch & settlement markers */}
      {ids.map((id) => {
        const [cx, cy] = xy(id);
        const si = sietchByArea.get(id);
        const st = settlementByArea.get(id);
        if (!si && !st) return null;
        return (
          <g key={`m-${id}`} pointerEvents="none">
            {si && (
              <g opacity={si.destroyed ? 0.4 : 1}>
                <path d={`M ${cx} ${cy - 14} L ${cx + 7} ${cy - 6} L ${cx - 7} ${cy - 6} Z`} fill={si.destroyed ? '#888' : '#2f5d50'} stroke="#1a2e29" strokeWidth={0.7} />
                {si.destroyed && <line x1={cx - 8} y1={cy - 15} x2={cx + 8} y2={cy - 5} stroke="#7a1d12" strokeWidth={1.8} />}
              </g>
            )}
            {st && (
              <g opacity={st.destroyed ? 0.4 : 1}>
                <rect x={cx - 6} y={cy - 15} width={12} height={10} rx={1.5} fill={st.destroyed ? '#888' : '#8a2c1f'} stroke="#3a120c" strokeWidth={0.7} />
                <text x={cx} y={cy - 7} fontSize={8} fill="#fff" textAnchor="middle" fontWeight={700}>{st.rank}</text>
              </g>
            )}
          </g>
        );
      })}

      {/* Legion markers (red = Harkonnen, green = Atreides) */}
      {[...legionByArea.entries()].map(([id, e]) => {
        const [cx, cy] = xy(id);
        return (
          <g key={`lg-${id}`} pointerEvents="none">
            {e.h && <circle cx={e.a ? cx - 5 : cx} cy={cy + 12} r={5} fill="#b3261e" stroke="#fff" strokeWidth={1.2} />}
            {e.a && <circle cx={e.h ? cx + 5 : cx} cy={cy + 12} r={5} fill="#2f7d3a" stroke="#fff" strokeWidth={1.2} />}
          </g>
        );
      })}

      {/* Wormsign / sandworm dots */}
      {[...wormAreas].map((id) => {
        const [cx, cy] = xy(id);
        return <circle key={`w-${id}`} cx={cx + 10} cy={cy - 3} r={3} fill="#5b3b1a" pointerEvents="none" />;
      })}

      {/* Highlight pulse (selected/found area) */}
      {highlight && AREA_POSITIONS[highlight] && (() => {
        const [cx, cy] = xy(highlight);
        return (
          <circle cx={cx} cy={cy} r={13} fill="none" stroke="#d4a017" strokeWidth={3} pointerEvents="none">
            <animate attributeName="r" values="11;17;11" dur="1.4s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="1;0.3;1" dur="1.4s" repeatCount="indefinite" />
          </circle>
        );
      })()}

      {/* Label tips: the selected/highlighted area always, plus whatever is hovered */}
      {highlight && AREA_POSITIONS[highlight] && <LabelTip id={highlight} accent />}
      {hover && hover !== highlight && <LabelTip id={hover} />}
    </svg>
  );
}
