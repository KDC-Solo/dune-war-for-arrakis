// Clickable board map. Each area is its real outline traced from the board (boardShapes.ts, our own
// generated geometry — no copyrighted art is shipped), coloured by terrain. Optional game state
// overlays legions / sietches / settlements / target so the player can see where things are.
//
// Pan & zoom (dependency-free, Pointer Events): one-finger drag pans, two-finger pinch zooms,
// wheel zooms on desktop, and +/−/reset buttons work everywhere — so dots are tappable on phones.

import { useEffect, useRef, useState } from 'react';
import { AREAS, AIR_ZONES, IMPASSABLE } from '../engine/board';
import type { Terrain } from '../engine/board';
import { AREA_POSITIONS } from '../engine/boardPositions';
import { AREA_SHAPES, AIR_ZONE_DOTS } from '../engine/boardShapes';
import { areaLabel, airZoneLabel } from '../engine/describeArea';
import type { GameState } from '../engine/state';

const W = 1000;
// Render aspect (height/width). Matches the squarer DuneMapTool framing (1680×1174) rather than the
// wide source photo, which reads better and keeps the radial sectors balanced.
const MAP_ASPECT = 0.6988;
const H = Math.round(W * MAP_ASPECT);
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

// Marker/centroid position of an area (captured from the board, normalized 0..1). The area SHAPES
// come from boardShapes.ts; this is just where pieces/labels sit (always inside the traced polygon).
const xy = (id: string): [number, number] => {
  const p = AREA_POSITIONS[id];
  return p ? [p[0] * W, p[1] * H] : [0, 0];
};

const sectorOf = (id: string): string => AREAS[id]?.sector ?? 'np';

// A distinct, desert-toned hue per sector for the "by sector" view (radial-wedge clarity).
const SECTOR_FILL: Record<string, string> = {
  s1: '#cf6a4a', s2: '#d9913f', s3: '#c9b13b', s4: '#7fa64e',
  s5: '#4f9e86', s6: '#4e86b0', s7: '#7a6fb0', s8: '#b05f97', np: '#9c8550',
};
const POLAR_FILL = '#b8b1a4'; // the North Pole cap (grey, like the board's polar sink)
const AIR_ZONE_FILL = '#2563c9'; // ornithopter / carryall air-zone circles (blue — distinct from red walls)
const AIR_ZONE_R = 16; // board units, matching the printed board's circles

