import type { ReactNode } from 'react';

/**
 * Иконки атак: детализированные силуэты по типу оружия (наследуют цвет через
 * currentColor). Клинки и древковое нарисованы вертикально и поворачиваются на
 * 45°, луки/арбалеты/сеть/хлыст — как есть.
 */

const wrap = (children: ReactNode, key: string): ReactNode => <g key={key}>{children}</g>;

const grip = (y1: number, y2: number): ReactNode => (
  <g stroke="currentColor" strokeWidth={1.3} fill="none">
    <path d={`M10.9 ${y1}v${y2 - y1}h2.2v${y2 - y1}`} />
    <path d={`M10.9 ${y1 + 3}h2.2M10.9 ${y1 + 5}h2.2M10.9 ${y1 + 7}h2.2`} opacity={0.5} strokeWidth={0.9} />
  </g>
);

const blade = (top: number, bottom: number, halfWidth: number, fuller = true): ReactNode => (
  <g>
    <path d={`M12 ${top} L${12 + halfWidth} ${top + 3.2} V${bottom} H${12 - halfWidth} V${top + 3.2} Z`} fill="currentColor" />
    {fuller && <path d={`M12 ${top + 3}V${bottom - 1.5}`} stroke="rgba(0,0,0,0.35)" strokeWidth={0.9} />}
  </g>
);

const guard = (halfWidth: number, y: number): ReactNode => (
  <path d={`M${12 - halfWidth} ${y} H${12 + halfWidth}`} stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
);

const pommel = (y: number): ReactNode => (
  <g>
    <circle cx={12} cy={y} r={1.4} fill="currentColor" />
    <circle cx={12} cy={y} r={1.4} fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth={0.7} />
  </g>
);

const staffShaft = (top: number, bottom: number, width = 2): ReactNode => (
  <g>
    <rect x={12 - width / 2} y={top} width={width} height={bottom - top} rx={width / 2} fill="currentColor" />
    <path d={`M${12 - width / 2 + 0.5} ${top + 1}V${bottom - 1}`} stroke="rgba(0,0,0,0.3)" strokeWidth={0.8} />
  </g>
);

const spearhead = (top: number, height = 6): ReactNode => (
  <g>
    <path d={`M12 ${top} L14.6 ${top + height * 0.6} L12.9 ${top + height} L11.1 ${top + height} L9.4 ${top + height * 0.6} Z`} fill="currentColor" />
    <path d={`M12 ${top + 1.4}V${top + height - 0.6}`} stroke="rgba(0,0,0,0.35)" strokeWidth={0.9} />
  </g>
);

