// v2 icon set — ~24 original single-weight stroke glyphs (PRD §5.3), drawn for this project.
// One visual family for UI chrome and (eventually) the board stage. 24×24 viewBox, stroke =
// currentColor so icons inherit text color; always pair with a visible label in sheets.

import type { SVGProps } from 'react';

type G = { d: string[]; fill?: string[] };

const GLYPHS = {
  // --- action-die faces (original symbols, not the printed ones) -----------
  leadership: { d: ['M7 21V4', 'M7 4h10l-3.2 3.2L17 10.5H7'] }, // war banner
  strategy: { d: ['M4 20 18 6', 'M14 6h4v4', 'M20 20 6 6', 'M6 14v4h4'] }, // crossing strikes
  mentat: { d: ['M2.5 12c2.6-4.2 6-6.3 9.5-6.3s6.9 2.1 9.5 6.3c-2.6 4.2-6 6.3-9.5 6.3S5.1 16.2 2.5 12Z', 'M12 9.6v4.8', 'M9.6 12h4.8'] }, // calculating eye
  deployment: { d: ['M12 3v11', 'M8 10l4 4 4-4', 'M5 20h14'] }, // drop to ground
  house: { d: ['M6 21V9l6-4.5L18 9v12', 'M10 21v-5h4v5'] }, // great house hall
  // --- pieces ---------------------------------------------------------------
  trooper: { d: ['M12 4.4a2.6 2.6 0 1 1 0 5.2 2.6 2.6 0 0 1 0-5.2Z', 'M6.8 20v-3.6c0-2.6 2-4.2 5.2-4.2s5.2 1.6 5.2 4.2V20'] },
  elite: { d: ['M12 6.4a2.4 2.4 0 1 1 0 4.8 2.4 2.4 0 0 1 0-4.8Z', 'M7.2 20v-3.2c0-2.4 1.9-3.9 4.8-3.9s4.8 1.5 4.8 3.9V20', 'M9 4l3-2 3 2'] },
  specialElite: { d: ['M12 6.4a2.4 2.4 0 1 1 0 4.8 2.4 2.4 0 0 1 0-4.8Z', 'M7.2 20v-3.2c0-2.4 1.9-3.9 4.8-3.9s4.8 1.5 4.8 3.9V20', 'M12 1.4l.9 1.8 2 .3-1.45 1.4.35 2-1.8-.95-1.8.95.35-2L9.1 3.5l2-.3Z'] },
  leader: { d: ['M12 5a2.6 2.6 0 1 1 0 5.2A2.6 2.6 0 0 1 12 5Z', 'M6.8 20v-3.2c0-2.6 2-4.2 5.2-4.2s5.2 1.6 5.2 4.2V20', 'M8.5 3.5C10 2.2 14 2.2 15.5 3.5'] },
  token: { d: ['M12 3.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17Z', 'M7 16.5l9.5-9.5', 'M4.8 13l8-8', 'M11 19.3l8-8'] }, // facedown hatch
  // --- board features --------------------------------------------------------
  sietch: { d: ['M4 20v-6c0-5 3.6-8.4 8-8.4s8 3.4 8 8.4v6', 'M9.8 20v-3.4a2.2 2.6 0 0 1 4.4 0V20'] },
  settlement: { d: ['M5 20V8h2.6V5.6h2.6V8h3.6V5.6h2.6V8H19v12', 'M10 20v-4.4h4V20'] },
  harvester: { d: ['M4 10.5h11v6H4Z', 'M15 12l4.4-2.4v4L15 15.5', 'M4.6 18.6h9.8'] },
  ornithopter: { d: ['M12 8.5v9', 'M12 10 4 4.5M12 10l8-5.5', 'M12 13.5 6 10m6 3.5 6-3.5', 'M10.4 19h3.2'] }, // dragonfly wings
  carryall: { d: ['M3 9.5h18l-4 4H7Z', 'M12 13.5v4', 'M9.5 19.5h5'] },
  wormsign: { d: ['M3 14.5c2.5-4.5 5-4.5 7.5 0s5 4.5 7.5 0', 'M18.6 8.6h.01'] },
  sandworm: { d: ['M17.5 5.5A8 8 0 1 0 17.5 18.5L11.5 12Z', 'M8.6 9.6h.01'] }, // open maw
  spice: { d: ['M9 15.5a2.4 2.4 0 1 1 0 4.8 2.4 2.4 0 0 1 0-4.8Z', 'M15.5 13a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z', 'M12 9.5a1.7 1.7 0 1 1 0 3.4 1.7 1.7 0 0 1 0-3.4Z', 'M16.5 4.5l.6 1.5 1.5.6-1.5.6-.6 1.5-.6-1.5-1.5-.6 1.5-.6Z'] },
  storm: { d: ['M12 12m-1.6 0a1.6 1.6 0 1 0 3.2 0 1.6 1.6 0 1 0-3.2 0', 'M12 5.5A6.5 6.5 0 0 1 18.5 12', 'M12 18.5A6.5 6.5 0 0 1 5.5 12', 'M17 17a10 10 0 0 1-11.5 1.6M7 7a10 10 0 0 1 11.5-1.6'] },
  // --- tracks & seals ---------------------------------------------------------
  prescience: { d: ['M4.5 13c2.2-3.6 4.9-5.4 7.5-5.4s5.3 1.8 7.5 5.4c-2.2 3.6-4.9 5.4-7.5 5.4S6.7 16.6 4.5 13Z', 'M12 11.2a1.8 1.8 0 1 1 0 3.6 1.8 1.8 0 0 1 0-3.6Z', 'M12 2.5v2.6M6 4.5l1.6 2M18 4.5l-1.6 2'] },
  supremacy: { d: ['M6 20.5v-8.2c0-1.4.9-2.3 2.2-2.3H16c1.2 0 2 .8 2 2v8.5', 'M8.6 10V7.6M11.5 10V6.8M14.4 10V7.6', 'M18 14h1.8l-1.4 3H18'] }, // clenched fist
  ban: { d: ['M12 3.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17Z', 'M6 6l12 12'] },
  objective: { d: ['M12 3.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17Z', 'M12 7l3.5 5-3.5 5-3.5-5Z'] },
  // --- chrome -------------------------------------------------------------------
  undo: { d: ['M7.5 5.5 4 9l3.5 3.5', 'M4 9h10a6 6 0 0 1 0 12H9'] },
  map: { d: ['M4 6.5 9 4.5l6 2 5-2v13l-5 2-6-2-5 2Z', 'M9 4.5v13M15 6.5v13'] },
  log: { d: ['M7 3.5h10a2.5 2.5 0 0 1 0 5H7a2.5 2.5 0 0 1 0-5Z', 'M7 8.5V18a2.5 2.5 0 0 0 2.5 2.5H19V8.5', 'M11 12.5h5M11 16h5'] },
  settings: { d: ['M4 7.5h16M4 12h16M4 16.5h16', 'M9 5.7a1.8 1.8 0 1 1 0 3.6 1.8 1.8 0 0 1 0-3.6Z', 'M15 10.2a1.8 1.8 0 1 1 0 3.6 1.8 1.8 0 0 1 0-3.6Z', 'M8 14.7a1.8 1.8 0 1 1 0 3.6 1.8 1.8 0 0 1 0-3.6Z'] },
  sound: { d: ['M4.5 9.5v5H8l4.5 4v-13L8 9.5Z', 'M15.5 9.5a4.2 4.2 0 0 1 0 5', 'M17.8 7a8 8 0 0 1 0 10'] },
} satisfies Record<string, G>;

export type IconName = keyof typeof GLYPHS;
export const ICON_NAMES = Object.keys(GLYPHS) as IconName[];

export function Icon({
  name,
  size = 22,
  ...rest
}: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  const g = GLYPHS[name];
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={rest['aria-label'] ? undefined : true}
      {...rest}
    >
      {g.d.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}
