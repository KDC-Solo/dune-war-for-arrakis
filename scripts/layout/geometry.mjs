// Offline layout tools for the schematic board map. Run from the repo root:
//   node scripts/layout/geometry.mjs report        # SEC=s5,s4,s8 to scope
//   node scripts/layout/optimize.mjs               # fit DISPLAY_POS nudges
// This replicates the adjacency-relevant geometry of src/ui/BoardMap.tsx (per-sector Voronoi +
// radial clip). If that render math changes, re-check this replica before trusting the optimizer:
// the oracle's verdict should match the rendered impassable walls / cell touches. The fitted
// positions live in DISPLAY_POS in BoardMap.tsx; objective = match the ADJACENCY∪IMPASSABLE graph.
import { readFileSync } from 'fs';
import { Delaunay } from 'd3-delaunay';

const W = 1000, H = Math.round(1000 * 0.6988);
const posSrc = readFileSync('src/engine/boardPositions.ts', 'utf8');
const boardSrc = readFileSync('src/engine/board.ts', 'utf8');
const POS = {};
for (const m of posSrc.matchAll(/"([a-z0-9_]+)":\s*\[([0-9.]+),\s*([0-9.]+)\]/g)) POS[m[1]] = [+m[2], +m[3]];
const SECTOR = {};
for (const m of boardSrc.matchAll(/"([a-z0-9_]+)":\s*\{[^}]*sector:\s*"([a-z0-9]+)"/g)) SECTOR[m[1]] = m[2];
const adjBlock = boardSrc.slice(boardSrc.indexOf('ADJACENCY'));
const ADJ = {};
for (const m of adjBlock.matchAll(/"([a-z0-9_]+)":\s*\[([^\]]*)\]/g)) if (!ADJ[m[1]]) ADJ[m[1]] = [...m[2].matchAll(/"([a-z0-9_]+)"/g)].map((x) => x[1]);
const impBlock = boardSrc.slice(boardSrc.indexOf('IMPASSABLE'), boardSrc.indexOf('AirZone'));
const IMP = [...impBlock.matchAll(/\["([a-z0-9_]+)",\s*"([a-z0-9_]+)"\]/g)].map((m) => [m[1], m[2]]);

const phys = new Set();
const key = (a, b) => [a, b].sort().join('|');
for (const a in ADJ) for (const b of ADJ[a]) phys.add(key(a, b));
for (const [a, b] of IMP) phys.add(key(a, b));

const ids = Object.keys(POS);
const sectorAreas = {};
for (const id of ids) (sectorAreas[SECTOR[id]] ??= []).push(id);
const QUADS = ['NW', 'NE', 'SW', 'SE'];

function geom(over) {
  const xy = (id) => { const p = over[id] ?? POS[id]; return [p[0] * W, p[1] * H]; };
  const C = xy('north_pole');
  const rad = (p) => Math.hypot(p[0] - C[0], p[1] - C[1]);
  const quadOf = (p) => `${p[1] < C[1] ? 'N' : 'S'}${p[0] < C[0] ? 'W' : 'E'}`;
  const sInfo = [];
  for (const s in sectorAreas) {
    if (s === 'np') continue;
    const ps = sectorAreas[s].map(xy);
    const qc = {}; for (const p of ps) qc[quadOf(p)] = (qc[quadOf(p)] ?? 0) + 1;
    const quad = Object.entries(qc).sort((a, b) => b[1] - a[1])[0][0];
    const mr = ps.reduce((t, p) => t + rad(p), 0) / ps.length;
    sInfo.push({ s, quad, mr });
  }
  const byQuad = {};
  for (const it of sInfo) (byQuad[it.quad] ??= []).push(it);
  for (const q in byQuad) byQuad[q].sort((a, b) => a.mr - b.mr);
  const ringSector = {};
  for (const q in byQuad) ringSector[q] = { inner: byQuad[q][0].s, outer: (byQuad[q][1] ?? byQuad[q][0]).s };
  const radsOf = (sec) => ids.filter((id) => SECTOR[id] === sec).map((id) => rad(xy(id)));
  const r1 = {};
  for (const q of QUADS) {
    const inn = ringSector[q]?.inner ?? 'np', out = ringSector[q]?.outer ?? 'np';
    const maxIn = Math.max(...radsOf(inn)), minOut = Math.min(...radsOf(out));
    r1[q] = maxIn + 0.8 * (minOut - maxIn);
  }
  const innerSet = new Set(QUADS.map((q) => ringSector[q]?.inner).filter(Boolean));
  const innerAreas = ids.filter((id) => innerSet.has(SECTOR[id]));
  const r0 = Math.min(...innerAreas.map((id) => rad(xy(id)))) * 0.55;
  const quadOfSec = {}, ringOfSec = {};
  for (const q of QUADS) { if (!ringSector[q]) continue; quadOfSec[ringSector[q].inner] = q; ringOfSec[ringSector[q].inner] = 'inner'; quadOfSec[ringSector[q].outer] = q; ringOfSec[ringSector[q].outer] = 'outer'; }
  const ANG = { NE: [-Math.PI/2, 0], SE: [0, Math.PI/2], SW: [Math.PI/2, Math.PI], NW: [Math.PI, 3*Math.PI/2] };
  const arcPt = (a, r) => [C[0] + r * Math.cos(a), C[1] + r * Math.sin(a)];
  return { xy, C, r1, r0, quadOfSec, ringOfSec, ANG, arcPt };
}

const inRegion = (sec, p, g) => {
  const q = g.quadOfSec[sec]; if (!q) return true;
  const r = Math.hypot(p[0] - g.C[0], p[1] - g.C[1]);
  return g.ringOfSec[sec] === 'inner' ? r >= g.r0 - 2 && r <= g.r1[q] + 2 : r >= g.r1[q] - 2;
};