const ICONS: Record<string, ReactNode> = {
  dagger: (
    <g>
      {blade(2.5, 12, 1.6)}
      {guard(3.6, 12.6)}
      {grip(13.4, 19)}
      {pommel(20.6)}
    </g>
  ),
  shortsword: (
    <g>
      {blade(1.5, 13.5, 1.9)}
      {guard(4.2, 14.1)}
      {grip(14.8, 19.4)}
      {pommel(21)}
    </g>
  ),
  longsword: (
    <g>
      {blade(1, 15, 2.1)}
      {guard(5.2, 15.6)}
      {grip(16.4, 21)}
      {pommel(22.4)}
    </g>
  ),
  greatsword: (
    <g>
      <path d="M12 0.8 L15.1 4.6 V16 H8.9 V4.6 Z" fill="currentColor" />
      <path d="M12 3V14.5" stroke="rgba(0,0,0,0.35)" strokeWidth={1.1} />
      <path d="M12 6.5 L14 8 M12 10 L14 11.5" stroke="rgba(255,255,255,0.35)" strokeWidth={0.8} />
      <path d="M6.4 16.6 H17.6" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" />
      {grip(17.8, 22.4)}
      {pommel(23.4)}
    </g>
  ),
  rapier: (
    <g>
      <path d="M12 1.6 L13.2 4 V14 H10.8 V4 Z" fill="currentColor" />
      <path d="M12 3.2V13" stroke="rgba(0,0,0,0.3)" strokeWidth={0.7} />
      <path d="M8.6 14.4 C10 16.4 14 16.4 15.4 14.4" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
      <path d="M8.6 15.6 C10 17.4 14 17.4 15.4 15.6" fill="none" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round" opacity={0.7} />
      {grip(16.4, 20.6)}
      {pommel(21.8)}
    </g>
  ),
  scimitar: (
    <g>
      <path d="M12.4 1.4 C16.6 4.6 17.4 9.4 15 14.6 C14 16.6 12.6 17.6 11 18.2 L10 16.4 C13.4 14.6 15.4 11 14.6 7 C14.2 5.2 13.4 3.4 12.4 1.4 Z" fill="currentColor" />
      <path d="M13.4 3.6 C15.4 6.4 15.6 10 13.8 13.4" fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth={0.9} />
      <path d="M11 18.4 L9.4 19.6" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
      {grip(19.6, 23)}
    </g>
  ),
  sickle: (
    <g>
      <path d="M18.6 3.4 C13 2.6 7.6 6.2 7 12.2 C6.6 16.4 9 19.4 12.6 20.4 L13.4 18.2 C10.8 17.2 9.4 14.8 10 11.8 C10.8 7.6 14.4 5.4 18.6 6 Z" fill="currentColor" />
      <path d="M18.8 3.2 L19.6 6" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
      {grip(20, 23.4)}
    </g>
  ),
  handaxe: (
    <g>
      {staffShaft(4, 22.5, 2)}
      <path d="M12 3.4 C8.4 2.6 5.6 5 5.6 8.3 C5.6 11.6 8.4 13.6 12 12.8 Z" fill="currentColor" />
      <path d="M7 5.4 C8.6 4.6 10.4 5 11.4 6.4" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={0.9} />
      <path d="M12 5.4 L15.6 4.4 L15.6 8 L12 8.8 Z" fill="currentColor" opacity={0.85} />
    </g>
  ),
  battleaxe: (
    <g>
      {staffShaft(2.5, 23, 2.2)}
      <path d="M11.2 3.6 C7.4 2.2 4.2 4.8 4.2 8.4 C4.2 12 7.4 14.2 11.2 13 Z" fill="currentColor" />
      <path d="M12.8 3.6 C16.6 2.2 19.8 4.8 19.8 8.4 C19.8 12 16.6 14.2 12.8 13 Z" fill="currentColor" opacity={0.85} />
      <path d="M6.2 5.2 C8 4.2 9.8 4.8 10.8 6.4" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={0.9} />
      <circle cx={12} cy={23.2} r={1.2} fill="currentColor" />
    </g>
  ),
  greataxe: (
    <g>
      {staffShaft(1.5, 23.5, 2.6)}
      <path d="M10.4 2.6 C5.4 1.4 1.8 4.6 1.8 9 C1.8 13.4 5.4 16.2 10.4 14.6 Z" fill="currentColor" />
      <path d="M13.6 2.6 C18.6 1.4 22.2 4.6 22.2 9 C22.2 13.4 18.6 16.2 13.6 14.6 Z" fill="currentColor" opacity={0.85} />
      <path d="M4.6 4.4 C7 3 9.2 4 10 6.4" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={1} />
      <path d="M19.4 4.4 C17 3 14.8 4 14 6.4" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth={1} />
    </g>
  ),
  halberd: (
    <g>
      {staffShaft(3, 23.5, 2.2)}
      <path d="M12 0.8 L14 4 L12 12.4 L10 4 Z" fill="currentColor" />
      <path d="M11 4.6 C7 3.8 4.4 6.2 4.4 9.2 C4.4 12.2 7 14 11 13 Z" fill="currentColor" opacity={0.9} />
      <path d="M12.6 9.8 C15.4 10.4 16.6 12 16.2 14.4 L12.6 13.2 Z" fill="currentColor" />
      <path d="M6.6 6 C8.2 5.2 9.6 5.8 10.4 7.2" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={0.9} />
    </g>
  ),
  glaive: (
    <g>
      {staffShaft(5.5, 23.5, 2.2)}
      <path d="M12 0.8 C15.4 4.4 16.2 8.4 14.4 12.2 L12 14.4 L9.6 12.2 C7.8 8.4 8.6 4.4 12 0.8 Z" fill="currentColor" />
      <path d="M12 2.6 C14 5.4 14.4 8.2 13.2 11" fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth={1} />
    </g>
  ),
  pike: (
    <g>
      {staffShaft(4.5, 23.5, 2)}
      <path d="M12 0.6 L13.6 4 L12.6 9.6 L11.4 9.6 L10.4 4 Z" fill="currentColor" />
      <path d="M10.6 8.6 H13.4" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" />
    </g>
  ),
  spear: (
    <g>
      {staffShaft(6, 23.5, 2)}
      {spearhead(0.8, 7.4)}
      <path d="M10.4 9.4 C10.4 10.8 13.6 10.8 13.6 9.4" fill="none" stroke="currentColor" strokeWidth={1.1} />
    </g>
  ),
  javelin: (
    <g>
      {staffShaft(6.5, 23.5, 1.7)}
      {spearhead(1.4, 6.4)}
      <path d="M10.8 14.2 C11.6 15.2 12.4 15.2 13.2 14.2" fill="none" stroke="currentColor" strokeWidth={0.9} opacity={0.7} />
    </g>
  ),
  lance: (
    <g>
      <path d="M11.2 3 H12.8 L12.8 22.6 H11.2 Z" fill="currentColor" />
      <path d="M12 0.6 C13.8 2 14.2 4 12 6.4 C9.8 4 10.2 2 12 0.6 Z" fill="currentColor" />
      <path d="M9.6 12.4 H14.4" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
      <path d="M9.6 14 H14.4" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round" opacity={0.7} />
    </g>
  ),
  trident: (
    <g>
      {staffShaft(8, 23.5, 2.2)}
      <path d="M12 1 L13.2 3.4 V9.4 H10.8 V3.4 Z" fill="currentColor" />
      <path d="M5.8 3 L7 5.4 V9.4 H4.6 V5.4 Z" fill="currentColor" transform="translate(0 0.6)" />
      <path d="M18.2 3 L19.4 5.4 V9.4 H17 V5.4 Z" fill="currentColor" transform="translate(0 0.6)" />
      <path d="M5.2 9.8 H18.8" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
    </g>
  ),
  mace: (
    <g>
      {staffShaft(9.5, 23.5, 2)}
      <circle cx={12} cy={6.4} r={5.2} fill="currentColor" />
      <path d="M12 1.6V11.2 M7.2 6.4H16.8 M8.6 3 L15.4 9.8 M8.6 9.8 L15.4 3" stroke="rgba(0,0,0,0.28)" strokeWidth={0.9} />
      <circle cx={12} cy={6.4} r={2.2} fill="rgba(255,255,255,0.22)" />
    </g>
  ),
  morningstar: (
    <g>
      {staffShaft(10, 23.5, 2)}
      <circle cx={12} cy={6} r={4.4} fill="currentColor" />
      <path d="M12 0.2V2.6 M12 9.4V11.8 M6.2 6H8.6 M15.4 6H17.8 M8 1.6L9.8 3.4 M14.2 8.6L16 10.4 M16 1.6L14.2 3.4 M9.8 8.6L8 10.4" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round" />
      <path d="M10.4 4.4 C11.2 3.6 12.8 3.6 13.6 4.4" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth={0.9} />
    </g>
  ),
  club: (
    <g>
      <path d="M10.4 23.4 C10.4 17 10.8 13 11.4 9.4 C11.8 7 12.2 5 12.6 2.6 C13.6 3.6 14.6 5.2 15 7 C15.6 10 15.8 13.4 15.4 17.4 C15.2 19.8 14.6 21.8 14 23.4 Z" fill="currentColor" />
      <path d="M12.4 4.4 C13.4 7 13.8 10.4 13.6 13.8" fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth={0.9} />
      <path d="M12.2 20.4 H14.6" stroke="rgba(255,255,255,0.3)" strokeWidth={0.9} />
    </g>
  ),
  greatclub: (
    <g>
      <path d="M9.4 23.6 C9.6 16.4 10 12.4 10.8 8.6 C11.2 6.2 11.6 3.8 11.8 0.8 C13.6 1.6 15.4 4 15.8 6.8 C16.4 10.6 16.2 14 15.6 17.6 C15.2 20 14.4 22 13.6 23.6 Z" fill="currentColor" />
      <path d="M11.6 3.4 C12.8 6.6 13.4 10.4 13.2 14.4" fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth={1} />
      <path d="M10.6 12.4 C11.8 12 13.2 12 14.2 12.4 M10.6 17.6 C11.8 17.2 13.2 17.2 14.2 17.6" stroke="rgba(255,255,255,0.22)" strokeWidth={0.9} />
    </g>
  ),
  quarterstaff: (
    <g>
      {staffShaft(2, 23, 2.2)}
      <path d="M9.6 9.6 H14.4 M9.6 11.2 H14.4 M9.6 12.8 H14.4 M9.6 14.4 H14.4" stroke="rgba(0,0,0,0.3)" strokeWidth={0.8} />
      <path d="M9.6 9.2 H14.4 M9.6 15.2 H14.4" stroke="rgba(255,255,255,0.2)" strokeWidth={0.8} />
    </g>
  ),
  warhammer: (
    <g>
      {staffShaft(4, 23.5, 2.2)}
      <path d="M4.6 2.6 H19.4 V8.6 H4.6 Z" fill="currentColor" />
      <path d="M12.6 4 C14.8 4 16.6 4.8 17.8 6.2 L17.8 8.6 H12.6 Z" fill="rgba(0,0,0,0.25)" />
      <path d="M6.4 4.2 H10 V7" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth={0.9} />
      <path d="M19.4 3.4 L22 2 L22 9.2 L19.4 7.8 Z" fill="currentColor" />
    </g>
  ),
  maul: (
    <g>
      {staffShaft(6.5, 23.5, 2.6)}
      <path d="M3.6 1.6 H20.4 V11.6 H3.6 Z" fill="currentColor" />
      <path d="M12.8 2.4 H19.6 V10.8 H12.8 Z" fill="rgba(0,0,0,0.22)" />
      <path d="M5.4 3.4 H11 V9.8 H5.4 Z" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth={1} />
      <path d="M5.4 6.6 H11" stroke="rgba(255,255,255,0.22)" strokeWidth={0.9} />
    </g>
  ),
  flail: (
    <g>
      <rect x={10.9} y={13.4} width={2.2} height={9.6} rx={1.1} fill="currentColor" />
      <circle cx={12} cy={12} r={1.1} fill="currentColor" />
      <path d="M12 11.4 C12 10.4 12.6 10 12 9.2 C11.4 10 12 10.4 12 11.4" fill="none" stroke="currentColor" strokeWidth={1} />
      <path d="M12 9.4 C12 7.6 13.2 6.8 12 5.2 C10.8 6.8 12 7.6 12 9.4" fill="none" stroke="currentColor" strokeWidth={1.2} />
      <circle cx={12} cy={3.6} r={3.2} fill="currentColor" />
      <path d="M12 -0.2V1.2 M12 6V7.4 M8.6 3.6H10 M14 3.6H15.4 M9.6 1.2L10.6 2.2 M13.4 5L14.4 6 M14.4 1.2L13.4 2.2 M10.6 5L9.6 6" stroke="currentColor" strokeWidth={1} strokeLinecap="round" />
    </g>
  ),
  warpick: (
    <g>
      {staffShaft(4.5, 23.5, 2.2)}
      <path d="M12 2.4 L14.4 4.2 L14.4 9 L12 10 Z" fill="currentColor" />
      <path d="M11.4 3.4 C7.6 3.6 5.4 5.6 5 8.6 C7.4 8.4 9.6 8 11.4 7 Z" fill="currentColor" />
      <path d="M6.4 7 C8 6.6 9.6 6.2 11 5.6" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth={0.8} />
      <path d="M13 3.8 C15.4 4.6 16.6 6 16.4 8" fill="none" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round" />
    </g>
  ),
  whip: (
    <g>
      <path d="M5.2 20.8 C4.6 21.4 4 21.6 3.4 21.4 C4.6 20.6 5.4 19.6 5.8 18.4 L7.6 19.6 C7 20 6.2 20.2 5.2 20.8 Z" fill="currentColor" />
      <path d="M5.8 18.4 C9 16.4 12.4 17.4 14.6 15 C16.4 13 15.6 10.6 17.4 8.6 C19 6.8 20.6 7 22 6.2" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
      <path d="M6.4 19.6 L8.2 20.8" stroke="rgba(0,0,0,0.3)" strokeWidth={0.8} />
      <path d="M14.6 15 C16 13.6 16 12.2 16.4 10.8" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth={0.9} />
    </g>
  ),
  net: (
    <g>
      <circle cx={12} cy={12} r={9.4} fill="none" stroke="currentColor" strokeWidth={1.4} />
      <path d="M12 2.6 L21.4 12 L12 21.4 L2.6 12 Z" fill="none" stroke="currentColor" strokeWidth={1} opacity={0.9} />
      <path d="M6.6 3.8 L20.2 17.4 M3.8 6.6 L17.4 20.2 M17.4 3.8 L3.8 17.4 M20.2 6.6 L6.6 20.2" stroke="currentColor" strokeWidth={0.8} opacity={0.75} />
      <path d="M12 8.4 L15.6 12 L12 15.6 L8.4 12 Z" fill="currentColor" opacity={0.35} />
    </g>
  ),
  sling: (
    <g>
      <path d="M4 21 C4 15.6 7 12 12 12 C17 12 20 15.6 20 21" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
      <path d="M12 12 V6.4" stroke="currentColor" strokeWidth={1.5} />
      <path d="M10 5 C10.8 3.8 13.2 3.8 14 5 C13.2 6.2 10.8 6.2 10 5 Z" fill="currentColor" />
      <circle cx={12} cy={16.6} r={2.2} fill="currentColor" />
      <path d="M4 21 H20" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" />
    </g>
  ),
  dart: (
    <g>
      <path d="M12 2 L13.4 4.4 L12 7 L10.6 4.4 Z" fill="currentColor" />
      <rect x={11.4} y={7} width={1.2} height={9.6} rx={0.6} fill="currentColor" />
      <path d="M12 16.6 L14.4 20.4 L12 22.6 L9.6 20.4 Z" fill="currentColor" />
      <path d="M12 3.4V15" stroke="rgba(0,0,0,0.3)" strokeWidth={0.8} />
    </g>
  ),
  blowgun: (
    <g>
      <rect x={9.6} y={1.4} width={4.8} height={21.2} rx={2.4} fill="currentColor" />
      <rect x={10.8} y={2.6} width={2.4} height={18.8} rx={1.2} fill="rgba(255,255,255,0.25)" />
      <path d="M12 4.2 V20" stroke="rgba(0,0,0,0.35)" strokeWidth={0.9} />
      <circle cx={12} cy={2.8} r={1} fill="rgba(0,0,0,0.4)" />
    </g>
  ),
  longbow: (
    <g>
      <path d="M8.4 1.6 C17.6 5 17.6 19 8.4 22.4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
      <path d="M8.4 1.6 L8.4 22.4" stroke="currentColor" strokeWidth={0.8} opacity={0.8} />
      <path d="M8.4 9.4 H19" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round" />
      <path d="M19 9.4 L21.6 8.2 L21.6 10.6 Z" fill="currentColor" />
      <path d="M6.6 10.4 C5.6 11.2 5.6 12.8 6.6 13.6" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
    </g>
  ),
  shortbow: (
    <g>
      <path d="M9.4 4.4 C16 7 16 17 9.4 19.6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
      <path d="M9.4 4.4 L9.4 19.6" stroke="currentColor" strokeWidth={0.8} opacity={0.8} />
      <path d="M9.4 10.4 H18.2" stroke="currentColor" strokeWidth={1.1} strokeLinecap="round" />
      <path d="M18.2 10.4 L20.6 9.4 L20.6 11.4 Z" fill="currentColor" />
      <path d="M7.8 11.2 C7 11.8 7 12.8 7.8 13.4" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" />
    </g>
  ),
  crossbow: (
    <g>
      <path d="M2 17.6 L16.4 11.4 L20 13 L20.6 14.8 L17.6 16.6 L18.8 21 L16.6 22 L14 17.4 L4 21.6 Z" fill="currentColor" />
      <path d="M8.6 3.6 C11.8 6.2 11.8 8.6 11.4 11.6 M15 3.6 C12.8 6.2 12.6 8.6 13 11.6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
      <path d="M8.6 3.6 L15 3.6" stroke="currentColor" strokeWidth={1.2} />
      <path d="M12.2 4 V12.4" stroke="currentColor" strokeWidth={1.1} strokeLinecap="round" />
      <path d="M12.2 12.4 L15.6 11.6 L15.6 13.4 Z" fill="currentColor" />
    </g>
  ),
  handcrossbow: (
    <g>
      <path d="M4 15.6 L14 11.4 L17 12.6 L17.4 14 L15 15.2 L15.8 19.4 L14 20.2 L12.2 15.8 L5.6 18.6 Z" fill="currentColor" />
      <path d="M9.4 4.4 C11.8 6.6 11.8 8.6 11.4 11 M14 4.4 C12.4 6.6 12.2 8.6 12.6 11" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" />
      <path d="M9.4 4.4 L14 4.4" stroke="currentColor" strokeWidth={1.1} />
      <path d="M11.8 4.8 V11.8" stroke="currentColor" strokeWidth={1} strokeLinecap="round" />
    </g>
  ),
  bite: (
    <g>
      <path d="M3.4 5.2 C8 2.6 16 2.6 20.6 5.2 L19.4 8.4 C16 6.8 8 6.8 4.6 8.4 Z" fill="currentColor" />
      <path d="M3.4 18.8 C8 21.4 16 21.4 20.6 18.8 L19.4 15.6 C16 17.2 8 17.2 4.6 15.6 Z" fill="currentColor" />
      <path d="M6.6 6.6 L8.4 11.4 L10.2 6.6 Z" fill="currentColor" />
      <path d="M13.8 6.6 L15.6 11.4 L17.4 6.6 Z" fill="currentColor" />
      <path d="M6.6 17.4 L8.4 12.6 L10.2 17.4 Z" fill="currentColor" opacity={0.85} />
      <path d="M13.8 17.4 L15.6 12.6 L17.4 17.4 Z" fill="currentColor" opacity={0.85} />
    </g>
  ),
  claws: (
    <g>
      <path d="M6 3.6 C4.4 9.4 5.4 15.4 8.6 21.6 L10.8 20.6 C8 15 7.2 9.6 8.2 4.4 Z" fill="currentColor" />
      <path d="M10.6 3 C9.4 9.2 10.4 15.6 13.4 21.8 L15.6 20.8 C12.8 15.2 12 9.4 12.8 4 Z" fill="currentColor" />
      <path d="M15.4 3.6 C14.8 9.6 15.8 15.6 18.6 21.4 L20.6 20.2 C18 14.8 17.2 9.6 17.8 4.6 Z" fill="currentColor" />
    </g>
  ),
  sting: (
    <g>
      <path d="M12 1 L14 5.6 L12 22 L10 5.6 Z" fill="currentColor" />
      <path d="M10 5.6 H14" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" />
      <path d="M12 8.6 V18" stroke="rgba(0,0,0,0.3)" strokeWidth={0.9} />
      <circle cx={12} cy={4.6} r={1.8} fill="currentColor" />
    </g>
  ),
  gore: (
    <g>
      <path d="M8.6 6.6 C4.6 5.4 2.6 7.4 2.6 11 C2.6 14.6 5 16.4 8.6 15.6 Z" fill="currentColor" />
      <path d="M15.4 6.6 C19.4 5.4 21.4 7.4 21.4 11 C21.4 14.6 19 16.4 15.4 15.6 Z" fill="currentColor" />
      <path d="M9.6 5.2 C10.4 3 13.6 3 14.4 5.2 L13.4 8.2 H10.6 Z" fill="currentColor" opacity={0.9} />
      <path d="M12 8.2 V21" stroke="currentColor" strokeWidth={1.2} opacity={0.6} />
    </g>
  ),
  tail: (
    <g>
      <path d="M20.4 4.6 C14 4.4 8.4 7.6 6.4 13 C4.8 17.4 6.6 21 10.6 22 C14 22.8 16.8 21 17.6 18.4 C18.2 16.4 17.4 14.6 15.6 13.6" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" />
      <path d="M20.4 2 L22 4.6 L20.4 7.2 Z" fill="currentColor" />
      <path d="M17.6 18.4 C16.4 16.8 14.6 16.4 13 17.2" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth={1} />
    </g>
  ),
  tentacle: (
    <g>
      <path d="M12 1.6 C15.6 1.6 17.6 4.4 16.6 8 C15.4 12.4 11.4 14.8 11.6 18.4 C11.7 20.2 12.8 21.2 14.2 21.4" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" />
      <path d="M12 1.6 C9 1.6 7.4 3.6 7.8 6.4 C8.2 9.2 10.4 10.6 10.4 13.2" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" opacity={0.7} />
      <circle cx={11.4} cy={5.4} r={1.4} fill="currentColor" />
      <circle cx={13.8} cy={9.4} r={1.1} fill="currentColor" opacity={0.8} />
    </g>
  ),
  spit: (
    <g>
      <path d="M12 2.4 C16 7 18 11 18 14.6 C18 18.4 15.2 21.6 12 21.6 C8.8 21.6 6 18.4 6 14.6 C6 11 8 7 12 2.4 Z" fill="currentColor" />
      <path d="M10.6 12 C10.6 13.6 11 15 12 16.2" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={1.1} strokeLinecap="round" />
      <circle cx={9.4} cy={17.6} r={1.2} fill="currentColor" opacity={0.7} />
    </g>
  ),
  fist: (
    <g>
      <path d="M6.2 10.8 V9.2 A1.7 1.7 0 0 1 9.6 9.2 V10.8 M9.6 10.8 V8.2 A1.7 1.7 0 0 1 13 8.2 V10.8 M13 10.8 V8.6 A1.7 1.7 0 0 1 16.4 8.6 V10.8" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" />
      <path d="M6.2 10.8 H16.4 A2.6 2.6 0 0 1 19 13.4 V14.6 A5.4 5.4 0 0 1 13.6 20 H11.6 A5.4 5.4 0 0 1 6.2 14.6 Z" fill="currentColor" />
      <path d="M8.4 13.4 C9 15 10 16.2 11.6 16.8" fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth={1} strokeLinecap="round" />
    </g>
  ),
  default: (
    <g>
      <path d="M12 1.6 L14.4 4.6 V15 H9.6 V4.6 Z" fill="currentColor" />
      <path d="M7.2 15.6 H16.8" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
      <path d="M11 16.6 H13 V21 H11 Z" fill="currentColor" />
      <circle cx={12} cy={22} r={1.2} fill="currentColor" />
    </g>
  ),
};

