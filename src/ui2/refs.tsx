// Location chips: every area / air-zone name in v2 is tappable — it closes whatever sheet is
// open, pans the stage to the spot, and pulses it (BoardMap `focus`). One context, two chips.

import { createContext, useContext } from 'react';
import { areaLabel } from '../ui/describeAction';

export const StageFocusContext = createContext<(id: string) => void>(() => {});
export const useStageFocus = () => useContext(StageFocusContext);

/** Tappable area name — pans/pulses the stage. */
export function AreaRef({ id, label }: { id: string; label?: string }) {
  const focus = useStageFocus();
  return (
    <button type="button" className="loc-chip" onClick={() => focus(id)}>
      {label ?? areaLabel(id)}
    </button>
  );
}

/** Tappable air-zone name — pans/pulses the zone circle. */
export function AzRef({ id, label }: { id: string; label?: string }) {
  const focus = useStageFocus();
  return (
    <button type="button" className="loc-chip az" onClick={() => focus(id)}>
      {label ?? id}
    </button>
  );
}

export function AreaRefs({ ids }: { ids: readonly string[] }) {
  return (
    <>
      {ids.map((id, i) => (
        <span key={`${id}-${i}`}>
          {i > 0 && ', '}
          <AreaRef id={id} />
        </span>
      ))}
    </>
  );
}