// visible within-sector adjacency: Delaunay-adjacent AND shared-edge midpoint shows in the region
function sectorAdj(sec, over, g) {
  const as = sectorAreas[sec];
  const pts = as.map(g.xy);
  const d = Delaunay.from(pts);
  const vor = d.voronoi([0, 0, W, H]);
  const adj = new Set();
  for (let i = 0; i < as.length; i++) {
    const poly = vor.cellPolygon(i); if (!poly) continue;
    for (const j of d.neighbors(i)) {
      if (j < i) continue;
      const pa = pts[i], pb = pts[j];
      const eq = (p) => Math.abs(Math.hypot(p[0] - pa[0], p[1] - pa[1]) - Math.hypot(p[0] - pb[0], p[1] - pb[1]));
      for (let k = 0; k < poly.length - 1; k++) {
        const p = poly[k], q = poly[k + 1];
        if (eq(p) >= 2 || eq(q) >= 2) continue;
        // in-region length of this shared edge (matches the wall locus logic)
        const N = 20; let inLen = 0; const segL = Math.hypot(q[0] - p[0], q[1] - p[1]);
        for (let t = 0; t < N; t++) { const u = (t + 0.5) / N; const pt = [p[0] + u * (q[0] - p[0]), p[1] + u * (q[1] - p[1])]; if (inRegion(sec, pt, g)) inLen += segL / N; }
        if (inLen > 8) adj.add(key(as[i], as[j]));
        break;
      }
    }
  }
  return adj;
}

// nearest area within a sector to point p
function nearestInSector(sec, p, over) {
  const xy = (id) => { const q = over[id] ?? POS[id]; return [q[0] * W, q[1] * H]; };
  let best = null, bd = Infinity;
  for (const id of sectorAreas[sec]) { const q = xy(id); const d = (p[0]-q[0])**2 + (p[1]-q[1])**2; if (d < bd) { bd = d; best = id; } }
  return best;
}
// cross-sector visible adjacency: in-region length of the shared divider where a,b are each nearest
function crossVisible(a, b, over, g) {
  const xy = (id) => { const q = over[id] ?? POS[id]; return [q[0]*W, q[1]*H]; };
  const pa = xy(a), pb = xy(b), sa = SECTOR[a], sb = SECTOR[b], C = g.C;
  let locus = [];
  if ((pa[1] < C[1]) !== (pb[1] < C[1])) { for (let x = 60; x <= W-60; x += 5) locus.push([x, C[1]]); }
  else if ((pa[0] < C[0]) !== (pb[0] < C[0])) { for (let y = 60; y <= H-60; y += 5) locus.push([C[0], y]); }
  else { const q = `${pa[1]<C[1]?'N':'S'}${pa[0]<C[0]?'W':'E'}`; const R = g.r1[q]; const [lo,hi] = g.ANG[q]; for (let ang = lo; ang <= hi; ang += 0.012) locus.push(g.arcPt(ang, R)); }
  let inLen = 0;
  for (let i = 0; i < locus.length - 1; i++) {
    const p = locus[i];
    if (nearestInSector(sa, p, over) === a && nearestInSector(sb, p, over) === b && inRegion(sa, p, g) && inRegion(sb, p, g))
      inLen += Math.hypot(locus[i+1][0]-p[0], locus[i+1][1]-p[1]);
  }
  return inLen;
}
function mismatches(sec, over) {
  const g = geom(over);
  const adj = sectorAdj(sec, over, g);
  const as = sectorAreas[sec];
  const miss = [], extra = [];
  for (let i = 0; i < as.length; i++) for (let j = i + 1; j < as.length; j++) {
    const a = as[i], b = as[j], k = key(a, b);
    const want = phys.has(k), have = adj.has(k);
    if (want && !have) miss.push(`${a}~${b}`);
    if (!want && have) extra.push(`${a}~${b}`);
  }
  return { miss, extra };
}

const cmd = process.argv[2] || 'report';
if (cmd === 'report') {
  // current DISPLAY_POS (BoardMap.tsx) — should report ~0 within-sector mismatches
  const over = { splintered_rock: [0.401, 0.441], s2_6: [0.7565, 0.837], s5_1: [0.525, 0.325], s5_2: [0.5009, 0.4592], s5_3: [0.5103, 0.4936], s5_5: [0.67, 0.4], s5_9: [0.7624, 0.5759], arrakeen: [0.5566, 0.2874], broken_land: [0.4934, 0.2075], carthag: [0.4935, 0.2865], hole_in_the_rock: [0.5317, 0.4486], imperial_basin: [0.59, 0.375], rimwall_west: [0.6063, 0.256], shield_wall_1: [0.738, 0.4583], s4_3: [0.41, 0.04], s4_10: [0.396, 0.0933], s4_11: [0.428, 0.1791], s4_12: [0.171, 0.5642], arsunt: [0.4308, 0.2876], hagga_basin: [0.4216, 0.3874], s8_2: [0.3679, 0.4407], wind_pass: [0.3706, 0.5757] };
  for (const sec of (process.env.SEC ? process.env.SEC.split(',') : ['s5'])) {
    const m = mismatches(sec, over);
    console.log(`\n=== ${sec} === missing ${m.miss.length}, extra ${m.extra.length}`);
    console.log('MISSING:', m.miss.join(', ') || 'none');
    console.log('EXTRA  :', m.extra.join(', ') || 'none');
  }
}
export { geom, sectorAdj, mismatches, crossVisible, phys, ADJ, IMP, sectorAreas, SECTOR, POS, ids, inRegion, key, W, H };
