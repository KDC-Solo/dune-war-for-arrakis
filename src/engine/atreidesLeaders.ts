// Atreides & Fremen Ally named leaders — captured from the physical leader cards
// (docs/images/attreides-card-*.jpg). The app doesn't run Atreides turns, so only what battles
// and the board state need is modeled: the name, deck, entry condition (reference text), and the
// combat strip (what one converted Special result yields).
//
// The Wild Maker is deliberately absent: it's the Shai-Hulud sandworm ally, not a legion leader
// (its card has rules text instead of a combat strip).

export interface AtreidesLeaderDef {
  name: string;
  faction: 'house_atreides' | 'fremen_ally';
  /** When the leader enters play (reference; the player runs their own side). */
  entry: string;
  /** Hits/shields granted when this leader converts 1 Special combat result. */
  combatAbility: { hits: number; shields: number };
}

export const ATREIDES_LEADERS: readonly AtreidesLeaderDef[] = [
  {
    name: 'Paul Atreides',
    faction: 'house_atreides',
    entry: 'In play at the start of the game.',
    combatAbility: { hits: 1, shields: 0 },
  },
  {
    name: 'Lady Jessica',
    faction: 'house_atreides',
    entry: 'In play at the start of the game.',
    combatAbility: { hits: 0, shields: 1 },
  },
  {
    name: 'Gurney Halleck',
    faction: 'house_atreides',
    entry: 'Enters play when any Smugglers Planning card is played.',
    combatAbility: { hits: 2, shields: 1 },
  },
  {
    name: 'Reverend Mother Jessica',
    faction: 'house_atreides',
    entry: 'Enters play when the Sand Dwellers marker reaches step 3 (replaces Lady Jessica).',
    combatAbility: { hits: 0, shields: 2 },
  },
  {
    name: 'Alia',
    faction: 'house_atreides',
    entry: 'Enters play when any prescience marker reaches step 6.',
    combatAbility: { hits: 1, shields: 0 },
  },
  {
    name: 'Stilgar',
    faction: 'fremen_ally',
    entry: 'In play at the start of the game.',
    combatAbility: { hits: 2, shields: 0 },
  },
  {
    name: 'Chani',
    faction: 'fremen_ally',
    entry: 'Enters play when the Jihad marker reaches step 3.',
    combatAbility: { hits: 1, shields: 1 },
  },
  {
    name: "Paul-Muad'Dib",
    faction: 'fremen_ally',
    entry: 'Enters play when the Kwisatz Haderach marker reaches step 3 (replaces Paul Atreides).',
    combatAbility: { hits: 2, shields: 1 },
  },
] as const;

const BY_NAME = new Map(ATREIDES_LEADERS.map((l) => [l.name, l]));

export function atreidesLeaderByName(name: string): AtreidesLeaderDef | undefined {
  return BY_NAME.get(name);
}

export const ATREIDES_LEADER_NAMES: readonly string[] = ATREIDES_LEADERS.map((l) => l.name);
