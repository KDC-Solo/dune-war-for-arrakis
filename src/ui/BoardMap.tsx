// Clickable board map. Each area is its real outline traced from the board (boardShapes.ts, our own
// generated geometry — no copyrighted art is shipped), coloured by terrain. Optional game state
// overlays legions / sietches / settlements / target so the player can see where things are.
//
// Pan & zoom (dependency-free, Pointer Events): one-finger drag pans, two-finger pinch zooms,
// wheel zooms on desktop, and +/−/reset buttons work everywhere — so dots are tappable on phones.

import { useEffect, useRef, useState } from 'react';
import { AREAS, AIR_ZONES, IMPASSABLE } from '../engine/board';
import { unitCount } from '../engine/state';
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
  // Subdivide a closed outline so every segment is ≤ step px (denser vertices → smoother,
  // fuller shared-border traces than the raw polygon corners give).
  const densify = (poly: [number, number][], step = 9): [number, number][] => {
    const out: [number, number][] = [];
    for (let i = 0; i < poly.length - 1; i++) {
      const a = poly[i], b = poly[i + 1];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const k = Math.max(1, Math.ceil(L / step));
      for (let j = 0; j < k; j++) out.push([a[0] + ((b[0] - a[0]) * j) / k, a[1] + ((b[1] - a[1]) * j) / k]);
    }
    out.push(poly[poly.length - 1]);
    return out;
  };
  // shared border of two areas: the longest run of a's (densified) outline points on b's outline
  const sharedBorder = (a: string, b: string): string | null => {
    const A = polyOf[a], B = polyOf[b];
    if (!A || !B) return null;
    const U = densify(A).slice(0, -1); // unique vertices (outline is closed: last == first)
    const n = U.length;
    if (n < 2) return null;
    const near = U.map((p) => distToPoly(p, B) < 12);
    let bestStart = -1, bestLen = 0;
    for (let s = 0; s < n; s++) {
      if (!near[s] || (near[(s - 1 + n) % n] && bestStart !== -1)) continue;
      let len = 0;
      while (len < n && near[(s + len) % n]) len++;
      if (len > bestLen) { bestLen = len; bestStart = s; }
    }
    if (bestLen < 3) return null;
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

  const legionByArea = new Map<string, { h: number; a: number }>();
  for (const l of state?.legions ?? []) {
    const en = legionByArea.get(l.area) ?? { h: 0, a: 0 };
    const n = Math.max(1, unitCount(l) + l.leaders.length);
    if (l.faction === 'harkonnen') en.h += n;
    else en.a += n;
    legionByArea.set(l.area, en);
  }
  const sietchByArea = new Map(state?.sietches.map((s) => [s.area, s]) ?? []);
  const settlementByArea = new Map(state?.settlements.map((s) => [s.area, s]) ?? []);
  const harvesterByArea = new Map<string, number>();
  const zoneVehicles = new Map<string, { o: number; c: number }>();
  for (const v of state?.vehicles ?? []) {
    if (v.type === 'harvester') harvesterByArea.set(v.location, (harvesterByArea.get(v.location) ?? 0) + 1);
    else {
      const zv = zoneVehicles.get(v.location) ?? { o: 0, c: 0 };
      if (v.type === 'ornithopter') zv.o += 1;
      else zv.c += 1;
      zoneVehicles.set(v.location, zv);
    }
  }
  const sandwormAreas = new Set((state?.sandworms ?? []).map((w) => w.area));
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
        <defs>
          <filter id="sand-grain" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" stitchTiles="stitch" result="n" />
            <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.30  0 0 0 0 0.22  0 0 0 0 0.10  0 0 0 0.55 0" />
          </filter>
          <pattern id="deep-ripples" width="14" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(-12)">
            <path d="M0,5 Q3.5,2.4 7,5 T14,5" fill="none" stroke="#8a5c1e" strokeWidth="1.1" opacity="0.5" />
          </pattern>
        </defs>
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

          {/* Self-made sand texture: deep-desert ripple stipple, then a whisper of grain over
              everything (terrain view only — the sector view stays flat and readable). */}
          {colorBy === 'terrain' &&
            GEO.cells.map(({ id, d }) =>
              AREAS[id]?.deep ? <path key={`dd-${id}`} d={d} fill="url(#deep-ripples)" pointerEvents="none" /> : null,
            )}
          {colorBy === 'terrain' && (
            <rect x={0} y={0} width={W} height={H} filter="url(#sand-grain)" opacity={0.16} pointerEvents="none" />
          )}

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
              <path d={b.d} stroke="#fff" strokeWidth={7} vectorEffect="non-scaling-stroke" />
              <path d={b.d} stroke="#c0182a" strokeWidth={5} vectorEffect="non-scaling-stroke" />
              <path d={b.d} stroke="#fbf1df" strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
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
          {/* Ornithopters / carryalls in an air zone — own-drawn wing chevrons on the circle. */}
          {GEO.airZones.map((z) => {
            const zv = zoneVehicles.get(z.id);
            if (!zv || (zv.o === 0 && zv.c === 0)) return null;
            return (
              <g key={`zv-${z.id}`} transform={`translate(${z.x} ${z.y})`} pointerEvents="none">
                {zv.o > 0 && (
                  <g transform="translate(0 -3)">
                    <path d="M-4,1.6 L0,-2.2 L4,1.6 M0,-2.2 V2.6" fill="none" stroke="#fff" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
                    {zv.o > 1 && <text x={5.4} y={3} fontSize={6.5} fontWeight={700} fill="#fff">{zv.o}</text>}
                  </g>
                )}
                {zv.c > 0 && (
                  <g transform="translate(0 5)">
                    <path d="M-3.6,0 h7.2 M-2.4,-1.8 h4.8" fill="none" stroke="#ffe9a8" strokeWidth={1.5} strokeLinecap="round" />
                    {zv.c > 1 && <text x={5.4} y={2.4} fontSize={6.5} fontWeight={700} fill="#ffe9a8">{zv.c}</text>}
                  </g>
                )}
              </g>
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

          {/* Sietch (rock arch) & settlement (crenellated keep) — own-drawn silhouettes. */}
          {ids.map((id) => {
            const [cx, cy] = xy(id);
            const si = sietchByArea.get(id);
            const st = settlementByArea.get(id);
            if (!si && !st) return null;
            return (
              <g key={`m-${id}`} pointerEvents="none">
                {si && (
                  <g transform={`translate(${cx} ${cy - 9})`} opacity={si.destroyed ? 0.4 : 1}>
                    <path d="M-7,4 V0 Q-7,-5.5 0,-6.5 Q7,-5.5 7,0 V4 Z" fill={si.destroyed ? '#888' : '#2f5d50'} stroke="#1a2e29" strokeWidth={0.8} />
                    <path d="M-1.8,4 v-2.6 a1.8,2 0 0 1 3.6,0 V4 Z" fill="#12211d" />
                    {si.destroyed && <line x1={-8} y1={-6} x2={8} y2={4} stroke="#7a1d12" strokeWidth={1.8} />}
                  </g>
                )}
                {st && (
                  <g transform={`translate(${cx} ${cy - 10})`} opacity={st.destroyed ? 0.4 : 1}>
                    <path d="M-6,5 V-3 h2.2 v-2 h2.2 v2 h3.2 v-2 h2.2 v2 h2.2 V5 Z" fill={st.destroyed ? '#888' : '#8b1f30'} stroke="#3a120c" strokeWidth={0.8} />
                    <text x={0} y={3.6} fontSize={7} fill="#fff" textAnchor="middle" fontWeight={700}>{st.rank}</text>
                    {st.destroyed && <line x1={-7} y1={-5} x2={7} y2={5} stroke="#2b2117" strokeWidth={1.8} />}
                  </g>
                )}
              </g>
            );
          })}

          {/* Legions — own-drawn trooper silhouettes (maroon = Harkonnen, green = Atreides),
              with the stack's figure count beside the helmet. */}
          {[...legionByArea.entries()].map(([id, e]) => {
            const [cx, cy] = xy(id);
            const trooper = (dx: number, fill: string, n: number, key: string) => (
              <g key={key} transform={`translate(${cx + dx} ${cy + 12})`}>
                <circle cy={-4.4} r={2.3} fill={fill} stroke="#fff" strokeWidth={1} />
                <path d="M-3.4,4.6 V0.8 Q-3.4,-1.8 -1.4,-2.4 h2.8 Q3.4,-1.8 3.4,0.8 V4.6 Z" fill={fill} stroke="#fff" strokeWidth={1} />
                {n > 1 && (
                  <text x={4.6} y={4.4} fontSize={7} fontWeight={700} fill={fill} stroke="#fff" strokeWidth={2.2} paintOrder="stroke">{n}</text>
                )}
              </g>
            );
            return (
              <g key={`lg-${id}`} pointerEvents="none">
                {e.h > 0 && trooper(e.a > 0 ? -7 : 0, '#9e2436', e.h, 'h')}
                {e.a > 0 && trooper(e.h > 0 ? 7 : 0, '#2f7d3a', e.a, 'a')}
              </g>
            );
          })}

          {/* Harvesters — own-drawn tracked-crawler silhouette with its spice chute. */}
          {[...harvesterByArea.entries()].map(([id, n]) => {
            const [cx, cy] = xy(id);
            return (
              <g key={`hv-${id}`} transform={`translate(${cx - 11} ${cy - 2})`} pointerEvents="none">
                <rect x={-5} y={-3.4} width={10} height={5} rx={1} fill="#a67c2e" stroke="#5c4415" strokeWidth={0.9} />
                <path d="M5,-2.2 l3.2,-1.8 v3 L5,0 Z" fill="#5c4415" />
                <line x1={-5} y1={2.6} x2={5} y2={2.6} stroke="#3c2c0e" strokeWidth={2.2} strokeLinecap="round" />
                {n > 1 && (
                  <text x={0} y={-5} fontSize={6.5} fontWeight={700} fill="#5c4415" stroke="#fff" strokeWidth={2} paintOrder="stroke" textAnchor="middle">{n}</text>
                )}
              </g>
            );
          })}

          {/* Wormsigns (sand ripple) & sandworms (open-maw coil) — own-drawn. */}
          {[...wormAreas].map((id) => {
            const [cx, cy] = xy(id);
            if (sandwormAreas.has(id)) {
              return (
                <g key={`w-${id}`} transform={`translate(${cx + 11} ${cy - 4})`} pointerEvents="none">
                  <path d="M4.5,-2.6 A5,5 0 1 0 4.5,2.6 L0.8,0 Z" fill="#6b4a23" stroke="#3c2a12" strokeWidth={1} strokeLinejoin="round" />
                  <circle cx={-1.4} cy={-1.8} r={0.8} fill="#f4e3c2" />
                </g>
              );
            }
            return (
              <g key={`w-${id}`} transform={`translate(${cx + 11} ${cy - 4})`} pointerEvents="none">
                <path d="M-4.5,1.6 Q-2.2,-2.6 0,0 T4.5,-1.6" fill="none" stroke="#6b4a23" strokeWidth={2} strokeLinecap="round" />
              </g>
            );
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
