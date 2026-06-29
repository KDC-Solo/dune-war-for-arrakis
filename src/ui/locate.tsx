// "Locate" chips: any area label rendered through these jumps to the Board map and pulses the
// area, so the player can always see where a named area physically sits. The signal is provided by
// App via LocateContext and consumed by the Board map panel.

import { createContext, useContext } from 'react';
import { areaLabel } from '../engine/describeArea';

export type LocateFn = (areaId: string) => void;

/** App provides the setter; panels read it through useLocate. */
export const LocateContext = createContext<LocateFn | null>(null);

export function useLocate(): LocateFn {
  return useContext(LocateContext) ?? (() => {});
}

/** A single area label that, when clicked, highlights the area on the Board map. */
export function AreaChip({ id, label }: { id: string; label?: string }) {
  const locate = useLocate();
  return (
    <button
      type="button"
      className="area-chip"
      onClick={() => locate(id)}
      title="Show this area on the board map"
    >
      {label ?? areaLabel(id)}
    </button>
  );
}

/** A comma-separated (or custom-separated) list of area ids as locate chips. */
export function AreaChips({ ids, sep = ', ', empty = 'none' }: { ids: string[]; sep?: string; empty?: string }) {
  if (ids.length === 0) return <>{empty}</>;
  return (
    <>
      {ids.map((id, i) => (
        <span key={`${id}-${i}`}>
          {i > 0 && sep}
          <AreaChip id={id} />
        </span>
      ))}
    </>
  );
}
