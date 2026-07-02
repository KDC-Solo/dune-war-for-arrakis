// A request from the editor to set some area-valued field by clicking the board map.

export type PickTarget =
  | { kind: "legion"; index: number }
  | { kind: "wormsign"; index: number }
  | { kind: "sandworm"; index: number }
  | { kind: "target" }
  | { kind: "move" };

export function samePick(a: PickTarget | null, b: PickTarget | null): boolean {
  if (!a || !b || a.kind !== b.kind) return false;
  if (a.kind === "target" || a.kind === "move") return true;
  return a.index === (b as { index: number }).index;
}