/** Название атаки (RU/EN) → тип иконки. */
export function weaponIconId(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('hand crossbow') || n.includes('handcrossbow') || n.includes('ручн') && n.includes('арбалет')) return 'handcrossbow';
  if (n.includes('арбалет') || n.includes('crossbow')) return 'crossbow';
  if (n.includes('blowgun') || n.includes('духов')) return 'blowgun';
  if (n.includes('longbow') || n.includes('длинн') && n.includes('лук')) return 'longbow';
  if (n.includes('лук') || n.includes('bow')) return 'shortbow';
  if (n.includes('sling') || n.includes('пращ')) return 'sling';
  if (n.includes('dart') || n.includes('дротик')) return 'dart';
  if (n.includes('net') || n.includes('сеть') || n.includes('сетк')) return 'net';
  if (n.includes('whip') || n.includes('хлыст') || n.includes('кнут')) return 'whip';
  if (n.includes('trident') || n.includes('трезуб')) return 'trident';
  if (n.includes('lance') || n.includes('ланц') || n.includes('ланс')) return 'lance';
  if (n.includes('halberd') || n.includes('алебард')) return 'halberd';
  if (n.includes('glaive') || n.includes('глеф')) return 'glaive';
  if (n.includes('pike') || n.includes('пика') || n.includes('пики')) return 'pike';
  if (n.includes('javelin') || n.includes('джавелин') || n.includes('метательн') && n.includes('копь')) return 'javelin';
  if (n.includes('spear') || n.includes('копь') || n.includes('рогатин')) return 'spear';
  if (n.includes('war pick') || n.includes('warpick') || n.includes('клев') || n.includes('кирк')) return 'warpick';
  if (n.includes('flail') || n.includes('кистень') || n.includes('цеп')) return 'flail';
  if (n.includes('morningstar') || n.includes('моргенштерн') || n.includes('звезд')) return 'morningstar';
  if (n.includes('maul') || n.includes('кувалд') || n.includes('двуручн') && n.includes('молот')) return 'maul';
  if (n.includes('warhammer') || n.includes('hammer') || n.includes('молот')) return 'warhammer';
  if (n.includes('mace') || n.includes('булав')) return 'mace';
  if (n.includes('greatclub') || n.includes('большая дубин') || n.includes('дубина')) return 'greatclub';
  if (n.includes('club') || n.includes('дубин') || n.includes('палиц')) return 'club';
  if (n.includes('quarterstaff') || n.includes('посох') || n.includes('staff')) return 'quarterstaff';
  if (n.includes('greataxe') || n.includes('двуручн') && n.includes('топор')) return 'greataxe';
  if (n.includes('handaxe') || n.includes('метательн') && n.includes('топор')) return 'handaxe';
  if (n.includes('топор') || n.includes('секир') || n.includes('axe')) return 'battleaxe';
  if (n.includes('sickle') || n.includes('серп')) return 'sickle';
  if (n.includes('scimitar') || n.includes('ятаган') || n.includes('сабл')) return 'scimitar';
  if (n.includes('rapier') || n.includes('рапир') || n.includes('шпаг')) return 'rapier';
  if (n.includes('greatsword') || n.includes('двуручн') && n.includes('меч')) return 'greatsword';
  if (n.includes('shortsword') || n.includes('коротк') && n.includes('меч')) return 'shortsword';
  if (n.includes('меч') || n.includes('sword')) return 'longsword';
  if (n.includes('кинжал') || n.includes('нож') || n.includes('dagger') || n.includes('стилет')) return 'dagger';
  if (n.includes('когот') || n.includes('когт') || n.includes('царап') || n.includes('claw')) return 'claws';
  if (n.includes('укус') || n.includes('паст') || n.includes('зуб') || n.includes('bite')) return 'bite';
  if (n.includes('жал') || n.includes('sting')) return 'sting';
  if (n.includes('рог') || n.includes('таран') || n.includes('gore')) return 'gore';
  if (n.includes('хвост') || n.includes('tail')) return 'tail';
  if (n.includes('щупальц') || n.includes('tentacle')) return 'tentacle';
  if (n.includes('плев') || n.includes('слюн') || n.includes('spit')) return 'spit';
  if (n.includes('кулак') || n.includes('безоруж') || n.includes('fist') || n.includes('slam') || n.includes('удар') || n.includes('unarmed') || n.includes('strike')) return 'fist';
  return 'default';
}

/** Вертикальные типы поворачиваем по диагонали (как держат оружие). */
const DIAGONAL = new Set([
  'dagger',
  'shortsword',
  'longsword',
  'greatsword',
  'rapier',
  'scimitar',
  'sickle',
  'handaxe',
  'battleaxe',
  'greataxe',
  'halberd',
  'glaive',
  'pike',
  'spear',
  'javelin',
  'lance',
  'trident',
  'mace',
  'morningstar',
  'club',
  'greatclub',
  'quarterstaff',
  'warhammer',
  'maul',
  'flail',
  'warpick',
  'sting',
  'default',
]);

export default function WeaponIcon({ name, className }: { name: string; className?: string }) {
  const id = weaponIconId(name);
  const content = ICONS[id] ?? ICONS.default;
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {DIAGONAL.has(id) ? wrap(<g transform="rotate(45 12 12)">{content}</g>, id) : content}
    </svg>
  );
}
