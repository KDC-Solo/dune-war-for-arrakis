// Shared area-label helper used by both the engine (card effects) and the UI.
//
// Named areas show their proper name. Unnamed areas (the 73 `sX_n` deserts/ergs/etc.) used to show
// only their opaque id, which players can't find on the board. Instead we describe each by its
// terrain and the named landmark(s) it touches ("Deep desert by Gara Kulon") — players read those
// off the physical board. Where several unnamed areas ring the same landmark and would collide, we
// append the id as a disambiguator so dropdown options stay distinct.

import { AREAS, ADJACENCY } from './board';
import type { Area } from './board';

function terrainWord(a: Area): string {
  if (a.deep) return 'Deep desert';
  switch (a.terrain) {
    case 'desert':
      return 'Desert';
    case 'minor_erg':
      return 'Minor erg';
    case 'plateau':
      return 'Plateau';
    case 'mountain':
      return 'Mountain';
    default:
      return 'Area';
  }
}

const isNamed = (id: string): boolean => !!AREAS[id]?.name;

/** Nearest named areas to `id`: adjacent ones if any, else the closest via BFS. `dist` is hops. */
function nearestNamed(id: string): { dist: number; names: string[] } {
  const seen = new Set<string>([id]);
  let frontier = [id];
  let dist = 0;
  while (frontier.length) {
    dist++;
    const next: string[] = [];
    const found: string[] = [];
    for (const cur of frontier) {
      for (const nb of ADJACENCY[cur] ?? []) {
        if (seen.has(nb)) continue;
        seen.add(nb);
        if (isNamed(nb)) found.push(AREAS[nb].name as string);
        next.push(nb);
      }
    }
    if (found.length) return { dist, names: found.sort() };
    frontier = next;
  }
  return { dist: 0, names: [] };
}

function baseLabel(id: string): string {
  const a = AREAS[id];
  const terrain = terrainWord(a);
  const { dist, names } = nearestNamed(id);
  if (!names.length) return `${terrain} (${a.sector})`;
  const where = dist === 1 ? 'by' : 'near';
  return `${terrain} ${where} ${names.slice(0, 2).join(' & ')}`;
}

// Precompute labels once: build descriptive labels, then add the id to any that collide.
const LABELS: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  const base: Record<string, string> = {};
  const counts: Record<string, number> = {};
  for (const id of Object.keys(AREAS)) {
    if (isNamed(id)) continue;
    const b = baseLabel(id);
    base[id] = b;
    counts[b] = (counts[b] ?? 0) + 1;
  }
  for (const id of Object.keys(base)) {
    out[id] = counts[base[id]] > 1 ? `${base[id]} · ${id}` : base[id];
  }
  return out;
})();

/** Display label for an area: its proper name, or a locating description for unnamed areas. */
export function areaLabel(id: string): string {
  const a = AREAS[id];
  if (!a) return id;
  return a.name ?? LABELS[id] ?? id;
}
