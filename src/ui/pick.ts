// A request from the editor to set some area-valued field by clicking the board map.

export type PickTarget =
  | { kind: 'legion'; index: number }
  | { kind: 'wormsign'; index: number }
  | { kind: 'sandworm'; index: number }
  | { kind: 'target' };

export function samePick(a: PickTarget | null, b: PickTarget | null): boolean {
  if (!a || !b || a.kind !== b.kind) return false;
  if (a.kind === 'target' || b.kind === 'target') return true;
  return a.index === (b as { index: number }).index;
}
