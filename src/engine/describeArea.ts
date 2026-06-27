// Tiny shared rendering helper used by both the engine (card effects) and the UI.

import { AREAS } from './board';

/** Display label for an area: its proper name, or the positional id for unnamed areas. */
export function areaLabel(id: string): string {
  return AREAS[id]?.name ?? id;
}
