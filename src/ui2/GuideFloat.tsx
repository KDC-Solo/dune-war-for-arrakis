// Floating shell for the guide bar (owner request 2026-07-05): the map keeps the whole stage
// and the guide hovers over it — draggable by its grip strip, collapsible to a small pill,
// with position and collapsed state persisted per device. Same float vocabulary as the
// Advisor (AdvisorFloat), but the guide drags from a dedicated grip because its body is full
// of buttons and scrollable phase panels.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from './icons';

const POS_KEY = 'dwfa.guidePos';
const MIN_KEY = 'dwfa.guideMin';

interface Pos {
  x: number;
  y: number;
}

function loadPos(): Pos | null {
  try {
    const v = JSON.parse(localStorage.getItem(POS_KEY) ?? 'null');
    return v && typeof v.x === 'number' && typeof v.y === 'number' ? v : null;
  } catch {
    return null;
  }
}

/** Keep the card fully inside its offset parent (the stage). */
function clamp(pos: Pos, card: HTMLElement): Pos {
  const parent = card.offsetParent as HTMLElement | null;
  if (!parent) return pos;
  return {
    x: Math.min(Math.max(0, pos.x), Math.max(0, parent.clientWidth - card.offsetWidth)),
    y: Math.min(Math.max(0, pos.y), Math.max(0, parent.clientHeight - card.offsetHeight)),
  };
}

export function GuideFloat({
  won,
  pill,
  wakeKey,
  children,
}: {
  won: boolean;
  /** Short label for the collapsed pill (the current step or phase). */
  pill: string;
  /** A collapsed guide auto-expands when this changes — new phase, directive, or map pick. */
  wakeKey: string;
  children: ReactNode;
}) {
  const [min, setMin] = useState(() => {
    try {
      return localStorage.getItem(MIN_KEY) === 'yes';
    } catch {
      return false;
    }
  });
  const [pos, setPos] = useState<Pos | null>(loadPos);
  const card = useRef<HTMLDivElement>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const lastWake = useRef(wakeKey);

  useEffect(() => {
    try {
      localStorage.setItem(MIN_KEY, min ? 'yes' : 'no');
    } catch {
      /* ignore */
    }
  }, [min]);
  // A stored position from a larger window could leave the card off-screen — clamp on mount.
  useEffect(() => {
    if (pos && card.current) setPos((p) => (p ? clamp(p, card.current!) : p));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // The guide is the flow's driver: when the game moves on, a collapsed guide wakes up.
  useEffect(() => {
    if (wakeKey !== lastWake.current) {
      lastWake.current = wakeKey;
      setMin(false);
    }
  }, [wakeKey]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!card.current) return;
    if ((e.target as HTMLElement).closest('button')) return; // the collapse button keeps its tap
    const r = card.current.getBoundingClientRect();
    const pr = (card.current.offsetParent as HTMLElement).getBoundingClientRect();
    drag.current = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    setPos(clamp({ x: r.left - pr.left, y: r.top - pr.top }, card.current));
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current || !card.current) return;
    const pr = (card.current.offsetParent as HTMLElement).getBoundingClientRect();
    setPos(clamp({ x: e.clientX - pr.left - drag.current.dx, y: e.clientY - pr.top - drag.current.dy }, card.current));
  };
  const onPointerUp = () => {
    if (!drag.current) return;
    drag.current = null;
    try {
      if (pos) localStorage.setItem(POS_KEY, JSON.stringify(pos));
    } catch {
      /* ignore */
    }
  };

  const style = pos
    ? { left: pos.x, top: pos.y, right: 'auto', bottom: 'auto', marginInline: 0 }
    : undefined;

  if (min) {
    return (
      <button
        className={`guide-pill${won ? ' won' : ''}`}
        style={style}
        onClick={() => setMin(false)}
        title="Show the guide"
      >
        <Icon name="leadership" size={14} /> <span>{pill}</span>
      </button>
    );
  }

  return (
    <div ref={card} className={`guide${won ? ' won' : ''}`} style={style}>
      <div
        className="guide-grip"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        title="Drag to move the guide"
      >
        <span className="grip-dots" aria-hidden>
          · · · ·
        </span>
        <button className="ap-close" onClick={() => setMin(true)} aria-label="Collapse the guide to a pill">
          –
        </button>
      </div>
      {children}
    </div>
  );
}
