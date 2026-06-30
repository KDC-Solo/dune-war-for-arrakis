import { geom, sectorAdj, crossVisible, phys, ADJ, IMP, sectorAreas, SECTOR, POS, key } from './geometry.mjs';

const FOCUS = (process.env.SEC || 's5,s4,s8').split(',');
const PIN = new Set(["splintered_rock","s2_6"]);
const inFocus = (id) => FOCUS.includes(SECTOR[id]) && !PIN.has(id);
const physPairsIn = (sec) => { const as = sectorAreas[sec]; const out = []; for (let i=0;i<as.length;i++) for (let j=i+1;j<as.length;j++) out.push([as[i],as[j]]); return out; };
// cross-sector physical pairs (passable ∪ impassable) with >=1 area in a focus sector
const crossPairs = (() => { const seen = new Set(), out = [];
  const add = (a,b) => { if (SECTOR[a]===SECTOR[b]) return; if (!inFocus(a)&&!inFocus(b)) return; const k=key(a,b); if (seen.has(k)) return; seen.add(k); out.push([a,b]); };
  for (const a in ADJ) for (const b of ADJ[a]) add(a,b);
  for (const [a,b] of IMP) add(a,b);
  return out;
})();

function score(over) {
  let miss = 0, extra = 0, crossMiss = 0;
  const g = geom(over);
  for (const sec of FOCUS) { const adj = sectorAdj(sec, over, g); for (const [a,b] of physPairsIn(sec)) { const k=key(a,b); const want=phys.has(k), have=adj.has(k); if (want&&!have) miss++; if (!want&&have) extra++; } }
  for (const [a,b] of crossPairs) { if (crossVisible(a,b,over,g) <= 8) crossMiss++; } // all crossPairs are physical (should touch)
  let disp = 0; for (const id in over) { const o = over[id], b = POS[id]; disp += Math.hypot(o[0]-b[0], o[1]-b[1]); }
  return { val: 2*miss + extra + 1.5*crossMiss + 6*disp, miss, extra, crossMiss, disp };
}

let best = { s5_5:[0.67,0.39], imperial_basin:[0.55,0.335], s5_1:[0.515,0.315], s4_11:[0.45,0.215], s4_3:[0.44,0.05], splintered_rock:[0.401,0.441], s2_6:[0.7565,0.837] };
function mismatchAreas(over) { const set = new Set(); const g = geom(over);
  for (const sec of FOCUS) { const adj = sectorAdj(sec, over, g); for (const [a,b] of physPairsIn(sec)) { const k=key(a,b); if (phys.has(k)!==adj.has(k)) { set.add(a); set.add(b); } } }
  for (const [a,b] of crossPairs) { if (crossVisible(a,b,over,g) <= 8) { if (inFocus(a)) set.add(a); if (inFocus(b)) set.add(b); } }
  return [...set].filter((id) => !PIN.has(id));
}
const CAP = 0.08;
const clampPos = (id, p) => { const b = POS[id]; const dx=Math.max(-CAP,Math.min(CAP,p[0]-b[0])), dy=Math.max(-CAP,Math.min(CAP,p[1]-b[1])); return [Math.max(0.02,Math.min(0.98,b[0]+dx)), Math.max(0.02,Math.min(0.98,b[1]+dy))]; };

let cur = { ...best }, curScore = score(cur); const start = curScore;
const offs = []; for (const s of [0.01,0.022,0.04]) for (const [dx,dy] of [[s,0],[-s,0],[0,s],[0,-s],[s,s],[-s,-s],[s,-s],[-s,s]]) offs.push([dx,dy]);
for (let restart = 0; restart < 6; restart++) {
  let movable = mismatchAreas(cur), improved = true, sweeps = 0;
  while (improved && sweeps < 14) { improved = false; sweeps++;
    for (const id of movable) { const base = cur[id] ?? POS[id]; let bestP = base, bestS = score(cur).val;
      for (const [dx,dy] of offs) { const np = clampPos(id,[base[0]+dx,base[1]+dy]); const s = score({...cur,[id]:np}).val; if (s < bestS-1e-6) { bestS=s; bestP=np; } }
      if (bestP !== base) { cur[id] = bestP; improved = true; } }
    movable = mismatchAreas(cur); }
  const sc = score(cur); if (sc.val < curScore.val) { curScore = sc; best = { ...cur }; }
  cur = { ...best }; for (const id of mismatchAreas(cur)) { const b = cur[id] ?? POS[id]; cur[id] = clampPos(id,[b[0]+(Math.random()-0.5)*0.05, b[1]+(Math.random()-0.5)*0.05]); }
}
const fin = score(best);
console.log('START  miss',start.miss,'extra',start.extra,'crossMiss',start.crossMiss,'val',start.val.toFixed(2));
console.log('RESULT miss',fin.miss,'extra',fin.extra,'crossMiss',fin.crossMiss,'val',fin.val.toFixed(2),'disp',fin.disp.toFixed(3));
const changed = {}; for (const id in best) { const b = POS[id]; if (!b || Math.hypot(best[id][0]-b[0],best[id][1]-b[1])>0.003) changed[id]=[+best[id][0].toFixed(4),+best[id][1].toFixed(4)]; }
console.log('OVERRIDES', JSON.stringify(changed));
