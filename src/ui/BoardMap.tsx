// Schematic, clickable board map. Areas are plotted from the captured normalized coordinates
// (boardPositions.ts) and colored by terrain — no copyrighted board art is shipped. Optional game
// state overlays legions / sietches / settlements / target so the player can see where things are.
//
// Pan & zoom (dependency-free, Pointer Events): one-finger drag pans, two-finger pinch zooms,
// wheel zooms on desktop, and +/−/reset buttons work everywhere — so dots are tappable on phones.

import { useEffect, useRef, useState } from 'react';
import { Delaunay } from 'd3-delaunay';
import { AREAS } from '../engine/board';
import type { Terrain } from '../engine/board';
import { AREA_POSITIONS, BOARD_ASPECT } from '../engine/boardPositions';
import { areaLabel } from '../engine/describeArea';
import type { GameState } from '../engine/state';

const W = 1000;
const H = Math.round(W * BOARD_ASPECT);
const MAX_K = 8;
const DRAG_THRESHOLD = 6; // px of movement before a press counts as a pan (not a tap)

const TERRAIN_FILL: Record<Terrain, string> = {
  desert: '#e3c281',
  minor_erg: '#efdca2',
  plateau: '#bd7b3f',
  mountain: '#6f5a40',
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

// Voronoi tessellation of the area centres — turns our captured points into filled, contiguous
// terrain cells that tile the board (our own generated geometry, no third-party art). Static, so
// it's computed once at module load rather than per render.
const CELLS: { id: string; d: string; fill: string }[] = (() => {
  const ids = Object.keys(AREA_POSITIONS);
  const delaunay = Delaunay.from(ids.map(xy));
  const voronoi = delaunay.voronoi([0, 0, W, H]);
  return ids.map((id, i) => ({ id, d: voronoi.renderCell(i), fill: fillFor(id) }));
})();

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

interface View {
  k: number;
  tx: number;
  ty: number;
}

/** Keep the scaled content covering the viewport (no dragging it fully off-screen). */
function clampView(v: View): View {
  const k = clamp(v.k, 1, MAX_K);
  return {
    k,
    tx: clamp(v.tx, W * (1 - k), 0),
    ty: clamp(v.ty, H * (1 - k), 0),
  };
}

const FOCUS_ZOOM = 3.2; // how far to zoom in when focusing a located area

export interface BoardMapProps {
  /** Area to emphasize (gold pulse + label). */
  highlight?: string | null;
  /** One-shot request to zoom/pan the view to an area (nonce makes repeat locates re-fire). */
  focus?: { id: string; nonce: number } | null;
  /** Called when an area dot is clicked (tap, not drag). */
  onSelect?: (id: string) => void;
  /** Called as the pointer enters/leaves a dot (id or null). Drives the info card. */
  onHover?: (id: string | null) => void;
  /** Optional game state to overlay pieces. */
  state?: GameState;
  /** When true, dots show a "pick" cursor (map is acting as an area picker). */
  picking?: boolean;
  /** When picking, which areas are valid targets (others are dimmed and not clickable). */
  selectable?: (id: string) => boolean;
}

export function BoardMap({ highlight, focus, onSelect, onHover, state, picking, selectable }: BoardMapProps) {
  const [hover, setHover] = useState<string | null>(null);
  const [view, setView] = useState<View>({ k: 1, tx: 0, ty: 0 });
  // Area to emphasize STRONGLY (veil + label) right after a locate/find — cleared on first
  // interaction so it doesn't get in the way while the player then explores the map.
  const [emphasis, setEmphasis] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Zoom & pan the located area to the centre of the viewport so it's unmistakable.
  useEffect(() => {
    if (!focus) return;
    const p = AREA_POSITIONS[focus.id];
    if (!p) return;
    const k = FOCUS_ZOOM;
    setView(clampView({ k, tx: W / 2 - k * (p[0] * W), ty: H / 2 - k * (p[1] * H) }));
    setEmphasis(focus.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.nonce]);

  // Active pointers and gesture bookkeeping (refs — no re-render during a drag).
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinch = useRef<{ dist: number; mid: [number, number] } | null>(null);
  const moved = useRef(0); // total movement of a single-pointer press (to tell tap from pan)

  const enter = (id: string) => { setHover(id); onHover?.(id); };
  const leave = (id: string) => setHover((h) => { if (h === id) { onHover?.(null); return null; } return h; });

  // Screen px → viewBox coords.
  const toSvg = (clientX: number, clientY: number): [number, number] => {
    const r = svgRef.current?.getBoundingClientRect();
    if (!r) return [0, 0];
    return [((clientX - r.left) / r.width) * W, ((clientY - r.top) / r.height) * H];
  };
  const pxToView = (dpx: number) => {
    const r = svgRef.current?.getBoundingClientRect();
    return r ? (dpx / r.width) * W : dpx;
  };

  const zoomAbout = (focalX: number, focalY: number, nextK: number) =>
    setView((v) => {
      const k = clamp(nextK, 1, MAX_K);
      return clampView({ k, tx: focalX - (focalX - v.tx) * (k / v.k), ty: focalY - (focalY - v.ty) * (k / v.k) });
    });

  const onPointerDown = (e: React.PointerEvent) => {
    setEmphasis(null); // the player is interacting now — drop the strong locate overlay
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved.current = 0;
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), mid: [(a.x + b.x) / 2, (a.y + b.y) / 2] };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const p = pointers.current.get(e.pointerId);
    if (!p) return;
    const prev = { ...p };
    p.x = e.clientX;
    p.y = e.clientY;

    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid: [number, number] = [(a.x + b.x) / 2, (a.y + b.y) / 2];
      const [fx, fy] = toSvg(mid[0], mid[1]);
      if (pinch.current.dist > 0) zoomAbout(fx, fy, view.k * (dist / pinch.current.dist));
      // pan by the midpoint shift
      const dmx = pxToView(mid[0] - pinch.current.mid[0]);
      const dmy = pxToView(mid[1] - pinch.current.mid[1]);
      setView((v) => clampView({ ...v, tx: v.tx + dmx, ty: v.ty + dmy }));
      pinch.current = { dist, mid };
      return;
    }

    if (pointers.current.size === 1) {
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      moved.current += Math.hypot(dx, dy);
      if (moved.current > DRAG_THRESHOLD) {
        setView((v) => clampView({ ...v, tx: v.tx + pxToView(dx), ty: v.ty + pxToView(dy) }));
      }
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  };

  const onWheel = (e: React.WheelEvent) => {
    const [fx, fy] = toSvg(e.clientX, e.clientY);
    zoomAbout(fx, fy, view.k * (e.deltaY < 0 ? 1.2 : 1 / 1.2));
  };

  const zoomBtn = (factor: number) => zoomAbout(W / 2, H / 2, view.k * factor);
  const reset = () => setView({ k: 1, tx: 0, ty: 0 });

  // Dots only fire onSelect for taps, not at the end of a pan.
  const tap = (id: string) => { if (moved.current <= DRAG_THRESHOLD) onSelect?.(id); };

  const legionByArea = new Map<string, { h: boolean; a: boolean }>();
  for (const l of state?.legions ?? []) {
    const en = legionByArea.get(l.area) ?? { h: false, a: false };
    if (l.faction === 'harkonnen') en.h = true;
    else en.a = true;
    legionByArea.set(l.area, en);
  }
  const sietchByArea = new Map(state?.sietches.map((s) => [s.area, s]) ?? []);
  const settlementByArea = new Map(state?.settlements.map((s) => [s.area, s]) ?? []);
  const wormAreas = new Set([
    ...(state?.wormsigns ?? []).map((w) => w.area),
    ...(state?.sandworms ?? []).map((w) => w.area),
  ]);
  const target = state?.targetSietchId ?? null;
  const ids = Object.keys(AREA_POSITIONS);

  return (
    <div className="map-wrap">
      <div className="map-zoom">
        <button type="button" onClick={() => zoomBtn(1.4)} aria-label="Zoom in">+</button>
        <button type="button" onClick={() => zoomBtn(1 / 1.4)} aria-label="Zoom out">−</button>
        <button type="button" onClick={reset} aria-label="Reset zoom">⟲</button>
      </div>
      <svg
        ref={svgRef}
        className={`board-map${picking ? ' picking' : ''}`}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Board map"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      >
        <rect x={0} y={0} width={W} height={H} rx={10} fill="#f3e2bd" stroke="#d8c9aa" />
        <g transform={`translate(${view.tx} ${view.ty}) scale(${view.k})`}>
          {/* Terrain cells (Voronoi of the area centres) — the filled, contiguous base map. Clicking
              anywhere in a cell selects that area, so the hit targets are large and easy to tap. */}
          {CELLS.map(({ id, d, fill }) => {
            const on = hover === id || highlight === id;
            const ok = !selectable || selectable(id);
            return (
              <path
                key={`c-${id}`}
                className="map-cell"
                d={d}
                fill={fill}
                stroke={on ? '#7a1d12' : '#9c8550'}
                strokeWidth={on ? 2.4 : 0.8}
                vectorEffect="non-scaling-stroke"
                fillOpacity={on ? 1 : 0.92}
                opacity={ok ? 1 : 0.2}
                style={ok ? undefined : { pointerEvents: 'none' }}
                onClick={() => ok && tap(id)}
                onMouseEnter={() => ok && enter(id)}
                onMouseLeave={() => leave(id)}
              />
            );
          })}

          {/* Target sietch halo (under markers) */}
          {target && AREA_POSITIONS[target] && (() => {
            const [cx, cy] = xy(target);
            return <circle cx={cx} cy={cy} r={15} fill="none" stroke="#d4a017" strokeWidth={3} strokeDasharray="4 3" />;
          })()}

          {/* Small centre dots mark each area (so adjacent same-terrain cells stay distinct).
              Non-interactive — the cells underneath handle clicks/hover. */}
          {ids.map((id) => {
            const [cx, cy] = xy(id);
            const on = hover === id || highlight === id;
            const ok = !selectable || selectable(id);
            return (
              <circle
                key={id}
                className="map-dot"
                cx={cx}
                cy={cy}
                r={(on ? 3.4 : 2.2) / Math.sqrt(view.k)}
                fill={on ? '#7a1d12' : '#4a3c28'}
                opacity={ok ? 0.85 : 0.2}
                pointerEvents="none"
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
                    <rect x={cx - 6} y={cy - 15} width={12} height={10} rx={1.5} fill={st.destroyed ? '#888' : '#8b1f30'} stroke="#3a120c" strokeWidth={0.7} />
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
                {e.h && <circle cx={e.a ? cx - 5 : cx} cy={cy + 12} r={5} fill="#9e2436" stroke="#fff" strokeWidth={1.2} />}
                {e.a && <circle cx={e.h ? cx + 5 : cx} cy={cy + 12} r={5} fill="#2f7d3a" stroke="#fff" strokeWidth={1.2} />}
              </g>
            );
          })}

          {/* Wormsign / sandworm dots */}
          {[...wormAreas].map((id) => {
            const [cx, cy] = xy(id);
            return <circle key={`w-${id}`} cx={cx + 10} cy={cy - 3} r={3} fill="#5b3b1a" pointerEvents="none" />;
          })}

          {/* Light highlight ring for a plainly selected area (constant on-screen size at any zoom) */}
          {highlight && highlight !== emphasis && AREA_POSITIONS[highlight] && (() => {
            const [cx, cy] = xy(highlight);
            const s = 1 / view.k;
            return (
              <circle cx={cx} cy={cy} r={13 * s} fill="none" stroke="#d4a017" strokeWidth={3 * s} pointerEvents="none">
                <animate attributeName="r" values={`${11 * s};${17 * s};${11 * s}`} dur="1.4s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="1;0.3;1" dur="1.4s" repeatCount="indefinite" />
              </circle>
            );
          })()}

          {/* Strong locate emphasis: dim the rest of the board, a bright pulsing ring, and a label,
              so a just-located area is unmistakable even on a crowded board. Cleared on interaction. */}
          {emphasis && AREA_POSITIONS[emphasis] && (() => {
            const [cx, cy] = xy(emphasis);
            const s = 1 / view.k; // keep ring/label a constant on-screen size at any zoom
            return (
              <g pointerEvents="none">
                <defs>
                  <mask id="focus-mask">
                    <rect x={0} y={0} width={W} height={H} fill="#fff" />
                    <circle cx={cx} cy={cy} r={40 * s} fill="#000" />
                  </mask>
                </defs>
                <rect x={0} y={0} width={W} height={H} fill="#1c160d" opacity={0.38} mask="url(#focus-mask)" />
                <circle cx={cx} cy={cy} r={20 * s} fill="none" stroke="#fff" strokeWidth={4 * s} opacity={0.9}>
                  <animate attributeName="r" values={`${14 * s};${24 * s};${14 * s}`} dur="1.3s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="1;0.25;1" dur="1.3s" repeatCount="indefinite" />
                </circle>
                <circle cx={cx} cy={cy} r={20 * s} fill="none" stroke="#d4a017" strokeWidth={2.4 * s}>
                  <animate attributeName="r" values={`${14 * s};${24 * s};${14 * s}`} dur="1.3s" repeatCount="indefinite" />
                </circle>
                <text
                  x={cx}
                  y={cy - 24 * s}
                  fontSize={13 * s}
                  fontWeight={700}
                  fill="#3a2a12"
                  stroke="#fff"
                  strokeWidth={3 * s}
                  paintOrder="stroke"
                  textAnchor="middle"
                >
                  {areaLabel(emphasis)}
                </text>
              </g>
            );
          })()}
        </g>
      </svg>
    </div>
  );
}
