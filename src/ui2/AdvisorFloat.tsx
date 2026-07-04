// The Advisor's floating card: hovers over the stage (clearly Atreides-green, apart from the
// Harkonnen guide bar), draggable by its header so it never sits where the player is looking,
// and collapsible to a small pill. Position + collapsed state persist across sessions.

import { useEffect, useRef, useState } from 'react';
import type { AdvisorAdvice } from '../engine/atreidesAdvisor';
import { Icon } from './icons';
import { AreaRef } from './refs';

const POS_KEY = 'dwfa.advisorPos';
const MIN_KEY = 'dwfa.advisorMin';

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

export function AdvisorFloat({ advice }: { advice: AdvisorAdvice | null }) {
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

  if (!advice) return null;

  const onPointerDown = (e: React.PointerEvent) => {
    if (!card.current) return;
    // Buttons in the header (collapse) keep their tap; dragging starts anywhere else on it.
    if ((e.target as HTMLElement).closest('button')) return;
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

  const style = pos ? { left: pos.x, top: pos.y, right: 'auto' } : undefined;

  if (min) {
    return (
      <button
        className="advisor-float min"
        style={style}
        onClick={() => setMin(false)}
        title="Show the Advisor's suggested move"
      >
        <Icon name="prescience" size={14} /> Advisor
      </button>
    );
  }

  const sug = advice.suggestion;
  return (
    <div ref={card} className="advisor-float" style={style}>
      <div
        className="adv-head"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <Icon name="prescience" size={14} /> Advisor suggests
        <button className="ap-close" onClick={() => setMin(true)} aria-label="Collapse the advisor">
          –
        </button>
      </div>
      <p className="adv-text">
        {sug.kind === 'assault_settlement' ? (
          <>
            Assault the settlement at <AreaRef id={sug.area} /> with your legion in <AreaRef id={sug.from} />.
          </>
        ) : sug.kind === 'attack_legion' ? (
          <>
            Attack the Harkonnen legion in <AreaRef id={sug.area} /> with your legion in <AreaRef id={sug.from} />.
          </>
        ) : (
          <>
            Move your legion from <AreaRef id={sug.from} /> to <AreaRef id={sug.to} />.
          </>
        )}
      </p>
      <p className="adv-why">{advice.why}</p>
    </div>
  );
}