// Board geometry from the traced area outlines (boardShapes.ts, derived from docs/images/dune-map.png).
// Each area renders as its real polygon; impassable walls are the polygons' shared borders; air zones
// sit at the centroid of their member areas. Static → computed once at module load.
const GEO = (() => {
  const px = (poly: readonly (readonly [number, number])[]): [number, number][] => poly.map(([x, y]) => [x * W, y * H]);
  const toPath = (poly: [number, number][]) => 'M' + poly.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L') + ' Z';
  const polyOf: Record<string, [number, number][]> = {};
  const cells = Object.keys(AREA_SHAPES).map((id) => {
    const poly = px(AREA_SHAPES[id]);
    polyOf[id] = poly;
    return { id, d: toPath(poly), terrainFill: id === 'north_pole' ? POLAR_FILL : fillFor(id), sector: sectorOf(id) };
  });

  // min distance from point p to a closed polygon's outline
  const distToPoly = (p: [number, number], poly: [number, number][]) => {
    let m = Infinity;
    for (let i = 0; i < poly.length - 1; i++) {
      const a = poly[i], b = poly[i + 1];
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const L2 = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2));
      const d = Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
      if (d < m) m = d;
    }
    return m;
  };
  // shared border of two areas: the longest run of a's outline vertices that lie on b's outline
  const sharedBorder = (a: string, b: string): string | null => {
    const A = polyOf[a], B = polyOf[b];
    if (!A || !B) return null;
    const U = A.slice(0, -1); // unique vertices (outline is closed: last == first)
    const n = U.length;
    if (n < 2) return null;
    const near = U.map((p) => distToPoly(p, B) < 11);
    let bestStart = -1, bestLen = 0;
    for (let s = 0; s < n; s++) {
      if (!near[s] || (near[(s - 1 + n) % n] && bestStart !== -1)) continue;
      let len = 0;
      while (len < n && near[(s + len) % n]) len++;
      if (len > bestLen) { bestLen = len; bestStart = s; }
    }
    if (bestLen < 2) return null;
    const pts: [number, number][] = [];
    for (let i = 0; i < bestLen; i++) pts.push(U[(bestStart + i) % n]);
    return 'M' + pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' L');
  };
  // very short shared borders trace to <2 vertices → a small mark at the polygons' closest approach
  const closestMark = (a: string, b: string): string | null => {
    const A = polyOf[a], B = polyOf[b];
    if (!A || !B) return null;
    let best: [[number, number], [number, number]] | null = null, bd = Infinity;
    for (const p of A) for (const q of B) { const d = Math.hypot(p[0] - q[0], p[1] - q[1]); if (d < bd) { bd = d; best = [p, q]; } }
    if (!best || bd > 26) return null;
    const mx = (best[0][0] + best[1][0]) / 2, my = (best[0][1] + best[1][1]) / 2;
    const dx = best[1][0] - best[0][0], dy = best[1][1] - best[0][1], L = Math.hypot(dx, dy) || 1;
    const ux = (-dy / L) * 9, uy = (dx / L) * 9; // perpendicular, ±9px
    return `M${(mx + ux).toFixed(1)},${(my + uy).toFixed(1)} L${(mx - ux).toFixed(1)},${(my - uy).toFixed(1)}`;
  };
  const impassable = IMPASSABLE
    .map(([a, b]) => ({ d: sharedBorder(a, b) ?? sharedBorder(b, a) ?? closestMark(a, b) }))
    .filter((x): x is { d: string } => !!x.d);

  // Air-zone circles at the spots traced from the board (boardShapes.ts), same size as on the board.
  const airZones = AIR_ZONES.map((z) => {
    const dot = AIR_ZONE_DOTS[z.id];
    return dot ? { id: z.id, x: dot[0] * W, y: dot[1] * H } : null;
  }).filter((z): z is { id: string; x: number; y: number } => !!z);
  return { cells, impassable, airZones };
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
  // Fill cells by terrain (default) or by sector (radial-wedge clarity).
  const [colorBy, setColorBy] = useState<'terrain' | 'sector'>('terrain');
  // Blow the map up to a full-window overlay so it's easy to read (Esc / button to restore).
  const [maximized, setMaximized] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  // While maximized, lock page scroll and let Escape restore the inline size.
  useEffect(() => {
    if (!maximized) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMaximized(false);
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [maximized]);

  // Pan the located area to the centre of the viewport so it's unmistakable. We keep the current
  // zoom level (the player asked not to zoom in on locate) and just re-centre + emphasize.
  useEffect(() => {
    if (!focus) return;
    const p = AREA_POSITIONS[focus.id] ?? AIR_ZONE_DOTS[focus.id];
    if (!p) return;
    setView((v) => clampView({ k: v.k, tx: W / 2 - v.k * (p[0] * W), ty: H / 2 - v.k * (p[1] * H) }));
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
  // Area to name in the maximized header (no separate detail card is visible there).
  const active = hover ?? highlight ?? emphasis;

  return (
    <div className={`map-wrap${maximized ? ' maximized' : ''}`}>
      <div className="map-toolbar">
        {maximized && (
          <div className="map-active" aria-live="polite">
            {active ? (
              <>
                <strong>{areaLabel(active)}</strong>
                <span className="map-active-id">{active}</span>
              </>
            ) : (
              <span className="map-active-hint">Hover or tap an area</span>
            )}
          </div>
        )}
        <div className="map-colorby" role="group" aria-label="Colour cells by">
          <button type="button" className={colorBy === 'terrain' ? 'on' : ''} onClick={() => setColorBy('terrain')}>
            Terrain
          </button>
          <button type="button" className={colorBy === 'sector' ? 'on' : ''} onClick={() => setColorBy('sector')}>
            Sectors
          </button>
        </div>
        <div className="map-zoom">
          <button type="button" onClick={() => zoomBtn(1.4)} aria-label="Zoom in">+</button>
          <button type="button" onClick={() => zoomBtn(1 / 1.4)} aria-label="Zoom out">−</button>
          <button type="button" onClick={reset} aria-label="Reset zoom">⟲</button>
          <button
            type="button"
            className="map-max"
            onClick={() => setMaximized((m) => !m)}
            aria-label={maximized ? 'Restore map size' : 'Maximize map'}
            title={maximized ? 'Restore (Esc)' : 'Maximize'}
          >
            {maximized ? '🗗' : '⛶'}
          </button>
        </div>
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
          {/* Each area is its traced outline from the board (boardShapes.ts), filled by terrain — or
              by sector colour in Sectors view. These are the click/hover targets. */}
          {GEO.cells.map(({ id, d, terrainFill, sector }) => {
            const on = hover === id || highlight === id;
            const ok = !selectable || selectable(id);
            const fill = colorBy === 'sector' ? SECTOR_FILL[sector] : terrainFill;
            return (
              <path
                key={`c-${id}`}
                data-area={id}
                className="map-cell"
                d={d}
                fill={fill}
                stroke={on ? '#7a1d12' : '#3a2c18'}
                strokeWidth={on ? 2.4 : 1}
                vectorEffect="non-scaling-stroke"
                fillOpacity={on ? 1 : 0.95}
                opacity={ok ? 1 : 0.2}
                style={ok ? undefined : { pointerEvents: 'none' }}
                onClick={() => ok && tap(id)}
                onMouseEnter={() => ok && enter(id)}
                onMouseLeave={() => leave(id)}
              />
            );
          })}

          {/* Selected / located area — highlight the whole polygon (gold), not just a dot. An air
              zone (no polygon) pulses a gold ring around its circle instead. */}
          {(() => {
            const sel = emphasis ?? highlight;
            if (!sel) return null;
            const azDot = AIR_ZONE_DOTS[sel];
            if (azDot) {
              return (
                <circle cx={azDot[0] * W} cy={azDot[1] * H} r={AIR_ZONE_R + 5} fill="#f4c842" stroke="#d4a017" strokeWidth={4} vectorEffect="non-scaling-stroke" pointerEvents="none">
                  <animate attributeName="fill-opacity" values="0.5;0.15;0.5" dur="1.4s" repeatCount="indefinite" />
                </circle>
              );
            }
            const cell = GEO.cells.find((c) => c.id === sel);
            if (!cell) return null;
            return (
              <path d={cell.d} fill="#f4c842" stroke="#d4a017" strokeWidth={4} strokeLinejoin="round" vectorEffect="non-scaling-stroke" pointerEvents="none">
                <animate attributeName="fill-opacity" values="0.5;0.15;0.5" dur="1.4s" repeatCount="indefinite" />
              </path>
            );
          })()}

          {/* Impassable borders — a bold red mark (white-cased) along the two areas' shared edge. */}
          {GEO.impassable.map((b, i) => (
            <g key={`imp-${i}`} pointerEvents="none" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path d={b.d} stroke="#fff" strokeWidth={6} vectorEffect="non-scaling-stroke" />
              <path d={b.d} stroke="#c0182a" strokeWidth={3.5} vectorEffect="non-scaling-stroke" />
            </g>
          ))}

          {/* Air zones (ornithopter / carryall) — blue circles matching the board's size/position. */}
          {GEO.airZones.map((z) => (
            <circle
              key={z.id}
              cx={z.x}
              cy={z.y}
              r={AIR_ZONE_R}
              fill={AIR_ZONE_FILL}
              fillOpacity={0.92}
              stroke="#fff"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            >
              <title>Air zone {z.id}</title>
            </circle>
          ))}

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

          {/* Strong locate emphasis: dim the rest of the board and label the located area (the gold
              whole-area highlight above marks it). Cleared on first interaction. */}
          {emphasis && (() => {
            const azDot = AIR_ZONE_DOTS[emphasis];
            const cell = azDot ? null : GEO.cells.find((c) => c.id === emphasis);
            if (!azDot && !cell) return null;
            const [cx, cy] = azDot ? [azDot[0] * W, azDot[1] * H] : xy(emphasis);
            // The label is drawn in board units (no 1/k compensation), so it zooms in and out with
            // the map — readable at default zoom and larger as you zoom in.
            return (
              <g pointerEvents="none">
                <defs>
                  <mask id="focus-mask">
                    <rect x={0} y={0} width={W} height={H} fill="#fff" />
                    {cell ? <path d={cell.d} fill="#000" /> : <circle cx={cx} cy={cy} r={AIR_ZONE_R + 5} fill="#000" />}
                  </mask>
                </defs>
                <rect x={0} y={0} width={W} height={H} fill="#1c160d" opacity={0.42} mask="url(#focus-mask)" />
                <text
                  x={cx}
                  y={azDot ? cy + (AIR_ZONE_R + 16) : cy}
                  fontSize={24}
                  fontWeight={700}
                  fill="#3a2a12"
                  stroke="#fff"
                  strokeWidth={5}
                  paintOrder="stroke"
                  textAnchor="middle"
                >
                  {azDot ? airZoneLabel(emphasis) : areaLabel(emphasis)}
                </text>
              </g>
            );
          })()}
        </g>
      </svg>
    </div>
  );
}
