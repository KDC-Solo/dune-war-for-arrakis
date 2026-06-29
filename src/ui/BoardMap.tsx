// Schematic, clickable board map. Areas are plotted from the captured normalized coordinates
// (boardPositions.ts) and colored by terrain — no copyrighted board art is shipped. Optional game
// state overlays legions / sietches / settlements / target so the player can see where things are.
//
// Pan & zoom (dependency-free, Pointer Events): one-finger drag pans, two-finger pinch zooms,
// wheel zooms on desktop, and +/−/reset buttons work everywhere — so dots are tappable on phones.

import { useEffect, useRef, useState } from 'react';
import { Delaunay } from 'd3-delaunay';
import { AREAS, AIR_ZONES } from '../engine/board';
import type { Terrain } from '../engine/board';
import { AREA_POSITIONS } from '../engine/boardPositions';
import { areaLabel } from '../engine/describeArea';
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
const AIR_ZONE_FILL = '#e87aa0'; // ornithopter / carryall air-zone circles (pink)

// Voronoi tessellation of the area centres — turns our captured points into filled, contiguous
// cells that tile the board (our own generated geometry, no third-party art). We also derive the
// board's RADIAL sector structure as clean shapes: a quadrant cross + an inner/outer ring circle +
// a polar cap, so the 8 sectors (+ N. Pole) read as straight/circular divisions, not jagged edges.
// Static → computed once at module load.
const GEO = (() => {
  const ids = Object.keys(AREA_POSITIONS);

  // Radial centre = the North Pole area (where the four quadrant boards meet).
  const C: [number, number] = AREA_POSITIONS['north_pole'] ? xy('north_pole') : [W / 2, H / 2];
  const rad = (p: [number, number]) => Math.hypot(p[0] - C[0], p[1] - C[1]);
  const quadOf = (p: [number, number]) => `${p[1] < C[1] ? 'N' : 'S'}${p[0] < C[0] ? 'W' : 'E'}`;

  // Group area ids by sector; classify each non-polar sector into a quadrant (by majority of its
  // areas) and rank inner/outer within the quadrant by mean radius.
  const sectorAreas = new Map<string, string[]>();
  for (const id of ids) (sectorAreas.get(sectorOf(id)) ?? sectorAreas.set(sectorOf(id), []).get(sectorOf(id))!).push(id);
  const bySector = new Map<string, [number, number][]>();
  for (const [s, as] of sectorAreas) bySector.set(s, as.map(xy));
  const sInfo = [...bySector.entries()]
    .filter(([s]) => s !== 'np')
    .map(([s, ps]) => {
      const qc: Record<string, number> = {};
      for (const p of ps) qc[quadOf(p)] = (qc[quadOf(p)] ?? 0) + 1;
      const quad = Object.entries(qc).sort((a, b) => b[1] - a[1])[0][0];
      const mr = ps.reduce((t, p) => t + rad(p), 0) / ps.length;
      const cx = ps.reduce((t, p) => t + p[0], 0) / ps.length;
      const cy = ps.reduce((t, p) => t + p[1], 0) / ps.length;
      return { s, quad, mr, cx, cy };
    });
  const byQuad = new Map<string, typeof sInfo>();
  for (const it of sInfo) (byQuad.get(it.quad) ?? byQuad.set(it.quad, []).get(it.quad)!).push(it);
  for (const arr of byQuad.values()) arr.sort((a, b) => a.mr - b.mr);
  const ringSector: Record<string, { inner: string; outer: string }> = {};
  for (const [q, arr] of byQuad) ringSector[q] = { inner: arr[0].s, outer: (arr[1] ?? arr[0]).s };

  // Per-quadrant boundary radius: the inner mass bulges different amounts into each quadrant, so
  // r1 is computed PER quadrant (midpoint between that quadrant's inner sector's farthest area and
  // its outer sector's nearest area). The arcs therefore differ — they don't form one circle.
  const QUADS = ['NW', 'NE', 'SW', 'SE'] as const;
  const radsOf = (sectorId: string) => ids.filter((id) => sectorOf(id) === sectorId).map((id) => rad(xy(id)));
  const r1: Record<string, number> = {};
  for (const q of QUADS) {
    const inR = radsOf(ringSector[q]?.inner ?? 'np');
    const ouR = radsOf(ringSector[q]?.outer ?? 'np');
    r1[q] = (Math.max(...inR) + Math.min(...ouR)) / 2;
  }
  const innerSet = new Set(QUADS.map((q) => ringSector[q]?.inner).filter(Boolean));
  const innerAreas = ids.filter((id) => innerSet.has(sectorOf(id)));
  const r0 = Math.min(...innerAreas.map((id) => rad(xy(id)))) * 0.55;

  // Clean sector regions for the "Sectors" view: outer rect-quadrants, inner pie-wedges, polar cap.
  const ANG: Record<string, [number, number]> = {
    NE: [-Math.PI / 2, 0], SE: [0, Math.PI / 2], SW: [Math.PI / 2, Math.PI], NW: [Math.PI, (3 * Math.PI) / 2],
  };
  const RECT: Record<string, [number, number, number, number]> = {
    NW: [0, 0, C[0], C[1]], NE: [C[0], 0, W - C[0], C[1]],
    SW: [0, C[1], C[0], H - C[1]], SE: [C[0], C[1], W - C[0], H - C[1]],
  };
  const arcPt = (a: number, r: number): [number, number] => [C[0] + r * Math.cos(a), C[1] + r * Math.sin(a)];
  const pie = (q: string) => {
    const [a0, a1] = ANG[q];
    const [x0, y0] = arcPt(a0, r1[q]);
    const [x1, y1] = arcPt(a1, r1[q]);
    return `M${C[0]},${C[1]} L${x0},${y0} A${r1[q]},${r1[q]} 0 0,1 ${x1},${y1} Z`;
  };
  const regions: { d: string; fill: string }[] = [];
  for (const q of QUADS) {
    const [x, y, w, h] = RECT[q];
    regions.push({ d: `M${x},${y} h${w} v${h} h${-w} Z`, fill: SECTOR_FILL[ringSector[q]?.outer ?? 'np'] });
  }
  for (const q of QUADS) regions.push({ d: pie(q), fill: SECTOR_FILL[ringSector[q]?.inner ?? 'np'] });

  // Clip path per sector. Outer sectors = rect-quadrant MINUS the pie; inner sectors = the pie
  // wedge MINUS the polar cap (both even-odd) — so inner cells stop at the polar circle.
  const circle = (r: number) => `M${C[0] - r},${C[1]} a${r},${r} 0 1,0 ${2 * r},0 a${r},${r} 0 1,0 ${-2 * r},0 Z`;
  const sectorClip: Record<string, string> = {};
  for (const q of QUADS) {
    const [x, y, w, h] = RECT[q];
    if (ringSector[q]) {
      sectorClip[ringSector[q].outer] = `M${x},${y} h${w} v${h} h${-w} Z ${pie(q)}`;
      sectorClip[ringSector[q].inner] = `${pie(q)} ${circle(r0)}`;
    }
  }

  // Per-SECTOR Voronoi: tessellate each sector's region among only that sector's areas, so every
  // point in the region belongs to the nearest area IN that sector (no orphaned strips), cells fill
  // the whole region, and cross-sector-adjacent areas meet along the divider lines.
  const cells: { id: string; d: string; terrainFill: string; sector: string }[] = [];
  for (const [s, as] of sectorAreas) {
    if (s === 'np') continue;
    const seeds = as.map(xy);
    const pad: [number, number][] = seeds.length >= 2 ? seeds : [seeds[0], [seeds[0][0] + 0.01, seeds[0][1]]];
    const vor = Delaunay.from(pad).voronoi([0, 0, W, H]);
    as.forEach((id, i) => {
      const d = vor.renderCell(Math.min(i, pad.length - 1));
      if (d) cells.push({ id, d, terrainFill: fillFor(id), sector: s });
    });
  }

  // Per-quadrant boundary arcs (the divider lines, varying radius — not a single circle).
  const arcs = QUADS.map((q) => {
    const [a0, a1] = ANG[q];
    const [x0, y0] = arcPt(a0, r1[q]);
    const [x1, y1] = arcPt(a1, r1[q]);
    return `M${x0},${y0} A${r1[q]},${r1[q]} 0 0,1 ${x1},${y1}`;
  });

  // Air-zone circles (ornithopter/carryall), at the centroid of each zone's member areas.
  const airZones = AIR_ZONES.map((z) => {
    const ps = z.areas.map(xy);
    return {
      id: z.id,
      x: ps.reduce((t, p) => t + p[0], 0) / ps.length,
      y: ps.reduce((t, p) => t + p[1], 0) / ps.length,
    };
  });

  // Labels at each sector's centroid.
  const labels = [
    ...sInfo.map((it) => ({
      x: it.cx,
      y: it.cy,
      text: `${byQuad.get(it.quad)!.indexOf(it) === 0 ? 'Inner' : 'Outer'} ${it.quad}`,
    })),
    ...(bySector.has('np') ? [{ x: C[0], y: C[1] - r0 - 5, text: 'N. Pole' }] : []),
  ];

  const sectors = Object.keys(sectorClip);
  return { cells, regions, arcs, airZones, labels, sectorClip, sectors, C, r0 };
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
  // Fill cells by terrain (default) or by sector (radial-wedge clarity).
  const [colorBy, setColorBy] = useState<'terrain' | 'sector'>('terrain');
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
      <div className="map-toolbar">
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
          {/* Clip paths so each area's cell is bounded by its sector's clean region. */}
          <defs>
            {GEO.sectors.map((s) => (
              <clipPath key={`clip-${s}`} id={`sec-clip-${s}`} clipPathUnits="userSpaceOnUse">
                <path d={GEO.sectorClip[s]} clipRule="evenodd" />
              </clipPath>
            ))}
          </defs>

          {/* Terrain cells: a per-sector Voronoi clipped to the sector region, so cells fill the
              whole sector and never spill across a boundary. The cells are the click/hover targets. */}
          {GEO.sectors.map((s) => (
            <g key={`sg-${s}`} clipPath={`url(#sec-clip-${s})`}>
              {GEO.cells
                .filter((c) => c.sector === s)
                .map(({ id, d, terrainFill }) => {
                  const on = hover === id || highlight === id;
                  const ok = !selectable || selectable(id);
                  return (
                    <path
                      key={`c-${id}`}
                      className="map-cell"
                      d={d}
                      fill={terrainFill}
                      stroke={on ? '#7a1d12' : '#9c8550'}
                      strokeWidth={on ? 2.4 : 0.6}
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
            </g>
          ))}

          {/* Sectors view: clean radial region colours overlaid on the cells (non-interactive —
              clicks fall through to the cells underneath). */}
          {colorBy === 'sector' &&
            GEO.regions.map((r, i) => (
              <path key={`sr-${i}`} d={r.d} fill={r.fill} fillOpacity={0.9} pointerEvents="none" />
            ))}

          {/* North Pole: a clean circle at the centre (also the click target for that area). */}
          {(() => {
            const np = AREA_POSITIONS['north_pole'] ? 'north_pole' : null;
            const on = np && (hover === np || highlight === np);
            return (
              <circle
                className="map-cell"
                cx={GEO.C[0]}
                cy={GEO.C[1]}
                r={GEO.r0}
                fill={POLAR_FILL}
                stroke={on ? '#7a1d12' : '#2b2117'}
                strokeWidth={on ? 2.4 : 2}
                vectorEffect="non-scaling-stroke"
                onClick={() => np && tap(np)}
                onMouseEnter={() => np && enter(np)}
                onMouseLeave={() => np && leave(np)}
              />
            );
          })()}

          {/* Clean sector dividers: the quadrant cross + a per-quadrant inner/outer arc (each a
              different radius, not one circle) + the polar circle. Shown in both colour modes. */}
          <g pointerEvents="none" opacity={colorBy === 'sector' ? 1 : 0.7}>
            <line x1={GEO.C[0]} y1={0} x2={GEO.C[0]} y2={H} stroke="#2b2117" strokeWidth={2} vectorEffect="non-scaling-stroke" />
            <line x1={0} y1={GEO.C[1]} x2={W} y2={GEO.C[1]} stroke="#2b2117" strokeWidth={2} vectorEffect="non-scaling-stroke" />
            {GEO.arcs.map((d, i) => (
              <path key={`arc-${i}`} d={d} fill="none" stroke="#2b2117" strokeWidth={2} vectorEffect="non-scaling-stroke" />
            ))}
          </g>

          {/* Air zones (ornithopter / carryall) — pink circles at each zone's centroid. */}
          {GEO.airZones.map((z) => (
            <circle
              key={z.id}
              cx={z.x}
              cy={z.y}
              r={7 / Math.sqrt(view.k)}
              fill={AIR_ZONE_FILL}
              stroke="#8a2c4f"
              strokeWidth={1.4 / view.k}
              pointerEvents="none"
            >
              <title>Air zone {z.id}</title>
            </circle>
          ))}

          {/* Sector labels */}
          {GEO.labels.map(({ x, y, text }, i) => (
            <text
              key={`sl-${i}`}
              x={x}
              y={y}
              fontSize={11 / view.k}
              fontWeight={800}
              fill="#2b2117"
              stroke="#fff"
              strokeWidth={3 / view.k}
              paintOrder="stroke"
              textAnchor="middle"
              opacity={0.9}
              pointerEvents="none"
            >
              {text}
            </text>
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
