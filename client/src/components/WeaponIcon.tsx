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

/** Ровный ряд зубьев: одинаковый шаг, ширина и направление (пасти, капканы). */
const teeth = (x0: number, x1: number, count: number, y: number, dir: 1 | -1, h: number, color: string, key: string): ReactNode[] =>
  Array.from({ length: count }, (_, i) => {
    const step = (x1 - x0) / count;
    const w = step * 0.6;
    const cx = x0 + step * (i + 0.5);
    return (
      <path
        key={`${key}${i}`}
        d={`M${(cx - w / 2).toFixed(2)} ${y} L${cx.toFixed(2)} ${y + dir * h} L${(cx + w / 2).toFixed(2)} ${y} Z`}
        fill={color}
      />
    );
  });

/** Клык, торчащий из челюсти: треугольник с заданным остриём. */
const fang = (x: number, y: number, tipX: number, tipY: number, w: number, color: string, stroke?: string): ReactNode => (
  <path
    d={`M${x - w / 2} ${y} L${tipX} ${tipY} L${x + w / 2} ${y} Z`}
    fill={color}
    {...(stroke ? { stroke, strokeWidth: 0.4 } : {})}
  />
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
    <g stroke="none">
      <defs>
        <linearGradient id="wdS" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#9aa3ad" />
          <stop offset="0.42" stopColor="#5c646d" />
          <stop offset="1" stopColor="#2b3037" />
        </linearGradient>
        <linearGradient id="wdM" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#c9ccd1" />
          <stop offset="1" stopColor="#565c63" />
        </linearGradient>
        <linearGradient id="wdL" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a2a1c" />
          <stop offset="1" stopColor="#16100a" />
        </linearGradient>
        <linearGradient id="wdG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c9ccd1" />
          <stop offset="0.5" stopColor="#8f959c" />
          <stop offset="1" stopColor="#565c63" />
        </linearGradient>
      </defs>
      <g transform="translate(0 24) scale(1 -1)">
        <path d="M12 3 L13.3 6.4 V13.4 H10.7 V6.4 Z" fill="url(#wdS)" stroke="#0a0e13" strokeWidth={0.5} />
        <path d="M12 6.6 V12.6" stroke="rgba(0,0,0,0.35)" strokeWidth={0.55} />
        <path d="M11.3 6.6 V12.6" stroke="rgba(220,228,238,0.35)" strokeWidth={0.35} />
        <rect x={9} y={12.55} width={6} height={1.7} rx={0.85} fill="url(#wdS)" stroke="#0a0e13" strokeWidth={0.4} />
        <circle cx={12} cy={13.4} r={0.8} fill="#b03a3a" stroke="#0a0e13" strokeWidth={0.3} />
        <rect x={10.7} y={14.3} width={2.6} height={5.1} rx={1.2} fill="url(#wdL)" stroke="#0a0e13" strokeWidth={0.4} />
        <rect x={10.7} y={14.3} width={0.8} height={5.1} rx={0.4} fill="rgba(255,235,200,0.14)" />
        {[0, 1, 2].map((i) => (
          <path key={i} d={`M10.9 ${15.2 + i * 1.1} L13.1 ${14.8 + i * 1.1}`} stroke="rgba(20,10,4,0.5)" strokeWidth={0.5} />
        ))}
        <circle cx={12} cy={20.7} r={1.7} fill="url(#wdG)" stroke="#0a0e13" strokeWidth={0.35} />
      </g>
    </g>
  ),
  shortsword: (
    <g stroke="none">
      <defs>
        <linearGradient id="wsS" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#9aa3ad" />
          <stop offset="0.42" stopColor="#5c646d" />
          <stop offset="1" stopColor="#2b3037" />
        </linearGradient>
        <linearGradient id="wsM" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#c9ccd1" />
          <stop offset="1" stopColor="#565c63" />
        </linearGradient>
        <linearGradient id="wsL" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a2a1c" />
          <stop offset="1" stopColor="#16100a" />
        </linearGradient>
        <linearGradient id="wsG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c9ccd1" />
          <stop offset="0.5" stopColor="#8f959c" />
          <stop offset="1" stopColor="#565c63" />
        </linearGradient>
      </defs>
      <path d="M10.67 2.8 H13.33 L14.15 5.4 V15 H9.85 V5.4 Z" fill="url(#wsS)" stroke="#0a0e13" strokeWidth={0.5} />
      <path d="M10.9 3.4 H13.1" stroke="rgba(220,228,238,0.4)" strokeWidth={0.35} />
      <path d="M12 6.2 V14.2" stroke="rgba(0,0,0,0.28)" strokeWidth={0.5} />
      <rect x={7.8} y={14.15} width={8.4} height={1.7} rx={0.85} fill="url(#wsS)" stroke="#0a0e13" strokeWidth={0.4} />
      <circle cx={12} cy={15} r={1.1} fill="url(#wsG)" />
      <rect x={10.7} y={15.9} width={2.6} height={4.5} rx={1.2} fill="url(#wsL)" stroke="#0a0e13" strokeWidth={0.4} />
      <rect x={10.7} y={15.9} width={0.8} height={4.5} rx={0.4} fill="rgba(255,235,200,0.14)" />
      {[0, 1, 2].map((i) => (
        <path key={i} d={`M10.9 ${16.8 + i * 0.9} L13.1 ${16.4 + i * 0.9}`} stroke="rgba(20,10,4,0.5)" strokeWidth={0.5} />
      ))}
      <ellipse cx={12} cy={21.7} rx={1.9} ry={0.9} fill="url(#wsM)" stroke="#0a0e13" strokeWidth={0.35} />
    </g>
  ),
  longsword: (
    <g stroke="none">
      <defs>
        <linearGradient id="wlS" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#9aa3ad" />
          <stop offset="0.42" stopColor="#5c646d" />
          <stop offset="1" stopColor="#2b3037" />
        </linearGradient>
        <linearGradient id="wlM" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#c9ccd1" />
          <stop offset="1" stopColor="#565c63" />
        </linearGradient>
        <linearGradient id="wlL" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a2a1c" />
          <stop offset="1" stopColor="#16100a" />
        </linearGradient>
      </defs>
      <path d="M12 0.6 L13.2 5.8 V16.8 H10.8 V5.8 Z" fill="url(#wlS)" stroke="#0a0e13" strokeWidth={0.5} />
      <path d="M12 6.4 V15.8" stroke="rgba(0,0,0,0.35)" strokeWidth={0.6} />
      <path d="M11.3 6.4 V15.8" stroke="rgba(220,228,238,0.35)" strokeWidth={0.35} />
      <rect x={7.4} y={16.3} width={9.2} height={1.8} rx={0.9} fill="url(#wlS)" stroke="#0a0e13" strokeWidth={0.4} />
      <circle cx={16.6} cy={17.9} r={1.4} fill="none" stroke="url(#wlM)" strokeWidth={0.9} />
      <rect x={10.7} y={18.1} width={2.6} height={4.3} rx={1.2} fill="url(#wlL)" stroke="#0a0e13" strokeWidth={0.4} />
      <rect x={10.7} y={18.1} width={0.8} height={4.3} rx={0.4} fill="rgba(255,235,200,0.14)" />
      <path d="M11.2 18.9 L13.2 20.5 L11.2 22.1" stroke="rgba(150,155,165,0.45)" strokeWidth={0.45} fill="none" />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <path key={i} d={`M10.9 ${19.1 + i * 0.383} L13.1 ${18.7 + i * 0.383}`} stroke="rgba(20,10,4,0.45)" strokeWidth={0.5} />
      ))}
      <ellipse cx={12} cy={23.6} rx={2} ry={0.9} fill="url(#wlM)" stroke="#0a0e13" strokeWidth={0.4} />
      <circle cx={12} cy={17.6} r={0.8} fill="#b03a3a" stroke="#0a0e13" strokeWidth={0.3} />
    </g>
  ),
  greatsword: (
    <g stroke="none">
      <defs>
        <linearGradient id="wgS" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#9aa3ad" />
          <stop offset="0.42" stopColor="#5c646d" />
          <stop offset="1" stopColor="#2b3037" />
        </linearGradient>
        <linearGradient id="wgM" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#c9ccd1" />
          <stop offset="1" stopColor="#565c63" />
        </linearGradient>
        <linearGradient id="wgG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c9ccd1" />
          <stop offset="0.5" stopColor="#8f959c" />
          <stop offset="1" stopColor="#565c63" />
        </linearGradient>
        <linearGradient id="wgL" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a2a1c" />
          <stop offset="1" stopColor="#16100a" />
        </linearGradient>
      </defs>
      <path
        d="M12.00 0.60L13.09 1.42L13.60 2.24L13.62 3.07L13.39 3.89L13.24 4.71L13.29 5.53L13.78 6.36L14.35 7.18L14.60 8.00L14.35 8.82L13.78 9.64L13.29 10.47L13.24 11.29L13.66 12.11L14.25 12.93L14.59 13.76L14.44 14.58L13.90 15.40L10.10 15.40L9.56 14.58L9.41 13.76L9.75 12.93L10.34 12.11L10.76 11.29L10.71 10.47L10.22 9.64L9.65 8.82L9.40 8.00L9.65 7.18L10.22 6.36L10.71 5.53L10.76 4.71L10.61 3.89L10.38 3.07L10.40 2.24L10.91 1.42L12.00 0.60Z"
        fill="url(#wgS)"
        stroke="#0a0e13"
        strokeWidth={0.4}
      />
      <path d="M11.2 7.4 C11.9 9 12.1 10.6 11.6 12.2 M13.4 4.2 C13.9 5.6 13.9 6.8 13.5 8" stroke="rgba(220,228,238,0.28)" strokeWidth={0.35} fill="none" />
      <rect x={4.6} y={14.55} width={14.8} height={1.7} rx={0.85} fill="url(#wgS)" stroke="#0a0e13" strokeWidth={0.4} />
      <circle cx={12} cy={15.4} r={1.15} fill="url(#wgG)" />
      <rect x={10.7} y={16.3} width={2.6} height={5.4} rx={1.2} fill="url(#wgL)" stroke="#0a0e13" strokeWidth={0.4} />
      <rect x={10.7} y={16.3} width={0.8} height={5.4} rx={0.4} fill="rgba(255,235,200,0.14)" />
      {[0, 1, 2, 3, 4].map((i) => (
        <path key={i} d={`M10.9 ${17.2 + i * 0.92} L13.1 ${16.8 + i * 0.92}`} stroke="rgba(20,10,4,0.5)" strokeWidth={0.5} />
      ))}
      <ellipse cx={12} cy={22.7} rx={1.9} ry={0.9} fill="url(#wgM)" stroke="#0a0e13" strokeWidth={0.35} />
    </g>
  ),
  rapier: (
    <g stroke="none">
      <defs>
        <linearGradient id="wrS" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#9aa3ad" />
          <stop offset="0.42" stopColor="#5c646d" />
          <stop offset="1" stopColor="#2b3037" />
        </linearGradient>
        <linearGradient id="wrM" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#c9ccd1" />
          <stop offset="1" stopColor="#565c63" />
        </linearGradient>
        <linearGradient id="wrG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c9ccd1" />
          <stop offset="0.5" stopColor="#8f959c" />
          <stop offset="1" stopColor="#565c63" />
        </linearGradient>
        <linearGradient id="wrL" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a2a1c" />
          <stop offset="1" stopColor="#16100a" />
        </linearGradient>
      </defs>
      <path d="M12 1.4 L12.95 4.6 V15.6 H11.05 V4.6 Z" fill="url(#wrS)" stroke="#0a0e13" strokeWidth={0.45} />
      <path d="M12 5 V14.8" stroke="rgba(0,0,0,0.32)" strokeWidth={0.5} />
      <path d="M11.5 5 V14.8" stroke="rgba(220,228,238,0.3)" strokeWidth={0.3} />
      <ellipse cx={12} cy={16.2} rx={3.5} ry={2.5} fill="url(#wrM)" stroke="#0a0e13" strokeWidth={0.4} />
      <path d="M7 14.6 H17" stroke="url(#wrS)" strokeWidth={1.3} strokeLinecap="round" />
      <rect x={10.7} y={16.5} width={2.6} height={3.8} rx={1.2} fill="url(#wrL)" stroke="#0a0e13" strokeWidth={0.4} />
      <rect x={10.7} y={16.5} width={0.8} height={3.8} rx={0.4} fill="rgba(255,235,200,0.14)" />
      {[0, 1, 2].map((i) => (
        <path key={i} d={`M10.9 ${17.3 + i * 0.9} L13.1 ${16.9 + i * 0.9}`} stroke="rgba(20,10,4,0.5)" strokeWidth={0.5} />
      ))}
      <path d="M12 19.9 C13.8 22 13.4 23.5 12 23.9 C10.6 23.5 10.2 22 12 19.9 Z" fill="url(#wrG)" />
    </g>
  ),
  scimitar: (
    <g stroke="none">
      <defs>
        <linearGradient id="wcS" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#9aa3ad" />
          <stop offset="0.42" stopColor="#5c646d" />
          <stop offset="1" stopColor="#2b3037" />
        </linearGradient>
        <linearGradient id="wcG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c9ccd1" />
          <stop offset="0.5" stopColor="#8f959c" />
          <stop offset="1" stopColor="#565c63" />
        </linearGradient>
        <linearGradient id="wcL" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a2a1c" />
          <stop offset="1" stopColor="#16100a" />
        </linearGradient>
      </defs>
      <path
        d="M16.60 1.40L15.93 2.17L15.29 2.93L14.82 3.70L14.52 4.47L14.33 5.23L14.10 6.00L14.01 6.77L13.95 7.53L13.89 8.30L13.83 9.07L13.78 9.83L13.73 10.60L13.68 11.37L13.63 12.13L13.59 12.90L13.55 13.67L13.52 14.43L13.50 15.20L10.50 15.20L10.51 14.43L10.54 13.67L10.56 12.90L10.59 12.13L10.62 11.37L10.66 10.60L10.70 9.83L10.73 9.07L10.77 8.30L10.82 7.53L10.86 6.77L10.92 6.00L11.14 5.23L11.74 4.47L12.59 3.70L13.60 2.93L14.79 2.17L16.30 1.40Z"
        fill="url(#wcS)"
        stroke="#0a0e13"
        strokeWidth={0.4}
      />
      <path d="M15.4 2.6 C14.8 5 13.6 8 12.6 11 C12.4 12.4 12.3 13.6 12.3 14.6" stroke="rgba(0,0,0,0.32)" strokeWidth={0.6} fill="none" />
      <path d="M15.9 2.5 C15.3 5 14.1 8 13.1 10.9 C12.9 12.2 12.8 13.4 12.8 14.4" stroke="rgba(220,228,238,0.3)" strokeWidth={0.32} fill="none" />
      <rect x={8.6} y={14.35} width={6.8} height={1.7} rx={0.85} fill="url(#wcS)" stroke="#0a0e13" strokeWidth={0.4} />
      <circle cx={12} cy={15.2} r={1.1} fill="url(#wcG)" />
      <rect x={10.7} y={16.1} width={2.6} height={4.5} rx={1.2} fill="url(#wcL)" stroke="#0a0e13" strokeWidth={0.4} />
      <rect x={10.7} y={16.1} width={0.8} height={4.5} rx={0.4} fill="rgba(255,235,200,0.14)" />
      {[0, 1, 2].map((i) => (
        <path key={i} d={`M10.9 ${17.0 + i * 0.9} L13.1 ${16.6 + i * 0.9}`} stroke="rgba(20,10,4,0.5)" strokeWidth={0.5} />
      ))}
      <circle cx={12} cy={21.9} r={1.7} fill="url(#wcG)" stroke="#0a0e13" strokeWidth={0.35} />
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
    <g stroke="none">
      <defs>
        <linearGradient id="gxSteel" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f6fafd" />
          <stop offset="0.42" stopColor="#cdd9e5" />
          <stop offset="1" stopColor="#7f92a5" />
        </linearGradient>
        <linearGradient id="gxDark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8a9aab" />
          <stop offset="1" stopColor="#46525f" />
        </linearGradient>
        <linearGradient id="gxWood" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#a5713a" />
          <stop offset="0.5" stopColor="#724822" />
          <stop offset="1" stopColor="#432810" />
        </linearGradient>
      </defs>
      <rect x={10.85} y={3.6} width={2.3} height={19.8} rx={1.15} fill="url(#gxWood)" />
      <rect x={12.23} y={4.4} width={0.69} height={18.2} rx={0.35} fill="rgba(24,12,4,0.32)" />
      <rect x={11.08} y={4.4} width={0.46} height={18.2} rx={0.23} fill="rgba(255,238,205,0.22)" />
      <path d="M11.35 6C12.25 8.6 11.75 11.6 11.45 14.6" stroke="rgba(30,16,6,0.35)" strokeWidth="0.35" fill="none" />
      <rect x={10.4} y={2.9} width={3.2} height={1.9} rx={0.9} fill="url(#gxDark)" />
      <rect x={10.4} y={2.9} width={3.2} height={0.7} rx={0.35} fill="rgba(255,255,255,0.25)" />
      <rect x={10.5} y={15.6} width={3} height={0.8} rx={0.4} fill="rgba(28,14,6,0.75)" />
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <rect
            x={10.5}
            y={16.45 + i * 1.55}
            width={3}
            height={0.8}
            rx={0.4}
            fill="#5d3a1a"
            stroke="rgba(20,10,4,0.55)"
            strokeWidth={0.25}
          />
          <path
            d={`M10.65 ${16.75 + i * 1.55}L13.35 ${16.55 + i * 1.55}`}
            stroke="rgba(255,220,180,0.28)"
            strokeWidth={0.3}
          />
        </g>
      ))}
      <rect x={10.35} y={23.4} width={3.3} height={1.5} rx={0.75} fill="url(#gxDark)" />
      {[0, 1].map((side) => (
        <g key={side} transform={side ? 'translate(24 0) scale(-1 1)' : undefined}>
          <path
            d="M11.5 3.2C6.6 2.4 3.6 4.8 3.4 8 3.3 10.7 5.2 12.5 7.8 12.6 6.7 11.4 6.2 9.9 6.4 8.4 6.7 6.6 8 5.2 10 4.4Z"
            fill="url(#gxDark)"
          />
          <path d="M10.6 4C7.9 4.3 6.1 6 5.6 8.5" stroke="rgba(255,255,255,0.45)" strokeWidth={0.5} fill="none" />
          <path d="M7 12.4 8.4 9.8 9.8 12.2" fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth={0.4} />
        </g>
      ))}
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
    <g stroke="none">
      <defs>
        <linearGradient id="wbJaw" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4a4542" />
          <stop offset="1" stopColor="#0f0c0b" />
        </linearGradient>
      </defs>
      <path d="M2.2 4.4 21.8 6.4 21 10.2H2.2Z" fill="url(#wbJaw)" />
      <path d="M2.2 20.6 21 16.8 21.8 20.6 2.2 21.6Z" fill="url(#wbJaw)" />
      <path d="M2.4 10.2h18.4v2.4H2.4z" fill="#6e0f14" />
      <path d="M2.4 14.2h18.4v2.6H2.4z" fill="#3d0508" />
      {teeth(3.4, 20.4, 8, 10.2, 1, 2.8, '#6b7280', 'wb-u')}
      {teeth(3.8, 20, 8, 16.8, -1, 2.8, '#5b616b', 'wb-l')}
      {fang(5.6, 10.2, 4.8, 17.4, 1.8, '#6b7280', '#1c1614')}
      {fang(18.2, 10.2, 19.2, 17.4, 1.8, '#6b7280', '#1c1614')}
      <circle cx="11.6" cy="12.6" r="1.6" fill="#ff3d2e" opacity={0.28} />
      <path d="M3.2 5.8 18.4 7.4" stroke="rgba(255,120,90,0.35)" strokeWidth={0.5} fill="none" />
    </g>
  ),
  claws: (
    <g stroke="none">
      <defs>
        <linearGradient id="wclSteel" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f6fafd" />
          <stop offset="0.42" stopColor="#cdd9e5" />
          <stop offset="1" stopColor="#7f92a5" />
        </linearGradient>
      </defs>
      <path d="M3.6 21.4c1.2-3.8 3.6-6.4 7-7.8-1.8 3.2-4.2 5.8-7 7.8Z" fill="#46525f" />
      <path d="M6 4c3.4 3.8 5.2 8.4 5.2 13.8C9 13.4 7.2 8.6 6 4Z" fill="url(#wclSteel)" />
      <path d="M12.4 2.6c3.6 4 5.4 9 5.4 14.8-2.2-5-4-10-5.4-14.8Z" fill="url(#wclSteel)" />
      <path d="M18.4 4c3.4 3.8 5 8.4 5 13.6-2-4.6-3.6-9.2-5-13.6Z" fill="url(#wclSteel)" />
      <path d="M7 5.6c1 3.4 1.6 7 1.8 10.6M13.4 4.6c1 3.6 1.6 7.2 1.8 10.8" stroke="rgba(255,255,255,0.75)" strokeWidth={0.5} fill="none" />
    </g>
  ),
  rend: (
    <g stroke="none">
      <defs>
        <linearGradient id="wrBlood" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e0553c" />
          <stop offset="1" stopColor="#8c1408" />
        </linearGradient>
      </defs>
      <path d="M3 4.6C7.4 7 11 10.8 13.6 15.6 10 12.6 6.4 9 3 4.6Z" fill="url(#wrBlood)" />
      <path d="M7 3.6c4.4 2.4 8 6.2 10.6 11-3.6-3-7.2-6.6-10.6-11Z" fill="url(#wrBlood)" />
      <path d="M11 3.2c4.2 2.6 7.6 6.2 10 10.8-3.4-3-6.8-6.4-10-10.8Z" fill="url(#wrBlood)" />
      <path d="M15.2 3.6c3.6 2.6 6.4 5.8 8.4 9.8-3-2.8-5.8-6-8.4-9.8Z" fill="url(#wrBlood)" />
      <path d="M4.4 6.2c2.8 1.8 5.2 4 7.2 6.6" stroke="rgba(255,220,210,0.5)" strokeWidth={0.4} fill="none" />
      <circle cx="17.4" cy="17.4" r="0.9" fill="#a81f14" />
      <circle cx="19.6" cy="19.6" r="0.6" fill="#a81f14" opacity={0.8} />
      <circle cx="15.6" cy="20.4" r="0.5" fill="#a81f14" opacity={0.7} />
    </g>
  ),
  slam: (
    <g stroke="none">
      <defs>
        <linearGradient id="wslPlate" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f6fafd" />
          <stop offset="0.42" stopColor="#b9c7d6" />
          <stop offset="1" stopColor="#5c6d7f" />
        </linearGradient>
      </defs>
      <rect x={4.6} y={3.4} width={14.8} height={8.6} rx={1.6} fill="url(#wslPlate)" />
      <rect x={4.6} y={3.4} width={14.8} height={2.6} rx={1.3} fill="rgba(255,255,255,0.45)" />
      <rect x={10.6} y={10.4} width={2.8} height={12.4} rx={1.4} fill="url(#wslPlate)" />
      <rect x={10.6} y={10.4} width={0.9} height={12.4} rx={0.45} fill="rgba(255,255,255,0.4)" />
      <path
        d="M2.6 15.6c1.8-.6 3.6-.6 5.4 0M16 15.6c1.8-.6 3.6-.6 5.4 0M2.6 18.6c2.4-.8 4.6-.8 6.8 0M14.6 18.6c2.4-.8 4.6-.8 6.8 0"
        stroke="#dbe6f0"
        strokeWidth={0.8}
        fill="none"
        opacity={0.8}
      />
    </g>
  ),
  sting: (
    <g stroke="none">
      <defs>
        <linearGradient id="wstChitin" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#e0b070" />
          <stop offset="0.5" stopColor="#a5701f" />
          <stop offset="1" stopColor="#5e3a10" />
        </linearGradient>
      </defs>
      <path
        d="M2.6 21.4C10.4 20.6 16.6 16.8 19.8 9.8 20.8 7.4 21.4 5 21.6 2.6 19 5 16.6 8.2 14.8 12.2 12.8 16.6 8.6 20 2.6 21.4Z"
        fill="url(#wstChitin)"
      />
      <path d="M5.4 20.2 6.8 21.2M8.8 18.4l1.6 1.2M11.6 15.8l1.8.8M13.8 12.6l2 .4M15.8 9.4l2.2 0" stroke="rgba(60,34,10,0.55)" strokeWidth={0.6} />
      <path d="M4.4 20.4C9.6 19 14 15.8 16.8 10" stroke="rgba(255,240,210,0.45)" strokeWidth={0.6} fill="none" />
      <circle cx="21.2" cy="3.4" r="0.6" fill="#a81f14" />
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
  if (n.includes('rend') || n.includes('раздир')) return 'rend';
  if (n.includes('когот') || n.includes('когт') || n.includes('царап') || n.includes('claw')) return 'claws';
  if (n.includes('укус') || n.includes('паст') || n.includes('зуб') || n.includes('bite')) return 'bite';
  if (n.includes('жал') || n.includes('sting')) return 'sting';
  if (n.includes('рог') || n.includes('таран') || n.includes('gore')) return 'gore';
  if (n.includes('хвост') || n.includes('tail')) return 'tail';
  if (n.includes('щупальц') || n.includes('tentacle')) return 'tentacle';
  if (n.includes('плев') || n.includes('слюн') || n.includes('spit')) return 'spit';
  if (n.includes('slam')) return 'slam';
  if (n.includes('кулак') || n.includes('безоруж') || n.includes('fist') || n.includes('удар') || n.includes('unarmed') || n.includes('strike')) return 'fist';
  // Shadow Blade: метание клинка тени — иконка метательного снаряда.
  if ((n.includes('клинок тени') || n.includes('shadow blade')) && (n.includes('метание') || n.includes('thrown'))) {
    return 'dart';
  }
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
