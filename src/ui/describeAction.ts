// Human-readable rendering of a resolved Harkonnen action (the instruction shown to the player).
// Pure & testable — no React. Turns a HarkonnenAction into a plain-English directive.

import { AREAS } from '../engine/board';
import type { HarkonnenAction } from '../engine/harkonnenActions';

/** Display label for an area: its proper name, or the positional id for unnamed areas. */
export function areaLabel(id: string): string {
  return AREAS[id]?.name ?? id;
}

function unitsPhrase(u: { regular: number; elite: number; special_elite: number }): string {
  const parts: string[] = [];
  if (u.regular) parts.push(`${u.regular} regular`);
  if (u.elite) parts.push(`${u.elite} elite`);
  if (u.special_elite) parts.push(`${u.special_elite} Sardaukar`);
  return parts.length ? parts.join(' + ') : 'no units';
}

/** A short headline for the action (for buttons / titles). */
export function actionHeadline(a: HarkonnenAction): string {
  switch (a.kind) {
    case 'attack_sietch':
      return 'Attack a sietch';
    case 'attack_legion':
      return 'Attack a legion';
    case 'move':
      return 'Move';
    case 'deploy':
      return 'Deploy';
    case 'mentat':
      return 'Mentat';
    case 'house_replace':
      return 'House — upgrade units';
    case 'house_place_vehicles':
      return 'House — place vehicles';
    case 'none':
      return 'No action';
  }
}

/** Full instruction text for the player to execute on the physical board. */
export function describeAction(a: HarkonnenAction): string {
  switch (a.kind) {
    case 'attack_sietch':
      return `Attack the sietch at ${areaLabel(a.sietch)} with the Harkonnen legion in ${areaLabel(
        a.attacker,
      )}${a.useOrnithopter ? ', using an ornithopter (troop-transport)' : ''}.`;
    case 'attack_legion':
      return `Attack the Atreides legion in ${areaLabel(a.defender)} with the Harkonnen legion in ${areaLabel(
        a.attacker,
      )}.`;
    case 'move':
      return `Move the Harkonnen legion from ${areaLabel(a.path[0])} to ${areaLabel(
        a.path[a.path.length - 1],
      )}.`;
    case 'deploy': {
      const lines = a.placements.map((p) => {
        const where = areaLabel(p.settlement);
        const units = unitsPhrase(p.units);
        const leader = p.leader ? ` and ${p.leader}` : '';
        return `${units}${leader} in ${where}`;
      });
      return `Deploy ${lines.join('; ')}.`;
    }
    case 'mentat':
      return 'Mentat: draw 2 planning cards (alternating House Harkonnen / Corrino Ally) and play them immediately.';
    case 'house_replace':
      return `House: replace ${a.count} regular unit${a.count === 1 ? '' : 's'} with elite${
        a.count === 1 ? '' : 's'
      } in the legion at ${areaLabel(a.legion)}.`;
    case 'house_place_vehicles':
      return 'House: place 2 vehicles (1 harvester + 1 ornithopter), following the vehicle-placement rules.';
    case 'none':
      return `No Harkonnen action is possible (${a.reason}).`;
  }
}
