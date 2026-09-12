import type { ReactNode } from 'react';

/**
 * Детальные рисованные иконки заклинаний (viewBox 64×64). Ключ — имя в нижнем регистре.
 * Бейдж круга рисует `SpellIcon`. Батч 1: 5 утверждённых + фокусы (круг 0), часть.
 */
export const SPELL_ICONS: Record<string, ReactNode> = {
  fireball: (
    <>
      <defs>
        <radialGradient id="g-fb-glow" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#ffb347" stopOpacity=".95"/><stop offset="55%" stopColor="#ff6a00" stopOpacity=".5"/><stop offset="100%" stopColor="#ff3d00" stopOpacity="0"/></radialGradient>
        <radialGradient id="g-fb-core" cx="46%" cy="42%" r="62%"><stop offset="0%" stopColor="#fffdf0"/><stop offset="30%" stopColor="#ffe27a"/><stop offset="62%" stopColor="#ff9d2e"/><stop offset="100%" stopColor="#e23b00"/></radialGradient>
        <filter id="g-fb-blur"><feGaussianBlur stdDeviation="2.4"/></filter>
      </defs>
      <circle cx="32" cy="33" r="27" fill="url(#g-fb-glow)"/>
      <g fill="#ff6a00" opacity=".85" filter="url(#g-fb-blur)">
        <path d="M32 6l6 10-6-3-6 3z"/><path d="M58 30l-11 4 4-6-4-6z"/><path d="M6 30l11 4-4-6 4-6z"/>
        <path d="M20 55l6-9 3 6 5-3z"/><path d="M44 55l-6-9-3 6-5-3z"/><path d="M32 60l-4-9 4 2 4-2z"/>
      </g>
      <circle cx="32" cy="32" r="15" fill="url(#g-fb-core)"/>
      <circle cx="32" cy="32" r="15" fill="none" stroke="#ffd166" strokeWidth="1.2" opacity=".7"/>
      <circle cx="27" cy="27" r="3.4" fill="#fffef5" opacity=".95"/>
      <circle cx="37" cy="37" r="1.6" fill="#fff1c0" opacity=".8"/>
      <g fill="#ffce6b"><circle cx="47" cy="20" r="1.3"/><circle cx="16" cy="22" r="1"/><circle cx="44" cy="47" r="1.1"/><circle cx="22" cy="46" r=".9"/><circle cx="32" cy="12" r="1"/></g>
    </>
  ),
  'magic missile': (
    <>
      <defs>
        <linearGradient id="g-mm-dart" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#7cf9ff"/><stop offset="55%" stopColor="#7aa2ff"/><stop offset="100%" stopColor="#c77dff"/></linearGradient>
        <filter id="g-mm-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.4"/></filter>
      </defs>
      <g filter="url(#g-mm-glow)" opacity=".8" stroke="url(#g-mm-dart)" strokeWidth="3" strokeLinecap="round"><path d="M10 50l18-14"/><path d="M18 20l10-2"/><path d="M40 44l6-8"/></g>
      <g filter="url(#g-mm-glow)" opacity=".9"><path d="M14 54l22-18-4-4z" fill="#5ad1ff"/><path d="M10 22l20-6-4-4z" fill="#7aa2ff"/><path d="M46 50l12-6-4-4z" fill="#c77dff"/></g>
      <g stroke="url(#g-mm-dart)" strokeWidth="2" strokeLinejoin="round"><path d="M30 34l10-4-3-3-10 4z"/><path d="M16 20l20-3-4-4-18 3z"/><path d="M42 46l14-2-4-4-12 3z"/></g>
      <circle cx="40" cy="30" r="1.6" fill="#fff"/>
      <g fill="#9fe8ff"><circle cx="52" cy="20" r="1.1"/><circle cx="18" cy="44" r="1"/><circle cx="30" cy="12" r=".9"/></g>
    </>
  ),
  'cure wounds': (
    <>
      <defs>
        <radialGradient id="g-cw-glow" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#b7ffd0" stopOpacity=".9"/><stop offset="60%" stopColor="#4ecb71" stopOpacity=".35"/><stop offset="100%" stopColor="#4ecb71" stopOpacity="0"/></radialGradient>
        <linearGradient id="g-cw-cross" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f2fff7"/><stop offset="45%" stopColor="#9cf0b6"/><stop offset="100%" stopColor="#3fae63"/></linearGradient>
        <filter id="g-cw-blur"><feGaussianBlur stdDeviation="1.6"/></filter>
      </defs>
      <circle cx="32" cy="32" r="28" fill="url(#g-cw-glow)"/>
      <g stroke="#7fe0a0" strokeWidth="1.3" opacity=".7"><path d="M32 6v6M32 52v6M6 32h6M52 32h6M14 14l4 4M46 46l4 4M50 14l-4 4M18 46l-4 4"/></g>
      <g filter="url(#g-cw-blur)" opacity=".55"><rect x="25" y="14" width="14" height="36" rx="4" fill="#8bf0aa"/><rect x="14" y="25" width="36" height="14" rx="4" fill="#8bf0aa"/></g>
      <rect x="26" y="15" width="12" height="34" rx="3.5" fill="url(#g-cw-cross)"/>
      <rect x="15" y="26" width="34" height="12" rx="3.5" fill="url(#g-cw-cross)"/>
      <rect x="26" y="15" width="12" height="34" rx="3.5" fill="none" stroke="#eafff1" strokeWidth=".8" opacity=".7"/>
      <rect x="15" y="26" width="34" height="12" rx="3.5" fill="none" stroke="#eafff1" strokeWidth=".8" opacity=".7"/>
      <g fill="#eafff1"><circle cx="49" cy="18" r="1.4"/><circle cx="15" cy="47" r="1.2"/><circle cx="50" cy="45" r="1"/></g>
    </>
  ),
  shield: (
    <>
      <defs>
        <linearGradient id="g-sh-face" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8fc3ff"/><stop offset="45%" stopColor="#3f7fd6"/><stop offset="100%" stopColor="#1d3f78"/></linearGradient>
        <linearGradient id="g-sh-edge" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#eaf4ff"/><stop offset="100%" stopColor="#6ea8ff"/></linearGradient>
        <radialGradient id="g-sh-glow" cx="50%" cy="38%" r="60%"><stop offset="0%" stopColor="#9cc8ff" stopOpacity=".8"/><stop offset="100%" stopColor="#2f6fd0" stopOpacity="0"/></radialGradient>
      </defs>
      <ellipse cx="32" cy="34" rx="26" ry="24" fill="url(#g-sh-glow)"/>
      <path d="M32 5l22 8v18c0 13-9 21-22 28C19 52 10 44 10 31V13z" fill="url(#g-sh-edge)"/>
      <path d="M32 8l19 7v16c0 11-7.6 18.6-19 25C20.6 49.6 13 42 13 31V15z" fill="url(#g-sh-face)"/>
      <path d="M32 8l19 7v16c0 11-7.6 18.6-19 25" fill="#fff" opacity=".12"/>
      <path d="M32 13l2.6 7 7.4.6-5.6 4.9 1.8 7.2L32 28.9 25.8 32.7l1.8-7.2L22 20.6l7.4-.6z" fill="#eaf4ff" opacity=".95"/>
      <circle cx="32" cy="24" r="2" fill="#bcd8ff"/>
      <g fill="#dbeaff"><circle cx="16" cy="20" r="1"/><circle cx="48" cy="20" r="1"/><circle cx="16" cy="40" r="1"/><circle cx="48" cy="40" r="1"/></g>
      <path d="M32 5l22 8v4L32 9 10 17v-4z" fill="#fff" opacity=".35"/>
    </>
  ),
  'misty step': (
    <>
      <defs>
        <linearGradient id="g-ms-arc" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#9be7ff"/><stop offset="100%" stopColor="#c77dff"/></linearGradient>
        <radialGradient id="g-ms-mist" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#cfe9ff" stopOpacity=".85"/><stop offset="100%" stopColor="#7aa2ff" stopOpacity="0"/></radialGradient>
        <filter id="g-ms-blur"><feGaussianBlur stdDeviation="2.6"/></filter>
      </defs>
      <ellipse cx="32" cy="44" rx="26" ry="12" fill="url(#g-ms-mist)"/>
      <path d="M14 50V22c0-9 8-16 18-16s18 7 18 16v28" fill="none" stroke="url(#g-ms-arc)" strokeWidth="3.4" strokeLinecap="round" opacity=".9"/>
      <path d="M20 50V24c0-6.6 5.4-12 12-12s12 5.4 12 12v26" fill="none" stroke="#e6f4ff" strokeWidth="1" opacity=".4"/>
      <g filter="url(#g-ms-blur)"><circle cx="32" cy="30" r="4.4" fill="#dceeff"/><path d="M25 44c0-6 3-10 7-10s7 4 7 10z" fill="#cfe3ff"/></g>
      <circle cx="32" cy="30" r="3.4" fill="#f2fbff"/>
      <path d="M26 45c0-6 2.6-9 6-9s6 3 6 9z" fill="#e8f3ff" opacity=".9"/>
      <g fill="#dceeff"><circle cx="45" cy="20" r="1.6"/><circle cx="19" cy="18" r="1.3"/><circle cx="50" cy="34" r="1.1"/><circle cx="14" cy="32" r="1"/><circle cx="40" cy="12" r="1"/></g>
    </>
  ),
  'fire bolt': (
    <>
      <defs>
        <radialGradient id="g-fbo-glow" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#ffcf6b" stopOpacity=".95"/><stop offset="100%" stopColor="#ff6a00" stopOpacity="0"/></radialGradient>
        <linearGradient id="g-fbo-core" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#fffdf0"/><stop offset="45%" stopColor="#ffd166"/><stop offset="100%" stopColor="#ff6a00"/></linearGradient>
        <filter id="g-fbo-blur"><feGaussianBlur stdDeviation="2.2"/></filter>
      </defs>
      <circle cx="40" cy="26" r="20" fill="url(#g-fbo-glow)"/>
      <g filter="url(#g-fbo-blur)" opacity=".8" fill="#ff9d2e"><path d="M6 58l18-18 6 6z"/><path d="M2 40l10-4 2 6z"/><path d="M24 60l4-10 6 2z"/></g>
      <path d="M46 8l-8 16 6 2-10 20 4-14-6-2z" fill="url(#g-fbo-core)"/>
      <path d="M46 8l-8 16 6 2-10 20 4-14-6-2z" fill="none" stroke="#fff3cf" strokeWidth=".8" opacity=".8"/>
      <g fill="#ffce6b"><circle cx="22" cy="30" r="1.2"/><circle cx="52" cy="44" r="1.1"/><circle cx="34" cy="12" r="1"/><circle cx="14" cy="22" r=".9"/></g>
    </>
  ),
  'acid splash': (
    <>
      <defs>
        <radialGradient id="g-as-glow" cx="50%" cy="55%" r="55%"><stop offset="0%" stopColor="#d9ff8a" stopOpacity=".9"/><stop offset="100%" stopColor="#7cbf2a" stopOpacity="0"/></radialGradient>
        <linearGradient id="g-as-drop" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#eaffb0"/><stop offset="100%" stopColor="#79b526"/></linearGradient>
      </defs>
      <circle cx="32" cy="34" r="24" fill="url(#g-as-glow)"/>
      <path d="M32 12s11 13 11 20a11 11 0 0 1-22 0c0-7 11-20 11-20z" fill="url(#g-as-drop)"/>
      <ellipse cx="27" cy="30" rx="3.4" ry="4.6" fill="#f4ffdc" opacity=".7"/>
      <g fill="#cdf07a"><circle cx="10" cy="50" r="2"/><circle cx="54" cy="48" r="1.6"/><circle cx="18" cy="57" r="1.4"/><circle cx="48" cy="57" r="1.2"/><circle cx="52" cy="18" r="1.4"/></g>
    </>
  ),
  'blade ward': (
    <>
      <defs>
        <linearGradient id="g-bw-blade" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#eaf4ff"/><stop offset="100%" stopColor="#7d8b9c"/></linearGradient>
        <linearGradient id="g-bw-ward" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#9fe8ff"/><stop offset="100%" stopColor="#4a7fd0"/></linearGradient>
      </defs>
      <path d="M14 46V14l4-6 4 6v32z" fill="url(#g-bw-blade)"/>
      <path d="M9 46h14M16 46v14h4V46" fill="none" stroke="#b8c4d4" strokeWidth="2"/>
      <path d="M34 16a12 12 0 0 1 12 12v6a12 12 0 0 1-12 12c-6 0-9-4-9-9" fill="none" stroke="url(#g-bw-ward)" strokeWidth="3" strokeLinecap="round"/>
      <path d="M34 22a6 6 0 0 1 6 6" fill="none" stroke="#eaf6ff" strokeWidth="1" opacity=".7"/>
    </>
  ),
  'booming blade': (
    <>
      <defs>
        <linearGradient id="g-bb-blade" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f2f6ff"/><stop offset="100%" stopColor="#7d8b9c"/></linearGradient>
      </defs>
      <path d="M20 46V16l4-6 4 6v30z" fill="url(#g-bb-blade)"/>
      <path d="M15 46h18M22 46v13h4V46" fill="none" stroke="#b8c4d4" strokeWidth="2"/>
      <g fill="none" stroke="#8fd0ff" strokeWidth="2.4" strokeLinecap="round">
        <path d="M38 26a8 8 0 0 1 4 7"/><path d="M42 20a14 14 0 0 1 6 11"/><path d="M44 14a20 20 0 0 1 8 15" opacity=".7"/>
      </g>
      <g fill="#bfe4ff"><circle cx="36" cy="34" r="1.2"/><circle cx="48" cy="34" r="1"/><circle cx="40" cy="44" r="1"/></g>
    </>
  ),
  'chill touch': (
    <>
      <defs>
        <linearGradient id="g-ct-bone" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#e9eae6"/><stop offset="100%" stopColor="#8f938c"/></linearGradient>
        <radialGradient id="g-ct-glow" cx="50%" cy="60%" r="55%"><stop offset="0%" stopColor="#9be7ff" stopOpacity=".7"/><stop offset="100%" stopColor="#3a7fd0" stopOpacity="0"/></radialGradient>
      </defs>
      <circle cx="32" cy="38" r="24" fill="url(#g-ct-glow)"/>
      <g fill="none" stroke="url(#g-ct-bone)" strokeWidth="2.6" strokeLinecap="round">
        <path d="M22 30v-8M27 28v-11M32 28v-11M37 29v-9"/>
        <path d="M19 30c0 11 6 18 13 20 7-2 13-9 13-20"/>
      </g>
      <g fill="#cfeeff"><circle cx="12" cy="20" r="1.6"/><circle cx="54" cy="18" r="1.4"/><circle cx="46" cy="12" r="1.1"/></g>
    </>
  ),
  'control flames': (
    <>
      <defs>
        <radialGradient id="g-cf-core" cx="50%" cy="40%" r="60%"><stop offset="0%" stopColor="#fff3c4"/><stop offset="60%" stopColor="#ff9d2e"/><stop offset="100%" stopColor="#e23b00"/></radialGradient>
      </defs>
      <path d="M32 10c3 6 9 8 9 15a9 9 0 0 1-18 0c0-4 2-6 4-8 .6 2.4 1.8 4 3.6 5C31 17 31 13 32 10z" fill="url(#g-cf-core)"/>
      <path d="M32 24c1.2 2.2 3 3 3 5.4A3 3 0 0 1 32 33a3 3 0 0 1-3-3.6C30 27.4 31 26.2 32 24z" fill="#fff6d6" opacity=".9"/>
      <g fill="none" stroke="#ffb347" strokeWidth="2" strokeLinecap="round"><path d="M12 44h40M18 52h28M24 60h16" opacity=".8"/></g>
      <g fill="#ffce6b"><circle cx="14" cy="36" r="1.2"/><circle cx="50" cy="36" r="1.2"/></g>
    </>
  ),
  'create bonfire': (
    <>
      <defs>
        <radialGradient id="g-cbn-core" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#fff3c4"/><stop offset="60%" stopColor="#ff8a1e"/><stop offset="100%" stopColor="#d23200"/></radialGradient>
        <radialGradient id="g-cbn-glow" cx="50%" cy="55%" r="55%"><stop offset="0%" stopColor="#ff9d2e" stopOpacity=".7"/><stop offset="100%" stopColor="#ff6a00" stopOpacity="0"/></radialGradient>
      </defs>
      <circle cx="32" cy="30" r="22" fill="url(#g-cbn-glow)"/>
      <path d="M16 52l32-8M48 52L16 44" fill="none" stroke="#7a5230" strokeWidth="4" strokeLinecap="round"/>
      <path d="M32 8c3.4 6.6 10 8.6 10 16a10 10 0 0 1-20 0c0-4.6 2.4-7 4.6-9 .6 2.6 1.8 4.4 3.8 5.4C31 14.6 31 11 32 8z" fill="url(#g-cbn-core)"/>
      <path d="M32 24c1.4 2.6 3.4 3.4 3.4 6.2A3.4 3.4 0 0 1 32 33a3.4 3.4 0 0 1-3.4-4C28.6 27.4 30.6 26.4 32 24z" fill="#fff7dc" opacity=".9"/>
    </>
  ),
  'dancing lights': (
    <>
      <defs>
        <radialGradient id="g-dl-a" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#fff7d6"/><stop offset="100%" stopColor="#ffb347" stopOpacity="0"/></radialGradient>
        <radialGradient id="g-dl-b" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#e6fff9"/><stop offset="100%" stopColor="#5ad1ff" stopOpacity="0"/></radialGradient>
        <radialGradient id="g-dl-c" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#ffeaff"/><stop offset="100%" stopColor="#c77dff" stopOpacity="0"/></radialGradient>
      </defs>
      <circle cx="20" cy="20" r="14" fill="url(#g-dl-a)"/><circle cx="34" cy="14" r="10" fill="url(#g-dl-b)"/><circle cx="46" cy="26" r="13" fill="url(#g-dl-c)"/>
      <circle cx="20" cy="20" r="5" fill="#fff7d6"/><circle cx="34" cy="14" r="3.6" fill="#e9fbff"/><circle cx="46" cy="26" r="4.4" fill="#fbe9ff"/>
      <circle cx="30" cy="40" r="12" fill="url(#g-dl-a)"/><circle cx="30" cy="40" r="4" fill="#fff7d6"/>
      <g fill="#fff0c8"><circle cx="12" cy="42" r="1"/><circle cx="52" cy="44" r="1"/><circle cx="24" cy="56" r="1"/></g>
    </>
  ),
  druidcraft: (
    <>
      <defs>
        <linearGradient id="g-dc-leaf" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#bff29a"/><stop offset="100%" stopColor="#3f9d4e"/></linearGradient>
        <radialGradient id="g-dc-glow" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#a9f07a" stopOpacity=".6"/><stop offset="100%" stopColor="#3f9d4e" stopOpacity="0"/></radialGradient>
      </defs>
      <circle cx="34" cy="34" r="26" fill="url(#g-dc-glow)"/>
      <path d="M32 54c0-14 7-24 18-28-2 15-8 24-18 28z" fill="url(#g-dc-leaf)"/>
      <path d="M32 54c-2-8-7-14-16-17 4 10 10 15 16 17z" fill="#7fd18a" opacity=".9"/>
      <path d="M32 54V28" stroke="#3f9d4e" strokeWidth="1.6" opacity=".7"/>
      <path d="M32 20l3.4-6L32 6l-3.4 8z" fill="#d9ffbf"/>
      <g fill="#e9ffe0"><circle cx="14" cy="14" r="1.4"/><circle cx="52" cy="16" r="1.2"/><circle cx="48" cy="48" r="1"/></g>
    </>
  ),
  'eldritch blast': (
    <>
      <defs>
        <radialGradient id="g-eb-core" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#fff"/><stop offset="45%" stopColor="#b18cff"/><stop offset="100%" stopColor="#5a2ecf"/></radialGradient>
        <radialGradient id="g-eb-glow" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#c77dff" stopOpacity=".9"/><stop offset="100%" stopColor="#7a2ecf" stopOpacity="0"/></radialGradient>
      </defs>
      <circle cx="42" cy="28" r="24" fill="url(#g-eb-glow)"/>
      <path d="M6 34h22M18 28l8 6-8 6" fill="none" stroke="#d9c2ff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity=".85"/>
      <circle cx="42" cy="28" r="9" fill="url(#g-eb-core)"/>
      <circle cx="38" cy="24" r="2.6" fill="#fff" opacity=".9"/>
      <g fill="none" stroke="#c77dff" strokeWidth="2" strokeLinecap="round"><path d="M52 18l4-4M56 28h6M52 38l4 4" opacity=".8"/></g>
      <g fill="#e0ccff"><circle cx="24" cy="20" r="1.2"/><circle cx="30" cy="44" r="1.2"/><circle cx="18" cy="48" r="1"/></g>
    </>
  ),
  elementalism: (
    <>
      <defs>
        <radialGradient id="g-el-fire" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#ffe0a0"/><stop offset="100%" stopColor="#ff6a00"/></radialGradient>
        <radialGradient id="g-el-water" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#d6f2ff"/><stop offset="100%" stopColor="#2f8fd6"/></radialGradient>
        <radialGradient id="g-el-earth" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#d8c09a"/><stop offset="100%" stopColor="#6b5a3a"/></radialGradient>
        <radialGradient id="g-el-air" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#eaffff"/><stop offset="100%" stopColor="#7fd1c8"/></radialGradient>
        <radialGradient id="g-el-glow" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#fff" stopOpacity=".5"/><stop offset="100%" stopColor="#fff" stopOpacity="0"/></radialGradient>
      </defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-el-glow)"/>
      <path d="M32 6l8 8-8 8-8-8z" fill="url(#g-el-air)"/>
      <path d="M32 42l8 8-8 8-8-8z" fill="url(#g-el-fire)"/>
      <path d="M6 32l8-8 8 8-8 8z" fill="url(#g-el-earth)"/>
      <path d="M42 32l8-8 8 8-8 8z" fill="url(#g-el-water)"/>
      <circle cx="32" cy="32" r="4" fill="#fff" opacity=".9"/>
    </>
  ),
  friends: (
    <>
      <defs>
        <radialGradient id="g-fr-a" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#ffd6ee"/><stop offset="100%" stopColor="#e07ad1"/></radialGradient>
        <radialGradient id="g-fr-b" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#d6f0ff"/><stop offset="100%" stopColor="#7aa2ff"/></radialGradient>
      </defs>
      <circle cx="22" cy="34" r="13" fill="url(#g-fr-a)"/>
      <circle cx="42" cy="34" r="13" fill="url(#g-fr-b)"/>
      <path d="M15 32c2-2 5-2 7 0M36 32c2-2 5-2 7 0" fill="none" stroke="#3a2a4a" strokeWidth="1.6" strokeLinecap="round"/>
      <path d="M17 39c3 2 7 2 10 0M37 39c3 2 7 2 10 0" fill="none" stroke="#3a2a4a" strokeWidth="1.6" strokeLinecap="round" opacity=".8"/>
      <path d="M32 10l1.6 3.6L37 15l-3.4 1.4L32 20l-1.6-3.6L27 15l3.4-1.4z" fill="#fff2c4"/>
    </>
  ),
  frostbite: (
    <>
      <defs>
        <linearGradient id="g-frb-hand" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#eaf6ff"/><stop offset="100%" stopColor="#7fb6e0"/></linearGradient>
        <radialGradient id="g-frb-glow" cx="35%" cy="45%" r="60%"><stop offset="0%" stopColor="#9be7ff" stopOpacity=".7"/><stop offset="100%" stopColor="#3a7fd0" stopOpacity="0"/></radialGradient>
      </defs>
      <circle cx="26" cy="36" r="24" fill="url(#g-frb-glow)"/>
      <path d="M22 40V26a3 3 0 0 1 6 0v10M28 36V24a3 3 0 0 1 6 0v14M34 36v-8a3 3 0 0 1 6 0v14a8 8 0 0 1-8 8h-4" fill="url(#g-frb-hand)" stroke="#bcdcff" strokeWidth="1"/>
      <g fill="none" stroke="#cdeeff" strokeWidth="1.8" strokeLinecap="round"><path d="M48 14v12M42 20l12 0M44 16l8 8M52 16l-8 8"/></g>
    </>
  ),
  'green-flame blade': (
    <>
      <defs>
        <linearGradient id="g-gfb-blade" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f2fff0"/><stop offset="100%" stopColor="#8a9788"/></linearGradient>
        <linearGradient id="g-gfb-flame" x1="0" y1="1" x2="0" y2="0"><stop offset="0%" stopColor="#1f8f3a"/><stop offset="60%" stopColor="#8bf04a"/><stop offset="100%" stopColor="#eaffb0"/></linearGradient>
      </defs>
      <path d="M22 48V16l4-6 4 6v32z" fill="url(#g-gfb-blade)"/>
      <path d="M16 48h20M24 48v14h4V48" fill="none" stroke="#b8c4b4" strokeWidth="2"/>
      <path d="M40 44c-6-4-8-9-4-14 1 3 3 4 4.6 4 2.4-4 6-5 8-4-3 3-2 7 0 10-2 3-6 4-8.6 4z" fill="url(#g-gfb-flame)"/>
      <g fill="#d9ff9a"><circle cx="46" cy="20" r="1.4"/><circle cx="50" cy="34" r="1.2"/><circle cx="36" cy="14" r="1"/></g>
    </>
  ),
  guidance: (
    <>
      <defs>
        <radialGradient id="g-gd-glow" cx="50%" cy="35%" r="55%"><stop offset="0%" stopColor="#fff3c4" stopOpacity=".85"/><stop offset="100%" stopColor="#ffd166" stopOpacity="0"/></radialGradient>
        <linearGradient id="g-gd-hand" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f0d6ad"/><stop offset="100%" stopColor="#b08050"/></linearGradient>
      </defs>
      <circle cx="36" cy="24" r="22" fill="url(#g-gd-glow)"/>
      <path d="M14 46V34M14 34a10 10 0 0 1 10-10h8" fill="none" stroke="url(#g-gd-hand)" strokeWidth="4" strokeLinecap="round"/>
      <circle cx="36" cy="24" r="6" fill="none" stroke="#fff3c4" strokeWidth="3"/>
      <path d="M44 6l1.8 4L50 11.8l-4.2 1.8L44 18l-1.8-4.4L38 11.8l4.2-1.8z" fill="#fff7d6"/>
      <path d="M14 52h24" stroke="#b08050" strokeWidth="3" strokeLinecap="round" opacity=".5"/>
    </>
  ),
  gust: (
    <>
      <defs>
        <linearGradient id="g-gu-wind" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#dff6ff" stopOpacity="0"/><stop offset="50%" stopColor="#bfeaff"/><stop offset="100%" stopColor="#7fd1c8"/></linearGradient>
      </defs>
      <g fill="none" stroke="url(#g-gu-wind)" strokeWidth="3" strokeLinecap="round">
        <path d="M6 24h30a6 6 0 1 0-6-6"/>
        <path d="M6 34h38a6 6 0 1 1-6 6"/>
        <path d="M6 44h20" opacity=".7"/>
      </g>
      <g fill="#dff6ff"><circle cx="50" cy="20" r="1.4"/><circle cx="46" cy="46" r="1.2"/><circle cx="38" cy="12" r="1"/></g>
    </>
  ),
  infestation: (
    <>
      <defs>
        <radialGradient id="g-if-glow" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#c8f07a" stopOpacity=".7"/><stop offset="100%" stopColor="#5a8f20" stopOpacity="0"/></radialGradient>
        <radialGradient id="g-if-body" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#3a2a1a"/><stop offset="100%" stopColor="#120c06"/></radialGradient>
      </defs>
      <circle cx="34" cy="34" r="24" fill="url(#g-if-glow)"/>
      <g fill="none" stroke="#7a5a2a" strokeWidth="2" strokeLinecap="round"><path d="M28 30l-8-8M32 30l10-8M28 36l-8 8M32 36l10 8M30 28l-1.5-9M30 40l-1.5 9"/></g>
      <g fill="url(#g-if-body)"><ellipse cx="30" cy="34" rx="5" ry="8"/></g>
      <circle cx="30" cy="26" r="3.4" fill="#1a120a"/>
      <g fill="#e8ff9a"><circle cx="12" cy="18" r="1.4"/><circle cx="52" cy="20" r="1.2"/><circle cx="50" cy="50" r="1.2"/><circle cx="14" cy="52" r="1"/></g>
    </>
  ),
  light: (
    <>
      <defs>
        <radialGradient id="g-li-core" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#ffffff"/><stop offset="45%" stopColor="#fff3c4"/><stop offset="100%" stopColor="#ffce6b" stopOpacity="0"/></radialGradient>
      </defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-li-core)"/>
      <circle cx="32" cy="32" r="11" fill="#fffbe8"/>
      <circle cx="32" cy="32" r="11" fill="none" stroke="#ffe9a8" strokeWidth="1.4"/>
      <g stroke="#fff3c4" strokeWidth="2.4" strokeLinecap="round"><path d="M32 6v8M32 50v8M6 32h8M50 32h8M13 13l5 5M46 46l5 5M51 13l-5 5M18 46l-5 5"/></g>
      <g fill="#fff7d6"><circle cx="20" cy="20" r="1.3"/><circle cx="44" cy="20" r="1.3"/><circle cx="44" cy="44" r="1.3"/><circle cx="20" cy="44" r="1.3"/></g>
    </>
  ),
  'lightning lure': (
    <>
      <defs>
        <linearGradient id="g-ll-bolt" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fff6c4"/><stop offset="55%" stopColor="#ffd166"/><stop offset="100%" stopColor="#ff9d1e"/></linearGradient>
        <radialGradient id="g-ll-glow" cx="30%" cy="40%" r="60%"><stop offset="0%" stopColor="#ffe9a0" stopOpacity=".8"/><stop offset="100%" stopColor="#ff9d1e" stopOpacity="0"/></radialGradient>
      </defs>
      <circle cx="26" cy="32" r="24" fill="url(#g-ll-glow)"/>
      <path d="M24 4L10 30h10l-3 24 16-30H23z" fill="url(#g-ll-bolt)" stroke="#fff3c4" strokeWidth="1"/>
      <g fill="none" stroke="#bfe4ff" strokeWidth="2.4" strokeLinecap="round"><path d="M44 28h14M54 22l6 6-6 6" opacity=".9"/><path d="M46 40c4 0 6 2 6 6" opacity=".6"/></g>
      <g fill="#fff3c4"><circle cx="40" cy="14" r="1.3"/><circle cx="48" cy="48" r="1.1"/></g>
    </>
  ),
  'mage hand': (
    <>
      <defs>
        <linearGradient id="g-mh-hand" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#e9f8ff"/><stop offset="100%" stopColor="#7aa2ff"/></linearGradient>
        <radialGradient id="g-mh-glow" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#bfe0ff" stopOpacity=".65"/><stop offset="100%" stopColor="#5a7fd0" stopOpacity="0"/></radialGradient>
      </defs>
      <circle cx="32" cy="34" r="26" fill="url(#g-mh-glow)"/>
      <g fill="none" stroke="url(#g-mh-hand)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity=".95">
        <path d="M18 40V26a3 3 0 0 1 6 0v12M24 36V20a3 3 0 0 1 6 0v16M30 36v-9a3 3 0 0 1 6 0v13M36 36a3 3 0 0 1 6 0v6a10 10 0 0 1-10 10h-4a9 9 0 0 1-9-9"/>
      </g>
      <g fill="#eaf6ff"><circle cx="20" cy="14" r="1.3"/><circle cx="50" cy="22" r="1.1"/><circle cx="46" cy="10" r="1"/></g>
    </>
  ),
  'magic stone': (
    <>
      <defs>
        <linearGradient id="g-mst" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#d9e2ec"/><stop offset="100%" stopColor="#6b7788"/></linearGradient>
        <radialGradient id="g-mst-glow" cx="50%" cy="55%" r="55%"><stop offset="0%" stopColor="#c9a6ff" stopOpacity=".7"/><stop offset="100%" stopColor="#7a4fd0" stopOpacity="0"/></radialGradient>
      </defs>
      <circle cx="32" cy="40" r="24" fill="url(#g-mst-glow)"/>
      <circle cx="22" cy="40" r="10" fill="url(#g-mst)"/><circle cx="40" cy="24" r="10" fill="url(#g-mst)"/><circle cx="46" cy="44" r="8" fill="url(#g-mst)"/>
      <path d="M18 36a6 6 0 0 1 6 2M36 20a6 6 0 0 1 6 2M43 41a5 5 0 0 1 5 1" fill="none" stroke="#eef3f9" strokeWidth="1.6" opacity=".7"/>
      <g fill="#d9c2ff"><circle cx="14" cy="18" r="1.3"/><circle cx="54" cy="16" r="1.2"/><circle cx="52" cy="54" r="1"/></g>
    </>
  ),
  mending: (
    <>
      <defs>
        <linearGradient id="g-md-shard" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#e9eef5"/><stop offset="100%" stopColor="#8494a6"/></linearGradient>
        <radialGradient id="g-md-glow" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#ffd166" stopOpacity=".7"/><stop offset="100%" stopColor="#ff9d1e" stopOpacity="0"/></radialGradient>
      </defs>
      <circle cx="32" cy="32" r="24" fill="url(#g-md-glow)"/>
      <path d="M14 16l10 6-10 6z" fill="url(#g-md-shard)"/>
      <path d="M50 36l-10 6 10 6z" fill="url(#g-md-shard)"/>
      <path d="M40 14l-6 10 10-2z" fill="url(#g-md-shard)"/>
      <path d="M24 44l6-10-10 2z" fill="url(#g-md-shard)"/>
      <g fill="none" stroke="#fff3c4" strokeWidth="2" strokeLinecap="round"><path d="M30 26l4 4M26 32l6 6M34 40l6 6"/></g>
    </>
  ),
  message: (
    <>
      <defs>
        <linearGradient id="g-msg-bubble" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#eaf6ff"/><stop offset="100%" stopColor="#7aa2ff"/></linearGradient>
        <radialGradient id="g-msg-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#bfe0ff" stopOpacity=".6"/><stop offset="100%" stopColor="#5a7fd0" stopOpacity="0"/></radialGradient>
      </defs>
      <circle cx="32" cy="30" r="24" fill="url(#g-msg-glow)"/>
      <path d="M14 14h30a6 6 0 0 1 6 6v12a6 6 0 0 1-6 6H28l-12 12V38h-2a6 6 0 0 1-6-6V20a6 6 0 0 1 6-6z" fill="url(#g-msg-bubble)"/>
      <path d="M22 24h20M22 30h12" stroke="#3a4a6a" strokeWidth="2" strokeLinecap="round" opacity=".75"/>
      <g fill="#eaf6ff"><circle cx="50" cy="50" r="1.4"/><circle cx="14" cy="52" r="1.1"/></g>
    </>
  ),
  'mind sliver': (
    <>
      <defs>
        <linearGradient id="g-msl-head" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f0d9ff"/><stop offset="100%" stopColor="#8b5cf6"/></linearGradient>
        <linearGradient id="g-msl-shard" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#fff"/><stop offset="100%" stopColor="#ff7ac6"/></linearGradient>
        <radialGradient id="g-msl-glow" cx="35%" cy="45%" r="60%"><stop offset="0%" stopColor="#e0b0ff" stopOpacity=".7"/><stop offset="100%" stopColor="#7a4fd0" stopOpacity="0"/></radialGradient>
      </defs>
      <circle cx="26" cy="36" r="24" fill="url(#g-msl-glow)"/>
      <path d="M26 10a14 14 0 0 0-8 25v6h16v-6a14 14 0 0 0-8-25z" fill="url(#g-msl-head)"/>
      <path d="M22 16l3 5h-5l3 5" fill="none" stroke="#5a2ecf" strokeWidth="2" strokeLinecap="round"/>
      <path d="M46 12l10 6-10 6 4-6z" fill="url(#g-msl-shard)"/>
      <path d="M40 30l10 4-10 4 3-4z" fill="url(#g-msl-shard)" opacity=".85"/>
      <g fill="#ffd6f2"><circle cx="16" cy="16" r="1.3"/><circle cx="52" cy="46" r="1.1"/></g>
    </>
  ),
  'minor illusion': (
    <>
      <defs>
        <linearGradient id="g-mil-body" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f0e6ff" stopOpacity=".95"/><stop offset="100%" stopColor="#a98bff" stopOpacity=".5"/></linearGradient>
        <radialGradient id="g-mil-glow" cx="50%" cy="40%" r="55%"><stop offset="0%" stopColor="#c8b0ff" stopOpacity=".6"/><stop offset="100%" stopColor="#7a4fd0" stopOpacity="0"/></radialGradient>
      </defs>
      <circle cx="32" cy="30" r="24" fill="url(#g-mil-glow)"/>
      <path d="M10 22c6-5 12-7 22-7s16 2 22 7c-6 5-12 7-22 7s-16-2-22-7z" fill="url(#g-mil-body)"/>
      <path d="M10 22v10c0 6 10 11 22 11s22-5 22-11V22" fill="url(#g-mil-body)" opacity=".6"/>
      <ellipse cx="32" cy="24" rx="9" ry="3.4" fill="#fff" opacity=".35"/>
      <g fill="#e9dcff"><circle cx="52" cy="48" r="1.3"/><circle cx="14" cy="48" r="1.1"/><circle cx="48" cy="12" r="1"/></g>
    </>
  ),
  'arms of hadar': (
    <>
      <defs>
        <radialGradient id="g-ah-rift" cx="50%" cy="80%" r="70%"><stop offset="0%" stopColor="#7a2ecf"/><stop offset="55%" stopColor="#3a1266"/><stop offset="100%" stopColor="#12061f"/></radialGradient>
        <linearGradient id="g-ah-arm" x1="0" y1="1" x2="0" y2="0"><stop offset="0%" stopColor="#2a0f4a"/><stop offset="100%" stopColor="#b06bff"/></linearGradient>
      </defs>
      <ellipse cx="32" cy="52" rx="30" ry="16" fill="url(#g-ah-rift)"/>
      <g stroke="url(#g-ah-arm)" strokeWidth="6" fill="none" strokeLinecap="round">
        <path d="M32 58C24 48 20 40 22 26"/><path d="M32 58c8-10 12-18 10-32"/>
        <path d="M32 58C18 52 12 44 10 34"/><path d="M32 58c14-6 20-14 22-24"/>
        <path d="M32 58c-4-12-2-24 0-34"/><path d="M32 58c4-12 2-24 0-34"/>
      </g>
      <g fill="#d9b0ff" opacity=".9">
        <circle cx="22" cy="26" r="1.6"/><circle cx="42" cy="26" r="1.6"/><circle cx="10" cy="34" r="1.4"/><circle cx="54" cy="34" r="1.4"/><circle cx="31" cy="24" r="1.4"/><circle cx="33" cy="24" r="1.4"/>
      </g>
    </>
  ),
  'dissonant whispers': (
    <>
      <defs>
        <linearGradient id="g-dw-head" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f0d9ff"/><stop offset="100%" stopColor="#7a4fd0"/></linearGradient>
        <radialGradient id="g-dw-glow" cx="40%" cy="45%" r="60%"><stop offset="0%" stopColor="#e0b0ff" stopOpacity=".7"/><stop offset="100%" stopColor="#5a2ecf" stopOpacity="0"/></radialGradient>
      </defs>
      <circle cx="26" cy="34" r="24" fill="url(#g-dw-glow)"/>
      <path d="M22 10c-7 2-11 9-11 18 0 8 5 15 12 18l3-5c-5-3-8-8-8-13 0-6 3-11 8-13z" fill="url(#g-dw-head)"/>
      <path d="M20 30a3 3 0 0 1 0 6z" fill="#2a1040"/>
      <g fill="none" stroke="#c77dff" strokeWidth="2.4" strokeLinecap="round">
        <path d="M36 18q6 4 0 8t0 8" opacity=".95"/><path d="M42 12q8 6 0 12t0 12" opacity=".8"/><path d="M48 6q10 8 0 16t0 16" opacity=".6"/>
      </g>
      <g fill="#e9dcff"><circle cx="40" cy="46" r="1.3"/><circle cx="50" cy="40" r="1.1"/></g>
    </>
  ),
  'absorb elements': (
    <>
      <defs>
        <radialGradient id="g-ae-core" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#ffffff"/><stop offset="50%" stopColor="#9fe8ff"/><stop offset="100%" stopColor="#3f7fd6" stopOpacity="0"/></radialGradient>
      </defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-ae-core)"/>
      <circle cx="32" cy="32" r="12" fill="none" stroke="#dff4ff" strokeWidth="3"/>
      <circle cx="32" cy="32" r="7" fill="#eafaff"/>
      <g stroke="#bfe4ff" strokeWidth="2" strokeLinecap="round" fill="none"><path d="M8 14l6 6M13 15l-4 4M56 50l-6-6M51 49l4-4M56 14l-6 6M51 15l4 4M8 50l6-6M13 49l-4-4"/></g>
      <g><circle cx="11" cy="12" r="3" fill="#ff8a3a"/><circle cx="53" cy="12" r="3" fill="#7cf9ff"/><circle cx="53" cy="52" r="3" fill="#ffd166"/><circle cx="11" cy="52" r="3" fill="#a3e635"/></g>
    </>
  ),
  alarm: (
    <>
      <defs>
        <radialGradient id="g-al-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#cfe8ff" stopOpacity=".8"/><stop offset="100%" stopColor="#4a7fd0" stopOpacity="0"/></radialGradient>
        <linearGradient id="g-al-bell" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fff2c4"/><stop offset="100%" stopColor="#d9a441"/></linearGradient>
      </defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-al-glow)"/>
      <circle cx="32" cy="32" r="20" fill="none" stroke="#9cc8ff" strokeWidth="1.4" opacity=".7"/>
      <path d="M32 12a12 12 0 0 1 12 12c0 8 2 10 4 12H16c2-2 4-4 4-12a12 12 0 0 1 12-12z" fill="url(#g-al-bell)"/>
      <path d="M28 40a4 4 0 0 0 8 0z" fill="#d9a441"/>
      <path d="M32 10v-3M12 8l4 4M52 8l-4 4" stroke="#fff2c4" strokeWidth="2" strokeLinecap="round"/>
    </>
  ),
  'animal friendship': (
    <>
      <defs>
        <radialGradient id="g-af-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#bff29a" stopOpacity=".7"/><stop offset="100%" stopColor="#3f9d4e" stopOpacity="0"/></radialGradient>
      </defs>
      <circle cx="32" cy="34" r="25" fill="url(#g-af-glow)"/>
      <g fill="#e9d6b0">
        <circle cx="20" cy="40" r="4"/><circle cx="13" cy="31" r="2.2"/><circle cx="18" cy="25" r="2.2"/><circle cx="24" cy="25" r="2.2"/><circle cx="29" cy="31" r="2.2"/>
        <circle cx="44" cy="44" r="3.4"/><circle cx="38" cy="37" r="1.9"/><circle cx="42" cy="32" r="1.9"/><circle cx="47" cy="32" r="1.9"/><circle cx="51" cy="37" r="1.9"/>
      </g>
      <path d="M32 12c1.8 2.4 5.2 4.4 5.2 7.4A3.6 3.6 0 0 1 32 23a3.6 3.6 0 0 1-5.2-3.6c0-3 3.4-5 5.2-7.4z" fill="#7fd18a"/>
    </>
  ),
  'armor of agathys': (
    <>
      <defs>
        <linearGradient id="g-ag-armor" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#dff4ff"/><stop offset="45%" stopColor="#7fc4ea"/><stop offset="100%" stopColor="#2f6fa0"/></linearGradient>
      </defs>
      <path d="M32 6l20 7v13c0 13-8 21-20 26-12-5-20-13-20-26V13z" fill="url(#g-ag-armor)"/>
      <path d="M32 6l20 7v4L32 11 12 17v-4z" fill="#fff" opacity=".4"/>
      <path d="M32 12v30M20 20l12 6 12-6M20 28l12 6 12-6" stroke="#eaf8ff" strokeWidth="1.6" opacity=".7" fill="none"/>
      <g fill="#eaf8ff"><path d="M32 4l3 8-3 3-3-3z"/><path d="M12 14l6 2-1 4z"/><path d="M52 14l-6 2 1 4z"/></g>
    </>
  ),
  bane: (
    <>
      <defs>
        <radialGradient id="g-ba-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#8a5fd0" stopOpacity=".6"/><stop offset="100%" stopColor="#2a1040" stopOpacity="0"/></radialGradient>
      </defs>
      <circle cx="32" cy="32" r="25" fill="url(#g-ba-glow)"/>
      <circle cx="32" cy="30" r="15" fill="none" stroke="#9a6fd0" strokeWidth="3"/>
      <path d="M32 15v30M17 30h30" stroke="#7a4fd0" strokeWidth="3" opacity=".7"/>
      <path d="M25 24l6 6-6 6M39 24l-6 6 6 6" stroke="#d9b0ff" strokeWidth="2.4" strokeLinecap="round" fill="none"/>
      <g fill="#c9a6ff"><path d="M20 52l4-6 4 6z"/><path d="M28 52l4-6 4 6z"/><path d="M36 52l4-6 4 6z"/></g>
    </>
  ),
  bless: (
    <>
      <defs>
        <radialGradient id="g-bl-glow" cx="50%" cy="40%" r="60%"><stop offset="0%" stopColor="#fff3c4" stopOpacity=".9"/><stop offset="100%" stopColor="#ffce6b" stopOpacity="0"/></radialGradient>
        <linearGradient id="g-bl-cup" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fff7dc"/><stop offset="100%" stopColor="#d9a441"/></linearGradient>
      </defs>
      <circle cx="32" cy="30" r="26" fill="url(#g-bl-glow)"/>
      <path d="M18 16h28v6a14 14 0 0 1-14 14 14 14 0 0 1-14-14z" fill="url(#g-bl-cup)"/>
      <path d="M18 18h28" stroke="#fff7dc" strokeWidth="1.6" opacity=".8"/>
      <path d="M32 36v10M24 50h16M28 46h8" stroke="#d9a441" strokeWidth="3" strokeLinecap="round"/>
      <g stroke="#fff3c4" strokeWidth="1.6" strokeLinecap="round"><path d="M32 2v5M10 8l3.5 3.5M54 8l-3.5 3.5M6 24h5M53 24h5"/></g>
    </>
  ),
  'burning hands': (
    <>
      <defs>
        <radialGradient id="g-bh-fire" cx="50%" cy="60%" r="60%"><stop offset="0%" stopColor="#fff3c4"/><stop offset="55%" stopColor="#ff9d1e"/><stop offset="100%" stopColor="#d23200"/></radialGradient>
      </defs>
      <path d="M10 44V24a3 3 0 0 1 6 0M16 44V20a3 3 0 0 1 6 0M22 44V20a3 3 0 0 1 6 0M28 44V24a3 3 0 0 1 6 0" fill="none" stroke="#e9c9a0" strokeWidth="4" strokeLinecap="round"/>
      <path d="M8 40c2-8 8-12 18-12s16 4 18 12c-4 8-12 12-18 12S12 48 8 40z" fill="url(#g-bh-fire)" opacity=".92"/>
      <g fill="#fff3c4" opacity=".9"><path d="M18 22c1 3 4 3.6 4 6.4A3.4 3.4 0 0 1 18 32z"/><path d="M38 20c1.2 3.4 4.4 4 4.4 7a3.8 3.8 0 0 1-7.6 0c0-3 3.2-3.6 3.2-7z"/></g>
    </>
  ),
  'charm person': (
    <>
      <defs>
        <linearGradient id="g-ch-head" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ffe0f4"/><stop offset="100%" stopColor="#e07ad1"/></linearGradient>
        <radialGradient id="g-ch-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#ffb0e6" stopOpacity=".7"/><stop offset="100%" stopColor="#a0308a" stopOpacity="0"/></radialGradient>
      </defs>
      <circle cx="32" cy="30" r="25" fill="url(#g-ch-glow)"/>
      <circle cx="28" cy="26" r="13" fill="url(#g-ch-head)"/>
      <path d="M15 54c0-9 6-15 13-15s13 6 13 15z" fill="url(#g-ch-head)" opacity=".85"/>
      <g fill="#7a2a66"><circle cx="24" cy="25" r="1.4"/><circle cx="32" cy="25" r="1.4"/><path d="M24 32c2.6 2 5.4 2 8 0" stroke="#7a2a66" strokeWidth="1.6" fill="none" strokeLinecap="round"/></g>
      <path d="M45 14c3 3 6.6 5 6.6 8.6A4.6 4.6 0 0 1 47 27a4.6 4.6 0 0 1-4.6-4.4c0-3.6 3.6-5.6 6.6-8.6z" fill="#ff7ac6"/>
    </>
  ),
  'chromatic orb': (
    <>
      <defs>
        <linearGradient id="g-cho" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#ff6b6b"/><stop offset="25%" stopColor="#ffd166"/><stop offset="50%" stopColor="#7fd18a"/><stop offset="75%" stopColor="#5ad1ff"/><stop offset="100%" stopColor="#c77dff"/></linearGradient>
        <radialGradient id="g-cho-glow" cx="40%" cy="35%" r="60%"><stop offset="0%" stopColor="#ffffff" stopOpacity=".7"/><stop offset="100%" stopColor="#7aa2ff" stopOpacity="0"/></radialGradient>
      </defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-cho-glow)"/>
      <circle cx="32" cy="32" r="16" fill="url(#g-cho)"/>
      <path d="M32 16a16 16 0 0 1 0 32M18 24a20 20 0 0 0 0 16M46 24a20 20 0 0 1 0 16" stroke="#fff" strokeWidth="1.2" opacity=".5" fill="none"/>
      <circle cx="26" cy="26" r="3.4" fill="#fff" opacity=".85"/>
      <g fill="#fff"><circle cx="8" cy="14" r="1.2"/><circle cx="56" cy="18" r="1.2"/><circle cx="52" cy="50" r="1"/></g>
    </>
  ),
  'color spray': (
    <>
      <defs>
        <linearGradient id="g-cs-rain" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#ff6b6b"/><stop offset="33%" stopColor="#ffd166"/><stop offset="66%" stopColor="#4ecb71"/><stop offset="100%" stopColor="#5ad1ff"/></linearGradient>
      </defs>
      <path d="M8 54L40 12l6 4z" fill="#fff" opacity=".0"/>
      <path d="M6 56c4-14 16-30 34-42l6 8C28 34 20 44 16 58z" fill="url(#g-cs-rain)"/>
      <path d="M10 56c4-12 14-26 30-36" stroke="#fff" strokeWidth="1.4" opacity=".6" fill="none" strokeDasharray="3 4"/>
      <g fill="#fff"><circle cx="48" cy="14" r="1.8"/><circle cx="52" cy="22" r="1.3"/><circle cx="30" cy="20" r="1.4"/><circle cx="40" cy="30" r="1.1"/></g>
    </>
  ),
  command: (
    <>
      <defs>
        <radialGradient id="g-cm-glow" cx="50%" cy="40%" r="55%"><stop offset="0%" stopColor="#cfe0ff" stopOpacity=".8"/><stop offset="100%" stopColor="#4a5fd0" stopOpacity="0"/></radialGradient>
      </defs>
      <circle cx="32" cy="30" r="25" fill="url(#g-cm-glow)"/>
      <path d="M32 8l16 10v12l-16 10-16-10V18z" fill="none" stroke="#9fb0ff" strokeWidth="3"/>
      <path d="M22 22l10 6 10-6M32 28v14" stroke="#dbe4ff" strokeWidth="2.4" strokeLinecap="round" fill="none"/>
      <path d="M32 42l-5-4h10z" fill="#dbe4ff"/>
    </>
  ),
  'detect magic': (
    <>
      <defs>
        <radialGradient id="g-dm-glow" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#a9f0e6" stopOpacity=".8"/><stop offset="100%" stopColor="#2f8f9a" stopOpacity="0"/></radialGradient>
      </defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-dm-glow)"/>
      <path d="M6 32s9-14 26-14 26 14 26 14-9 14-26 14S6 32 6 32z" fill="none" stroke="#8fe0d6" strokeWidth="2.4"/>
      <circle cx="32" cy="32" r="8" fill="#d6fff8"/>
      <circle cx="32" cy="32" r="4" fill="#1a3a40"/>
      <circle cx="29" cy="29" r="2" fill="#eafffb"/>
      <g fill="none" stroke="#8fe0d6" strokeWidth="1.4" opacity=".8"><circle cx="32" cy="32" r="13"/><circle cx="32" cy="32" r="19"/></g>
    </>
  ),
  'disguise self': (
    <>
      <defs>
        <linearGradient id="g-ds-mask" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f0e6ff"/><stop offset="100%" stopColor="#9a7fd0"/></linearGradient>
        <radialGradient id="g-ds-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#c8b0ff" stopOpacity=".6"/><stop offset="100%" stopColor="#6a4fd0" stopOpacity="0"/></radialGradient>
      </defs>
      <circle cx="32" cy="32" r="25" fill="url(#g-ds-glow)"/>
      <path d="M8 18c4-2 8-2 12 0 2 12-2 22-6 26-4-4-8-14-6-26z" fill="url(#g-ds-mask)"/>
      <path d="M56 18c-4-2-8-2-12 0-2 12 2 22 6 26 4-4 8-14 6-26z" fill="url(#g-ds-mask)"/>
      <path d="M13 24c1.6-1.4 4-1.4 5.6 0M45.4 24c1.6-1.4 4-1.4 5.6 0" fill="none" stroke="#3a2a5a" strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M16 36c1.6 1.4 4 1.4 5.6 0M42.4 36c1.6 1.4 4 1.4 5.6 0" fill="none" stroke="#3a2a5a" strokeWidth="1.6" strokeLinecap="round" opacity=".8"/>
    </>
  ),
  'divine smite': (
    <>
      <defs>
        <linearGradient id="g-dsm-blade" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fffdf0"/><stop offset="100%" stopColor="#c9a24a"/></linearGradient>
        <radialGradient id="g-dsm-burst" cx="50%" cy="30%" r="65%"><stop offset="0%" stopColor="#fff3c4" stopOpacity=".95"/><stop offset="100%" stopColor="#ffb347" stopOpacity="0"/></radialGradient>
      </defs>
      <circle cx="32" cy="24" r="26" fill="url(#g-dsm-burst)"/>
      <path d="M32 4l4 8v22h-8V12z" fill="url(#g-dsm-blade)"/>
      <path d="M22 34h20M28 34v14h8V34" fill="none" stroke="#fff7dc" strokeWidth="2.4"/>
      <g stroke="#fff3c4" strokeWidth="2.4" strokeLinecap="round"><path d="M12 8l6 6M52 8l-6 6M10 24h7M47 24h7M14 40l5-4M50 40l-5-4"/></g>
    </>
  ),
  'faerie fire': (
    <>
      <defs>
        <linearGradient id="g-ff-out" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#7cf9ff"/><stop offset="50%" stopColor="#c77dff"/><stop offset="100%" stopColor="#ff7ac6"/></linearGradient>
      </defs>
      <path d="M32 8c-8 0-12 6-12 14v10c-6 4-10 10-10 16h44c0-6-4-12-10-16V22c0-8-4-14-12-14z" fill="none" stroke="url(#g-ff-out)" strokeWidth="3" strokeLinejoin="round" opacity=".95"/>
      <g fill="url(#g-ff-out)"><circle cx="14" cy="16" r="2.4"/><circle cx="50" cy="14" r="2.2"/><circle cx="10" cy="40" r="2"/><circle cx="54" cy="40" r="2"/><circle cx="32" cy="6" r="2.2"/><circle cx="26" cy="30" r="1.6"/><circle cx="40" cy="26" r="1.6"/></g>
      <g fill="#fff" opacity=".8"><circle cx="16" cy="18" r="1"/><circle cx="48" cy="16" r="1"/></g>
    </>
  ),
  'guiding bolt': (
    <>
      <defs>
        <linearGradient id="g-gb-lance" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fffdf0"/><stop offset="55%" stopColor="#ffe27a"/><stop offset="100%" stopColor="#ff9d1e" stopOpacity="0"/></linearGradient>
        <radialGradient id="g-gb-glow" cx="50%" cy="25%" r="60%"><stop offset="0%" stopColor="#fff3c4" stopOpacity=".9"/><stop offset="100%" stopColor="#ffce6b" stopOpacity="0"/></radialGradient>
      </defs>
      <circle cx="32" cy="20" r="26" fill="url(#g-gb-glow)"/>
      <path d="M32 2l6 14v26h-12V16z" fill="url(#g-gb-lance)"/>
      <path d="M26 16h12" stroke="#fff7dc" strokeWidth="2"/>
      <g stroke="#fff3c4" strokeWidth="2.2" strokeLinecap="round"><path d="M18 10l4 4M46 10l-4 4M14 24h-6M50 24h6"/></g>
      <g fill="#fff"><circle cx="20" cy="36" r="1.4"/><circle cx="46" cy="34" r="1.3"/><circle cx="36" cy="48" r="1.2"/></g>
    </>
  ),
  'healing word': (
    <>
      <defs>
        <radialGradient id="g-hw-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#b7ffd0" stopOpacity=".85"/><stop offset="100%" stopColor="#3fae63" stopOpacity="0"/></radialGradient>
        <linearGradient id="g-hw-plus" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f2fff7"/><stop offset="100%" stopColor="#3fae63"/></linearGradient>
      </defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-hw-glow)"/>
      <rect x="27" y="16" width="10" height="30" rx="3" fill="url(#g-hw-plus)"/>
      <rect x="17" y="26" width="30" height="10" rx="3" fill="url(#g-hw-plus)"/>
      <g fill="none" stroke="#7fe0a0" strokeWidth="2.2" strokeLinecap="round"><path d="M8 24a10 10 0 0 1 0 16" opacity=".8"/><path d="M56 24a10 10 0 0 0 0 16" opacity=".8"/></g>
    </>
  ),
  'hellish rebuke': (
    <>
      <defs>
        <radialGradient id="g-hr-fire" cx="50%" cy="55%" r="60%"><stop offset="0%" stopColor="#fff0c0"/><stop offset="55%" stopColor="#ff7a18"/><stop offset="100%" stopColor="#b02000"/></radialGradient>
      </defs>
      <path d="M12 50V28a3 3 0 0 1 6 0M18 50V24a3 3 0 0 1 6 0M24 50V24a3 3 0 0 1 6 0M30 50V28a3 3 0 0 1 6 0" fill="none" stroke="#5a2a10" strokeWidth="4.4" strokeLinecap="round"/>
      <path d="M10 46c2-10 9-15 22-15s20 5 22 15c-4 8-12 12-22 12S14 54 10 46z" fill="url(#g-hr-fire)" opacity=".95"/>
      <g fill="#ffe9a8" opacity=".9"><path d="M20 26c1.2 3.4 4.4 4 4.4 7a3.8 3.8 0 0 1-7.6 0c0-3 3.2-3.6 3.2-7z"/><path d="M42 22c1.2 3.4 4.4 4 4.4 7a3.8 3.8 0 0 1-7.6 0c0-3 3.2-3.6 3.2-7z"/></g>
    </>
  ),
  hex: (
    <>
      <defs>
        <radialGradient id="g-hx-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#a06bd8" stopOpacity=".6"/><stop offset="100%" stopColor="#2a1040" stopOpacity="0"/></radialGradient>
        <linearGradient id="g-hx-eye" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f0d9ff"/><stop offset="100%" stopColor="#5a2ecf"/></linearGradient>
      </defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-hx-glow)"/>
      <path d="M32 8l7 12h13l-10 8 4 13-14-8-14 8 4-13-10-8h13z" fill="none" stroke="#9a6fd0" strokeWidth="2.2" opacity=".9"/>
      <path d="M10 32s9-11 22-11 22 11 22 11-9 11-22 11S10 32 10 32z" fill="url(#g-hx-eye)"/>
      <circle cx="32" cy="32" r="4.6" fill="#2a1040"/>
      <circle cx="30.4" cy="30.4" r="1.6" fill="#e9dcff"/>
      <path d="M24 20l-4-5M40 20l4-5" stroke="#c9a6ff" strokeWidth="2" strokeLinecap="round"/>
    </>
  ),
  "hunter's mark": (
    <>
      <defs>
        <radialGradient id="g-hm-glow" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#8fd0ff" stopOpacity=".7"/><stop offset="100%" stopColor="#2f6fa0" stopOpacity="0"/></radialGradient>
      </defs>
      <circle cx="30" cy="32" r="25" fill="url(#g-hm-glow)"/>
      <circle cx="30" cy="32" r="15" fill="none" stroke="#bfe4ff" strokeWidth="3"/>
      <circle cx="30" cy="32" r="6" fill="none" stroke="#eaf6ff" strokeWidth="2.4"/>
      <path d="M30 12v8M30 44v8M10 32h8M42 32h8" stroke="#bfe4ff" strokeWidth="2.6" strokeLinecap="round"/>
      <path d="M44 44l12 12M56 40l-4 4" stroke="#dbeaff" strokeWidth="3" strokeLinecap="round"/>
      <circle cx="30" cy="32" r="2" fill="#fff"/>
    </>
  ),
  'ice knife': (
    <>
      <defs>
        <linearGradient id="g-ik-blade" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ffffff"/><stop offset="55%" stopColor="#9fe0ff"/><stop offset="100%" stopColor="#3f8fd6"/></linearGradient>
        <radialGradient id="g-ik-glow" cx="50%" cy="35%" r="60%"><stop offset="0%" stopColor="#cfeaff" stopOpacity=".8"/><stop offset="100%" stopColor="#5a9fd0" stopOpacity="0"/></radialGradient>
      </defs>
      <circle cx="32" cy="28" r="25" fill="url(#g-ik-glow)"/>
      <path d="M32 4l6 12v16h-12V16z" fill="url(#g-ik-blade)"/>
      <path d="M26 32h12M32 32v18" stroke="#eaf6ff" strokeWidth="2.6" strokeLinecap="round"/>
      <path d="M32 50l-4 6h8z" fill="#bfe4ff"/>
      <g fill="#eaf6ff"><circle cx="14" cy="14" r="1.6"/><circle cx="50" cy="14" r="1.4"/><circle cx="12" cy="44" r="1.2"/><circle cx="52" cy="42" r="1.2"/></g>
    </>
  ),
  'inflict wounds': (
    <>
      <defs>
        <linearGradient id="g-iw-hand" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#c9ffb0"/><stop offset="100%" stopColor="#2f7a3a"/></linearGradient>
        <radialGradient id="g-iw-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#7ad06a" stopOpacity=".6"/><stop offset="100%" stopColor="#1a3a20" stopOpacity="0"/></radialGradient>
      </defs>
      <circle cx="32" cy="34" r="25" fill="url(#g-iw-glow)"/>
      <path d="M20 40V26a3 3 0 0 1 6 0v8M26 34V22a3 3 0 0 1 6 0v12M32 34v-8a3 3 0 0 1 6 0v14a10 10 0 0 1-10 10h-4a8 8 0 0 1-8-8" fill="none" stroke="url(#g-iw-hand)" strokeWidth="4.4" strokeLinecap="round" strokeLinejoin="round"/>
      <g stroke="#7fe08a" strokeWidth="2.2" strokeLinecap="round"><path d="M12 12l6 6M52 12l-6 6M10 30h6M48 30h6M16 50l5-5M48 50l-5-5"/></g>
    </>
  ),
  'mage armor': (
    <>
      <defs>
        <linearGradient id="g-ma-plate" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#cfe6ff"/><stop offset="45%" stopColor="#6a9fe0"/><stop offset="100%" stopColor="#2f5aa0"/></linearGradient>
      </defs>
      <path d="M32 6l18 6v14c0 12-7 20-18 25-11-5-18-13-18-25V12z" fill="url(#g-ma-plate)"/>
      <path d="M32 6l18 6v4L32 10 14 16v-4z" fill="#fff" opacity=".35"/>
      <path d="M32 16l8 4v8l-8 4-8-4v-8z" fill="none" stroke="#eaf6ff" strokeWidth="2"/>
      <circle cx="32" cy="24" r="3.4" fill="#eaf6ff"/>
      <path d="M20 40l6-4M44 40l-6-4M16 28h6M42 28h6" stroke="#bfe0ff" strokeWidth="2" strokeLinecap="round" opacity=".8"/>
    </>
  ),
  sleep: (
    <>
      <defs>
        <radialGradient id="g-sl-moon" cx="40%" cy="40%" r="60%"><stop offset="0%" stopColor="#eaf3ff"/><stop offset="100%" stopColor="#7a8fd0"/></radialGradient>
        <radialGradient id="g-sl-glow" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#9fb6ff" stopOpacity=".55"/><stop offset="100%" stopColor="#3a4a8a" stopOpacity="0"/></radialGradient>
      </defs>
      <circle cx="30" cy="34" r="26" fill="url(#g-sl-glow)"/>
      <path d="M34 10a16 16 0 1 0 12 26 13 13 0 0 1-12-26z" fill="url(#g-sl-moon)"/>
      <g fill="#dbe6ff"><text x="40" y="20" fontFamily="system-ui, sans-serif" fontSize="12" fontWeight="700">z</text><text x="47" y="13" fontFamily="system-ui, sans-serif" fontSize="9" fontWeight="700">z</text></g>
      <g fill="#eaf3ff"><circle cx="14" cy="16" r="1.4"/><circle cx="52" cy="46" r="1.2"/><circle cx="12" cy="48" r="1"/></g>
    </>
  ),
  thunderwave: (
    <>
      <defs>
        <radialGradient id="g-tw-core" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#ffffff"/><stop offset="55%" stopColor="#9fd0ff"/><stop offset="100%" stopColor="#4a7fd0" stopOpacity="0"/></radialGradient>
      </defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-tw-core)"/>
      <g fill="none" stroke="#cfe8ff" strokeLinecap="round">
        <circle cx="32" cy="32" r="7" strokeWidth="3.4"/>
        <circle cx="32" cy="32" r="13" strokeWidth="2.8" opacity=".85"/>
        <circle cx="32" cy="32" r="19" strokeWidth="2.2" opacity=".6"/>
        <circle cx="32" cy="32" r="25" strokeWidth="1.6" opacity=".4"/>
      </g>
      <circle cx="32" cy="32" r="3.4" fill="#fff"/>
      <g fill="#dbeaff"><circle cx="52" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="12" cy="52" r="1.1"/><circle cx="52" cy="52" r="1.1"/></g>
    </>
  ),
  'beast bond': (
    <>
      <defs><radialGradient id="g-bb2-glow" cx="50%" cy="55%" r="55%"><stop offset="0%" stopColor="#bff29a" stopOpacity=".65"/><stop offset="100%" stopColor="#3f9d4e" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="38" r="24" fill="url(#g-bb2-glow)"/>
      <circle cx="32" cy="40" r="4.4" fill="#e9d6b0"/><circle cx="23" cy="32" r="2.4" fill="#e9d6b0"/><circle cx="29" cy="28" r="2.4" fill="#e9d6b0"/><circle cx="35" cy="28" r="2.4" fill="#e9d6b0"/><circle cx="41" cy="32" r="2.4" fill="#e9d6b0"/>
      <path d="M32 20c4 0 7 3 7 7s-3 6-7 6-7-2-7-6 3-7 7-7z" fill="#7fd18a" opacity=".9"/>
      <path d="M32 14v-4M26 16l-3-3M38 16l3-3" stroke="#bff29a" strokeWidth="2" strokeLinecap="round"/>
    </>
  ),
  catapult: (
    <>
      <defs><radialGradient id="g-cp-rock" cx="40%" cy="35%" r="60%"><stop offset="0%" stopColor="#d8d2c4"/><stop offset="100%" stopColor="#6b6353"/></radialGradient></defs>
      <g fill="none" stroke="#d8c9a0" strokeWidth="2" strokeLinecap="round" opacity=".8"><path d="M8 56C18 34 30 22 46 14"/><path d="M12 50C22 34 32 26 44 20" strokeDasharray="3 4"/></g>
      <circle cx="46" cy="14" r="9" fill="url(#g-cp-rock)"/>
      <path d="M40 12a6 6 0 0 1 6 2" stroke="#efeadf" strokeWidth="1.6" fill="none" opacity=".7"/>
      <path d="M6 58l14-4-2-8z" fill="#8a7a5a"/>
      <g fill="#e9e2d4"><circle cx="58" cy="26" r="1.4"/><circle cx="34" cy="10" r="1.2"/></g>
    </>
  ),
  'cause fear': (
    <>
      <defs><radialGradient id="g-cf2-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#b06bff" stopOpacity=".6"/><stop offset="100%" stopColor="#2a1040" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-cf2-glow)"/>
      <path d="M32 8a14 14 0 0 0-14 14c0 6 3.6 9.2 6 11v5h16v-5c2.4-1.8 6-5 6-11A14 14 0 0 0 32 8z" fill="#7a4fd0"/>
      <g fill="#1a0a2a"><circle cx="26" cy="22" r="2.6"/><circle cx="38" cy="22" r="2.6"/></g>
      <path d="M24 34c3 2.6 13 2.6 16 0" fill="none" stroke="#1a0a2a" strokeWidth="2" strokeLinecap="round"/>
      <g stroke="#c9a6ff" strokeWidth="2.4" strokeLinecap="round"><path d="M10 12l5 5M54 12l-5 5M8 30h5M51 30h5"/></g>
    </>
  ),
  ceremony: (
    <>
      <defs><radialGradient id="g-cer-glow" cx="50%" cy="40%" r="60%"><stop offset="0%" stopColor="#fff3c4" stopOpacity=".85"/><stop offset="100%" stopColor="#ffce6b" stopOpacity="0"/></radialGradient><linearGradient id="g-cer-cup" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fff7dc"/><stop offset="100%" stopColor="#d9a441"/></linearGradient></defs>
      <circle cx="32" cy="28" r="26" fill="url(#g-cer-glow)"/>
      <circle cx="32" cy="32" r="18" fill="none" stroke="#ffe9a8" strokeWidth="1.6" opacity=".75"/>
      <path d="M20 14h24v4a12 12 0 0 1-12 12 12 12 0 0 1-12-12z" fill="url(#g-cer-cup)"/>
      <path d="M32 30v12M25 46h14M28 42h8" stroke="#d9a441" strokeWidth="2.6" strokeLinecap="round"/>
      <g stroke="#fff3c4" strokeWidth="1.6" strokeLinecap="round"><path d="M32 4v4M14 8l3 3M50 8l-3 3"/></g>
    </>
  ),
  'chaos bolt': (
    <>
      <defs><radialGradient id="g-cb-core" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#fff"/><stop offset="45%" stopColor="#ff7ac6"/><stop offset="100%" stopColor="#5a2ecf"/></radialGradient></defs>
      <circle cx="32" cy="32" r="24" fill="url(#g-cb-core)" opacity=".9"/>
      <path d="M32 6c4 8 8 8 12 12s4 8-4 12 4 8 0 12-8 4-12-4-8 4-12 0 4-8-4-12 0-8 12-12-4-8 8-8z" fill="none" stroke="#ffe9ff" strokeWidth="2" opacity=".7"/>
      <circle cx="32" cy="32" r="6" fill="#fff"/>
      <g fill="#ffd6f2"><circle cx="14" cy="14" r="1.6"/><circle cx="50" cy="14" r="1.6"/><circle cx="14" cy="50" r="1.6"/><circle cx="50" cy="50" r="1.6"/></g>
    </>
  ),
  'compelled duel': (
    <>
      <defs><radialGradient id="g-cdu-glow" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#ffd6a0" stopOpacity=".6"/><stop offset="100%" stopColor="#a05020" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="25" fill="url(#g-cdu-glow)"/>
      <path d="M14 50L44 14l6 6-30 36z" fill="#c9d2de"/>
      <path d="M50 50L20 14l-6 6 30 36z" fill="#aab4c2"/>
      <circle cx="32" cy="32" r="20" fill="none" stroke="#ffb347" strokeWidth="2.4" strokeDasharray="4 5"/>
      <circle cx="32" cy="32" r="4" fill="#ffd6a0"/>
    </>
  ),
  'comprehend languages': (
    <>
      <defs><linearGradient id="g-cl-scroll" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f2e6c4"/><stop offset="100%" stopColor="#c9a86a"/></linearGradient></defs>
      <rect x="12" y="10" width="40" height="44" rx="4" fill="url(#g-cl-scroll)"/>
      <g stroke="#8a6a3a" strokeWidth="1.6" opacity=".7"><path d="M18 18h28M18 24h20M18 30h28M18 36h16"/></g>
      <path d="M30 44l6-2 6 6-6 2z" fill="#7aa2ff"/>
      <circle cx="42" cy="20" r="7" fill="none" stroke="#7aa2ff" strokeWidth="2.4"/>
      <path d="M47 25l6 6" stroke="#7aa2ff" strokeWidth="2.4" strokeLinecap="round"/>
    </>
  ),
  'create or destroy water': (
    <>
      <defs><linearGradient id="g-cdw-drop" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#dff4ff"/><stop offset="100%" stopColor="#2f8fd6"/></linearGradient></defs>
      <path d="M22 8s7 9 7 14a7 7 0 0 1-14 0c0-5 7-14 7-14z" fill="url(#g-cdw-drop)"/>
      <path d="M18 22v6M15 25h6" stroke="#eafaff" strokeWidth="2" strokeLinecap="round"/>
      <path d="M42 8s7 9 7 14a7 7 0 0 1-14 0c0-5 7-14 7-14z" fill="url(#g-cdw-drop)"/>
      <path d="M39 22l6 6M45 22l-6 6" stroke="#eafaff" strokeWidth="2" strokeLinecap="round"/>
      <path d="M6 44c4-3 8-3 12 0s8 3 12 0 8-3 12 0 8 3 12 0" fill="none" stroke="#7fc4ea" strokeWidth="2.4"/>
      <path d="M6 52c4-3 8-3 12 0s8 3 12 0 8-3 12 0 8 3 12 0" fill="none" stroke="#7fc4ea" strokeWidth="2.4" opacity=".6"/>
    </>
  ),
  'detect evil and good': (
    <>
      <defs><radialGradient id="g-deg-glow" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#fff3c4" stopOpacity=".7"/><stop offset="100%" stopColor="#8a6fd0" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-deg-glow)"/>
      <path d="M6 32s9-13 26-13 26 13 26 13-9 13-26 13S6 32 6 32z" fill="none" stroke="#ffe9a8" strokeWidth="2.4"/>
      <circle cx="32" cy="32" r="7" fill="#eaf6ff"/><circle cx="32" cy="32" r="3.4" fill="#2a3a5a"/>
      <path d="M20 12l3 4 3-4M44 12l-3 4-3-4" stroke="#ffe9a8" strokeWidth="2" fill="none" strokeLinecap="round"/>
      <path d="M20 52l3-4 3 4M44 52l-3-4-3 4" stroke="#c9a6ff" strokeWidth="2" fill="none" strokeLinecap="round"/>
    </>
  ),
  'detect poison and disease': (
    <>
      <defs><radialGradient id="g-dpd-glow" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#c8f07a" stopOpacity=".7"/><stop offset="100%" stopColor="#3a6a20" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-dpd-glow)"/>
      <path d="M6 32s9-13 26-13 26 13 26 13-9 13-26 13S6 32 6 32z" fill="none" stroke="#bff29a" strokeWidth="2.4"/>
      <circle cx="32" cy="32" r="7" fill="#eaffd6"/><circle cx="32" cy="32" r="3.4" fill="#2a4a20"/>
      <path d="M32 46s5 6 5 9a5 5 0 0 1-10 0c0-3 5-9 5-9z" fill="#7ec850"/>
      <path d="M30 55h4" stroke="#eaffd6" strokeWidth="1.6" strokeLinecap="round"/>
    </>
  ),
  'divine favor': (
    <>
      <defs><linearGradient id="g-df-blade" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fffdf0"/><stop offset="100%" stopColor="#c9a24a"/></linearGradient><radialGradient id="g-df-glow" cx="50%" cy="40%" r="60%"><stop offset="0%" stopColor="#fff3c4" stopOpacity=".85"/><stop offset="100%" stopColor="#ffce6b" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="26" r="26" fill="url(#g-df-glow)"/>
      <path d="M32 4l4 8v26h-8V12z" fill="url(#g-df-blade)"/>
      <path d="M22 38h20M28 38v14h8V38" fill="none" stroke="#fff7dc" strokeWidth="2.6"/>
      <g stroke="#fff3c4" strokeWidth="2" strokeLinecap="round" opacity=".9"><path d="M14 10l5 5M50 10l-5 5M12 24h6M46 24h6"/></g>
    </>
  ),
  'earth tremor': (
    <>
      <defs><radialGradient id="g-et-dirt" cx="50%" cy="30%" r="60%"><stop offset="0%" stopColor="#b08a5a"/><stop offset="100%" stopColor="#5a4020" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="30" r="24" fill="url(#g-et-dirt)"/>
      <path d="M4 40h56v16H4z" fill="#6b4f2a"/>
      <path d="M20 40l6-10 6 10zM36 40l5-8 5 8z" fill="#8a6a3a"/>
      <g fill="none" stroke="#ffce8a" strokeWidth="2" strokeLinecap="round"><path d="M8 34c3-4 7-4 10 0M26 30c3-4 7-4 10 0M44 34c3-4 7-4 10 0" opacity=".85"/></g>
      <g fill="#d9b98a"><circle cx="14" cy="24" r="1.4"/><circle cx="50" cy="22" r="1.4"/><circle cx="32" cy="16" r="1.2"/></g>
    </>
  ),
  'ensnaring strike': (
    <>
      <defs><linearGradient id="g-es-arrow" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#e9eef5"/><stop offset="100%" stopColor="#7d8b9c"/></linearGradient><radialGradient id="g-es-glow" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#bff29a" stopOpacity=".6"/><stop offset="100%" stopColor="#3f9d4e" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="34" r="25" fill="url(#g-es-glow)"/>
      <path d="M12 12l36 30M12 12l4-2M12 12l2 4" stroke="url(#g-es-arrow)" strokeWidth="2.6" strokeLinecap="round" fill="none"/>
      <g fill="none" stroke="#3f9d4e" strokeWidth="2.2" strokeLinecap="round"><path d="M20 20q8-4 16 2t16-2" opacity=".9"/><path d="M16 30q10-6 20 0t14-2" opacity=".8"/><path d="M24 40q8-4 16 2"/></g>
      <g fill="#7fd18a"><circle cx="24" cy="18" r="1.6"/><circle cx="42" cy="26" r="1.6"/><circle cx="30" cy="38" r="1.4"/></g>
    </>
  ),
  entangle: (
    <>
      <defs><radialGradient id="g-en-glow" cx="50%" cy="70%" r="60%"><stop offset="0%" stopColor="#7fd18a" stopOpacity=".6"/><stop offset="100%" stopColor="#2f6a3a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="40" r="26" fill="url(#g-en-glow)"/>
      <path d="M4 58c6-4 10-2 14-6s8-8 14-6 8 6 14 4 10-4 14-2" fill="none" stroke="#4a7a3a" strokeWidth="3" strokeLinecap="round"/>
      <g fill="none" stroke="#7fd18a" strokeWidth="3" strokeLinecap="round"><path d="M14 56c0-10 3-16 8-22M30 56c-2-12 0-20 4-28M46 56c0-10-3-16-8-20"/></g>
      <g fill="#bff29a"><path d="M22 34c-4-2-5-6-4-9 3 1 5 4 4 9z"/><path d="M34 28c4-2 5-6 4-9-3 1-5 4-4 9z"/><path d="M42 36c3-2 4-5 3-8-2 1-4 4-3 8z"/></g>
    </>
  ),
  'expeditious retreat': (
    <>
      <defs><linearGradient id="g-er-boot" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#d9b98a"/><stop offset="100%" stopColor="#7a5a30"/></linearGradient></defs>
      <path d="M26 6h10v28c0 6 4 8 8 12l-2 6H24c-4 0-6-2-6-6V30z" fill="url(#g-er-boot)"/>
      <g stroke="#9fd0ff" strokeWidth="3" strokeLinecap="round" opacity=".85"><path d="M12 16h14M6 24h16M10 32h14M4 40h14"/></g>
      <g fill="#dbeaff"><circle cx="50" cy="16" r="1.4"/><circle cx="54" cy="28" r="1.2"/></g>
    </>
  ),
  'false life': (
    <>
      <defs><radialGradient id="g-fl-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#b06bff" stopOpacity=".7"/><stop offset="100%" stopColor="#3a1266" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-fl-glow)"/>
      <path d="M32 50s-16-10-16-22a9 9 0 0 1 16-5.6A9 9 0 0 1 48 28c0 12-16 22-16 22z" fill="#7a4fd0"/>
      <path d="M32 50s-16-10-16-22a9 9 0 0 1 16-5.6" fill="#b06bff" opacity=".6"/>
      <path d="M26 30h12M32 24v12" stroke="#e9dcff" strokeWidth="2.6" strokeLinecap="round" opacity=".9"/>
      <path d="M20 12l3 3M44 12l-3 3" stroke="#c9a6ff" strokeWidth="2" strokeLinecap="round"/>
    </>
  ),
  'feather fall': (
    <>
      <defs><linearGradient id="g-fe-fea" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#eaf6ff"/><stop offset="100%" stopColor="#9fb6d0"/></linearGradient></defs>
      <path d="M42 6c-16 2-26 12-32 30l-4 12 12-4C26 40 32 26 42 6z" fill="url(#g-fe-fea)"/>
      <path d="M42 6L10 48M30 16l-6 8M26 24l-6 8M22 32l-6 8" stroke="#7d93ad" strokeWidth="1.6" opacity=".75" fill="none"/>
      <g fill="#cfe8ff"><circle cx="48" cy="18" r="1.4"/><circle cx="50" cy="30" r="1.2"/><circle cx="46" cy="42" r="1"/></g>
    </>
  ),
  'find familiar': (
    <>
      <defs><radialGradient id="g-ff2-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#bfe0ff" stopOpacity=".7"/><stop offset="100%" stopColor="#4a6fd0" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-ff2-glow)"/>
      <circle cx="32" cy="32" r="20" fill="none" stroke="#9cc8ff" strokeWidth="1.6" strokeDasharray="4 4" opacity=".8"/>
      <ellipse cx="32" cy="30" rx="9" ry="11" fill="#e9f2ff"/>
      <path d="M23 22l-3-8 7 5M41 22l3-8-7 5" fill="#e9f2ff"/>
      <g fill="#2a3a5a"><circle cx="28" cy="28" r="2"/><circle cx="36" cy="28" r="2"/><path d="M32 32l-2 3h4z"/></g>
      <path d="M26 44c4 2 8 2 12 0" fill="none" stroke="#9cc8ff" strokeWidth="1.6" opacity=".6"/>
      <g fill="#dbeaff"><circle cx="12" cy="16" r="1.4"/><circle cx="52" cy="16" r="1.4"/><circle cx="52" cy="48" r="1.2"/><circle cx="12" cy="48" r="1.2"/></g>
    </>
  ),
  'fog cloud': (
    <>
      <defs><radialGradient id="g-fc-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#cfe0e8" stopOpacity=".55"/><stop offset="100%" stopColor="#6a7a88" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-fc-glow)"/>
      <g fill="#c6d2dc"><circle cx="20" cy="30" r="11"/><circle cx="34" cy="24" r="13"/><circle cx="46" cy="32" r="10"/><circle cx="28" cy="40" r="12"/><circle cx="42" cy="44" r="9"/></g>
      <g fill="#eaf1f6" opacity=".7"><circle cx="22" cy="26" r="4"/><circle cx="34" cy="18" r="4"/><circle cx="44" cy="28" r="3.4"/></g>
    </>
  ),
  goodberry: (
    <>
      <defs><radialGradient id="g-gb2-berry" cx="40%" cy="35%" r="60%"><stop offset="0%" stopColor="#ff9ecb"/><stop offset="100%" stopColor="#a03060"/></radialGradient><radialGradient id="g-gb2-glow" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#ffb0d6" stopOpacity=".6"/><stop offset="100%" stopColor="#7a2a4a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="34" r="24" fill="url(#g-gb2-glow)"/>
      <circle cx="24" cy="38" r="8" fill="url(#g-gb2-berry)"/><circle cx="40" cy="40" r="7" fill="url(#g-gb2-berry)"/><circle cx="32" cy="26" r="8" fill="url(#g-gb2-berry)"/>
      <path d="M32 18c-4-4-10-4-12 0 4 2 8 2 12 0zM32 18c4-4 10-4 12 0-4 2-8 2-12 0z" fill="#7fd18a"/>
      <g fill="#ffe0ee" opacity=".8"><circle cx="21" cy="35" r="2"/><circle cx="29" cy="23" r="2"/><circle cx="38" cy="37" r="1.8"/></g>
    </>
  ),
  grease: (
    <>
      <defs><linearGradient id="g-gr-slick" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8a7a4a"/><stop offset="100%" stopColor="#3a3218"/></linearGradient></defs>
      <ellipse cx="32" cy="44" rx="26" ry="12" fill="url(#g-gr-slick)"/>
      <ellipse cx="32" cy="42" rx="18" ry="6" fill="#c9b060" opacity=".3"/>
      <path d="M22 12h12v10l4 16H18l4-16z" fill="#6b7a3a"/>
      <path d="M22 12h12v3H22z" fill="#8a9a4a"/>
      <g fill="#d9d060"><circle cx="18" cy="46" r="1.6"/><circle cx="44" cy="48" r="1.6"/><circle cx="34" cy="52" r="1.4"/><circle cx="26" cy="40" r="1.2"/></g>
    </>
  ),
  'hail of thorns': (
    <>
      <defs><linearGradient id="g-ht-arrow" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#e9eef5"/><stop offset="100%" stopColor="#7d8b9c"/></linearGradient></defs>
      <g fill="url(#g-ht-arrow)"><path d="M18 6l3 12h-6z"/><path d="M36 4l3 12h-6z"/><path d="M28 14l3 12h-6z"/><path d="M44 14l3 12h-6z"/></g>
      <g stroke="#3f9d4e" strokeWidth="2.4" strokeLinecap="round" fill="none"><path d="M6 40q10-6 20 0t20-2"/><path d="M8 50q10-6 20 0t18-2"/></g>
      <g fill="#7fd18a"><path d="M14 38l3-5 1 5z"/><path d="M30 42l3-5 1 5z"/><path d="M44 36l3-5 1 5z"/></g>
    </>
  ),
  heroism: (
    <>
      <defs><radialGradient id="g-he-glow" cx="50%" cy="40%" r="60%"><stop offset="0%" stopColor="#ffd6a0" stopOpacity=".8"/><stop offset="100%" stopColor="#d07020" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="30" r="26" fill="url(#g-he-glow)"/>
      <path d="M32 8l18 7v12c0 12-8 19-18 23-10-4-18-11-18-23V15z" fill="#c9762a"/>
      <path d="M32 8l18 7v4L32 12 14 19v-4z" fill="#ffd6a0" opacity=".6"/>
      <path d="M32 18l3.4 7 7.6.7-5.6 5 1.6 7.4L32 34.4 24.6 38l1.6-7.4-5.6-5 7.6-.7z" fill="#fff2c4"/>
    </>
  ),
  identify: (
    <>
      <defs><radialGradient id="g-id-gem" cx="40%" cy="35%" r="60%"><stop offset="0%" stopColor="#e0f7ff"/><stop offset="100%" stopColor="#3f8fd6"/></radialGradient></defs>
      <path d="M22 18l10-8 10 8-10 22z" fill="url(#g-id-gem)" opacity=".95"/>
      <path d="M22 18h20M32 10v30" stroke="#eafaff" strokeWidth="1.2" opacity=".6" fill="none"/>
      <circle cx="34" cy="30" r="12" fill="none" stroke="#9cc8ff" strokeWidth="3"/>
      <path d="M43 39l10 10" stroke="#9cc8ff" strokeWidth="3.4" strokeLinecap="round"/>
      <path d="M34 24v6" stroke="#eafaff" strokeWidth="1.6" strokeLinecap="round"/>
    </>
  ),
  'illusory script': (
    <>
      <defs><linearGradient id="g-is-scroll" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f2e6c4"/><stop offset="100%" stopColor="#bfa46a"/></linearGradient></defs>
      <rect x="14" y="8" width="36" height="48" rx="4" fill="url(#g-is-scroll)"/>
      <path d="M14 14c-4 0-4 6 0 6M50 44c4 0 4 6 0 6" fill="none" stroke="#8a6a3a" strokeWidth="1.6"/>
      <g stroke="#8a6a3a" strokeWidth="1.6" opacity=".7"><path d="M20 18h24M20 24h18M20 30h24M20 36h16"/></g>
      <path d="M20 42l4 6 4-4 4 6 4-5 4 5 4-4" fill="none" stroke="#a98bff" strokeWidth="2" strokeLinecap="round"/>
      <g fill="#c9a6ff"><circle cx="44" cy="18" r="1.6"/><circle cx="24" cy="30" r="1.3"/></g>
    </>
  ),
  jump: (
    <>
      <defs><radialGradient id="g-jp-glow" cx="50%" cy="40%" r="55%"><stop offset="0%" stopColor="#a9f0e6" stopOpacity=".6"/><stop offset="100%" stopColor="#2f8f9a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="30" r="26" fill="url(#g-jp-glow)"/>
      <circle cx="28" cy="14" r="4.4" fill="#d6fff8"/>
      <path d="M28 19c-3 4-3 9 2 12l-6 8M28 24l8 3 6-4M30 31l-6 11" fill="none" stroke="#d6fff8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M6 46c8-10 14-14 20-14" fill="none" stroke="#8fe0d6" strokeWidth="2.4" strokeDasharray="3 4" opacity=".8"/>
      <g fill="#d6fff8"><circle cx="50" cy="16" r="1.3"/><circle cx="52" cy="30" r="1.1"/></g>
    </>
  ),
  longstrider: (
    <>
      <defs><linearGradient id="g-ls-boot" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#d9b98a"/><stop offset="100%" stopColor="#7a5a30"/></linearGradient></defs>
      <path d="M30 4h10v30c0 6 4 8 8 12l-2 6H28c-4 0-6-2-6-6V28z" fill="url(#g-ls-boot)"/>
      <g stroke="#9fd0ff" strokeWidth="3" strokeLinecap="round" opacity=".85"><path d="M6 14h16M2 22h18M6 30h16M2 38h18"/></g>
      <g fill="#dbeaff"><circle cx="50" cy="14" r="1.3"/><circle cx="54" cy="26" r="1.1"/></g>
    </>
  ),
  'protection from evil and good': (
    <>
      <defs><linearGradient id="g-pe-shield" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#eaf4ff"/><stop offset="100%" stopColor="#4a7fd0"/></linearGradient><radialGradient id="g-pe-halo" cx="50%" cy="45%" r="60%"><stop offset="0%" stopColor="#dff0ff" stopOpacity=".8"/><stop offset="100%" stopColor="#7a9fd0" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="27" fill="url(#g-pe-halo)"/>
      <circle cx="32" cy="32" r="21" fill="none" stroke="#eaf4ff" strokeWidth="1.6" strokeDasharray="3 4" opacity=".8"/>
      <path d="M32 8l18 7v12c0 12-8 19-18 23-10-4-18-11-18-23V15z" fill="url(#g-pe-shield)"/>
      <path d="M32 18l3 6 7 .6-5 4.4 1.4 6.6L32 32.2 25.6 35.6 27 29l-5-4.4 7-.6z" fill="#eaf4ff"/>
    </>
  ),
  'purify food and drink': (
    <>
      <defs><linearGradient id="g-pu-cup" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f2e6c4"/><stop offset="100%" stopColor="#bfa46a"/></linearGradient><radialGradient id="g-pu-glow" cx="50%" cy="40%" r="55%"><stop offset="0%" stopColor="#f0fff0" stopOpacity=".7"/><stop offset="100%" stopColor="#7fd18a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="30" r="26" fill="url(#g-pu-glow)"/>
      <path d="M18 24h28v6a14 14 0 0 1-28 0z" fill="url(#g-pu-cup)"/>
      <path d="M18 26h28" stroke="#fff" strokeWidth="1.4" opacity=".7"/>
      <path d="M32 40v8M24 50h16" stroke="#bfa46a" strokeWidth="3" strokeLinecap="round"/>
      <path d="M44 10l1.6 3.6L49 15l-3.4 1.4L44 20l-1.6-3.6L39 15l3.4-1.4z" fill="#bff29a"/>
      <path d="M16 12l1.2 2.6L20 16l-2.8 1.2L16 20l-1.2-2.8L12 16l2.8-1.4z" fill="#d9ffbf"/>
    </>
  ),
  'ray of sickness': (
    <>
      <defs><linearGradient id="g-rs-ray" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#d9ffb0"/><stop offset="100%" stopColor="#4a8a20"/></linearGradient></defs>
      <path d="M6 54L30 30l6 6-24 24z" fill="url(#g-rs-ray)" opacity=".9"/>
      <circle cx="44" cy="20" r="14" fill="url(#g-rs-ray)" opacity=".5"/>
      <circle cx="44" cy="20" r="9" fill="#bff29a"/>
      <g fill="#3a6a20"><circle cx="41" cy="17" r="1.6"/><circle cx="47" cy="20" r="1.4"/><circle cx="43" cy="24" r="1.4"/></g>
      <g fill="#eaffd6"><circle cx="14" cy="14" r="1.4"/><circle cx="52" cy="42" r="1.3"/></g>
    </>
  ),
  sanctuary: (
    <>
      <defs><linearGradient id="g-san-shield" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fff7dc"/><stop offset="100%" stopColor="#d9a441"/></linearGradient><radialGradient id="g-san-glow" cx="50%" cy="40%" r="60%"><stop offset="0%" stopColor="#fff3c4" stopOpacity=".8"/><stop offset="100%" stopColor="#ffce6b" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="27" fill="url(#g-san-glow)"/>
      <circle cx="32" cy="32" r="22" fill="none" stroke="#fff3c4" strokeWidth="1.8" opacity=".85"/>
      <path d="M32 8l18 7v12c0 12-8 19-18 23-10-4-18-11-18-23V15z" fill="url(#g-san-shield)"/>
      <circle cx="32" cy="26" r="6" fill="none" stroke="#fff7dc" strokeWidth="2.6"/>
      <path d="M32 32v10" stroke="#fff7dc" strokeWidth="2.6" strokeLinecap="round"/>
    </>
  ),
  'searing smite': (
    <>
      <defs><linearGradient id="g-ssm-blade" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fffdf0"/><stop offset="100%" stopColor="#a09088"/></linearGradient><radialGradient id="g-ssm-fire" cx="50%" cy="55%" r="55%"><stop offset="0%" stopColor="#ffd166" stopOpacity=".95"/><stop offset="100%" stopColor="#ff6a00" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="34" r="24" fill="url(#g-ssm-fire)"/>
      <path d="M32 4l4 8v24h-8V12z" fill="url(#g-ssm-blade)"/>
      <path d="M22 36h20M28 36v14h8V36" fill="none" stroke="#e9c9a0" strokeWidth="2.6"/>
      <path d="M32 34c-4 4-3 8 0 11 3-3 4-7 0-11z" fill="#ffd166"/>
      <path d="M23 30c-2 3-1 6 1 8 1-3 2-5-1-8zM41 30c2 3 1 6-1 8-1-3-2-5 1-8z" fill="#ff9d1e"/>
    </>
  ),
  'shield of faith': (
    <>
      <defs><linearGradient id="g-sof-shield" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#eaf4ff"/><stop offset="100%" stopColor="#4a7fd0"/></linearGradient><radialGradient id="g-sof-glow" cx="50%" cy="40%" r="60%"><stop offset="0%" stopColor="#dff0ff" stopOpacity=".8"/><stop offset="100%" stopColor="#7a9fd0" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="27" fill="url(#g-sof-glow)"/>
      <path d="M32 8l18 7v12c0 12-8 19-18 23-10-4-18-11-18-23V15z" fill="url(#g-sof-shield)"/>
      <path d="M32 8l18 7v12c0 12-8 19-18 23" fill="#fff" opacity=".15"/>
      <path d="M32 16l3 6 6.6.6-4.8 4.4 1.2 6.4L32 30.2 26 33.4l1.2-6.4-4.8-4.4 6.6-.6z" fill="#eaf4ff"/>
      <g fill="none" stroke="#dff0ff" strokeWidth="1.8" strokeLinecap="round" opacity=".8"><path d="M14 10c-4 2-6 6-6 10M50 10c4 2 6 6 6 10"/></g>
    </>
  ),
  'silent image': (
    <>
      <defs><linearGradient id="g-si-ill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f0e6ff" stopOpacity=".85"/><stop offset="100%" stopColor="#a98bff" stopOpacity=".25"/></linearGradient></defs>
      <path d="M32 6c-6 0-10 5-10 12v8c-6 4-10 10-10 18h40c0-8-4-14-10-18v-8c0-7-4-12-10-12z" fill="url(#g-si-ill)"/>
      <circle cx="32" cy="20" r="6" fill="none" stroke="#d9c9ff" strokeWidth="2" opacity=".8"/>
      <path d="M32 30v14" stroke="#d9c9ff" strokeWidth="2" strokeLinecap="round" opacity=".8"/>
      <g stroke="#c9a6ff" strokeWidth="1.6" strokeDasharray="3 3" opacity=".7" fill="none"><path d="M6 52h52M6 46h52"/></g>
    </>
  ),
  snare: (
    <>
      <defs><radialGradient id="g-sn-glow" cx="50%" cy="60%" r="55%"><stop offset="0%" stopColor="#bff29a" stopOpacity=".6"/><stop offset="100%" stopColor="#3f6a2a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="38" r="25" fill="url(#g-sn-glow)"/>
      <path d="M32 4v14" stroke="#8a6a3a" strokeWidth="3" strokeLinecap="round"/>
      <ellipse cx="32" cy="34" rx="14" ry="8" fill="none" stroke="#c9a86a" strokeWidth="3.4"/>
      <path d="M18 34c0 10 6 16 14 16s14-6 14-16" fill="none" stroke="#c9a86a" strokeWidth="3.4"/>
      <g fill="#7fd18a"><path d="M32 22c-3-2-4-5-3-8 2 1 4 4 3 8z"/><circle cx="20" cy="40" r="1.4"/><circle cx="44" cy="40" r="1.4"/></g>
    </>
  ),
  'speak with animals': (
    <>
      <defs><linearGradient id="g-swa-bubble" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#eaf6ff"/><stop offset="100%" stopColor="#7aa2ff"/></linearGradient></defs>
      <path d="M8 10h30a6 6 0 0 1 6 6v10a6 6 0 0 1-6 6H22L10 44V32H8a6 6 0 0 1-6-6V16a6 6 0 0 1 6-6z" fill="url(#g-swa-bubble)"/>
      <g fill="#3a4a6a"><circle cx="15" cy="21" r="1.6"/><circle cx="22" cy="21" r="1.6"/><circle cx="29" cy="21" r="1.6"/></g>
      <circle cx="46" cy="42" r="4" fill="#e9d6b0"/><circle cx="40" cy="35" r="2.2" fill="#e9d6b0"/><circle cx="46" cy="32" r="2.2" fill="#e9d6b0"/><circle cx="52" cy="35" r="2.2" fill="#e9d6b0"/>
    </>
  ),
  "tasha's caustic brew": (
    <>
      <defs><linearGradient id="g-tcb-vial" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#dff4ff"/><stop offset="100%" stopColor="#4a8a20"/></linearGradient><radialGradient id="g-tcb-glow" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#cdf07a" stopOpacity=".6"/><stop offset="100%" stopColor="#4a8a20" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="36" r="24" fill="url(#g-tcb-glow)"/>
      <path d="M22 8h20v6l4 26a8 8 0 0 1-8 8H26a8 8 0 0 1-8-8l4-26z" fill="url(#g-tcb-vial)" opacity=".9"/>
      <path d="M22 14h20" stroke="#eafaff" strokeWidth="1.6" opacity=".7"/>
      <g fill="#3a6a20"><circle cx="28" cy="34" r="2"/><circle cx="36" cy="38" r="2.4"/><circle cx="31" cy="44" r="1.8"/><circle cx="38" cy="30" r="1.6"/></g>
      <path d="M32 6V2M28 6l-2-3M36 6l2-3" stroke="#bff29a" strokeWidth="1.8" strokeLinecap="round" opacity=".8"/>
    </>
  ),
  "tasha's hideous laughter": (
    <>
      <defs><linearGradient id="g-thl-head" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ffe0f4"/><stop offset="100%" stopColor="#e07ad1"/></linearGradient></defs>
      <path d="M32 8a18 18 0 0 1 18 18c0 4-1 7-3 10l2 8-8-4c-3 1.4-6 2-9 2A18 18 0 0 1 32 8z" fill="url(#g-thl-head)"/>
      <path d="M22 24c2-2 5-2 7 0M35 24c2-2 5-2 7 0" fill="none" stroke="#7a2a66" strokeWidth="2" strokeLinecap="round"/>
      <path d="M20 32c4 6 20 6 24 0-2 6-6 9-12 9s-10-3-12-9z" fill="#7a2a66"/>
      <path d="M31 32v6M28 34h6" stroke="#ffe0f4" strokeWidth="1.4"/>
      <g fill="#ffb0e6"><circle cx="12" cy="14" r="1.6"/><circle cx="52" cy="14" r="1.6"/></g>
    </>
  ),
  "tenser's floating disk": (
    <>
      <defs><radialGradient id="g-tfd-disk" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#fff"/><stop offset="60%" stopColor="#9fd0ff"/><stop offset="100%" stopColor="#4a7fd0"/></radialGradient></defs>
      <ellipse cx="32" cy="36" rx="24" ry="10" fill="url(#g-tfd-disk)"/>
      <ellipse cx="32" cy="34" rx="24" ry="10" fill="none" stroke="#eaf6ff" strokeWidth="1.6" opacity=".7"/>
      <ellipse cx="32" cy="34" rx="14" ry="5" fill="none" stroke="#eaf6ff" strokeWidth="1.2" opacity=".5"/>
      <g fill="none" stroke="#9fd0ff" strokeWidth="1.6" opacity=".6"><path d="M12 22c6-4 34-4 40 0M18 16c5-3 23-3 28 0"/></g>
      <g fill="#dbeaff"><circle cx="10" cy="30" r="1.4"/><circle cx="54" cy="30" r="1.4"/></g>
    </>
  ),
  'thunderous smite': (
    <>
      <defs><linearGradient id="g-tsm-blade" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f2f6ff"/><stop offset="100%" stopColor="#8a94a2"/></linearGradient></defs>
      <path d="M32 4l4 8v24h-8V12z" fill="url(#g-tsm-blade)"/>
      <path d="M22 36h20M28 36v14h8V36" fill="none" stroke="#c9d2de" strokeWidth="2.6"/>
      <g fill="none" stroke="#bfe4ff" strokeWidth="2.2" strokeLinecap="round" opacity=".9"><path d="M14 12a8 8 0 0 0 0 12M10 8a14 14 0 0 0 0 20"/><path d="M50 12a8 8 0 0 1 0 12M54 8a14 14 0 0 1 0 20"/></g>
      <circle cx="32" cy="46" r="3" fill="#dbeaff"/>
    </>
  ),
  'unseen servant': (
    <>
      <defs><radialGradient id="g-us-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#cfe0ff" stopOpacity=".5"/><stop offset="100%" stopColor="#5a7fd0" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="25" fill="url(#g-us-glow)"/>
      <circle cx="32" cy="16" r="7" fill="none" stroke="#cfe0ff" strokeWidth="1.8" strokeDasharray="4 3" opacity=".8"/>
      <path d="M18 52c0-10 6-18 14-18s14 8 14 18" fill="none" stroke="#cfe0ff" strokeWidth="1.8" strokeDasharray="4 3" opacity=".8"/>
      <path d="M24 30l-6 12M40 30l6 12" stroke="#cfe0ff" strokeWidth="1.8" strokeDasharray="4 3" fill="none" opacity=".8"/>
      <g fill="#eaf2ff"><circle cx="12" cy="14" r="1.3"/><circle cx="52" cy="14" r="1.3"/><circle cx="50" cy="48" r="1.1"/></g>
    </>
  ),
  'witch bolt': (
    <>
      <defs><linearGradient id="g-wb-bolt" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#fff6c4"/><stop offset="100%" stopColor="#9fd0ff"/></linearGradient><radialGradient id="g-wb-glow" cx="30%" cy="40%" r="60%"><stop offset="0%" stopColor="#ffe9a0" stopOpacity=".7"/><stop offset="100%" stopColor="#4a7fd0" stopOpacity="0"/></radialGradient></defs>
      <circle cx="26" cy="32" r="24" fill="url(#g-wb-glow)"/>
      <path d="M8 8l6 10h-5l6 8h-5l7 8" fill="none" stroke="url(#g-wb-bolt)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M30 30c8 2 12 8 12 16" fill="none" stroke="url(#g-wb-bolt)" strokeWidth="3" strokeLinecap="round" strokeDasharray="5 4"/>
      <circle cx="14" cy="14" r="3.4" fill="#fff6c4"/>
      <circle cx="44" cy="46" r="4" fill="#cfe8ff"/>
      <g fill="#dbeaff"><circle cx="30" cy="50" r="1.3"/><circle cx="48" cy="26" r="1.2"/></g>
    </>
  ),
  'wrathful smite': (
    <>
      <defs><linearGradient id="g-wsm-blade" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f2eaf0"/><stop offset="100%" stopColor="#8a7080"/></linearGradient><radialGradient id="g-wsm-glow" cx="50%" cy="40%" r="60%"><stop offset="0%" stopColor="#c77dff" stopOpacity=".6"/><stop offset="100%" stopColor="#5a2ecf" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="28" r="25" fill="url(#g-wsm-glow)"/>
      <path d="M32 4l4 8v24h-8V12z" fill="url(#g-wsm-blade)"/>
      <path d="M22 36h20M28 36v14h8V36" fill="none" stroke="#b8a4b4" strokeWidth="2.6"/>
      <g fill="none" stroke="#c9a6ff" strokeWidth="2.2" strokeLinecap="round"><path d="M12 12c4 2 6 6 6 10M52 12c-4 2-6 6-6 10"/></g>
      <path d="M24 24l4 4M40 24l-4 4" stroke="#e9dcff" strokeWidth="2" strokeLinecap="round"/>
    </>
  ),
  'zephyr strike': (
    <>
      <defs><linearGradient id="g-zs-blade" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f2f6ff"/><stop offset="100%" stopColor="#8a94a2"/></linearGradient><linearGradient id="g-zs-wind" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#dff6ff" stopOpacity="0"/><stop offset="100%" stopColor="#9be7ff"/></linearGradient></defs>
      <path d="M32 4l4 8v26h-8V12z" fill="url(#g-zs-blade)"/>
      <path d="M22 38h20M28 38v14h8V38" fill="none" stroke="#c9d2de" strokeWidth="2.6"/>
      <g fill="none" stroke="url(#g-zs-wind)" strokeWidth="3" strokeLinecap="round"><path d="M6 18h18M2 26h20M8 34h16M4 42h18"/></g>
      <g fill="#dff6ff"><circle cx="52" cy="16" r="1.4"/><circle cx="54" cy="30" r="1.2"/></g>
    </>
  ),
  'mold earth': (
    <>
      <defs><linearGradient id="g-me-dirt" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#b08a5a"/><stop offset="100%" stopColor="#5a4020"/></linearGradient></defs>
      <path d="M6 44h30l-6-14H12z" fill="url(#g-me-dirt)"/>
      <path d="M30 44v10M24 54l10-4" stroke="#8a6a3a" strokeWidth="3" strokeLinecap="round"/>
      <path d="M44 10v16M38 14l6-6 6 6" fill="none" stroke="#c9d2de" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
      <g fill="#d9b98a"><circle cx="14" cy="30" r="1.4"/><circle cx="22" cy="34" r="1.2"/><circle cx="50" cy="44" r="1.4"/></g>
    </>
  ),
  'poison spray': (
    <>
      <defs><radialGradient id="g-ps-cloud" cx="50%" cy="50%" r="60%"><stop offset="0%" stopColor="#d9ff8a" stopOpacity=".95"/><stop offset="100%" stopColor="#4a8a20" stopOpacity="0"/></radialGradient></defs>
      <path d="M6 44h6l-4 10z" fill="#8a9a4a"/>
      <circle cx="36" cy="30" r="20" fill="url(#g-ps-cloud)"/>
      <g fill="#a3e635"><circle cx="28" cy="24" r="4"/><circle cx="40" cy="24" r="5"/><circle cx="34" cy="36" r="5.4"/><circle cx="46" cy="34" r="3.6"/><circle cx="22" cy="34" r="3.4"/></g>
      <g fill="#eaffd6" opacity=".8"><circle cx="27" cy="22" r="1.4"/><circle cx="38" cy="22" r="1.6"/><circle cx="33" cy="34" r="1.8"/></g>
    </>
  ),
  prestidigitation: (
    <>
      <defs><radialGradient id="g-pre-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#fff3c4" stopOpacity=".8"/><stop offset="100%" stopColor="#c77dff" stopOpacity="0"/></radialGradient></defs>
      <circle cx="34" cy="34" r="24" fill="url(#g-pre-glow)"/>
      <path d="M8 56L34 30" stroke="#c9a24a" strokeWidth="4" strokeLinecap="round"/>
      <path d="M40 6l2.2 5.4L47.6 13l-5.4 2.2L40 20l-2.2-4.8L32.4 13l5.4-1.6z" fill="#fff3c4"/>
      <path d="M50 22l1.4 3 3 1.4-3 1.4L50 31l-1.4-3.2-3-1.4 3-1.4z" fill="#c77dff"/>
      <path d="M22 14l1.2 2.6 2.8 1.2-2.8 1.2L22 22l-1.2-2.8L18 18l2.8-1.4z" fill="#9fe8ff"/>
    </>
  ),
  'primal savagery': (
    <>
      <defs><linearGradient id="g-prs-claw" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#e9e2d4"/><stop offset="100%" stopColor="#8a7a5a"/></linearGradient><radialGradient id="g-prs-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#c9ffb0" stopOpacity=".5"/><stop offset="100%" stopColor="#2f6a3a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="25" fill="url(#g-prs-glow)"/>
      <g fill="none" stroke="url(#g-prs-claw)" strokeWidth="3.4" strokeLinecap="round"><path d="M16 20c-2 8 0 14 4 20M26 16c-2 8 0 16 4 22M36 16c-2 8 0 16 4 22M46 20c-2 8-2 14-6 20"/></g>
      <path d="M22 52c6 4 14 4 20 0l-4-8H26z" fill="#7fd18a" opacity=".8"/>
      <g fill="#e9e2d4"><circle cx="20" cy="52" r="1.6"/><circle cx="32" cy="56" r="1.6"/><circle cx="44" cy="52" r="1.6"/></g>
    </>
  ),
  'produce flame': (
    <>
      <defs><radialGradient id="g-pf-core" cx="50%" cy="40%" r="60%"><stop offset="0%" stopColor="#fff3c4"/><stop offset="60%" stopColor="#ff9d2e"/><stop offset="100%" stopColor="#d23200"/></radialGradient></defs>
      <path d="M14 40V26a3 3 0 0 1 6 0M20 40V24a3 3 0 0 1 6 0" fill="none" stroke="#e9c9a0" strokeWidth="4" strokeLinecap="round"/>
      <path d="M32 6c3.4 6.6 10 8.6 10 16a10 10 0 0 1-20 0c0-4.6 2.4-7 4.6-9 .6 2.6 1.8 4.4 3.8 5.4C31 12.6 31 9 32 6z" fill="url(#g-pf-core)"/>
      <path d="M32 20c1.4 2.6 3.4 3.4 3.4 6.2A3.4 3.4 0 0 1 32 29a3.4 3.4 0 0 1-3.4-4C28.6 23.4 30.6 22.4 32 20z" fill="#fff7dc" opacity=".9"/>
      <path d="M26 42c4 4 8 4 12 0" fill="none" stroke="#e9c9a0" strokeWidth="4" strokeLinecap="round"/>
    </>
  ),
  'ray of frost': (
    <>
      <defs><linearGradient id="g-rf-ray" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#eaf6ff"/><stop offset="100%" stopColor="#5db9ff"/></linearGradient></defs>
      <path d="M6 54L30 30l6 6-24 24z" fill="url(#g-rf-ray)" opacity=".9"/>
      <g fill="#eaf6ff"><path d="M48 10l1.6 4L54 15.6l-4.4 1.6L48 22l-1.6-4.8L42 15.6l4.4-1.6z"/></g>
      <g stroke="#cfeaff" strokeWidth="2" strokeLinecap="round"><path d="M44 30v8M40 34l8 0M41.5 31.5l5 5M46.5 31.5l-5 5"/></g>
      <g fill="#eaf6ff"><circle cx="14" cy="14" r="1.3"/><circle cx="56" cy="46" r="1.2"/></g>
    </>
  ),
  resistance: (
    <>
      <defs><linearGradient id="g-res-shield" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#eaf4ff"/><stop offset="100%" stopColor="#4a7fd0"/></linearGradient><radialGradient id="g-res-glow" cx="50%" cy="45%" r="60%"><stop offset="0%" stopColor="#dff0ff" stopOpacity=".7"/><stop offset="100%" stopColor="#7a9fd0" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-res-glow)"/>
      <path d="M32 8l18 7v12c0 12-8 19-18 23-10-4-18-11-18-23V15z" fill="url(#g-res-shield)"/>
      <path d="M32 20v18M24 28h16" stroke="#fff" strokeWidth="3.4" strokeLinecap="round"/>
    </>
  ),
  'sacred flame': (
    <>
      <defs><linearGradient id="g-sf-flame" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fffdf0"/><stop offset="100%" stopColor="#ff9d1e"/></linearGradient><radialGradient id="g-sf-glow" cx="50%" cy="30%" r="60%"><stop offset="0%" stopColor="#fff3c4" stopOpacity=".95"/><stop offset="100%" stopColor="#ffce6b" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="22" r="26" fill="url(#g-sf-glow)"/>
      <path d="M32 2l4 10v14h-8V12z" fill="#fff3c4"/>
      <path d="M32 26c3 4 7 5 7 9a7 7 0 0 1-14 0c0-4 4-5 7-9z" fill="url(#g-sf-flame)"/>
      <path d="M24 48c6 2 10 2 16 0" fill="none" stroke="#fff3c4" strokeWidth="2" strokeLinecap="round" opacity=".8"/>
      <g fill="#fff7d6"><circle cx="16" cy="38" r="1.4"/><circle cx="48" cy="38" r="1.4"/></g>
    </>
  ),
  'shape water': (
    <>
      <defs><linearGradient id="g-shw" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#dff4ff"/><stop offset="100%" stopColor="#2f8fd6"/></linearGradient></defs>
      <path d="M32 6s12 15 12 22a12 12 0 0 1-24 0c0-7 12-22 12-22z" fill="url(#g-shw)"/>
      <path d="M24 28c0 6 4 10 8 10 3 0 5-2 5-5" fill="none" stroke="#eafaff" strokeWidth="2" strokeLinecap="round" opacity=".7"/>
      <path d="M6 52c5-4 9-4 14 0s9 4 14 0 9-4 14 0" fill="none" stroke="#7fc4ea" strokeWidth="2.4"/>
      <g fill="#eafaff"><circle cx="14" cy="16" r="1.3"/><circle cx="50" cy="18" r="1.2"/></g>
    </>
  ),
  shillelagh: (
    <>
      <defs><linearGradient id="g-shl-club" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#a97a3a"/><stop offset="100%" stopColor="#5a3a18"/></linearGradient><radialGradient id="g-shl-glow" cx="45%" cy="35%" r="55%"><stop offset="0%" stopColor="#c9ffb0" stopOpacity=".6"/><stop offset="100%" stopColor="#3f7a3a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="30" cy="24" r="24" fill="url(#g-shl-glow)"/>
      <path d="M18 56L34 24" stroke="url(#g-shl-club)" strokeWidth="7" strokeLinecap="round"/>
      <path d="M34 24c-4-4-3-10 2-13 5 3 6 9 2 13-1.5 1-2.5 1-4 0z" fill="#7a5a2a"/>
      <path d="M32 10c-2-3-6-3-8 0 2 2 5 2 8 0zM40 12c2-3 6-3 8 0-2 2-5 2-8 0z" fill="#7fd18a"/>
      <g fill="#e9ffd6"><circle cx="16" cy="20" r="1.3"/><circle cx="48" cy="30" r="1.2"/></g>
    </>
  ),
  'shocking grasp': (
    <>
      <defs><linearGradient id="g-sg-hand" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f0d6ad"/><stop offset="100%" stopColor="#a0784a"/></linearGradient><radialGradient id="g-sg-glow" cx="60%" cy="40%" r="55%"><stop offset="0%" stopColor="#fff6c4" stopOpacity=".8"/><stop offset="100%" stopColor="#ff9d1e" stopOpacity="0"/></radialGradient></defs>
      <circle cx="40" cy="30" r="24" fill="url(#g-sg-glow)"/>
      <path d="M14 44V30a3 3 0 0 1 6 0M20 44V26a3 3 0 0 1 6 0M26 44V26a3 3 0 0 1 6 0M32 44v-14a3 3 0 0 1 6 0v14a10 10 0 0 1-10 10h-4a8 8 0 0 1-8-8" fill="none" stroke="url(#g-sg-hand)" strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M42 6l-6 10h5l-3 10 9-12h-5z" fill="#fff6c4"/>
      <g fill="#ffe9a8"><circle cx="34" cy="20" r="1.4"/><circle cx="50" cy="30" r="1.3"/></g>
    </>
  ),
  'sorcerous burst': (
    <>
      <defs><radialGradient id="g-sob" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#ffffff"/><stop offset="60%" stopColor="#ff7ac6"/><stop offset="100%" stopColor="#5a2ecf" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="24" fill="url(#g-sob)"/>
      <g stroke="#fff" strokeWidth="2.4" strokeLinecap="round" opacity=".9"><path d="M32 8v8M32 48v8M8 32h8M48 32h8M15 15l6 6M43 43l6 6M49 15l-6 6M21 43l-6 6"/></g>
      <circle cx="32" cy="32" r="5" fill="#fff"/>
      <g fill="#ffd6f2"><circle cx="20" cy="20" r="1.6"/><circle cx="44" cy="20" r="1.6"/><circle cx="20" cy="44" r="1.6"/><circle cx="44" cy="44" r="1.6"/></g>
    </>
  ),
  'spare the dying': (
    <>
      <defs><radialGradient id="g-spd-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#cfe0e8" stopOpacity=".6"/><stop offset="100%" stopColor="#5a6a7a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="30" cy="36" r="25" fill="url(#g-spd-glow)"/>
      <path d="M16 44V30a3 3 0 0 1 6 0M22 44V26a3 3 0 0 1 6 0M28 44v-8a3 3 0 0 1 6 0v8a10 10 0 0 1-10 10h-2a8 8 0 0 1-8-8" fill="none" stroke="#aab8c6" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M46 8v12M41 13h10" stroke="#7fe0a0" strokeWidth="3" strokeLinecap="round"/>
      <circle cx="46" cy="14" r="9" fill="none" stroke="#7fe0a0" strokeWidth="1.4" opacity=".6"/>
    </>
  ),
  'starry wisp': (
    <>
      <defs><radialGradient id="g-stw-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#d6ecff" stopOpacity=".85"/><stop offset="100%" stopColor="#7aa2ff" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-stw-glow)"/>
      <path d="M24 8l2.6 6.4L33 17l-6.4 2.6L24 26l-2.6-6.4L15 17l6.4-2.6z" fill="#eaf4ff"/>
      <path d="M44 26c4 0 7 2.4 7 5.4 0 2-1.8 3.6-4.2 3.6H36" fill="none" stroke="#cfe0ff" strokeWidth="2.4" strokeLinecap="round"/>
      <path d="M36 42c6 0 10 2 10 4.4 0 1.6-1.4 2.6-3.4 2.6H32" fill="none" stroke="#cfe0ff" strokeWidth="2.4" strokeLinecap="round"/>
      <g fill="#fff"><circle cx="48" cy="14" r="1.4"/><circle cx="14" cy="44" r="1.3"/><circle cx="50" cy="44" r="1"/></g>
    </>
  ),
  'sword burst': (
    <>
      <defs><linearGradient id="g-swb" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#e9eef5"/><stop offset="100%" stopColor="#8494a6"/></linearGradient><radialGradient id="g-swb-glow" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#c9a6ff" stopOpacity=".6"/><stop offset="100%" stopColor="#5a2ecf" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-swb-glow)"/>
      <g fill="url(#g-swb)">
        <path d="M32 2l2.6 5v9h-5.2V7z"/><path d="M32 62l-2.6-5v-9h5.2v9z"/>
        <path d="M2 32l5-2.6h9v5.2H7z"/><path d="M62 32l-5 2.6h-9v-5.2h9z"/>
      </g>
      <g stroke="#cfe0ff" strokeWidth="2" strokeLinecap="round"><path d="M14 18l8 8M50 18l-8 8M50 46l-8-8M14 46l8-8"/></g>
      <circle cx="32" cy="32" r="4" fill="#eaf4ff"/>
    </>
  ),
  thaumaturgy: (
    <>
      <defs><radialGradient id="g-tha-glow" cx="50%" cy="40%" r="55%"><stop offset="0%" stopColor="#ffd6a0" stopOpacity=".7"/><stop offset="100%" stopColor="#a05020" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="28" r="26" fill="url(#g-tha-glow)"/>
      <g fill="none" stroke="#e9c9a0" strokeWidth="3" strokeLinecap="round"><path d="M8 26c4-5 8-5 12 0M36 26c4-5 8-5 12 0"/></g>
      <ellipse cx="14" cy="30" rx="4" ry="3" fill="#fff2c4"/><ellipse cx="50" cy="30" rx="4" ry="3" fill="#fff2c4"/>
      <ellipse cx="14" cy="30" rx="1.6" ry="2.4" fill="#2a1a0a"/><ellipse cx="50" cy="30" rx="1.6" ry="2.4" fill="#2a1a0a"/>
      <path d="M32 46c3 3 3 7 0 10-3-3-3-7 0-10z" fill="#ffb347"/>
      <path d="M26 52h12" stroke="#e9c9a0" strokeWidth="2" strokeLinecap="round" opacity=".7"/>
    </>
  ),
  'thorn whip': (
    <>
      <defs><linearGradient id="g-thw-vine" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#bff29a"/><stop offset="100%" stopColor="#3f7a2a"/></linearGradient></defs>
      <path d="M6 8c8 4 12 12 10 20-2 8 2 14 12 18" fill="none" stroke="url(#g-thw-vine)" strokeWidth="4" strokeLinecap="round"/>
      <g fill="#e9ffd6"><path d="M14 14l-4-1 2 4z"/><path d="M18 26l-4-1 2 4z"/><path d="M20 38l-4-1 2 4z"/><path d="M28 46l-4-1 2 4z"/></g>
      <circle cx="28" cy="46" r="4" fill="#7fd18a"/>
      <g fill="#bff29a"><circle cx="44" cy="14" r="1.3"/><circle cx="16" cy="52" r="1.2"/></g>
    </>
  ),
  thunderclap: (
    <>
      <defs><radialGradient id="g-tcl-glow" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#ffffff" stopOpacity=".8"/><stop offset="100%" stopColor="#9fd0ff" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-tcl-glow)"/>
      <g fill="none" stroke="#cfe8ff" strokeWidth="3" strokeLinecap="round">
        <circle cx="32" cy="32" r="8"/><circle cx="32" cy="32" r="14" opacity=".8"/><circle cx="32" cy="32" r="20" opacity=".55"/><circle cx="32" cy="32" r="25" opacity=".35"/></g>
      <g stroke="#eaf6ff" strokeWidth="2.4" strokeLinecap="round"><path d="M12 12l5 5M52 12l-5 5M52 52l-5-5M12 52l5-5"/></g>
      <circle cx="32" cy="32" r="3" fill="#fff"/>
    </>
  ),
  'toll the dead': (
    <>
      <defs><linearGradient id="g-ttd-bell" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#d8d2c4"/><stop offset="100%" stopColor="#6b6353"/></linearGradient><radialGradient id="g-ttd-glow" cx="50%" cy="40%" r="55%"><stop offset="0%" stopColor="#b06bff" stopOpacity=".6"/><stop offset="100%" stopColor="#2a1040" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="30" r="26" fill="url(#g-ttd-glow)"/>
      <path d="M32 8a14 14 0 0 1 14 14c0 10 3 12 5 15H13c2-3 5-5 5-15A14 14 0 0 1 32 8z" fill="url(#g-ttd-bell)"/>
      <path d="M14 37h36" stroke="#4a4238" strokeWidth="2"/>
      <path d="M26 41a6 6 0 0 0 12 0z" fill="#6b6353"/>
      <circle cx="32" cy="6" r="2.4" fill="#d8d2c4"/>
    </>
  ),
  'true strike': (
    <>
      <defs><radialGradient id="g-tr-glow" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#a9f0e6" stopOpacity=".7"/><stop offset="100%" stopColor="#2f8f9a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-tr-glow)"/>
      <circle cx="32" cy="32" r="16" fill="none" stroke="#d6fff8" strokeWidth="2.4"/>
      <circle cx="32" cy="32" r="7" fill="none" stroke="#d6fff8" strokeWidth="2.4"/>
      <path d="M32 6v8M32 50v8M6 32h8M50 32h8" stroke="#d6fff8" strokeWidth="2.4" strokeLinecap="round"/>
      <path d="M32 24l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" fill="#fff"/>
    </>
  ),
  'vicious mockery': (
    <>
      <defs><linearGradient id="g-vm-face" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ffe0f4"/><stop offset="100%" stopColor="#c76ad1"/></linearGradient></defs>
      <path d="M10 14h36a8 8 0 0 1 8 8v8a8 8 0 0 1-8 8H26L12 48V38h-2a8 8 0 0 1-8-8v-8a8 8 0 0 1 8-8z" fill="url(#g-vm-face)"/>
      <path d="M18 22l6 3-6 3M42 22l-6 3 6 3" fill="none" stroke="#5a2a5a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M16 32c6 4 22 4 28 0-2 6-8 9-14 9s-12-3-14-9z" fill="#5a2a5a"/>
      <path d="M22 34l3 4M28 34v5M34 34l-3 4" stroke="#ffe0f4" strokeWidth="1.2"/>
      <g fill="#ff7ac6"><circle cx="52" cy="10" r="1.4"/><circle cx="8" cy="10" r="1.4"/></g>
    </>
  ),
  'word of radiance': (
    <>
      <defs><radialGradient id="g-wr-glow" cx="50%" cy="40%" r="60%"><stop offset="0%" stopColor="#fff3c4" stopOpacity=".9"/><stop offset="100%" stopColor="#ffce6b" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="28" r="26" fill="url(#g-wr-glow)"/>
      <path d="M12 22h5v20h-5a5 5 0 0 1 0-10z" fill="none" stroke="#ffe9a8" strokeWidth="2.6"/>
      <path d="M28 22h5a5 5 0 0 1 0 10h-5zM28 36h5a5 5 0 0 1 0 10h-5z" fill="none" stroke="#ffe9a8" strokeWidth="2.6"/>
      <path d="M44 22h5a5 5 0 0 1 0 10h-5z" fill="none" stroke="#ffe9a8" strokeWidth="2.6"/>
      <g stroke="#fff3c4" strokeWidth="2" strokeLinecap="round"><path d="M32 4v5M12 6l3 4M52 6l-3 4"/></g>
    </>
  ),
  "aganazzar's scorcher": (
    <>
      <defs><radialGradient id="g-agz-fire" cx="50%" cy="60%" r="60%"><stop offset="0%" stopColor="#fff3c4"/><stop offset="60%" stopColor="#ff7a18"/><stop offset="100%" stopColor="#b02000"/></radialGradient></defs>
      <path d="M4 56L52 8" stroke="url(#g-agz-fire)" strokeWidth="12" strokeLinecap="round" opacity=".85"/>
      <path d="M4 56L52 8" stroke="#fff3c4" strokeWidth="3" strokeLinecap="round" opacity=".7"/>
      <g fill="#ff9d1e"><path d="M40 6c1.2 3.4 4.4 4 4.4 7a3.8 3.8 0 0 1-7.6 0c0-3 3.2-3.6 3.2-7z"/><path d="M20 26c1.2 3.4 4.4 4 4.4 7a3.8 3.8 0 0 1-7.6 0c0-3 3.2-3.6 3.2-7z"/></g>
      <g fill="#ffce6b"><circle cx="50" cy="36" r="1.4"/><circle cx="14" cy="20" r="1.3"/></g>
    </>
  ),
  aid: (
    <>
      <defs><radialGradient id="g-aid-glow" cx="50%" cy="40%" r="60%"><stop offset="0%" stopColor="#b7ffd0" stopOpacity=".85"/><stop offset="100%" stopColor="#3fae63" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="30" r="26" fill="url(#g-aid-glow)"/>
      <path d="M20 10h6v10h10v6H26v10h-6V26H10v-6h10z" fill="#7fe0a0" opacity="0"/>
      <path d="M22 12h6v8h8v6h-8v8h-6v-8h-8v-6h8z" fill="#bff29a"/>
      <path d="M38 30l1.6 3.6L43 35l-3.4 1.4L38 40l-1.6-3.6L33 35l3.4-1.4z" fill="#eafff1"/>
      <g fill="#bff29a"><circle cx="46" cy="20" r="1.4"/><circle cx="48" cy="44" r="1.3"/></g>
    </>
  ),
  'alter self': (
    <>
      <defs><radialGradient id="g-alt-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#c8b0ff" stopOpacity=".6"/><stop offset="100%" stopColor="#5a2ecf" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-alt-glow)"/>
      <path d="M20 24c0-7 5-12 12-12s12 5 12 12" fill="none" stroke="#d9c9ff" strokeWidth="2.4"/>
      <circle cx="32" cy="24" r="7" fill="#e9dcff"/>
      <path d="M18 52c0-8 6-14 14-14s14 6 14 14" fill="none" stroke="#d9c9ff" strokeWidth="2.4"/>
      <path d="M24 16c4-3 12-3 16 0" fill="none" stroke="#e9dcff" strokeWidth="2" strokeDasharray="3 3"/>
    </>
  ),
  'animal messenger': (
    <>
      <defs><radialGradient id="g-am-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#bff29a" stopOpacity=".6"/><stop offset="100%" stopColor="#3f7a2a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="34" r="25" fill="url(#g-am-glow)"/>
      <ellipse cx="30" cy="30" rx="8" ry="10" fill="#e9d6b0"/>
      <path d="M22 22l-2-8 6 5M38 22l2-8-6 5" fill="#e9d6b0"/>
      <g fill="#3a2a1a"><circle cx="27" cy="28" r="1.6"/><circle cx="33" cy="28" r="1.6"/><path d="M30 31l-2 3h4z"/></g>
      <path d="M30 14h14v8l-5-3h-9z" fill="#9ad0ff"/>
      <path d="M36 44c4-3 6-7 4-11" fill="none" stroke="#bff29a" strokeWidth="2" strokeLinecap="round" opacity=".8"/>
    </>
  ),
  'arcane lock': (
    <>
      <defs><linearGradient id="g-alo-lock" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#e9c9a0"/><stop offset="100%" stopColor="#8a6a3a"/></linearGradient><radialGradient id="g-alo-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#9cc8ff" stopOpacity=".6"/><stop offset="100%" stopColor="#3a5f9a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-alo-glow)"/>
      <rect x="16" y="26" width="32" height="26" rx="5" fill="url(#g-alo-lock)"/>
      <path d="M22 26v-6a10 10 0 0 1 20 0v6" fill="none" stroke="#c9d2de" strokeWidth="4"/>
      <circle cx="32" cy="38" r="4" fill="#4a3a20"/>
      <path d="M32 42v6" stroke="#4a3a20" strokeWidth="3" strokeLinecap="round"/>
      <path d="M40 8l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#9cc8ff"/>
    </>
  ),
  'arcane vigor': (
    <>
      <defs><radialGradient id="g-avg-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#c77dff" stopOpacity=".7"/><stop offset="100%" stopColor="#4a1a8a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-avg-glow)"/>
      <path d="M32 50s-16-10-16-22a9 9 0 0 1 16-5.6A9 9 0 0 1 48 28c0 12-16 22-16 22z" fill="#8a5cf0"/>
      <path d="M32 16v10M27 21h10" stroke="#f0e6ff" strokeWidth="2.6" strokeLinecap="round"/>
      <g stroke="#c9a6ff" strokeWidth="1.8" strokeLinecap="round"><path d="M14 14l4 4M50 14l-4 4M12 30h5M47 30h5"/></g>
    </>
  ),
  augury: (
    <>
      <defs><radialGradient id="g-aug-glow" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#c9c0ff" stopOpacity=".7"/><stop offset="100%" stopColor="#5a4fd0" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-aug-glow)"/>
      <path d="M32 6l9 16h-6l9 16H12l9-16h-6z" fill="none" stroke="#d9c9ff" strokeWidth="2.2"/>
      <circle cx="32" cy="32" r="13" fill="none" stroke="#9fa8ff" strokeWidth="1.4" strokeDasharray="3 4"/>
      <circle cx="32" cy="32" r="4" fill="#e9e6ff"/>
      <path d="M32 10l1.4 3 3 1.4-3 1.4L32 19l-1.4-3.2-3-1.4 3-1.4z" fill="#fff"/>
    </>
  ),
  barkskin: (
    <>
      <defs><linearGradient id="g-bk-bark" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#c99a5a"/><stop offset="100%" stopColor="#5a3a18"/></linearGradient></defs>
      <path d="M32 6l18 7v13c0 12-8 19-18 23-10-4-18-11-18-23V13z" fill="url(#g-bk-bark)"/>
      <g stroke="#3a2510" strokeWidth="1.6" opacity=".7"><path d="M18 16l6 6-4 4 6 6-4 4M32 12v10l-5 4 5 5v9M46 18l-6 6 3 4-5 5 3 4"/></g>
      <path d="M32 6l18 7v4L32 10 14 17v-4z" fill="#e0b878" opacity=".5"/>
    </>
  ),
  'beast sense': (
    <>
      <defs><radialGradient id="g-bse-glow" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#bff29a" stopOpacity=".6"/><stop offset="100%" stopColor="#3f7a2a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-bse-glow)"/>
      <path d="M6 32s9-12 26-12 26 12 26 12-9 12-26 12S6 32 6 32z" fill="none" stroke="#bff29a" strokeWidth="2.4"/>
      <ellipse cx="32" cy="32" rx="6" ry="7" fill="#eaffd6"/><ellipse cx="32" cy="32" rx="2" ry="6" fill="#2a4a20"/>
      <path d="M24 20l-3-6 6 3M40 20l3-6-6 3" fill="#7fd18a"/>
    </>
  ),
  'blindness/deafness': (
    <>
      <defs><radialGradient id="g-bld-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#9a6fd0" stopOpacity=".6"/><stop offset="100%" stopColor="#2a1040" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-bld-glow)"/>
      <path d="M8 24s7-10 18-10 18 10 18 10-7 10-18 10S8 24 8 24z" fill="none" stroke="#c9a6ff" strokeWidth="2.2" opacity=".85"/>
      <circle cx="26" cy="24" r="4" fill="#e9dcff" opacity=".6"/>
      <path d="M10 12l28 28" stroke="#1a0a2a" strokeWidth="4" strokeLinecap="round"/>
      <path d="M10 12l28 28" stroke="#c9a6ff" strokeWidth="1.6" strokeLinecap="round"/>
      <path d="M40 38c4-3 6-3 8 0M40 46c4-3 6-3 8 0" fill="none" stroke="#9a6fd0" strokeWidth="2" strokeLinecap="round" opacity=".7"/>
    </>
  ),
  blur: (
    <>
      <defs><radialGradient id="g-blr-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#c8b0ff" stopOpacity=".6"/><stop offset="100%" stopColor="#5a2ecf" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-blr-glow)"/>
      <g fill="none" stroke="#c8b0ff" strokeWidth="2.2"><circle cx="28" cy="32" r="14" opacity=".4"/><circle cx="32" cy="32" r="14" opacity=".7"/><circle cx="36" cy="32" r="14"/></g>
      <circle cx="32" cy="26" r="7" fill="#e9dcff" opacity=".85"/>
      <path d="M20 50c3-6 7-9 12-9s9 3 12 9" fill="none" stroke="#e9dcff" strokeWidth="2.4" opacity=".85"/>
    </>
  ),
  'calm emotions': (
    <>
      <defs><radialGradient id="g-cae-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#bfe0ff" stopOpacity=".7"/><stop offset="100%" stopColor="#4a7fd0" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-cae-glow)"/>
      <path d="M32 50s-16-10-16-22a9 9 0 0 1 16-5.6A9 9 0 0 1 48 28c0 12-16 22-16 22z" fill="#9cc8ff" opacity=".9"/>
      <path d="M22 30h20" stroke="#eaf6ff" strokeWidth="3" strokeLinecap="round"/>
      <g fill="#eaf6ff"><circle cx="14" cy="14" r="1.4"/><circle cx="50" cy="14" r="1.4"/><circle cx="50" cy="48" r="1.2"/></g>
    </>
  ),
  'cloud of daggers': (
    <>
      <defs><linearGradient id="g-cod-dag" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#eef3f9"/><stop offset="100%" stopColor="#8494a6"/></linearGradient><radialGradient id="g-cod-glow" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#cfe0ff" stopOpacity=".5"/><stop offset="100%" stopColor="#5a6a9a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="24" fill="url(#g-cod-glow)"/>
      <g fill="url(#g-cod-dag)"><path d="M20 8l3 8-3 3-3-3z"/><path d="M32 6l3 10-3 4-3-4z"/><path d="M44 10l3 8-3 3-3-3z"/><path d="M14 30l3 8-3 3-3-3z"/><path d="M50 30l3 8-3 3-3-3z"/><path d="M26 46l3 8-3 3-3-3z"/><path d="M38 46l3 8-3 3-3-3z"/></g>
      <circle cx="32" cy="30" r="3" fill="#fff" opacity=".6"/>
    </>
  ),
  'continual flame': (
    <>
      <defs><radialGradient id="g-cof-glow" cx="50%" cy="45%" r="60%"><stop offset="0%" stopColor="#ffcf6b" stopOpacity=".95"/><stop offset="100%" stopColor="#ff6a00" stopOpacity="0"/></radialGradient><linearGradient id="g-cof-hand" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#d9b98a"/><stop offset="100%" stopColor="#7a5a30"/></linearGradient></defs>
      <circle cx="32" cy="30" r="26" fill="url(#g-cof-glow)"/>
      <path d="M18 56V44c0-8 6-12 14-12s14 4 14 12v12z" fill="url(#g-cof-hand)"/>
      <path d="M32 6c3 6 9 8 9 14a9 9 0 0 1-18 0c0-6 6-8 9-14z" fill="#ffd166"/>
      <path d="M32 20c1.4 2.6 3.4 3.4 3.4 6.2A3.4 3.4 0 0 1 32 29a3.4 3.4 0 0 1-3.4-4C28.6 23.4 30.6 22.4 32 20z" fill="#fff7dc"/>
    </>
  ),
  'cordon of arrows': (
    <>
      <defs><linearGradient id="g-coa-arr" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#e9eef5"/><stop offset="100%" stopColor="#7d8b9c"/></linearGradient></defs>
      <ellipse cx="32" cy="48" rx="24" ry="8" fill="none" stroke="#9cc8ff" strokeWidth="2" strokeDasharray="4 4" opacity=".8"/>
      <g fill="url(#g-coa-arr)"><path d="M12 20l3 10-3 3-3-3z"/><path d="M24 12l3 12-3 4-3-4z"/><path d="M40 12l3 12-3 4-3-4z"/><path d="M52 20l3 10-3 3-3-3z"/></g>
      <g fill="#cfe0ff"><circle cx="12" cy="36" r="1.4"/><circle cx="52" cy="36" r="1.4"/><circle cx="32" cy="30" r="1.2"/></g>
    </>
  ),
  'crown of madness': (
    <>
      <defs><linearGradient id="g-com-crown" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ffe0f4"/><stop offset="100%" stopColor="#c76ad1"/></linearGradient><radialGradient id="g-com-glow" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#ffb0e6" stopOpacity=".6"/><stop offset="100%" stopColor="#7a2a66" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="38" r="26" fill="url(#g-com-glow)"/>
      <circle cx="32" cy="40" r="10" fill="#e9dcff"/>
      <g fill="#2a1040"><circle cx="28" cy="38" r="1.6"/><circle cx="36" cy="38" r="1.6"/><path d="M26 45c4 3 8 3 12 0" stroke="#2a1040" strokeWidth="1.6" fill="none" strokeLinecap="round"/></g>
      <path d="M18 24l4-12 6 7 4-9 4 9 6-7 4 12z" fill="url(#g-com-crown)"/>
      <circle cx="32" cy="16" r="2" fill="#ff7ac6"/>
    </>
  ),
  darkness: (
    <>
      <defs><radialGradient id="g-dar-glow" cx="50%" cy="45%" r="60%"><stop offset="0%" stopColor="#7a2ecf" stopOpacity=".7"/><stop offset="100%" stopColor="#0a0410" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="27" fill="url(#g-dar-glow)"/>
      <circle cx="32" cy="32" r="17" fill="#0a0414"/>
      <circle cx="32" cy="32" r="17" fill="none" stroke="#5a2ecf" strokeWidth="2" opacity=".8"/>
      <g stroke="#9a6fd0" strokeWidth="1.6" strokeLinecap="round" opacity=".8"><path d="M12 12l5 5M52 12l-5 5M12 52l5-5M52 52l-5-5"/></g>
      <circle cx="24" cy="26" r="2" fill="#4a2a7a"/>
    </>
  ),
  darkvision: (
    <>
      <defs><radialGradient id="g-dav-glow" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#9a6fd0" stopOpacity=".6"/><stop offset="100%" stopColor="#1a0a2a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-dav-glow)"/>
      <path d="M6 32s9-12 26-12 26 12 26 12-9 12-26 12S6 32 6 32z" fill="#2a1040"/>
      <circle cx="32" cy="32" r="8" fill="#c9a6ff"/>
      <circle cx="32" cy="32" r="3" fill="#1a0a2a"/>
      <g fill="none" stroke="#7a4fd0" strokeWidth="1.4" opacity=".7"><circle cx="32" cy="32" r="13"/><circle cx="32" cy="32" r="18"/></g>
    </>
  ),
  'detect thoughts': (
    <>
      <defs><radialGradient id="g-det-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#c77dff" stopOpacity=".6"/><stop offset="100%" stopColor="#3a1266" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-det-glow)"/>
      <path d="M14 14a14 14 0 0 1 24 10c0 5-3 7-3 11 0 3-2 5-5 5h-6" fill="none" stroke="#c9a6ff" strokeWidth="3" strokeLinecap="round"/>
      <path d="M30 40v6M30 50v.5" stroke="#e9dcff" strokeWidth="3" strokeLinecap="round"/>
      <path d="M44 8a10 10 0 0 1 6 9" fill="none" stroke="#ff7ac6" strokeWidth="2" strokeLinecap="round" opacity=".85"/>
      <circle cx="42" cy="28" r="2" fill="#ff7ac6"/>
    </>
  ),
  "dragon's breath": (
    <>
      <defs><linearGradient id="g-drb" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#fff3c4"/><stop offset="50%" stopColor="#ff7a18"/><stop offset="100%" stopColor="#c77dff"/></linearGradient></defs>
      <path d="M10 40c6-14 16-24 30-30l-6 12c4-2 8-3 12-3-6 6-10 10-12 16-4 8-12 12-22 12z" fill="url(#g-drb)"/>
      <path d="M22 34c6-6 12-10 18-12" fill="none" stroke="#fff7dc" strokeWidth="2" strokeLinecap="round" opacity=".7"/>
      <g fill="#ffe9a8"><circle cx="46" cy="12" r="1.6"/><circle cx="50" cy="24" r="1.3"/><circle cx="16" cy="20" r="1.2"/></g>
    </>
  ),
  'dust devil': (
    <>
      <defs><radialGradient id="g-dud-glow" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#d9c9a0" stopOpacity=".6"/><stop offset="100%" stopColor="#7a6a4a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="25" fill="url(#g-dud-glow)"/>
      <path d="M32 6c8 4 8 12 0 16s-8 12 0 16 8 12 0 16" fill="none" stroke="#c9b98a" strokeWidth="3" strokeLinecap="round"/>
      <path d="M20 18c-4 3-4 8 0 11M44 18c4 3 4 8 0 11M22 40c-3 3-3 6 0 9M42 40c3 3 3 6 0 9" fill="none" stroke="#b0a078" strokeWidth="2" opacity=".7"/>
      <g fill="#e0d0a8"><circle cx="14" cy="30" r="1.2"/><circle cx="50" cy="34" r="1.2"/></g>
    </>
  ),
  earthbind: (
    <>
      <defs><radialGradient id="g-eab-glow" cx="50%" cy="40%" r="55%"><stop offset="0%" stopColor="#d9b98a" stopOpacity=".6"/><stop offset="100%" stopColor="#6b4f2a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="30" r="26" fill="url(#g-eab-glow)"/>
      <path d="M28 6c-8 6-10 16-6 26M36 6c8 6 10 16 6 26" fill="none" stroke="#c9b98a" strokeWidth="2.4" strokeLinecap="round"/>
      <path d="M32 4c-4 8-4 16 0 24" fill="none" stroke="#e0c9a0" strokeWidth="2" strokeLinecap="round" opacity=".7"/>
      <g fill="#8a6a3a"><path d="M24 40l4 8h-8z"/><path d="M40 40l4 8h-8z"/><path d="M32 44l4 8h-8z"/></g>
    </>
  ),
  'enhance ability': (
    <>
      <defs><radialGradient id="g-eha-glow" cx="50%" cy="40%" r="60%"><stop offset="0%" stopColor="#ffe9a8" stopOpacity=".8"/><stop offset="100%" stopColor="#d07020" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="30" r="26" fill="url(#g-eha-glow)"/>
      <circle cx="32" cy="16" r="7" fill="#e9c9a0"/>
      <path d="M18 50c0-9 6-16 14-16s14 7 14 16" fill="#c9762a"/>
      <path d="M20 40l6-4M44 40l-6-4" stroke="#ffd6a0" strokeWidth="2.4" strokeLinecap="round"/>
      <path d="M46 8l1.6 3.6L51 13l-3.4 1.4L46 18l-1.6-3.6L41 13l3.4-1.4z" fill="#fff2c4"/>
    </>
  ),
  'enlarge/reduce': (
    <>
      <defs><radialGradient id="g-enr-glow" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#c8b0ff" stopOpacity=".6"/><stop offset="100%" stopColor="#5a2ecf" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-enr-glow)"/>
      <path d="M14 20l6 6M20 14l-6 6M20 14h-6v6" stroke="#9fd0ff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <path d="M50 44l-6-6M44 50l6-6M44 50h6v-6" stroke="#ff9ecb" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <path d="M32 24l6 8h-12z" fill="#e9dcff"/>
      <circle cx="32" cy="42" r="4" fill="#e9dcff"/>
    </>
  ),
  enthrall: (
    <>
      <defs><radialGradient id="g-enh-glow" cx="50%" cy="40%" r="55%"><stop offset="0%" stopColor="#ffb0e6" stopOpacity=".7"/><stop offset="100%" stopColor="#7a2a66" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="30" r="26" fill="url(#g-enh-glow)"/>
      <circle cx="32" cy="18" r="7" fill="#e9dcff"/>
      <path d="M18 52c0-9 6-16 14-16s14 7 14 16" fill="#c76ad1"/>
      <g stroke="#e9dcff" strokeWidth="2" strokeLinecap="round" fill="none"><path d="M10 10c4 2 6 6 6 10M54 10c-4 2-6 6-6 10"/><path d="M8 22c3 1 5 4 5 7M56 22c-3 1-5 4-5 7" opacity=".7"/></g>
    </>
  ),
  'find steed': (
    <>
      <defs><radialGradient id="g-fst-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#bfe0ff" stopOpacity=".65"/><stop offset="100%" stopColor="#4a6fd0" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-fst-glow)"/>
      <path d="M18 30c0-8 6-14 14-14 6 0 10 4 12 8l6 2-4 4c0 8-6 14-14 14" fill="none" stroke="#dbeaff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M20 30l-6 6M20 30l-6-4M22 36l-4 16M40 40l4 14" stroke="#dbeaff" strokeWidth="2.6" strokeLinecap="round"/>
      <circle cx="38" cy="26" r="1.6" fill="#eaf6ff"/>
    </>
  ),
  'find traps': (
    <>
      <defs><radialGradient id="g-ftr-glow" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#ffd166" stopOpacity=".6"/><stop offset="100%" stopColor="#a06a20" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="25" fill="url(#g-ftr-glow)"/>
      <path d="M4 44L32 12l28 32z" fill="none" stroke="#ffb347" strokeWidth="2" opacity=".55"/>
      <g fill="#ffcf6b"><path d="M8 48l4-8 4 8z"/><path d="M20 48l4-8 4 8z"/><path d="M32 48l4-8 4 8z"/><path d="M44 48l4-8 4 8z"/></g>
      <circle cx="42" cy="20" r="8" fill="none" stroke="#fff3c4" strokeWidth="2.4"/>
      <path d="M48 26l8 8" stroke="#fff3c4" strokeWidth="2.6" strokeLinecap="round"/>
    </>
  ),
  'flame blade': (
    <>
      <defs><linearGradient id="g-flb" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fff3c4"/><stop offset="60%" stopColor="#ff8a1e"/><stop offset="100%" stopColor="#d23200"/></linearGradient><radialGradient id="g-flb-glow" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#ff9d2e" stopOpacity=".7"/><stop offset="100%" stopColor="#d23200" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="25" fill="url(#g-flb-glow)"/>
      <path d="M32 4c4 6 8 8 8 14 0 4-2 6-4 7l4 26-4 3-4-3 4-26c-2-1-4-3-4-7 0-6 4-8 0-14z" fill="url(#g-flb)"/>
      <path d="M24 44h16" stroke="#ffd166" strokeWidth="3" strokeLinecap="round"/>
      <g fill="#ffe9a8"><circle cx="20" cy="20" r="1.4"/><circle cx="46" cy="16" r="1.3"/><circle cx="44" cy="40" r="1.1"/></g>
    </>
  ),
  'flaming sphere': (
    <>
      <defs><radialGradient id="g-fls-core" cx="45%" cy="42%" r="60%"><stop offset="0%" stopColor="#fffdf0"/><stop offset="30%" stopColor="#ffe27a"/><stop offset="65%" stopColor="#ff8a1e"/><stop offset="100%" stopColor="#c0260a"/></radialGradient><radialGradient id="g-fls-glow" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#ff8a1e" stopOpacity=".8"/><stop offset="100%" stopColor="#ff3d00" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-fls-glow)"/>
      <circle cx="32" cy="32" r="15" fill="url(#g-fls-core)"/>
      <circle cx="26" cy="27" r="3.4" fill="#fffef5" opacity=".9"/>
      <g fill="#ffce6b"><circle cx="22" cy="46" r="1.6"/><circle cx="44" cy="44" r="1.4"/><circle cx="48" cy="24" r="1.3"/><circle cx="18" cy="22" r="1.2"/></g>
    </>
  ),
  'gentle repose': (
    <>
      <defs><radialGradient id="g-grp-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#cfe0e8" stopOpacity=".55"/><stop offset="100%" stopColor="#5a6a7a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-grp-glow)"/>
      <path d="M20 20v24M44 20v24M20 20h24M20 44h24" fill="none" stroke="#aab8c6" strokeWidth="2.4" opacity=".8"/>
      <circle cx="32" cy="32" r="8" fill="#e9f2ff" opacity=".9"/>
      <path d="M32 22v-8M28 18l4-4 4 4" stroke="#dbeaff" strokeWidth="2" strokeLinecap="round" fill="none" opacity=".8"/>
      <path d="M24 52h16" stroke="#aab8c6" strokeWidth="2.4" strokeLinecap="round" opacity=".6"/>
    </>
  ),
  'gust of wind': (
    <>
      <defs><linearGradient id="g-gow" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#dff6ff" stopOpacity="0"/><stop offset="100%" stopColor="#7fd1c8"/></linearGradient></defs>
      <g fill="none" stroke="url(#g-gow)" strokeWidth="3" strokeLinecap="round"><path d="M6 18h34a7 7 0 1 0-7-7"/><path d="M2 30h44a7 7 0 1 1-7 7"/><path d="M8 42h22"/></g>
      <g fill="#dff6ff"><circle cx="54" cy="20" r="1.4"/><circle cx="52" cy="44" r="1.2"/><circle cx="46" cy="12" r="1"/></g>
    </>
  ),
  'healing spirit': (
    <>
      <defs><radialGradient id="g-hsp-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#b7ffd0" stopOpacity=".85"/><stop offset="100%" stopColor="#3fae63" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-hsp-glow)"/>
      <path d="M32 6c4 6 8 10 8 18a8 8 0 0 1-16 0c0-8 4-12 8-18z" fill="#7fe0a0" opacity=".9"/>
      <circle cx="32" cy="22" r="3.4" fill="#eafff1"/>
      <path d="M12 40c4-4 8-4 12 0s8 4 12 0 8-4 12 0" fill="none" stroke="#bff29a" strokeWidth="2.4" opacity=".8"/>
      <g fill="#eafff1"><circle cx="16" cy="20" r="1.3"/><circle cx="48" cy="18" r="1.3"/></g>
    </>
  ),
  'heat metal': (
    <>
      <defs><linearGradient id="g-htm" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fff3c4"/><stop offset="60%" stopColor="#ff7a18"/><stop offset="100%" stopColor="#b02000"/></linearGradient><radialGradient id="g-htm-glow" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#ff8a1e" stopOpacity=".7"/><stop offset="100%" stopColor="#d23200" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="25" fill="url(#g-htm-glow)"/>
      <path d="M28 14l-10 20h8l-3 16 14-22h-8z" fill="url(#g-htm)"/>
      <path d="M40 12c1.4 3 4 3.6 4 6.4A3.6 3.6 0 0 1 40 22a3.6 3.6 0 0 1-3.6-3.6c0-2.8 2.6-3.4 3.6-6.4z" fill="#ffce6b"/>
      <g fill="#ffe9a8"><circle cx="44" cy="34" r="1.4"/><circle cx="42" cy="46" r="1.2"/><circle cx="18" cy="12" r="1.2"/></g>
    </>
  ),
  'hold person': (
    <>
      <defs><radialGradient id="g-hp-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#bfd0ff" stopOpacity=".6"/><stop offset="100%" stopColor="#3a4aa0" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-hp-glow)"/>
      <circle cx="32" cy="14" r="6" fill="#dbe4ff"/>
      <path d="M22 44c0-7 4-12 10-12s10 5 10 12" fill="#9fb0ff"/>
      <g fill="none" stroke="#7cf9ff" strokeWidth="2.2"><circle cx="32" cy="30" r="20" strokeDasharray="4 4" opacity=".7"/><path d="M12 18l40 28M52 18L12 46" opacity=".7"/></g>
      <g fill="#eaf6ff"><circle cx="14" cy="14" r="1.3"/><circle cx="50" cy="14" r="1.3"/></g>
    </>
  ),
  invisibility: (
    <>
      <defs><radialGradient id="g-inv-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#cfe0ff" stopOpacity=".5"/><stop offset="100%" stopColor="#7a8fd0" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="25" fill="url(#g-inv-glow)"/>
      <g fill="none" stroke="#cfe0ff" strokeWidth="2.2" strokeDasharray="5 4"><circle cx="32" cy="14" r="6"/><path d="M20 46c0-8 5-14 12-14s12 6 12 14"/></g>
      <g fill="#eaf2ff" opacity=".8"><circle cx="14" cy="20" r="1.3"/><circle cx="50" cy="22" r="1.3"/><circle cx="18" cy="44" r="1.2"/><circle cx="48" cy="44" r="1.2"/></g>
    </>
  ),
  knock: (
    <>
      <defs><linearGradient id="g-kn-door" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a97a3a"/><stop offset="100%" stopColor="#5a3a18"/></linearGradient><radialGradient id="g-kn-glow" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#ffe9a8" stopOpacity=".6"/><stop offset="100%" stopColor="#a06a20" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="25" fill="url(#g-kn-glow)"/>
      <rect x="14" y="10" width="30" height="44" rx="3" fill="url(#g-kn-door)"/>
      <circle cx="38" cy="32" r="2.4" fill="#fff3c4"/>
      <g stroke="#fff3c4" strokeWidth="2.2" strokeLinecap="round"><path d="M10 18a12 12 0 0 1 0 14M6 14a18 18 0 0 1 0 22" opacity=".9"/></g>
      <path d="M44 30l6-4v12z" fill="#fff3c4" opacity=".8"/>
    </>
  ),
  'lesser restoration': (
    <>
      <defs><radialGradient id="g-lr-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#b7ffd0" stopOpacity=".8"/><stop offset="100%" stopColor="#3fae63" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-lr-glow)"/>
      <path d="M32 8l16 8v10c0 10-7 17-16 20-9-3-16-10-16-20V16z" fill="none" stroke="#7fe0a0" strokeWidth="2.6"/>
      <path d="M32 18v18M24 27h16" stroke="#eafff1" strokeWidth="3.2" strokeLinecap="round"/>
      <g fill="#bff29a"><circle cx="14" cy="12" r="1.3"/><circle cx="50" cy="12" r="1.3"/></g>
    </>
  ),
  levitate: (
    <>
      <defs><radialGradient id="g-lv-glow" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#cfe0ff" stopOpacity=".6"/><stop offset="100%" stopColor="#4a6fd0" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-lv-glow)"/>
      <circle cx="32" cy="16" r="6" fill="#dbeaff"/>
      <path d="M24 30c0-5 3-8 8-8s8 3 8 8" fill="#9fb0ff"/>
      <g stroke="#8fd0ff" strokeWidth="2" strokeLinecap="round" opacity=".9"><path d="M32 40v8M26 44l6 6 6-6"/></g>
      <g fill="none" stroke="#cfe0ff" strokeWidth="1.4" opacity=".6"><path d="M14 50c6-3 12-3 18 0M40 50c4-2 7-2 10 0"/></g>
    </>
  ),
  'locate animals or plants': (
    <>
      <defs><radialGradient id="g-lap-glow" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#bff29a" stopOpacity=".6"/><stop offset="100%" stopColor="#3f7a2a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="25" fill="url(#g-lap-glow)"/>
      <circle cx="30" cy="30" r="14" fill="none" stroke="#bff29a" strokeWidth="2.4"/>
      <path d="M40 40l12 12" stroke="#bff29a" strokeWidth="3.4" strokeLinecap="round"/>
      <path d="M26 30l3-4 3 4 3-4 3 4" fill="none" stroke="#eaffd6" strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M30 26c2-2 4-2 6 0" fill="none" stroke="#eaffd6" strokeWidth="1.8" strokeLinecap="round"/>
    </>
  ),
  'locate object': (
    <>
      <defs><radialGradient id="g-lo-glow" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#cfe0ff" stopOpacity=".6"/><stop offset="100%" stopColor="#4a6fd0" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="25" fill="url(#g-lo-glow)"/>
      <circle cx="30" cy="30" r="14" fill="none" stroke="#9cc8ff" strokeWidth="2.4"/>
      <path d="M40 40l12 12" stroke="#9cc8ff" strokeWidth="3.4" strokeLinecap="round"/>
      <path d="M30 22l6 3v7l-6 3-6-3v-7z" fill="#dbeaff"/>
    </>
  ),
  'magic mouth': (
    <>
      <defs><radialGradient id="g-mmo-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#ffb0e6" stopOpacity=".6"/><stop offset="100%" stopColor="#7a2a66" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-mmo-glow)"/>
      <path d="M12 16h32a6 6 0 0 1 6 6v12a6 6 0 0 1-6 6H26l-10 10V40h-4a6 6 0 0 1-6-6V22a6 6 0 0 1 6-6z" fill="#c76ad1" opacity=".85"/>
      <path d="M20 28c3 3 8 3 11 0M34 28c3 3 8 3 11 0" fill="none" stroke="#ffe0f4" strokeWidth="2" strokeLinecap="round"/>
      <path d="M22 22l6-2M40 20l4 4" stroke="#ffe0f4" strokeWidth="1.6" strokeLinecap="round"/>
    </>
  ),
  'magic weapon': (
    <>
      <defs><linearGradient id="g-mwe-blade" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fffdf0"/><stop offset="100%" stopColor="#8a94a2"/></linearGradient><radialGradient id="g-mwe-glow" cx="50%" cy="45%" r="60%"><stop offset="0%" stopColor="#9fd0ff" stopOpacity=".8"/><stop offset="100%" stopColor="#4a7fd0" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="30" r="26" fill="url(#g-mwe-glow)"/>
      <path d="M32 4l4 8v26h-8V12z" fill="url(#g-mwe-blade)"/>
      <path d="M22 38h20M28 38v14h8V38" fill="none" stroke="#c9d2de" strokeWidth="2.6"/>
      <g stroke="#cfe8ff" strokeWidth="2" strokeLinecap="round" opacity=".9"><path d="M14 8l5 5M50 8l-5 5M12 22h6M46 22h6"/></g>
      <path d="M32 6l1.4 3 3 1.4-3 1.4L32 15l-1.4-3.2-3-1.4 3-1.4z" fill="#eaf6ff"/>
    </>
  ),
  "maximilian's earthen grasp": (
    <>
      <defs><linearGradient id="g-meg-hand" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#c9a86a"/><stop offset="100%" stopColor="#5a4020"/></linearGradient><radialGradient id="g-meg-glow" cx="50%" cy="65%" r="60%"><stop offset="0%" stopColor="#d9b98a" stopOpacity=".6"/><stop offset="100%" stopColor="#6b4f2a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="40" r="25" fill="url(#g-meg-glow)"/>
      <path d="M8 56h48v6H8z" fill="#6b4f2a"/>
      <g fill="url(#g-meg-hand)"><path d="M14 56V36a4 4 0 0 1 8 0v20z"/><path d="M22 56V30a4 4 0 0 1 8 0v26z"/><path d="M30 56V30a4 4 0 0 1 8 0v26z"/><path d="M38 56V33a4 4 0 0 1 8 0v23z"/></g>
      <g fill="#8a6a3a"><circle cx="18" cy="40" r="1.6"/><circle cx="26" cy="34" r="1.6"/><circle cx="34" cy="34" r="1.6"/><circle cx="42" cy="37" r="1.6"/></g>
    </>
  ),
  "melf's acid arrow": (
    <>
      <defs><linearGradient id="g-maa" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#eaffb0"/><stop offset="100%" stopColor="#4a8a20"/></linearGradient></defs>
      <path d="M8 56L44 20l6 6-36 36z" fill="url(#g-maa)"/>
      <path d="M44 20l6-12 2 8 8 2-12 6z" fill="#bff29a"/>
      <g fill="#cdf07a"><circle cx="14" cy="20" r="2.4"/><circle cx="52" cy="36" r="2.2"/><circle cx="30" cy="12" r="2"/><circle cx="46" cy="50" r="1.8"/></g>
      <path d="M10 40c4-2 8-2 12 0" fill="none" stroke="#eaffd6" strokeWidth="1.6" opacity=".7"/>
    </>
  ),
  'mind spike': (
    <>
      <defs><linearGradient id="g-msp" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#f0d9ff"/><stop offset="100%" stopColor="#8b5cf6"/></linearGradient><radialGradient id="g-msp-glow" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#c77dff" stopOpacity=".7"/><stop offset="100%" stopColor="#5a2ecf" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-msp-glow)"/>
      <path d="M32 6l6 12-6 4-6-4z" fill="url(#g-msp)"/>
      <path d="M26 46l6-12 6 12z" fill="url(#g-msp)" opacity=".85"/>
      <g fill="#ffd6f2"><circle cx="16" cy="20" r="1.4"/><circle cx="48" cy="20" r="1.4"/><circle cx="16" cy="44" r="1.3"/><circle cx="48" cy="44" r="1.3"/></g>
    </>
  ),
  'mirror image': (
    <>
      <defs><radialGradient id="g-mir-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#cfe0ff" stopOpacity=".6"/><stop offset="100%" stopColor="#5a7fd0" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-mir-glow)"/>
      <g fill="#cfe0ff"><circle cx="20" cy="28" r="4" opacity=".5"/><circle cx="44" cy="28" r="4" opacity=".5"/><circle cx="32" cy="26" r="5"/></g>
      <g fill="#9fb8ff"><path d="M12 50c0-6 4-10 8-10s8 4 8 10z" opacity=".5"/><path d="M36 50c0-6 4-10 8-10s8 4 8 10z" opacity=".5"/><path d="M22 50c0-8 5-14 10-14s10 6 10 14z"/></g>
      <g fill="#eaf2ff"><circle cx="32" cy="24" r="1.4"/><circle cx="20" cy="26" r="1"/><circle cx="44" cy="26" r="1"/></g>
    </>
  ),
  "nystul's magic aura": (
    <>
      <defs><radialGradient id="g-nma-glow" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#c8b0ff" stopOpacity=".7"/><stop offset="100%" stopColor="#5a2ecf" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-nma-glow)"/>
      <circle cx="32" cy="32" r="14" fill="none" stroke="#d9c9ff" strokeWidth="2.4"/>
      <circle cx="32" cy="32" r="7" fill="none" stroke="#e9dcff" strokeWidth="2"/>
      <g stroke="#c9a6ff" strokeWidth="2" strokeLinecap="round"><path d="M32 12v-6M32 58v-6M12 32H6M58 32h-6M18 18l-4-4M46 46l4 4M46 18l4-4M18 46l-4 4"/></g>
      <circle cx="32" cy="32" r="2.4" fill="#fff"/>
    </>
  ),
  'pass without trace': (
    <>
      <defs><radialGradient id="g-pwt-glow" cx="50%" cy="55%" r="55%"><stop offset="0%" stopColor="#bff29a" stopOpacity=".6"/><stop offset="100%" stopColor="#3f7a2a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="38" r="25" fill="url(#g-pwt-glow)"/>
      <g fill="#7fd18a" opacity=".9"><circle cx="18" cy="44" r="2.4"/><circle cx="14" cy="36" r="1.6"/><circle cx="21" cy="34" r="1.6"/><circle cx="24" cy="40" r="1.6"/><circle cx="41" cy="48" r="2"/><circle cx="38" cy="41" r="1.4"/><circle cx="44" cy="42" r="1.4"/><circle cx="47" cy="48" r="1.4"/></g>
      <path d="M28 56c6-8 12-14 22-20" fill="none" stroke="#bff29a" strokeWidth="2" strokeDasharray="3 4" opacity=".7"/>
      <path d="M6 20h52M6 26h52" stroke="#7fd18a" strokeWidth="1.6" opacity=".5"/>
    </>
  ),
  'phantasmal force': (
    <>
      <defs><radialGradient id="g-phf-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#c8b0ff" stopOpacity=".6"/><stop offset="100%" stopColor="#6a4fd0" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-phf-glow)"/>
      <path d="M8 12c6-4 12-6 24-6s18 2 24 6c-6 4-12 6-24 6S14 16 8 12z" fill="#a98bff" opacity=".8"/>
      <path d="M8 12v8c0 6 10 10 24 10s24-4 24-10v-8" fill="none" stroke="#c9a6ff" strokeWidth="2"/>
      <ellipse cx="32" cy="14" rx="8" ry="3" fill="#fff" opacity=".35"/>
      <g fill="#e9dcff"><circle cx="20" cy="44" r="2"/><circle cx="32" cy="48" r="2.4"/><circle cx="44" cy="44" r="2"/></g>
    </>
  ),
  'prayer of healing': (
    <>
      <defs><radialGradient id="g-poh-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#b7ffd0" stopOpacity=".85"/><stop offset="100%" stopColor="#3fae63" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-poh-glow)"/>
      <path d="M32 6a10 10 0 0 1 10 10c0 6-4 10-10 10s-10-4-10-10A10 10 0 0 1 32 6z" fill="none" stroke="#7fe0a0" strokeWidth="2.4"/>
      <path d="M32 14v6M29 17h6" stroke="#eafff1" strokeWidth="2.4" strokeLinecap="round"/>
      <g fill="#7fe0a0"><circle cx="14" cy="40" r="3.4"/><circle cx="32" cy="46" r="4"/><circle cx="50" cy="40" r="3.4"/></g>
      <g fill="#eafff1" opacity=".8"><circle cx="14" cy="40" r="1.4"/><circle cx="32" cy="46" r="1.6"/><circle cx="50" cy="40" r="1.4"/></g>
    </>
  ),
  'protection from poison': (
    <>
      <defs><linearGradient id="g-pfp-shield" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#eaffd6"/><stop offset="100%" stopColor="#3f7a2a"/></linearGradient><radialGradient id="g-pfp-glow" cx="50%" cy="45%" r="60%"><stop offset="0%" stopColor="#bff29a" stopOpacity=".7"/><stop offset="100%" stopColor="#4a8a20" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-pfp-glow)"/>
      <path d="M32 8l18 7v12c0 12-8 19-18 23-10-4-18-11-18-23V15z" fill="url(#g-pfp-shield)"/>
      <path d="M32 20s6 8 6 12a6 6 0 0 1-12 0c0-4 6-12 6-12z" fill="#2f6a2a" opacity=".7"/>
      <path d="M29 33h6" stroke="#eaffd6" strokeWidth="1.6" strokeLinecap="round"/>
    </>
  ),
  pyrotechnics: (
    <>
      <defs><radialGradient id="g-pyt-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#ffd166" stopOpacity=".85"/><stop offset="100%" stopColor="#ff6a00" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="30" r="26" fill="url(#g-pyt-glow)"/>
      <g fill="#ffd166"><circle cx="32" cy="20" r="2"/> {[0,1,2,3,4,5,6,7].map((i)=><path key={i} transform={`rotate(${i*45} 32 30)`} d="M32 10l2 8h-4z" fill={i%2?'#ff9d1e':'#fff3c4'}/>) }</g>
      <path d="M32 34c-6 6-10 10-10 15h20c0-5-4-9-10-15z" fill="#ff9d1e"/>
      <g fill="#ffe9a8"><circle cx="14" cy="44" r="1.4"/><circle cx="50" cy="44" r="1.4"/></g>
    </>
  ),
  'ray of enfeeblement': (
    <>
      <defs><linearGradient id="g-roe" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#e9d6ff"/><stop offset="100%" stopColor="#5a2ecf"/></linearGradient></defs>
      <path d="M6 54L30 30l6 6-24 24z" fill="url(#g-roe)" opacity=".9"/>
      <circle cx="44" cy="20" r="10" fill="none" stroke="#9a6fd0" strokeWidth="2.6"/>
      <path d="M44 12v16M36 20h16" stroke="#c9a6ff" strokeWidth="2" opacity=".6"/>
      <path d="M38 26l12 8" stroke="#5a2ecf" strokeWidth="2.4" strokeLinecap="round"/>
      <g fill="#e9dcff"><circle cx="14" cy="14" r="1.3"/><circle cx="52" cy="44" r="1.2"/></g>
    </>
  ),
  'rope trick': (
    <>
      <defs><radialGradient id="g-rt-glow" cx="50%" cy="30%" r="60%"><stop offset="0%" stopColor="#9cc8ff" stopOpacity=".7"/><stop offset="100%" stopColor="#4a6fd0" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="24" r="26" fill="url(#g-rt-glow)"/>
      <ellipse cx="32" cy="14" rx="20" ry="7" fill="none" stroke="#9cc8ff" strokeWidth="2.6"/>
      <path d="M12 14c0 8 2 14 2 34M52 14c0 8-2 14-2 34" fill="none" stroke="#c9a24a" strokeWidth="3" strokeLinecap="round"/>
      <path d="M20 16c0 6 1 12 1 30M44 16c0 6-1 12-1 30" fill="none" stroke="#a97a3a" strokeWidth="1.6" opacity=".7"/>
      <g fill="#eaf6ff"><circle cx="16" cy="36" r="1.3"/><circle cx="48" cy="36" r="1.3"/></g>
    </>
  ),
  'scorching ray': (
    <>
      <defs><linearGradient id="g-scr" x1="0" y1="1" x2="1" y2="0"><stop offset="0%" stopColor="#fff3c4"/><stop offset="100%" stopColor="#ff6a00"/></linearGradient></defs>
      <path d="M6 58L28 36l4 4-22 22z" fill="url(#g-scr)" opacity=".75"/>
      <path d="M6 38L34 10l4 4-28 28z" fill="url(#g-scr)"/>
      <path d="M6 18L40 10l2 6-30 8z" fill="url(#g-scr)" opacity=".85"/>
      <path d="M32 12l6-4 2 6" fill="#fff3c4"/>
      <g fill="#ffce6b"><circle cx="52" cy="20" r="1.4"/><circle cx="48" cy="40" r="1.4"/><circle cx="30" cy="52" r="1.2"/></g>
    </>
  ),
  'see invisibility': (
    <>
      <defs><radialGradient id="g-siv-glow" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#dff0ff" stopOpacity=".7"/><stop offset="100%" stopColor="#5a7fd0" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-siv-glow)"/>
      <path d="M6 32s9-12 26-12 26 12 26 12-9 12-26 12S6 32 6 32z" fill="none" stroke="#9cc8ff" strokeWidth="2.4"/>
      <circle cx="32" cy="32" r="7" fill="#dff0ff"/><circle cx="32" cy="32" r="3" fill="#2a3a5a"/>
      <path d="M14 18c3 2 5 5 5 8M50 18c-3 2-5 5-5 8" fill="none" stroke="#cfe8ff" strokeWidth="1.8" strokeDasharray="3 3" opacity=".8"/>
    </>
  ),
  'shadow blade': (
    <>
      <defs><linearGradient id="g-shb" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#5a2ecf"/><stop offset="100%" stopColor="#0a0414"/></linearGradient><radialGradient id="g-shb-glow" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#7a4fd0" stopOpacity=".7"/><stop offset="100%" stopColor="#1a0a2a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-shb-glow)"/>
      <path d="M36 4l4 10-14 28-4-4z" fill="url(#g-shb)"/>
      <path d="M22 38l-6 6M14 34l6 6" stroke="#7a4fd0" strokeWidth="3" strokeLinecap="round"/>
      <path d="M34 6l2 6-12 24" stroke="#c9a6ff" strokeWidth="1.4" opacity=".6" fill="none"/>
      <g fill="#c9a6ff"><circle cx="46" cy="16" r="1.4"/><circle cx="18" cy="50" r="1.2"/><circle cx="48" cy="40" r="1"/></g>
    </>
  ),
  shatter: (
    <>
      <defs><radialGradient id="g-sht-glow" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#ffffff" stopOpacity=".8"/><stop offset="100%" stopColor="#9fd0ff" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-sht-glow)"/>
      <g fill="none" stroke="#cfe8ff" strokeWidth="2.4" strokeLinecap="round"><circle cx="32" cy="32" r="8"/><circle cx="32" cy="32" r="15" opacity=".7"/><circle cx="32" cy="32" r="21" opacity=".45"/></g>
      <g fill="#eaf6ff"><path d="M32 6l4 8-6 2z"/><path d="M58 32l-8 4-2-6z"/><path d="M32 58l-4-8 6-2z"/><path d="M6 32l8-4 2 6z"/></g>
      <circle cx="32" cy="32" r="3" fill="#fff"/>
    </>
  ),
  'shining smite': (
    <>
      <defs><linearGradient id="g-shs-blade" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fffdf0"/><stop offset="100%" stopColor="#c9a24a"/></linearGradient><radialGradient id="g-shs-glow" cx="50%" cy="35%" r="65%"><stop offset="0%" stopColor="#fff3c4" stopOpacity=".95"/><stop offset="100%" stopColor="#ffce6b" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="26" r="27" fill="url(#g-shs-glow)"/>
      <path d="M32 4l4 8v24h-8V12z" fill="url(#g-shs-blade)"/>
      <path d="M22 36h20M28 36v14h8V36" fill="none" stroke="#fff7dc" strokeWidth="2.6"/>
      <g stroke="#fff3c4" strokeWidth="2.4" strokeLinecap="round"><path d="M12 10l6 6M52 10l-6 6M10 26h7M47 26h7"/></g>
    </>
  ),
  silence: (
    <>
      <defs><radialGradient id="g-sil-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#cfe0ff" stopOpacity=".6"/><stop offset="100%" stopColor="#5a7fd0" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-sil-glow)"/>
      <path d="M10 26h8l10-8v28l-10-8h-8z" fill="#9cc8ff"/>
      <g stroke="#7a8fd0" strokeWidth="2.4" strokeLinecap="round"><path d="M34 24l16 16M50 24L34 40"/></g>
      <circle cx="32" cy="32" r="22" fill="none" stroke="#cfe0ff" strokeWidth="1.4" strokeDasharray="4 4" opacity=".6"/>
    </>
  ),
  skywrite: (
    <>
      <defs><radialGradient id="g-skw-glow" cx="50%" cy="40%" r="55%"><stop offset="0%" stopColor="#dff6ff" stopOpacity=".7"/><stop offset="100%" stopColor="#5a9fd0" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-skw-glow)"/>
      <path d="M6 40a8 8 0 0 1 8-14 10 10 0 0 1 19-2 7 7 0 0 1 9 6" fill="none" stroke="#cfe8ff" strokeWidth="2.4" strokeLinecap="round"/>
      <path d="M14 52c2-2 4-2 6 0s4 2 6 0 4-2 6 0 4 2 6 0 4-2 6 0 4 2 6 0" fill="none" stroke="#9fd0ff" strokeWidth="2.2" strokeLinecap="round" opacity=".85"/>
      <g fill="#eaf6ff"><circle cx="46" cy="14" r="1.4"/><circle cx="52" cy="22" r="1.1"/></g>
    </>
  ),
  "snilloc's snowball swarm": (
    <>
      <defs><radialGradient id="g-sns-ball" cx="40%" cy="35%" r="60%"><stop offset="0%" stopColor="#ffffff"/><stop offset="100%" stopColor="#8fd0ea"/></radialGradient><radialGradient id="g-sns-glow" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#cfeaff" stopOpacity=".6"/><stop offset="100%" stopColor="#5a9fd0" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="25" fill="url(#g-sns-glow)"/>
      <circle cx="24" cy="24" r="9" fill="url(#g-sns-ball)"/><circle cx="40" cy="30" r="7" fill="url(#g-sns-ball)"/><circle cx="30" cy="42" r="6.4" fill="url(#g-sns-ball)"/><circle cx="46" cy="16" r="5" fill="url(#g-sns-ball)"/>
      <g fill="#eaf6ff"><circle cx="14" cy="40" r="1.6"/><circle cx="50" cy="46" r="1.4"/></g>
    </>
  ),
  'spider climb': (
    <>
      <defs><radialGradient id="g-spc-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#bff29a" stopOpacity=".5"/><stop offset="100%" stopColor="#3f6a2a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="25" fill="url(#g-spc-glow)"/>
      <path d="M32 44V18M32 20l-10-8M32 20l10-8M32 28l-12-4M32 28l12-4M32 36l-12 0M32 36l12 0" stroke="#8a9a5a" strokeWidth="2" strokeLinecap="round" fill="none"/>
      <ellipse cx="32" cy="48" rx="6" ry="8" fill="#e9d6b0"/>
      <path d="M28 46v6M36 46v6" stroke="#5a4a20" strokeWidth="1.6"/>
      <g fill="#bff29a"><circle cx="12" cy="40" r="1.3"/><circle cx="50" cy="38" r="1.3"/></g>
    </>
  ),
  'spike growth': (
    <>
      <defs><radialGradient id="g-spg-glow" cx="50%" cy="60%" r="60%"><stop offset="0%" stopColor="#7fd18a" stopOpacity=".6"/><stop offset="100%" stopColor="#2f6a3a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="40" r="26" fill="url(#g-spg-glow)"/>
      <path d="M4 46h56v10H4z" fill="#4a6a2a"/>
      <g fill="#b0b0a0"><path d="M8 46l4-14 4 14z"/><path d="M20 46l4-18 4 18z"/><path d="M32 46l4-20 4 20z"/><path d="M44 46l4-16 4 16z"/></g>
      <g fill="#eaffd6" opacity=".8"><circle cx="14" cy="24" r="1.3"/><circle cx="38" cy="18" r="1.3"/><circle cx="50" cy="26" r="1.2"/></g>
    </>
  ),
  'spiritual weapon': (
    <>
      <defs><linearGradient id="g-spw" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fffdf0"/><stop offset="100%" stopColor="#d9a441"/></linearGradient><radialGradient id="g-spw-glow" cx="50%" cy="45%" r="60%"><stop offset="0%" stopColor="#ffe9a8" stopOpacity=".85"/><stop offset="100%" stopColor="#ffce6b" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-spw-glow)"/>
      <path d="M32 4l6 10-6 2-6-2z" fill="url(#g-spw)"/>
      <path d="M32 16v34" stroke="#fff7dc" strokeWidth="4" strokeLinecap="round"/>
      <path d="M20 30h24" stroke="#fff7dc" strokeWidth="4" strokeLinecap="round"/>
      <g fill="#fff3c4"><circle cx="32" cy="14" r="2.4"/><circle cx="44" cy="20" r="1.4"/><circle cx="20" cy="20" r="1.4"/></g>
    </>
  ),
  suggestion: (
    <>
      <defs><radialGradient id="g-sug-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#ffb0e6" stopOpacity=".65"/><stop offset="100%" stopColor="#7a2a66" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-sug-glow)"/>
      <path d="M10 14h34a6 6 0 0 1 6 6v10a6 6 0 0 1-6 6H26l-10 10V36h-6a6 6 0 0 1-6-6V20a6 6 0 0 1 6-6z" fill="#c76ad1" opacity=".85"/>
      <path d="M20 26c4-4 8-4 12 0s8 4 12 0" fill="none" stroke="#ffe0f4" strokeWidth="2.2" strokeLinecap="round"/>
      <path d="M44 8a6 6 0 0 1 0 8" fill="none" stroke="#ffb0e6" strokeWidth="2" strokeLinecap="round" opacity=".8"/>
    </>
  ),
  'summon beast': (
    <>
      <defs><radialGradient id="g-sumb-glow" cx="50%" cy="45%" r="60%"><stop offset="0%" stopColor="#bff29a" stopOpacity=".7"/><stop offset="100%" stopColor="#3f7a2a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="34" r="26" fill="url(#g-sumb-glow)"/>
      <circle cx="32" cy="34" r="18" fill="none" stroke="#bff29a" strokeWidth="1.6" strokeDasharray="4 4" opacity=".8"/>
      <circle cx="32" cy="36" r="4.4" fill="#7fd18a"/><circle cx="23" cy="29" r="2.4" fill="#7fd18a"/><circle cx="29" cy="25" r="2.4" fill="#7fd18a"/><circle cx="35" cy="25" r="2.4" fill="#7fd18a"/><circle cx="41" cy="29" r="2.4" fill="#7fd18a"/>
      <g fill="#eaffd6"><circle cx="12" cy="14" r="1.3"/><circle cx="52" cy="14" r="1.3"/><circle cx="52" cy="52" r="1.2"/><circle cx="12" cy="52" r="1.2"/></g>
    </>
  ),
  "tasha's mind whip": (
    <>
      <defs><radialGradient id="g-tmw-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#c77dff" stopOpacity=".7"/><stop offset="100%" stopColor="#4a1a8a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-tmw-glow)"/>
      <path d="M26 8a14 14 0 0 0-8 25v6h16v-6a14 14 0 0 0-8-25z" fill="#8a5cf0"/>
      <path d="M22 14l3 5h-5l3 5" fill="none" stroke="#e9dcff" strokeWidth="2" strokeLinecap="round"/>
      <g fill="none" stroke="#c77dff" strokeWidth="2.6" strokeLinecap="round"><path d="M40 18q8 4 0 10t0 10" opacity=".9"/><path d="M46 12q10 6 0 14t0 14" opacity=".6"/></g>
      <circle cx="38" cy="44" r="2" fill="#e9dcff"/>
    </>
  ),
  'warding bond': (
    <>
      <defs><radialGradient id="g-wdb-glow" cx="50%" cy="45%" r="60%"><stop offset="0%" stopColor="#ffe9a8" stopOpacity=".7"/><stop offset="100%" stopColor="#a06a20" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="34" r="26" fill="url(#g-wdb-glow)"/>
      <circle cx="20" cy="30" r="8" fill="#dbe4ff"/><circle cx="44" cy="38" r="8" fill="#e9c9a0"/>
      <path d="M20 38v10M44 46v8" stroke="#9fb0ff" strokeWidth="3" strokeLinecap="round"/>
      <path d="M26 26c6-2 12 4 12 10" fill="none" stroke="#ffe9a8" strokeWidth="2.4" strokeDasharray="3 4"/>
      <path d="M32 12l1.6 3.6L37 17l-3.4 1.4L32 22l-1.6-3.6L27 17l3.4-1.4z" fill="#fff2c4"/>
    </>
  ),
  'warding wind': (
    <>
      <defs><radialGradient id="g-ww-glow" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#dff6ff" stopOpacity=".5"/><stop offset="100%" stopColor="#5a9fd0" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="25" fill="url(#g-ww-glow)"/>
      <g fill="none" stroke="#cfe8ff" strokeWidth="2.6" strokeLinecap="round"><path d="M14 14c10 4 16 10 18 18s4 14 0 18"/><path d="M22 10c10 6 16 12 18 22s2 16-2 20" opacity=".7"/><path d="M30 8c10 8 16 16 16 26s-4 18-8 22" opacity=".5"/></g>
      <g fill="#eaf6ff"><circle cx="44" cy="18" r="1.3"/><circle cx="46" cy="30" r="1.2"/></g>
    </>
  ),
  web: (
    <>
      <defs><radialGradient id="g-web-glow" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#e9eef5" stopOpacity=".5"/><stop offset="100%" stopColor="#8494a6" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-web-glow)"/>
      <g fill="none" stroke="#dfe6ee" strokeWidth="1.6" opacity=".9"><circle cx="32" cy="32" r="6"/><circle cx="32" cy="32" r="13"/><circle cx="32" cy="32" r="20"/></g>
      <g stroke="#dfe6ee" strokeWidth="1.6" opacity=".9"><path d="M32 6v52M6 32h52M14 14l36 36M50 14L14 50"/></g>
      <path d="M26 20l4-6" stroke="#fff" strokeWidth="1.4" opacity=".6"/>
      <g fill="#fff"><circle cx="32" cy="32" r="2"/></g>
    </>
  ),
  'zone of truth': (
    <>
      <defs><radialGradient id="g-zot-glow" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#ffe9a8" stopOpacity=".8"/><stop offset="100%" stopColor="#d9a441" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-zot-glow)"/>
      <circle cx="32" cy="34" r="20" fill="none" stroke="#fff3c4" strokeWidth="2" strokeDasharray="3 5"/>
      <path d="M32 10a6 6 0 0 1 6 6c0 3-2 5-4 6l-2 2-2-2c-2-1-4-3-4-6a6 6 0 0 1 6-6z" fill="#fff2c4"/>
      <path d="M32 26v8M32 38v.5" stroke="#fff2c4" strokeWidth="3" strokeLinecap="round"/>
      <g fill="#fff7dc"><circle cx="16" cy="30" r="1.3"/><circle cx="48" cy="30" r="1.3"/><circle cx="32" cy="52" r="1.2"/></g>
    </>
  ),
  'animate dead': (
    <>
      <defs><radialGradient id="g-and-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#a06bd8" stopOpacity=".6"/><stop offset="100%" stopColor="#2a1040" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-and-glow)"/>
      <path d="M32 8a11 11 0 0 0-11 11c0 4 2 7 4 9v6h14v-6c2-2 4-5 4-9A11 11 0 0 0 32 8z" fill="#c9a6ff"/>
      <g fill="#2a1040"><circle cx="27" cy="19" r="1.8"/><circle cx="37" cy="19" r="1.8"/><path d="M26 29c4 2 8 2 12 0" stroke="#2a1040" strokeWidth="1.4" fill="none" strokeLinecap="round"/></g>
      <path d="M18 52V40c2-3 6-4 14-4s12 1 14 4v12" fill="none" stroke="#9a6fd0" strokeWidth="3" strokeLinecap="round"/>
      <path d="M24 52v-6M40 52v-6" stroke="#9a6fd0" strokeWidth="3" strokeLinecap="round"/>
    </>
  ),
  'aura of vitality': (
    <>
      <defs><radialGradient id="g-aov-glow" cx="50%" cy="45%" r="60%"><stop offset="0%" stopColor="#b7ffd0" stopOpacity=".85"/><stop offset="100%" stopColor="#3fae63" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="27" fill="url(#g-aov-glow)"/>
      <g fill="none" stroke="#7fe0a0" strokeWidth="2.4"><circle cx="32" cy="32" r="10"/><circle cx="32" cy="32" r="17" opacity=".7"/><circle cx="32" cy="32" r="23" opacity=".45"/></g>
      <path d="M32 24v12M27 29h10" stroke="#eafff1" strokeWidth="3" strokeLinecap="round"/>
      <g fill="#eafff1"><circle cx="14" cy="14" r="1.3"/><circle cx="50" cy="14" r="1.3"/><circle cx="50" cy="50" r="1.2"/><circle cx="14" cy="50" r="1.2"/></g>
    </>
  ),
  'beacon of hope': (
    <>
      <defs><radialGradient id="g-beh-glow" cx="50%" cy="35%" r="60%"><stop offset="0%" stopColor="#fff3c4" stopOpacity=".95"/><stop offset="100%" stopColor="#ffce6b" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="28" r="27" fill="url(#g-beh-glow)"/>
      <path d="M24 52V30h16v22z" fill="#ffe9a8"/>
      <path d="M22 30h20l-4-6H26z" fill="#d9a441"/>
      <circle cx="32" cy="18" r="6" fill="#fff7dc"/>
      <g stroke="#fff3c4" strokeWidth="2" strokeLinecap="round"><path d="M32 2v6M14 8l4 4M50 8l-4 4M10 22h6M48 22h6"/></g>
    </>
  ),
  'bestow curse': (
    <>
      <defs><radialGradient id="g-bec-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#9a6fd0" stopOpacity=".6"/><stop offset="100%" stopColor="#2a1040" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-bec-glow)"/>
      <path d="M32 8a11 11 0 0 0-11 11c0 4 2 7 4 9v6h14v-6c2-2 4-5 4-9A11 11 0 0 0 32 8z" fill="#5a2ecf"/>
      <g stroke="#c9a6ff" strokeWidth="2.2" strokeLinecap="round" fill="none"><path d="M27 20l4 4-4 4M37 20l-4 4 4 4"/></g>
      <g stroke="#9a6fd0" strokeWidth="2.4" strokeLinecap="round"><path d="M12 10l6 6M52 10l-6 6M10 26h6M48 26h6"/></g>
    </>
  ),
  'blinding smite': (
    <>
      <defs><linearGradient id="g-bls-blade" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fffdf0"/><stop offset="100%" stopColor="#a09088"/></linearGradient><radialGradient id="g-bls-glow" cx="50%" cy="35%" r="65%"><stop offset="0%" stopColor="#fff3c4" stopOpacity=".95"/><stop offset="100%" stopColor="#ffce6b" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="26" r="27" fill="url(#g-bls-glow)"/>
      <path d="M32 4l4 8v24h-8V12z" fill="url(#g-bls-blade)"/>
      <path d="M22 36h20M28 36v14h8V36" fill="none" stroke="#fff7dc" strokeWidth="2.6"/>
      <g stroke="#fff3c4" strokeWidth="3" strokeLinecap="round"><path d="M12 12l7 7M52 12l-7 7M10 28h8M46 28h8M16 44l6-6M48 44l-6-6"/></g>
    </>
  ),
  blink: (
    <>
      <defs><radialGradient id="g-blk-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#c8b0ff" stopOpacity=".7"/><stop offset="100%" stopColor="#5a2ecf" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-blk-glow)"/>
      <g fill="none" stroke="#c8b0ff" strokeWidth="2.2"><circle cx="20" cy="32" r="12" strokeDasharray="4 4" opacity=".6"/><circle cx="44" cy="32" r="12"/></g>
      <path d="M20 26c3 0 6 2 6 6s-3 6-6 6" fill="#b0a0ff" opacity=".7"/>
      <path d="M44 26c-3 0-6 2-6 6s3 6 6 6" fill="#e9dcff"/>
      <path d="M30 30l4 2-4 2z" fill="#fff"/>
    </>
  ),
  'call lightning': (
    <>
      <defs><radialGradient id="g-cal-glow" cx="50%" cy="30%" r="60%"><stop offset="0%" stopColor="#cfe0ff" stopOpacity=".7"/><stop offset="100%" stopColor="#5a7fd0" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="28" r="27" fill="url(#g-cal-glow)"/>
      <path d="M8 22a8 8 0 0 1 8-12 10 10 0 0 1 18-2 7 7 0 0 1 10 6" fill="none" stroke="#c6d2dc" strokeWidth="3" strokeLinecap="round"/>
      <path d="M30 24l-8 16h6l-2 14 10-18h-6z" fill="#fff6c4"/>
      <g fill="#eaf6ff"><circle cx="18" cy="40" r="1.4"/><circle cx="46" cy="44" r="1.3"/></g>
    </>
  ),
  catnap: (
    <>
      <defs><radialGradient id="g-ctp-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#9fb6ff" stopOpacity=".6"/><stop offset="100%" stopColor="#3a4a8a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-ctp-glow)"/>
      <path d="M20 54c0-12 5-20 12-20s12 8 12 20z" fill="#8a9fd0"/>
      <circle cx="32" cy="28" r="7" fill="#dbe6ff"/>
      <g fill="#dbe6ff"><text x="42" y="16" fontFamily="system-ui, sans-serif" fontSize="12" fontWeight="700">z</text><text x="50" y="9" fontFamily="system-ui, sans-serif" fontSize="9" fontWeight="700">z</text></g>
      <path d="M12 20h8M10 28h6" stroke="#8a9fd0" strokeWidth="2" strokeLinecap="round" opacity=".7"/>
    </>
  ),
  clairvoyance: (
    <>
      <defs><radialGradient id="g-clv-glow" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#a9f0e6" stopOpacity=".7"/><stop offset="100%" stopColor="#2f8f9a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-clv-glow)"/>
      <path d="M6 32s9-13 26-13 26 13 26 13-9 13-26 13S6 32 6 32z" fill="none" stroke="#8fe0d6" strokeWidth="2.4"/>
      <circle cx="32" cy="32" r="8" fill="#d6fff8"/><circle cx="32" cy="32" r="3.4" fill="#1a3a40"/>
      <g fill="none" stroke="#8fe0d6" strokeWidth="1.4" opacity=".7"><circle cx="32" cy="32" r="14"/><circle cx="32" cy="32" r="19"/></g>
    </>
  ),
  'conjure animals': (
    <>
      <defs><radialGradient id="g-coa2-glow" cx="50%" cy="45%" r="60%"><stop offset="0%" stopColor="#bff29a" stopOpacity=".7"/><stop offset="100%" stopColor="#3f7a2a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="34" r="26" fill="url(#g-coa2-glow)"/>
      <circle cx="24" cy="26" r="9" fill="#e9d6b0"/><circle cx="40" cy="30" r="8" fill="#c9b98a"/><circle cx="32" cy="42" r="7" fill="#e9d6b0"/>
      <g fill="#5a4020"><path d="M20 22l-2-6 5 3z"/><path d="M28 22l2-6-5 3z"/><path d="M36 26l-2-5 5 2z"/><path d="M44 26l2-5-5 2z"/></g>
      <g fill="#bff29a"><circle cx="12" cy="14" r="1.3"/><circle cx="52" cy="14" r="1.3"/></g>
    </>
  ),
  'conjure barrage': (
    <>
      <defs><linearGradient id="g-cob" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#e9eef5"/><stop offset="100%" stopColor="#8494a6"/></linearGradient></defs>
      <path d="M4 58C14 34 28 18 50 6l6 8C34 26 22 40 14 58z" fill="url(#g-cob)" opacity=".9"/>
      <g fill="#cfe0ff"><circle cx="18" cy="30" r="2"/><circle cx="28" cy="20" r="1.6"/><circle cx="38" cy="12" r="1.4"/><circle cx="44" cy="30" r="1.4"/><circle cx="30" cy="44" r="1.4"/></g>
      <path d="M10 50c8-12 18-22 30-28" fill="none" stroke="#eaf6ff" strokeWidth="1.6" strokeDasharray="3 4" opacity=".7"/>
    </>
  ),
  counterspell: (
    <>
      <defs><radialGradient id="g-cou-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#9cc8ff" stopOpacity=".7"/><stop offset="100%" stopColor="#3a5f9a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-cou-glow)"/>
      <path d="M24 6l4 4 6-6 6 6 4-4 2 10-8 6v28l-8-3V22l-8-6z" fill="none" stroke="#cfe8ff" strokeWidth="2.4" strokeLinejoin="round"/>
      <path d="M20 20l24 24" stroke="#7cf9ff" strokeWidth="3" strokeLinecap="round"/>
      <g fill="#eaf6ff"><circle cx="14" cy="14" r="1.3"/><circle cx="50" cy="14" r="1.3"/></g>
    </>
  ),
  'create food and water': (
    <>
      <defs><radialGradient id="g-cfw-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#ffe9a8" stopOpacity=".7"/><stop offset="100%" stopColor="#a06a20" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-cfw-glow)"/>
      <path d="M14 20c4-3 10-3 14 0 4-3 10-3 14 0v6c-4-3-10-3-14 0-4-3-10-3-14 0z" fill="#d9a441"/>
      <path d="M14 20v6M42 20v6" stroke="#8a6a3a" strokeWidth="2"/>
      <path d="M30 34s5 7 5 11a5 5 0 0 1-10 0c0-4 5-11 5-11z" fill="#7fc4ea"/>
      <path d="M44 40h8v10h-8z" fill="#7fc4ea" opacity=".8"/>
    </>
  ),
  "crusader's mantle": (
    <>
      <defs><radialGradient id="g-crm-glow" cx="50%" cy="40%" r="60%"><stop offset="0%" stopColor="#fff3c4" stopOpacity=".9"/><stop offset="100%" stopColor="#ffce6b" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="30" r="27" fill="url(#g-crm-glow)"/>
      <path d="M32 4l4 8v22h-8V12z" fill="#fff7dc"/>
      <path d="M22 34h20M28 34v12h8V34" fill="none" stroke="#d9a441" strokeWidth="2.4"/>
      <path d="M18 40c-4 2-6 6-6 10M46 40c4 2 6 6 6 10" fill="none" stroke="#ffe9a8" strokeWidth="2.4" strokeLinecap="round" opacity=".8"/>
      <g fill="#fff3c4"><circle cx="32" cy="14" r="2"/><circle cx="44" cy="20" r="1.3"/><circle cx="20" cy="20" r="1.3"/></g>
    </>
  ),
  daylight: (
    <>
      <defs><radialGradient id="g-dal-glow" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#fffdf0" stopOpacity="1"/><stop offset="60%" stopColor="#fff3c4" stopOpacity=".7"/><stop offset="100%" stopColor="#ffe9a8" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="27" fill="url(#g-dal-glow)"/>
      <circle cx="32" cy="32" r="12" fill="#fffdf0"/>
      <g stroke="#fff7dc" strokeWidth="3" strokeLinecap="round"><path d="M32 4v8M32 52v8M4 32h8M52 32h8M12 12l6 6M46 46l6 6M52 12l-6 6M18 46l-6 6"/></g>
    </>
  ),
  'dispel magic': (
    <>
      <defs><radialGradient id="g-dim-glow" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#c77dff" stopOpacity=".6"/><stop offset="100%" stopColor="#4a1a8a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-dim-glow)"/>
      <circle cx="32" cy="30" r="14" fill="none" stroke="#c9a6ff" strokeWidth="2.4"/>
      <path d="M32 18l2.6 7.4H42l-6 4.4 2.2 7.2L32 32.8l-6.2 4.2 2.2-7.2-6-4.4h7.4z" fill="none" stroke="#e9dcff" strokeWidth="1.8"/>
      <path d="M12 12l40 40" stroke="#7cf9ff" strokeWidth="3.4" strokeLinecap="round"/>
    </>
  ),
  'elemental weapon': (
    <>
      <defs><linearGradient id="g-elw-blade" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#eaf6ff"/><stop offset="100%" stopColor="#8a94a2"/></linearGradient><linearGradient id="g-elw-aura" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#ff8a3a"/><stop offset="50%" stopColor="#5ad1ff"/><stop offset="100%" stopColor="#a3e635"/></linearGradient></defs>
      <path d="M32 6l4 8v24h-8V14z" fill="url(#g-elw-blade)"/>
      <path d="M22 38h20M28 38v14h8V38" fill="none" stroke="#aab4c2" strokeWidth="2.6"/>
      <path d="M28 10c-6 6-6 14 0 20M36 10c6 6 6 14 0 20" fill="none" stroke="url(#g-elw-aura)" strokeWidth="2.6" opacity=".85"/>
      <g fill="#fff"><circle cx="20" cy="20" r="1.2"/><circle cx="44" cy="24" r="1.2"/></g>
    </>
  ),
  'enemies abound': (
    <>
      <defs><radialGradient id="g-enb-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#ff9ecb" stopOpacity=".6"/><stop offset="100%" stopColor="#7a2a4a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-enb-glow)"/>
      <circle cx="20" cy="30" r="8" fill="#e9dcff"/><circle cx="44" cy="30" r="8" fill="#e9dcff"/>
      <g fill="#2a1040"><circle cx="17" cy="28" r="1.4"/><circle cx="23" cy="28" r="1.4"/><circle cx="41" cy="28" r="1.4"/><circle cx="47" cy="28" r="1.4"/></g>
      <path d="M18 40c2 2 4 2 6 0M40 40c2 2 4 2 6 0" fill="none" stroke="#7a2a4a" strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M30 14l4-6 4 6-4 4z" fill="#ff7ac6"/>
    </>
  ),
  'erupting earth': (
    <>
      <defs><radialGradient id="g-epe-glow" cx="50%" cy="40%" r="55%"><stop offset="0%" stopColor="#d9b98a" stopOpacity=".6"/><stop offset="100%" stopColor="#6b4f2a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="28" r="26" fill="url(#g-epe-glow)"/>
      <path d="M4 46h56v14H4z" fill="#6b4f2a"/>
      <g fill="#8a6a3a"><path d="M12 46l6-16 6 16z"/><path d="M26 46l6-22 6 22z"/><path d="M40 46l6-16 6 16z"/></g>
      <g fill="#d9b98a"><circle cx="18" cy="20" r="1.6"/><circle cx="32" cy="14" r="1.6"/><circle cx="46" cy="20" r="1.6"/></g>
    </>
  ),
  fear: (
    <>
      <defs><radialGradient id="g-fea-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#a06bd8" stopOpacity=".6"/><stop offset="100%" stopColor="#2a1040" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-fea-glow)"/>
      <path d="M32 8a12 12 0 0 0-12 12c0 5 3 8 5 10v4h14v-4c2-2 5-5 5-10A12 12 0 0 0 32 8z" fill="#7a4fd0"/>
      <g fill="#1a0a2a"><circle cx="27" cy="20" r="2.2"/><circle cx="37" cy="20" r="2.2"/><path d="M27 30c3-2 7-2 10 0" stroke="#1a0a2a" strokeWidth="1.8" fill="none" strokeLinecap="round"/></g>
      <g stroke="#c9a6ff" strokeWidth="2.4" strokeLinecap="round"><path d="M12 12l5 5M52 12l-5 5M10 30h5M49 30h5"/></g>
    </>
  ),
  'feign death': (
    <>
      <defs><radialGradient id="g-feid-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#cfe0e8" stopOpacity=".5"/><stop offset="100%" stopColor="#5a6a7a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-feid-glow)"/>
      <path d="M32 10a10 10 0 0 1 10 10c0 4-2 6-4 8v4H26v-4c-2-2-4-4-4-8A10 10 0 0 1 32 10z" fill="#aab8c6"/>
      <path d="M27 20v4M37 20v4" stroke="#5a6a7a" strokeWidth="2" strokeLinecap="round"/>
      <path d="M24 40h16v12H24z" fill="#8a98a6"/>
      <path d="M32 44v6" stroke="#5a6a7a" strokeWidth="2" strokeLinecap="round"/>
    </>
  ),
  'flame arrows': (
    <>
      <defs><linearGradient id="g-fla" x1="0" y1="1" x2="1" y2="0"><stop offset="0%" stopColor="#fff3c4"/><stop offset="100%" stopColor="#ff6a00"/></linearGradient></defs>
      <path d="M8 56L40 24l6 6-32 32z" fill="#e9c9a0"/>
      <path d="M40 24l6-12 2 8 8 2-12 6z" fill="#ffd166"/>
      <path d="M12 40c-2 3-1 7 2 9 1-3 1-6-2-9zM22 30c-2 3-1 7 2 9 1-3 1-6-2-9z" fill="#ff9d1e"/>
      <g fill="#ffe9a8"><circle cx="52" cy="30" r="1.4"/><circle cx="48" cy="46" r="1.2"/></g>
    </>
  ),
  fly: (
    <>
      <defs><radialGradient id="g-fly-glow" cx="50%" cy="40%" r="60%"><stop offset="0%" stopColor="#dff0ff" stopOpacity=".7"/><stop offset="100%" stopColor="#5a7fd0" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="30" r="27" fill="url(#g-fly-glow)"/>
      <circle cx="32" cy="20" r="5" fill="#dbeaff"/>
      <path d="M32 26v14M32 30l-14-8M32 30l14-8" fill="none" stroke="#eaf2ff" strokeWidth="3.4" strokeLinecap="round"/>
      <path d="M18 22c-6-4-12-4-14-2 4 4 10 6 14 4zM46 22c6-4 12-4 14-2-4 4-10 6-14 4z" fill="#bfe0ff" opacity=".9"/>
      <path d="M26 44h12M28 44v6M36 44v6" stroke="#dbeaff" strokeWidth="2.4" strokeLinecap="round"/>
    </>
  ),
  'gaseous form': (
    <>
      <defs><radialGradient id="g-gsf-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#cfe0e8" stopOpacity=".5"/><stop offset="100%" stopColor="#6a7a88" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-gsf-glow)"/>
      <path d="M32 10c8 0 12 6 12 12 0 5-2 7-4 9l2 8-6-3-4 4-4-4-6 3 2-8c-2-2-4-4-4-9 0-6 4-12 12-12z" fill="#c6d2dc" opacity=".65"/>
      <path d="M26 22c2-2 4-2 6 0M34 22c2-2 4-2 6 0" fill="none" stroke="#eaf1f6" strokeWidth="2" strokeLinecap="round" opacity=".8"/>
      <path d="M24 52c2-2 4-2 6 0M36 52c2-2 4-2 6 0" fill="none" stroke="#c6d2dc" strokeWidth="2" strokeLinecap="round" opacity=".6"/>
    </>
  ),
  'glyph of warding': (
    <>
      <defs><radialGradient id="g-gow2-glow" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#ffd166" stopOpacity=".7"/><stop offset="100%" stopColor="#a06a20" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-gow2-glow)"/>
      <circle cx="32" cy="32" r="18" fill="none" stroke="#ffcf6b" strokeWidth="2.4"/>
      <circle cx="32" cy="32" r="12" fill="none" stroke="#ffe9a8" strokeWidth="1.6"/>
      <path d="M32 20l3.4 8H44l-7 5 2.6 8L32 36.6 24.4 41l2.6-8-7-5h8.6z" fill="none" stroke="#fff3c4" strokeWidth="1.8"/>
      <g stroke="#ffcf6b" strokeWidth="2" strokeLinecap="round"><path d="M32 6v6M32 52v6M6 32h6M52 32h6"/></g>
    </>
  ),
  haste: (
    <>
      <defs><radialGradient id="g-hst-glow" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#ffd166" stopOpacity=".7"/><stop offset="100%" stopColor="#a06a20" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-hst-glow)"/>
      <path d="M20 12a3 3 0 0 1 4.2 0L34 22l-2 4-12-12z" fill="#ffe9a8" opacity=".0"/>
      <circle cx="32" cy="32" r="16" fill="none" stroke="#ffe9a8" strokeWidth="2.4"/>
      <path d="M32 22v10l7 5" stroke="#fff7dc" strokeWidth="3" strokeLinecap="round" fill="none"/>
      <g stroke="#ffcf6b" strokeWidth="2.6" strokeLinecap="round"><path d="M10 18h8M6 26h8M8 42h8M42 42h8M50 34h8"/></g>
    </>
  ),
  'hunger of hadar': (
    <>
      <defs><radialGradient id="g-hoh-glow" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#5a2ecf" stopOpacity=".7"/><stop offset="100%" stopColor="#0a0414" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="27" fill="url(#g-hoh-glow)"/>
      <circle cx="32" cy="32" r="18" fill="#0a0414"/>
      <g stroke="#7a4fd0" strokeWidth="2.4" fill="none" strokeLinecap="round"><path d="M32 50c-6-6-6-12 0-18s6-12 0-18M22 46c-4-4-4-9 0-14M42 46c4-4 4-9 0-14"/></g>
      <g fill="#c9a6ff"><circle cx="26" cy="24" r="1.6"/><circle cx="38" cy="40" r="1.6"/><circle cx="34" cy="20" r="1.3"/></g>
    </>
  ),
  'hypnotic pattern': (
    <>
      <defs><radialGradient id="g-hyp-glow" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#c77dff" stopOpacity=".7"/><stop offset="100%" stopColor="#4a1a8a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="27" fill="url(#g-hyp-glow)"/>
      <g fill="none" stroke="#e0b0ff" strokeWidth="2.2"><path d="M8 24c8-8 16 8 24 0s16 8 24 0"/><path d="M8 36c8-8 16 8 24 0s16 8 24 0" opacity=".8"/><path d="M8 48c8-8 16 8 24 0s16 8 24 0" opacity=".6"/></g>
      <g fill="#ffd6f2"><circle cx="14" cy="14" r="1.6"/><circle cx="32" cy="10" r="1.6"/><circle cx="50" cy="14" r="1.6"/><circle cx="32" cy="54" r="1.4"/></g>
    </>
  ),
  'intellect fortress': (
    <>
      <defs><radialGradient id="g-inf-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#c77dff" stopOpacity=".6"/><stop offset="100%" stopColor="#4a1a8a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-inf-glow)"/>
      <path d="M32 6l16 7v13c0 10-6 17-16 20-10-3-16-10-16-20V13z" fill="none" stroke="#c9a6ff" strokeWidth="3"/>
      <path d="M32 16l3 6 7 .6-5 4.4 1.4 6.8L32 30.4 25.6 34.8 27 28l-5-4.4 7-.6z" fill="#e9dcff"/>
    </>
  ),
  "leomund's tiny hut": (
    <>
      <defs><radialGradient id="g-lth-glow" cx="50%" cy="55%" r="60%"><stop offset="0%" stopColor="#cfe0ff" stopOpacity=".7"/><stop offset="100%" stopColor="#5a7fd0" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="36" r="27" fill="url(#g-lth-glow)"/>
      <path d="M6 40a26 18 0 0 1 52 0z" fill="#9cc8ff" opacity=".55"/>
      <path d="M6 40a26 18 0 0 0 52 0" fill="none" stroke="#cfe8ff" strokeWidth="2.4"/>
      <path d="M24 40V30a8 8 0 0 1 16 0v10" fill="none" stroke="#eaf6ff" strokeWidth="2.4"/>
      <path d="M28 40V32a4 4 0 0 1 8 0v8" fill="#eaf6ff" opacity=".7"/>
    </>
  ),
  'life transference': (
    <>
      <defs><radialGradient id="g-lt-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#b06bff" stopOpacity=".6"/><stop offset="100%" stopColor="#3a1266" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-lt-glow)"/>
      <path d="M20 50s-10-6-10-14a6 6 0 0 1 10-3.6A6 6 0 0 1 30 36c0 8-10 14-10 14z" fill="#9a6fd0"/>
      <path d="M44 14s10 6 10 14a6 6 0 0 1-10 3.6A6 6 0 0 1 34 28c0-8 10-14 10-14z" fill="#7fe0a0"/>
      <path d="M24 34c4 4 8 4 12 0" fill="none" stroke="#e9dcff" strokeWidth="2.2" strokeDasharray="3 3"/>
    </>
  ),
  'lightning arrow': (
    <>
      <defs><linearGradient id="g-lia" x1="0" y1="1" x2="1" y2="0"><stop offset="0%" stopColor="#fff6c4"/><stop offset="100%" stopColor="#ffd166"/></linearGradient></defs>
      <path d="M8 56L40 24l6 6-32 32z" fill="#c9d2de"/>
      <path d="M40 24l6-12 2 8 8 2-12 6z" fill="url(#g-lia)"/>
      <path d="M14 40l6 6M24 30l6 6" stroke="#fff6c4" strokeWidth="2.4" strokeLinecap="round"/>
      <g fill="#ffe9a8"><circle cx="52" cy="34" r="1.4"/><circle cx="46" cy="48" r="1.2"/></g>
    </>
  ),
  'lightning bolt': (
    <>
      <defs><linearGradient id="g-lib" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#ffffff"/><stop offset="60%" stopColor="#ffe27a"/><stop offset="100%" stopColor="#ff9d1e"/></linearGradient><radialGradient id="g-lib-glow" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#ffe9a8" stopOpacity=".8"/><stop offset="100%" stopColor="#ff9d1e" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-lib-glow)"/>
      <path d="M4 34h22l-6 8h16l-4 8h20" fill="none" stroke="url(#g-lib)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M4 34h22l-6 8h16l-4 8h20" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity=".8"/>
      <g fill="#fff6c4"><circle cx="20" cy="20" r="1.6"/><circle cx="44" cy="22" r="1.4"/><circle cx="40" cy="52" r="1.3"/></g>
    </>
  ),
  'magic circle': (
    <>
      <defs><radialGradient id="g-mac-glow" cx="50%" cy="55%" r="60%"><stop offset="0%" stopColor="#ffe9a8" stopOpacity=".6"/><stop offset="100%" stopColor="#d9a441" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="36" r="27" fill="url(#g-mac-glow)"/>
      <ellipse cx="32" cy="42" rx="26" ry="10" fill="none" stroke="#fff3c4" strokeWidth="2.4"/>
      <ellipse cx="32" cy="42" rx="18" ry="7" fill="none" stroke="#ffcf6b" strokeWidth="1.6"/>
      <path d="M32 20l5 10h-10z" fill="none" stroke="#fff3c4" strokeWidth="1.8"/>
      <path d="M27 30h10l-5 10z" fill="none" stroke="#fff3c4" strokeWidth="1.8"/>
      <g fill="#ffe9a8"><circle cx="8" cy="42" r="1.4"/><circle cx="56" cy="42" r="1.4"/></g>
    </>
  ),
  'major image': (
    <>
      <defs><linearGradient id="g-mai-ill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f0e6ff" stopOpacity=".9"/><stop offset="100%" stopColor="#a98bff" stopOpacity=".4"/></linearGradient><radialGradient id="g-mai-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#c8b0ff" stopOpacity=".6"/><stop offset="100%" stopColor="#6a4fd0" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-mai-glow)"/>
      <circle cx="32" cy="22" r="6" fill="url(#g-mai-ill)"/>
      <path d="M20 52c0-9 5-16 12-16s12 7 12 16" fill="url(#g-mai-ill)"/>
      <path d="M12 30c4 2 6 6 6 10M52 30c-4 2-6 6-6 10" fill="none" stroke="#d9c9ff" strokeWidth="2" strokeDasharray="3 3" opacity=".7"/>
    </>
  ),
  'mass healing word': (
    <>
      <defs><radialGradient id="g-mhw-glow" cx="50%" cy="45%" r="60%"><stop offset="0%" stopColor="#b7ffd0" stopOpacity=".85"/><stop offset="100%" stopColor="#3fae63" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="27" fill="url(#g-mhw-glow)"/>
      <g fill="#7fe0a0"><circle cx="18" cy="34" r="5"/><circle cx="32" cy="30" r="6"/><circle cx="46" cy="34" r="5"/></g>
      <g stroke="#eafff1" strokeWidth="2.4" strokeLinecap="round"><path d="M18 31v6M15 34h6M32 26v8M28 30h8M46 31v6M43 34h6"/></g>
      <path d="M20 50c8 4 16 4 24 0" fill="none" stroke="#bff29a" strokeWidth="2" opacity=".6"/>
    </>
  ),
  'meld into stone': (
    <>
      <defs><linearGradient id="g-mis-stone" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a09a8a"/><stop offset="100%" stopColor="#5a5448"/></linearGradient></defs>
      <path d="M6 6h52v52H6z" fill="url(#g-mis-stone)"/>
      <g stroke="#7a7468" strokeWidth="1.4" opacity=".6"><path d="M6 22h52M6 40h52M20 6v16M40 40v18M28 22v18M44 6v16"/></g>
      <path d="M26 20a6 6 0 0 1 12 0v10c3 2 5 6 5 12H21c0-6 2-10 5-12z" fill="#c9c2b0" opacity=".55"/>
      <path d="M28 24c2 0 4 1 4 3" fill="none" stroke="#5a5448" strokeWidth="2" strokeLinecap="round" opacity=".6"/>
    </>
  ),
  "melf's minute meteors": (
    <>
      <defs><radialGradient id="g-mmm" cx="42%" cy="38%" r="60%"><stop offset="0%" stopColor="#fffdf0"/><stop offset="60%" stopColor="#ff9d2e"/><stop offset="100%" stopColor="#c0260a"/></radialGradient></defs>
      <circle cx="20" cy="18" r="6" fill="url(#g-mmm)"/><circle cx="44" cy="22" r="5" fill="url(#g-mmm)"/><circle cx="30" cy="40" r="6.4" fill="url(#g-mmm)"/>
      <g fill="none" stroke="#ff9d2e" strokeWidth="2.4" strokeLinecap="round" opacity=".85"><path d="M26 22c4 6 4 14 0 20M40 26c2 6 0 12-4 16"/></g>
      <g fill="#ffce6b"><circle cx="14" cy="34" r="1.6"/><circle cx="50" cy="40" r="1.4"/><circle cx="52" cy="10" r="1.3"/></g>
    </>
  ),
  nondetection: (
    <>
      <defs><radialGradient id="g-non-glow" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#c8b0ff" stopOpacity=".6"/><stop offset="100%" stopColor="#3a2a6a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-non-glow)"/>
      <path d="M6 32s9-12 26-12 26 12 26 12-9 12-26 12S6 32 6 32z" fill="none" stroke="#9a8fd0" strokeWidth="2.4" opacity=".7"/>
      <circle cx="32" cy="32" r="7" fill="#c9c2ff"/>
      <path d="M10 12l44 40" stroke="#e9dcff" strokeWidth="3.4" strokeLinecap="round"/>
      <path d="M40 20l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#fff" opacity=".8"/>
    </>
  ),
  'phantom steed': (
    <>
      <defs><radialGradient id="g-phs-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#c8b0ff" stopOpacity=".6"/><stop offset="100%" stopColor="#5a2ecf" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-phs-glow)"/>
      <path d="M16 30c0-8 6-14 14-14 6 0 10 4 12 8l6 2-4 4c0 8-6 14-14 14" fill="none" stroke="#d9c9ff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity=".8"/>
      <path d="M18 30l-6 6M18 30l-6-4M20 36l-4 16M38 40l4 14" stroke="#d9c9ff" strokeWidth="2.4" strokeLinecap="round" opacity=".8"/>
      <path d="M24 44c4-2 8-2 12 0" fill="none" stroke="#e9dcff" strokeWidth="1.6" strokeDasharray="3 3" opacity=".7"/>
      <g fill="#e9dcff"><circle cx="12" cy="16" r="1.3"/><circle cx="52" cy="16" r="1.3"/></g>
    </>
  ),
  'plant growth': (
    <>
      <defs><radialGradient id="g-plg-glow" cx="50%" cy="60%" r="60%"><stop offset="0%" stopColor="#7fd18a" stopOpacity=".7"/><stop offset="100%" stopColor="#2f6a3a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="40" r="27" fill="url(#g-plg-glow)"/>
      <path d="M4 50h56v10H4z" fill="#4a6a2a"/>
      <g stroke="#3f8a4a" strokeWidth="3" strokeLinecap="round" fill="none"><path d="M14 50V30M24 50V24M32 50V18M40 50V24M50 50V30"/></g>
      <g fill="#7fd18a"><path d="M14 30c-5-2-7-6-6-10 4 1 7 5 6 10z"/><path d="M24 24c-5-2-6-6-5-10 4 1 6 5 5 10z"/><path d="M32 18c-4-2-5-6-4-9 3 1 5 5 4 9z"/><path d="M50 30c5-2 7-6 6-10-4 1-7 5-6 10z"/></g>
    </>
  ),
  'protection from energy': (
    <>
      <defs><linearGradient id="g-pfe-shield" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#eaf6ff"/><stop offset="100%" stopColor="#4a7fd0"/></linearGradient><radialGradient id="g-pfe-glow" cx="50%" cy="45%" r="60%"><stop offset="0%" stopColor="#9fd0ff" stopOpacity=".7"/><stop offset="100%" stopColor="#3a6fa0" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-pfe-glow)"/>
      <path d="M32 8l18 7v12c0 12-8 19-18 23-10-4-18-11-18-23V15z" fill="url(#g-pfe-shield)"/>
      <path d="M30 20l-6 14h5l-2 10 8-14h-5z" fill="#fff6c4"/>
      <path d="M32 8l18 7v4L32 12 14 19v-4z" fill="#fff" opacity=".3"/>
    </>
  ),
  'remove curse': (
    <>
      <defs><radialGradient id="g-rc-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#b7ffd0" stopOpacity=".7"/><stop offset="100%" stopColor="#3fae63" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-rc-glow)"/>
      <path d="M32 8a11 11 0 0 0-11 11c0 4 2 7 4 9" fill="none" stroke="#9a6fd0" strokeWidth="3"/>
      <g stroke="#7fe0a0" strokeWidth="2.6" strokeLinecap="round"><path d="M14 14l36 36M50 14L14 50"/></g>
      <path d="M32 26l2.4 6.6H42l-5.4 4 1.8 6.4L32 39.4 25.6 43l1.8-6.4-5.4-4h7.6z" fill="none" stroke="#eafff1" strokeWidth="1.6"/>
    </>
  ),
  revivify: (
    <>
      <defs><radialGradient id="g-rvf-glow" cx="50%" cy="45%" r="60%"><stop offset="0%" stopColor="#fff3c4" stopOpacity=".9"/><stop offset="100%" stopColor="#ffce6b" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="27" fill="url(#g-rvf-glow)"/>
      <path d="M32 50s-16-10-16-22a9 9 0 0 1 16-5.6A9 9 0 0 1 48 28c0 12-16 22-16 22z" fill="none" stroke="#ffe9a8" strokeWidth="2.6"/>
      <path d="M32 18v16M25 26h14" stroke="#fff7dc" strokeWidth="3.2" strokeLinecap="round"/>
      <g stroke="#fff3c4" strokeWidth="2" strokeLinecap="round"><path d="M14 12l5 5M50 12l-5 5M10 30h6M48 30h6"/></g>
    </>
  ),
  sending: (
    <>
      <defs><radialGradient id="g-snd-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#cfe0ff" stopOpacity=".6"/><stop offset="100%" stopColor="#5a7fd0" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-snd-glow)"/>
      <circle cx="20" cy="34" r="9" fill="#9cc8ff"/>
      <circle cx="44" cy="34" r="9" fill="#9cc8ff"/>
      <path d="M20 25c4-4 8-4 12 0M20 43c4 4 8 4 12 0" fill="none" stroke="#eaf6ff" strokeWidth="1.8" opacity=".7"/>
      <g stroke="#bfd0ff" strokeWidth="2" strokeLinecap="round" opacity=".7"><path d="M32 12v8M26 16l6 6 6-6" fill="none"/></g>
    </>
  ),
  'sleet storm': (
    <>
      <defs><radialGradient id="g-slst-glow" cx="50%" cy="40%" r="60%"><stop offset="0%" stopColor="#cfeaff" stopOpacity=".7"/><stop offset="100%" stopColor="#5a9fd0" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="30" r="27" fill="url(#g-slst-glow)"/>
      <path d="M8 24a8 8 0 0 1 8-12 10 10 0 0 1 18-2 7 7 0 0 1 10 6" fill="none" stroke="#c6d2dc" strokeWidth="3" strokeLinecap="round"/>
      <g fill="#eaf6ff"><circle cx="18" cy="38" r="2"/><circle cx="28" cy="44" r="2"/><circle cx="38" cy="38" r="2"/><circle cx="46" cy="44" r="2"/><circle cx="24" cy="52" r="2"/><circle cx="40" cy="52" r="2"/></g>
      <g stroke="#bfe4ff" strokeWidth="1.8" strokeLinecap="round"><path d="M18 34v-4M28 40v-4M38 34v-4M46 40v-4M24 48v-4M40 48v-4"/></g>
    </>
  ),
  slow: (
    <>
      <defs><radialGradient id="g-slw-glow" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#c8b0ff" stopOpacity=".6"/><stop offset="100%" stopColor="#4a2a8a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-slw-glow)"/>
      <circle cx="32" cy="32" r="16" fill="none" stroke="#d9c9ff" strokeWidth="2.4"/>
      <path d="M32 20v12l8 5" stroke="#e9dcff" strokeWidth="3" strokeLinecap="round" fill="none"/>
      <path d="M12 24l-4 4 4 4M52 24l4 4-4 4" fill="none" stroke="#9a6fd0" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" opacity=".8"/>
      <path d="M24 52h16" stroke="#d9c9ff" strokeWidth="2.4" strokeLinecap="round" opacity=".6"/>
    </>
  ),
  'speak with dead': (
    <>
      <defs><radialGradient id="g-swd-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#a06bd8" stopOpacity=".6"/><stop offset="100%" stopColor="#2a1040" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-swd-glow)"/>
      <path d="M32 8a12 12 0 0 0-12 12c0 5 3 8 5 10v4h14v-4c2-2 5-5 5-10A12 12 0 0 0 32 8z" fill="#c9a6ff"/>
      <g fill="#2a1040"><circle cx="27" cy="20" r="2"/><circle cx="37" cy="20" r="2"/></g>
      <path d="M26 30h12v6H26z" fill="#2a1040"/>
      <path d="M36 33l6 3-6 3" fill="none" stroke="#e9dcff" strokeWidth="2" strokeLinecap="round"/>
    </>
  ),
  'speak with plants': (
    <>
      <defs><radialGradient id="g-swp-glow" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#bff29a" stopOpacity=".6"/><stop offset="100%" stopColor="#3f7a2a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-swp-glow)"/>
      <path d="M8 14h24a6 6 0 0 1 6 6v6a6 6 0 0 1-6 6H18l-10 8V14z" fill="#9ad07a"/>
      <g fill="#3a6a20"><circle cx="16" cy="23" r="1.4"/><circle cx="22" cy="23" r="1.4"/><circle cx="28" cy="23" r="1.4"/></g>
      <path d="M44 52c0-10 2-16 6-22-1 10-3 16-6 22z" fill="#7fd18a"/>
      <path d="M44 52c-2-6-5-9-9-11 3 6 6 9 9 11z" fill="#bff29a"/>
    </>
  ),
  'spirit guardians': (
    <>
      <defs><radialGradient id="g-spgu-glow" cx="50%" cy="45%" r="60%"><stop offset="0%" stopColor="#c77dff" stopOpacity=".7"/><stop offset="100%" stopColor="#3a1266" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="27" fill="url(#g-spgu-glow)"/>
      <g fill="#e9dcff"><circle cx="18" cy="24" r="5" opacity=".85"/><circle cx="44" cy="22" r="4.4" opacity=".85"/><circle cx="32" cy="14" r="4.4" opacity=".85"/></g>
      <g stroke="#c9a6ff" strokeWidth="2" strokeLinecap="round" fill="none"><path d="M14 36c4-4 8-4 12 0s8 4 12 0 8-4 12 0"/><path d="M12 46c5-4 9-4 14 0s9 4 14 0 9-4 14 0" opacity=".7"/></g>
      <g fill="#fff"><circle cx="18" cy="24" r="1.4"/><circle cx="44" cy="22" r="1.2"/><circle cx="32" cy="14" r="1.2"/></g>
    </>
  ),
  'spirit shroud': (
    <>
      <defs><radialGradient id="g-sps-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#c77dff" stopOpacity=".7"/><stop offset="100%" stopColor="#3a1266" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-sps-glow)"/>
      <path d="M20 52c0-10 5-16 12-16s12 6 12 16z" fill="#8a5cf0" opacity=".85"/>
      <circle cx="32" cy="20" r="6" fill="#e9dcff"/>
      <g stroke="#c9a6ff" strokeWidth="2.2" strokeLinecap="round" fill="none" opacity=".9"><path d="M14 20c-3 6-3 16 0 24M50 20c3 6 3 16 0 24M18 14c-4 8-4 20 0 30M46 14c4 8 4 20 0 30" opacity=".6"/></g>
    </>
  ),
  'stinking cloud': (
    <>
      <defs><radialGradient id="g-stc-glow" cx="50%" cy="50%" r="60%"><stop offset="0%" stopColor="#c8f07a" stopOpacity=".8"/><stop offset="100%" stopColor="#5a8f20" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="34" r="27" fill="url(#g-stc-glow)"/>
      <g fill="#8aa64a"><circle cx="20" cy="30" r="9"/><circle cx="34" cy="26" r="11"/><circle cx="44" cy="34" r="8"/><circle cx="28" cy="42" r="10"/></g>
      <g stroke="#5a7a2a" strokeWidth="2" strokeLinecap="round" opacity=".7"><path d="M18 20l4-6M34 12l2-6M46 22l5-5M24 52l-3 5M44 50l4 5"/></g>
      <g fill="#eaffd6" opacity=".7"><circle cx="20" cy="28" r="2"/><circle cx="34" cy="24" r="2.4"/></g>
    </>
  ),
  'summon fey': (
    <>
      <defs><radialGradient id="g-sfy-glow" cx="50%" cy="45%" r="60%"><stop offset="0%" stopColor="#c8ffb0" stopOpacity=".7"/><stop offset="100%" stopColor="#3f8a6a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-sfy-glow)"/>
      <circle cx="32" cy="32" r="18" fill="none" stroke="#bff29a" strokeWidth="1.6" strokeDasharray="4 4" opacity=".8"/>
      <circle cx="32" cy="24" r="5" fill="#d9ffbf"/>
      <path d="M24 44c0-6 3-10 8-10s8 4 8 10" fill="#9ad0a0"/>
      <path d="M20 20c-4-3-8-3-10-1 3 3 7 4 10 1zM44 20c4-3 8-3 10-1-3 3-7 4-10 1z" fill="#c8ffb0"/>
      <g fill="#eafff1"><circle cx="14" cy="44" r="1.3"/><circle cx="50" cy="44" r="1.3"/></g>
    </>
  ),
  'summon lesser demons': (
    <>
      <defs><radialGradient id="g-sld-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#ff6a6a" stopOpacity=".6"/><stop offset="100%" stopColor="#5a0a0a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="34" r="26" fill="url(#g-sld-glow)"/>
      <g fill="#c02a2a"><circle cx="22" cy="34" r="7"/><circle cx="42" cy="32" r="6"/><circle cx="32" cy="44" r="5.4"/></g>
      <g fill="#2a0a0a"><circle cx="20" cy="32" r="1.4"/><circle cx="24" cy="32" r="1.4"/><circle cx="40" cy="30" r="1.3"/><circle cx="44" cy="30" r="1.3"/></g>
      <g stroke="#ff6a6a" strokeWidth="2" strokeLinecap="round"><path d="M18 28l-2-5M26 28l2-5M40 26l-2-5M46 26l2-5M30 38l-2-5M34 38l2-5"/></g>
    </>
  ),
  'summon shadowspawn': (
    <>
      <defs><radialGradient id="g-sss-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#7a4fd0" stopOpacity=".6"/><stop offset="100%" stopColor="#0a0414" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="34" r="26" fill="url(#g-sss-glow)"/>
      <path d="M32 14c6 0 10 5 10 11 0 4-2 6-3 8 4 4 6 10 6 16H19c0-6 2-12 6-16-1-2-3-4-3-8 0-6 4-11 10-11z" fill="#3a1266"/>
      <g fill="#c9a6ff"><circle cx="28" cy="26" r="1.8"/><circle cx="36" cy="26" r="1.8"/></g>
      <g stroke="#9a6fd0" strokeWidth="2" strokeLinecap="round" opacity=".8"><path d="M14 46c4-2 8-2 12 0M38 46c4-2 8-2 12 0"/></g>
    </>
  ),
  'summon undead': (
    <>
      <defs><radialGradient id="g-sud-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#8a5cf0" stopOpacity=".6"/><stop offset="100%" stopColor="#1a0a2a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="34" r="26" fill="url(#g-sud-glow)"/>
      <path d="M32 12a13 13 0 0 0-13 13c0 5 3 8 5 10v5h16v-5c2-2 5-5 5-10A13 13 0 0 0 32 12z" fill="#c9a6ff"/>
      <g fill="#1a0a2a"><circle cx="26" cy="24" r="2.2"/><circle cx="38" cy="24" r="2.2"/><path d="M26 34h12v4H26z"/></g>
      <path d="M20 54V46c2-2 6-3 12-3s10 1 12 3v8" fill="none" stroke="#9a6fd0" strokeWidth="3" strokeLinecap="round"/>
    </>
  ),
  'thunder step': (
    <>
      <defs><radialGradient id="g-ths-glow" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#cfe8ff" stopOpacity=".8"/><stop offset="100%" stopColor="#5a7fd0" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-ths-glow)"/>
      <g fill="none" stroke="#cfe8ff" strokeWidth="2.6" strokeLinecap="round"><path d="M14 44c0-6 2-11 6-15M20 48c0-8 3-14 8-18M26 50c0-9 3-16 9-20"/></g>
      <path d="M36 12l4 8-4 2-6-2z" fill="#eaf6ff"/>
      <g stroke="#9fd0ff" strokeWidth="2" strokeLinecap="round"><path d="M44 20l4-4M48 28h6M46 38l5 3"/></g>
      <circle cx="34" cy="26" r="3" fill="#fff"/>
    </>
  ),
  'tidal wave': (
    <>
      <defs><linearGradient id="g-tdw" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#dff4ff"/><stop offset="100%" stopColor="#2f7fb0"/></linearGradient><radialGradient id="g-tdw-glow" cx="50%" cy="60%" r="60%"><stop offset="0%" stopColor="#7fc4ea" stopOpacity=".6"/><stop offset="100%" stopColor="#2f7fb0" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="36" r="27" fill="url(#g-tdw-glow)"/>
      <path d="M4 42c6-14 18-22 32-18 6 2 10 6 12 12-6-4-12-4-18 0-8 6-16 8-26 6z" fill="url(#g-tdw)"/>
      <path d="M4 46c10 4 22 4 32-2 6-4 12-4 18 0-6 8-16 12-28 10-8-1-16-5-22-8z" fill="#2f8fd6" opacity=".8"/>
      <g fill="#eafaff"><circle cx="16" cy="24" r="2"/><circle cx="26" cy="18" r="1.6"/><circle cx="40" cy="20" r="1.4"/></g>
    </>
  ),
  'tiny servant': (
    <>
      <defs><linearGradient id="g-tsv" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#c9a86a"/><stop offset="100%" stopColor="#6b4f2a"/></linearGradient><radialGradient id="g-tsv-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#ffe9a8" stopOpacity=".6"/><stop offset="100%" stopColor="#a06a20" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="25" fill="url(#g-tsv-glow)"/>
      <rect x="26" y="12" width="12" height="12" rx="2" fill="url(#g-tsv)"/>
      <rect x="22" y="26" width="20" height="18" rx="3" fill="url(#g-tsv)"/>
      <g fill="#3a2a10"><circle cx="29" cy="17" r="1.4"/><circle cx="35" cy="17" r="1.4"/></g>
      <path d="M18 32h4v10h-4zM42 32h4v10h-4zM28 44v8M36 44v8" fill="#8a6a3a"/>
    </>
  ),
  tongues: (
    <>
      <defs><radialGradient id="g-tng-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#cfe0ff" stopOpacity=".6"/><stop offset="100%" stopColor="#5a7fd0" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-tng-glow)"/>
      <path d="M10 16h24a6 6 0 0 1 6 6v8a6 6 0 0 1-6 6H24L12 44V16z" fill="#9cc8ff"/>
      <path d="M30 24h22v18l-8-6H30a4 4 0 0 1-4-4v-4a4 4 0 0 1 4-4z" fill="#cfe0ff" opacity=".9"/>
      <g fill="#3a4a6a"><path d="M36 30h10M36 36h8" stroke="#3a4a6a" strokeWidth="2" strokeLinecap="round"/></g>
      <g fill="#eaf6ff"><circle cx="46" cy="14" r="1.3"/><circle cx="14" cy="48" r="1.2"/></g>
    </>
  ),
  'vampiric touch': (
    <>
      <defs><radialGradient id="g-vtc-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#b06bff" stopOpacity=".7"/><stop offset="100%" stopColor="#3a1266" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="34" r="26" fill="url(#g-vtc-glow)"/>
      <path d="M14 44V30a4 4 0 0 1 8 0v6M22 36V26a4 4 0 0 1 8 0v10M30 36v-8a4 4 0 0 1 8 0v12a10 10 0 0 1-10 10h-4a8 8 0 0 1-8-8" fill="none" stroke="#c9a6ff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
      <g stroke="#7fe0a0" strokeWidth="2" strokeLinecap="round" opacity=".85" fill="none"><path d="M46 14c-4 6-4 14 0 20M50 18c-3 5-3 11 0 16"/></g>
      <g fill="#7fe0a0"><circle cx="48" cy="10" r="2"/></g>
    </>
  ),
  'wall of sand': (
    <>
      <defs><radialGradient id="g-wsn-glow" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#ffe9a8" stopOpacity=".6"/><stop offset="100%" stopColor="#a06a20" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-wsn-glow)"/>
      <path d="M8 14h48v36H8z" fill="#d9bd7a" opacity=".55"/>
      <g stroke="#b0945a" strokeWidth="1.6" opacity=".8"><path d="M8 24h48M8 34h48M8 44h48M20 14v10M40 24v10M28 34v10M44 44v6M14 44v6"/></g>
      <g fill="#f0d9a0" opacity=".8"><circle cx="16" cy="20" r="1.4"/><circle cx="34" cy="18" r="1.4"/><circle cx="48" cy="28" r="1.4"/><circle cx="24" cy="48" r="1.4"/><circle cx="42" cy="48" r="1.4"/></g>
    </>
  ),
  'wall of water': (
    <>
      <defs><linearGradient id="g-wwa" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#dff4ff"/><stop offset="100%" stopColor="#2f7fb0"/></linearGradient></defs>
      <path d="M8 12h48v40H8z" fill="url(#g-wwa)" opacity=".85"/>
      <g fill="none" stroke="#eafaff" strokeWidth="1.6" opacity=".8"><path d="M14 16c2 20 2 30 0 34M24 16c2 20 2 30 0 34M32 16c2 20 2 30 0 34M40 16c2 20 2 30 0 34M50 16c2 20 2 30 0 34"/></g>
      <ellipse cx="32" cy="14" rx="24" ry="5" fill="#eafaff" opacity=".5"/>
      <g fill="#eafaff"><circle cx="18" cy="30" r="1.6"/><circle cx="46" cy="34" r="1.6"/></g>
    </>
  ),
  'water breathing': (
    <>
      <defs><radialGradient id="g-wbr-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#9fe0ff" stopOpacity=".7"/><stop offset="100%" stopColor="#3a7fb0" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-wbr-glow)"/>
      <circle cx="32" cy="30" r="15" fill="none" stroke="#dff4ff" strokeWidth="2.4"/>
      <path d="M32 20s7 9 7 14a7 7 0 0 1-14 0c0-5 7-14 7-14z" fill="#7fc4ea"/>
      <path d="M12 40c3-2 6-2 9 0M39 42c3-2 6-2 9 0" fill="none" stroke="#cfeaff" strokeWidth="2.2" strokeLinecap="round"/>
      <g fill="#eafaff"><circle cx="18" cy="18" r="1.4"/><circle cx="46" cy="20" r="1.4"/></g>
    </>
  ),
  'water walk': (
    <>
      <defs><radialGradient id="g-wwk-glow" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#9fe0ff" stopOpacity=".6"/><stop offset="100%" stopColor="#3a7fb0" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="34" r="26" fill="url(#g-wwk-glow)"/>
      <g fill="none" stroke="#7fc4ea" strokeWidth="2.4"><path d="M4 38c5-4 9-4 14 0s9 4 14 0 9-4 14 0 9 4 14 0"/><path d="M4 46c5-4 9-4 14 0s9 4 14 0 9-4 14 0 9 4 14 0" opacity=".6"/></g>
      <path d="M26 12h8v6l6 4-4 6H24l-4-6 6-4z" fill="#cfe0ff"/>
      <path d="M27 34h6v6h-6z" fill="#cfe0ff"/>
      <g fill="#eafaff"><circle cx="14" cy="20" r="1.3"/><circle cx="50" cy="20" r="1.3"/></g>
    </>
  ),
  'wind wall': (
    <>
      <defs><radialGradient id="g-wwl-glow" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#dff6ff" stopOpacity=".5"/><stop offset="100%" stopColor="#5a9fd0" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-wwl-glow)"/>
      <g fill="none" stroke="#bfe4ff" strokeWidth="2.4" strokeLinecap="round" opacity=".9"><path d="M14 10c-4 14-4 30 0 44M22 10c-4 14-4 30 0 44M32 10c-4 14-4 30 0 44M42 10c-4 14-4 30 0 44M50 10c-4 14-4 30 0 44"/></g>
      <g stroke="#eaf6ff" strokeWidth="2" strokeLinecap="round"><path d="M8 20l6 3M48 40l6 3M12 44l6-3M46 18l6-3"/></g>
    </>
  ),
  'arcane eye': (
    <>
      <defs><radialGradient id="g-aey-glow" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#9cc8ff" stopOpacity=".7"/><stop offset="100%" stopColor="#3a6fd0" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-aey-glow)"/>
      <ellipse cx="32" cy="32" rx="18" ry="12" fill="none" stroke="#9cc8ff" strokeWidth="2.4"/>
      <circle cx="32" cy="32" r="7" fill="#dff0ff"/><circle cx="32" cy="32" r="3" fill="#1a2a5a"/>
      <path d="M32 6c6 4 8 10 8 16M14 12l4 4M50 12l-4 4" fill="none" stroke="#bfd0ff" strokeWidth="2" strokeLinecap="round" opacity=".7"/>
    </>
  ),
  'aura of life': (
    <>
      <defs><radialGradient id="g-aol-glow" cx="50%" cy="45%" r="60%"><stop offset="0%" stopColor="#b7ffd0" stopOpacity=".85"/><stop offset="100%" stopColor="#3fae63" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="27" fill="url(#g-aol-glow)"/>
      <g fill="none" stroke="#7fe0a0" strokeWidth="2.2"><circle cx="32" cy="32" r="10"/><circle cx="32" cy="32" r="17" opacity=".7"/><circle cx="32" cy="32" r="23" opacity=".45"/></g>
      <path d="M32 26s6 8 6 12a6 6 0 0 1-12 0c0-4 6-12 6-12z" fill="#eafff1"/>
    </>
  ),
  'aura of purity': (
    <>
      <defs><radialGradient id="g-aop-glow" cx="50%" cy="45%" r="60%"><stop offset="0%" stopColor="#dff0ff" stopOpacity=".85"/><stop offset="100%" stopColor="#5a9fd0" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="27" fill="url(#g-aop-glow)"/>
      <g fill="none" stroke="#9cc8ff" strokeWidth="2.2"><circle cx="32" cy="32" r="10"/><circle cx="32" cy="32" r="17" opacity=".7"/><circle cx="32" cy="32" r="23" opacity=".45"/></g>
      <path d="M32 24l3 6 6 .6-4.4 4 1.2 6L32 38.4 26.2 40.6l1.2-6-4.4-4 6-.6z" fill="#eaf6ff"/>
    </>
  ),
  banishment: (
    <>
      <defs><radialGradient id="g-bnm-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#c77dff" stopOpacity=".7"/><stop offset="100%" stopColor="#3a1266" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-bnm-glow)"/>
      <circle cx="32" cy="32" r="16" fill="none" stroke="#c9a6ff" strokeWidth="2.6"/>
      <path d="M32 16a16 16 0 0 1 0 32" fill="none" stroke="#9a6fd0" strokeWidth="2.6" opacity=".7"/>
      <path d="M24 32h14M32 26l8 6-8 6" fill="none" stroke="#e9dcff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/>
    </>
  ),
  blight: (
    <>
      <defs><radialGradient id="g-blt-glow" cx="50%" cy="55%" r="55%"><stop offset="0%" stopColor="#7a4fd0" stopOpacity=".6"/><stop offset="100%" stopColor="#1a0a2a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="36" r="26" fill="url(#g-blt-glow)"/>
      <path d="M32 54V20" stroke="#5a3a2a" strokeWidth="4" strokeLinecap="round"/>
      <path d="M32 30c-8-2-12-8-10-16 7 2 11 8 10 16zM32 30c8-2 12-8 10-16-7 2-11 8-10 16z" fill="#5a3a5a"/>
      <g fill="#3a2a3a"><circle cx="26" cy="42" r="2"/><circle cx="38" cy="46" r="2"/></g>
      <path d="M20 52c4-2 8-2 12 0s8 2 12 0" fill="none" stroke="#7a4fd0" strokeWidth="2" opacity=".6"/>
    </>
  ),
  'charm monster': (
    <>
      <defs><radialGradient id="g-chm-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#ffb0e6" stopOpacity=".6"/><stop offset="100%" stopColor="#7a2a66" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-chm-glow)"/>
      <path d="M32 12c5 0 8 3 8 8 0 3-1 5-3 6 3 2 5 5 5 9H22c0-4 2-7 5-9-2-1-3-3-3-6 0-5 3-8 8-8z" fill="#c76ad1"/>
      <g stroke="#c76ad1" strokeWidth="3" strokeLinecap="round"><path d="M18 14l-4-4M46 14l4-4"/></g>
      <path d="M28 20c2-1 6-1 8 0" fill="none" stroke="#ffe0f4" strokeWidth="1.6" strokeLinecap="round"/>
      <path d="M44 40c2 2 5 3 5 6a3.4 3.4 0 0 1-5 2.6A3.4 3.4 0 0 1 39 46c0-3 3-4 5-6z" fill="#ff7ac6"/>
    </>
  ),
  compulsion: (
    <>
      <defs><radialGradient id="g-cpl-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#b0c0ff" stopOpacity=".6"/><stop offset="100%" stopColor="#3a4aa0" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-cpl-glow)"/>
      <circle cx="24" cy="26" r="7" fill="#dbe4ff"/><circle cx="42" cy="26" r="7" fill="#dbe4ff"/>
      <path d="M17 46c0-6 3-10 7-10s7 4 7 10M35 46c0-6 3-10 7-10s7 4 7 10" fill="#9fb0ff"/>
      <path d="M32 8v10M28 12l4-4 4 4" fill="none" stroke="#eaf2ff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
    </>
  ),
  confusion: (
    <>
      <defs><radialGradient id="g-cfs-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#ffb0e6" stopOpacity=".5"/><stop offset="100%" stopColor="#5a2a5a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-cfs-glow)"/>
      <path d="M32 12a14 14 0 0 0-10 24" fill="none" stroke="#c76ad1" strokeWidth="2.6" strokeLinecap="round"/>
      <path d="M32 12a14 14 0 0 1 10 24" fill="none" stroke="#ff9ecb" strokeWidth="2.6" strokeLinecap="round"/>
      <path d="M22 36c6 4 14 4 20 0" fill="none" stroke="#e9dcff" strokeWidth="2.4" strokeLinecap="round"/>
      <g fill="none" stroke="#c76ad1" strokeWidth="2" strokeLinecap="round" opacity=".8"><path d="M32 6v6M14 12l4 4M50 12l-4 4"/></g>
      <circle cx="32" cy="26" r="2.4" fill="#ffe0f4"/>
    </>
  ),
  'conjure minor elementals': (
    <>
      <defs><radialGradient id="g-cme-glow" cx="50%" cy="50%" r="60%"><stop offset="0%" stopColor="#ffd6a0" stopOpacity=".6"/><stop offset="100%" stopColor="#a06020" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="34" r="26" fill="url(#g-cme-glow)"/>
      <path d="M32 6l7 8-7 8-7-8z" fill="#9fe8ff"/><path d="M14 40l7 8-7 8-7-8z" fill="#a3e635"/><path d="M50 40l7 8-7 8-7-8z" fill="#ff8a3a"/><path d="M32 40l7 8-7 8-7-8z" fill="#c9c2b0"/>
    </>
  ),
  'conjure woodland beings': (
    <>
      <defs><radialGradient id="g-cwb-glow" cx="50%" cy="50%" r="60%"><stop offset="0%" stopColor="#bff29a" stopOpacity=".7"/><stop offset="100%" stopColor="#3f7a2a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="34" r="26" fill="url(#g-cwb-glow)"/>
      <g fill="#7fd18a"><circle cx="20" cy="30" r="5"/><circle cx="44" cy="28" r="5"/><circle cx="32" cy="44" r="5"/></g>
      <g fill="#eaffd6"><circle cx="20" cy="30" r="1.6"/><circle cx="44" cy="28" r="1.6"/><circle cx="32" cy="44" r="1.6"/></g>
      <path d="M20 24l-2-6 5 3zM44 22l2-6-5 3zM32 38l-2-6 5 3zM32 50l-2-6 5 3z" fill="#c8ffb0"/>
    </>
  ),
  'control water': (
    <>
      <defs><linearGradient id="g-cwt" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#dff4ff"/><stop offset="100%" stopColor="#2f7fb0"/></linearGradient></defs>
      <path d="M6 40c4-10 10-14 18-12 4 1 6 4 6 8-8-2-16 0-24 4z" fill="url(#g-cwt)"/>
      <path d="M58 40c-4-10-10-14-18-12-4 1-6 4-6 8 8-2 16 0 24 4z" fill="url(#g-cwt)"/>
      <path d="M6 48c6 4 14 4 20 0s14-4 20 0 6 4 6 4H6z" fill="#2f8fd6" opacity=".75"/>
      <g stroke="#eafaff" strokeWidth="1.8" strokeLinecap="round" opacity=".8"><path d="M14 30l-4-6M50 30l4-6M32 24v-6"/></g>
    </>
  ),
  'death ward': (
    <>
      <defs><linearGradient id="g-dwd-shield" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#eaf6ff"/><stop offset="100%" stopColor="#3a4f9a"/></linearGradient><radialGradient id="g-dwd-glow" cx="50%" cy="45%" r="60%"><stop offset="0%" stopColor="#9fb0ff" stopOpacity=".7"/><stop offset="100%" stopColor="#2a3a6a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="27" fill="url(#g-dwd-glow)"/>
      <path d="M32 8l18 7v12c0 12-8 19-18 23-10-4-18-11-18-23V15z" fill="url(#g-dwd-shield)"/>
      <path d="M32 20v14M32 38v.5" stroke="#eaf6ff" strokeWidth="3.2" strokeLinecap="round"/>
      <path d="M32 8l18 7v4L32 12 14 19v-4z" fill="#fff" opacity=".3"/>
    </>
  ),
  'dimension door': (
    <>
      <defs><radialGradient id="g-ddr-glow" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#c77dff" stopOpacity=".7"/><stop offset="100%" stopColor="#3a1266" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-ddr-glow)"/>
      <ellipse cx="18" cy="32" rx="10" ry="14" fill="none" stroke="#c9a6ff" strokeWidth="2.6"/>
      <ellipse cx="46" cy="32" rx="10" ry="14" fill="none" stroke="#9a6fd0" strokeWidth="2.6"/>
      <path d="M22 32h20M34 26l8 6-8 6" fill="none" stroke="#e9dcff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/>
    </>
  ),
  divination: (
    <>
      <defs><radialGradient id="g-div-glow" cx="50%" cy="45%" r="60%"><stop offset="0%" stopColor="#c9c0ff" stopOpacity=".8"/><stop offset="100%" stopColor="#5a4fd0" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="27" fill="url(#g-div-glow)"/>
      <path d="M32 8l18 9v8c0 10-7 17-18 21-11-4-18-11-18-21v-8z" fill="none" stroke="#d9c9ff" strokeWidth="2.4"/>
      <path d="M32 18l2.6 6.4L41 27l-6.4 2.6L32 36l-2.6-6.4L23 27l6.4-2.6z" fill="#e9e6ff"/>
      <g fill="#fff"><circle cx="44" cy="14" r="1.4"/><circle cx="20" cy="14" r="1.4"/></g>
    </>
  ),
  'dominate beast': (
    <>
      <defs><radialGradient id="g-dmb-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#ffb0e6" stopOpacity=".6"/><stop offset="100%" stopColor="#7a2a66" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="34" r="26" fill="url(#g-dmb-glow)"/>
      <circle cx="32" cy="36" r="4.4" fill="#e9d6b0"/><circle cx="23" cy="29" r="2.4" fill="#e9d6b0"/><circle cx="29" cy="25" r="2.4" fill="#e9d6b0"/><circle cx="35" cy="25" r="2.4" fill="#e9d6b0"/><circle cx="41" cy="29" r="2.4" fill="#e9d6b0"/>
      <path d="M32 12c4 0 6 2 6 5s-2 5-6 5-6-2-6-5 2-5 6-5z" fill="#c76ad1"/>
      <path d="M32 8l1.6 3 3 1.4-3 1.4L32 17l-1.6-3.2-3-1.4 3-1.4z" fill="#ffe0f4"/>
    </>
  ),
  'elemental bane': (
    <>
      <defs><radialGradient id="g-eln-glow" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#ff8a3a" stopOpacity=".6"/><stop offset="100%" stopColor="#5a2a0a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-eln-glow)"/>
      <circle cx="32" cy="32" r="15" fill="none" stroke="#ff9d1e" strokeWidth="2.4"/>
      <path d="M32 18v28M18 32h28" stroke="#ffb347" strokeWidth="2" opacity=".6"/>
      <path d="M32 22l6 6-6 12-6-12z" fill="#ffce6b"/>
      <g fill="#ffe9a8"><circle cx="14" cy="14" r="1.4"/><circle cx="50" cy="14" r="1.4"/><circle cx="50" cy="50" r="1.2"/></g>
    </>
  ),
  "evard's black tentacles": (
    <>
      <defs><radialGradient id="g-ebt-glow" cx="50%" cy="55%" r="60%"><stop offset="0%" stopColor="#5a2ecf" stopOpacity=".7"/><stop offset="100%" stopColor="#0a0414" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="38" r="27" fill="url(#g-ebt-glow)"/>
      <g stroke="#3a1266" strokeWidth="5" fill="none" strokeLinecap="round">
        <path d="M32 58C24 48 20 40 22 26"/><path d="M32 58c8-10 12-18 10-32"/><path d="M32 58C18 52 12 44 10 34"/><path d="M32 58c14-6 20-14 22-24"/><path d="M32 58c-4-12-2-24 0-34"/></g>
      <g fill="#7a4fd0"><circle cx="22" cy="26" r="2"/><circle cx="42" cy="26" r="2"/><circle cx="10" cy="34" r="1.6"/><circle cx="54" cy="34" r="1.6"/><circle cx="31" cy="24" r="1.6"/></g>
    </>
  ),
  fabricate: (
    <>
      <defs><linearGradient id="g-fab" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#d9b98a"/><stop offset="100%" stopColor="#7a5a30"/></linearGradient><radialGradient id="g-fab-glow" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#ffe9a8" stopOpacity=".6"/><stop offset="100%" stopColor="#a06a20" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="25" fill="url(#g-fab-glow)"/>
      <path d="M32 8l12 6v12l-12 6-12-6V14z" fill="url(#g-fab)"/>
      <path d="M20 14l12 6 12-6M32 20v12" stroke="#5a3a18" strokeWidth="1.8" opacity=".7"/>
      <path d="M14 44l10-4v8l-10 4z" fill="#b08a5a"/>
      <path d="M42 40l8-6v10l-8 6z" fill="#b08a5a"/>
    </>
  ),
  'find greater steed': (
    <>
      <defs><radialGradient id="g-fgs-glow" cx="50%" cy="45%" r="60%"><stop offset="0%" stopColor="#dff0ff" stopOpacity=".7"/><stop offset="100%" stopColor="#4a6fd0" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="27" fill="url(#g-fgs-glow)"/>
      <path d="M16 32c0-9 7-16 16-16 6 0 11 4 13 9l7 2-4 5" fill="none" stroke="#eaf2ff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M18 32l-6 6M18 32l-6-4M20 38l-4 16M40 42l4 14" stroke="#eaf2ff" strokeWidth="2.6" strokeLinecap="round"/>
      <path d="M40 16l4-8 2 6 6 0-5 5" fill="#bfe0ff"/>
      <circle cx="40" cy="27" r="1.8" fill="#eaf6ff"/>
    </>
  ),
  'fire shield': (
    <>
      <defs><linearGradient id="g-fsh-face" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ff8a1e"/><stop offset="50%" stopColor="#e23b00"/><stop offset="100%" stopColor="#7a1a00"/></linearGradient><radialGradient id="g-fsh-glow" cx="50%" cy="50%" r="60%"><stop offset="0%" stopColor="#ff9d2e" stopOpacity=".8"/><stop offset="100%" stopColor="#d23200" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="27" fill="url(#g-fsh-glow)"/>
      <path d="M32 6l18 7v12c0 12-8 19-18 23-10-4-18-11-18-23V13z" fill="url(#g-fsh-face)"/>
      <g fill="#ffe9a8" opacity=".9"><path d="M32 14c1.6 4 5 4.6 5 8a5 5 0 0 1-10 0c0-3.4 3.4-4 5-8z"/><path d="M20 26c1.2 3 3.6 3.4 3.6 6a3.6 3.6 0 0 1-7.2 0c0-2.6 2.4-3 3.6-6z" opacity=".7"/><path d="M44 26c1.2 3 3.6 3.4 3.6 6a3.6 3.6 0 0 1-7.2 0c0-2.6 2.4-3 3.6-6z" opacity=".7"/></g>
    </>
  ),
  'fount of moonlight': (
    <>
      <defs><radialGradient id="g-fom-glow" cx="50%" cy="40%" r="65%"><stop offset="0%" stopColor="#eaf3ff" stopOpacity=".95"/><stop offset="100%" stopColor="#9fb6ff" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="28" r="27" fill="url(#g-fom-glow)"/>
      <path d="M30 10a14 14 0 1 0 12 22 11 11 0 0 1-12-22z" fill="#f2f7ff"/>
      <g stroke="#cfe0ff" strokeWidth="2.4" strokeLinecap="round" opacity=".9"><path d="M32 34v14M24 40c4 2 12 2 16 0M26 48c4 2 8 2 12 0"/></g>
      <g fill="#eaf3ff"><circle cx="16" cy="16" r="1.6"/><circle cx="50" cy="16" r="1.6"/><circle cx="16" cy="42" r="1.2"/></g>
    </>
  ),
  'freedom of movement': (
    <>
      <defs><radialGradient id="g-frm-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#b7ffd0" stopOpacity=".7"/><stop offset="100%" stopColor="#3fae63" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-frm-glow)"/>
      <circle cx="32" cy="16" r="5" fill="#d9ffbf"/>
      <path d="M32 22c-4 4-4 9 1 13l-6 9M32 27l10 3 5-5M33 35l-7 13" fill="none" stroke="#7fe0a0" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
      <g stroke="#7fe0a0" strokeWidth="2" strokeLinecap="round" opacity=".8" fill="none"><path d="M12 24l-4-4M52 24l4-4M10 40l-4 4M54 40l4 4"/></g>
    </>
  ),
  'giant insect': (
    <>
      <defs><radialGradient id="g-gin-glow" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#bff29a" stopOpacity=".6"/><stop offset="100%" stopColor="#3f6a2a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="34" r="26" fill="url(#g-gin-glow)"/>
      <ellipse cx="32" cy="34" rx="7" ry="14" fill="#7a8a3a"/>
      <path d="M32 20v28" stroke="#5a6a2a" strokeWidth="2"/>
      <g stroke="#5a6a2a" strokeWidth="2.4" strokeLinecap="round" fill="none"><path d="M25 28l-12-6M25 36l-13 0M39 28l12-6M39 36l13 0M27 46l-9 8M37 46l9 8"/></g>
      <circle cx="32" cy="18" r="5" fill="#3f5a2a"/>
      <path d="M28 14l-4-5M36 14l4-5" stroke="#3f5a2a" strokeWidth="2" strokeLinecap="round"/>
    </>
  ),
  'grasping vine': (
    <>
      <defs><linearGradient id="g-grv-vine" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#bff29a"/><stop offset="100%" stopColor="#2f6a3a"/></linearGradient></defs>
      <path d="M6 6c10 6 12 18 6 26-4 6-2 14 8 20" fill="none" stroke="url(#g-grv-vine)" strokeWidth="5" strokeLinecap="round"/>
      <g fill="none" stroke="#3f8a4a" strokeWidth="3" strokeLinecap="round"><path d="M24 34c0 6 4 10 10 12"/></g>
      <path d="M34 44c4-1 7 1 8 5-4 1-8-1-8-5z" fill="#7fd18a"/>
      <circle cx="24" cy="34" r="3" fill="#7fd18a"/>
      <path d="M14 14l-4-2 2 4zM18 24l-4-2 2 4z" fill="#eaffd6"/>
    </>
  ),
  'greater invisibility': (
    <>
      <defs><radialGradient id="g-giv-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#cfe0ff" stopOpacity=".5"/><stop offset="100%" stopColor="#7a8fd0" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-giv-glow)"/>
      <circle cx="32" cy="18" r="7" fill="none" stroke="#cfe0ff" strokeWidth="2.2" strokeDasharray="5 4"/>
      <path d="M18 52c0-10 6-18 14-18s14 8 14 18" fill="none" stroke="#cfe0ff" strokeWidth="2.2" strokeDasharray="5 4"/>
      <path d="M20 32l-6 10M44 32l6 10" fill="none" stroke="#cfe0ff" strokeWidth="2.2" strokeDasharray="5 4"/>
      <path d="M48 14l1.6 3.6L53 19l-3.4 1.4L48 24l-1.6-3.6L43 19l3.4-1.4z" fill="#eaf2ff"/>
    </>
  ),
  'guardian of faith': (
    <>
      <defs><radialGradient id="g-gof-glow" cx="50%" cy="40%" r="65%"><stop offset="0%" stopColor="#fff3c4" stopOpacity=".95"/><stop offset="100%" stopColor="#ffce6b" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="27" fill="url(#g-gof-glow)"/>
      <path d="M32 6l16 7v10c0 10-6 16-16 20-10-4-16-10-16-20V13z" fill="none" stroke="#fff7dc" strokeWidth="2.4"/>
      <path d="M32 4l4 8v18h-8V12z" fill="#fff7dc"/>
      <path d="M22 30h20M28 30v12h8V30" fill="none" stroke="#d9a441" strokeWidth="2.4"/>
    </>
  ),
  'guardian of nature': (
    <>
      <defs><radialGradient id="g-gon-glow" cx="50%" cy="40%" r="60%"><stop offset="0%" stopColor="#bff29a" stopOpacity=".7"/><stop offset="100%" stopColor="#3f8a4a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="27" fill="url(#g-gon-glow)"/>
      <path d="M32 12c6 0 10 5 10 11 0 4-2 6-4 8-2-4-4-6-6-6s-4 2-6 6c-2-2-4-4-4-8 0-6 4-11 10-11z" fill="#7fd18a"/>
      <path d="M20 48c0-8 5-14 12-14s12 6 12 14z" fill="#5a9a5a"/>
      <g fill="#eaffd6"><circle cx="26" cy="22" r="1.6"/><circle cx="38" cy="22" r="1.6"/></g>
      <path d="M18 16l-4-6M46 16l4-6M32 8V2" stroke="#bff29a" strokeWidth="2" strokeLinecap="round"/>
    </>
  ),
  'hallucinatory terrain': (
    <>
      <defs><radialGradient id="g-htt-glow" cx="50%" cy="55%" r="60%"><stop offset="0%" stopColor="#c8b0ff" stopOpacity=".6"/><stop offset="100%" stopColor="#5a4fd0" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="36" r="27" fill="url(#g-htt-glow)"/>
      <path d="M4 46c6-8 14-12 28-12s22 4 28 12z" fill="#7fd18a" opacity=".8"/>
      <path d="M12 40l6-8 6 8zM30 40l8-12 8 12z" fill="#5a9a5a"/>
      <path d="M8 52c2-2 4-2 6 0s4 2 6 0 4-2 6 0 4 2 6 0 4-2 6 0 4 2 6 0" fill="none" stroke="#9cc8ff" strokeWidth="2" opacity=".7"/>
      <g fill="#e9dcff"><circle cx="14" cy="16" r="1.4"/><circle cx="50" cy="16" r="1.4"/></g>
    </>
  ),
  'ice storm': (
    <>
      <defs><linearGradient id="g-ics" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ffffff"/><stop offset="100%" stopColor="#7fc4ea"/></linearGradient><radialGradient id="g-ics-glow" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#cfeaff" stopOpacity=".6"/><stop offset="100%" stopColor="#5a9fd0" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-ics-glow)"/>
      <g fill="url(#g-ics)"><path d="M14 8l3 8-3 3-3-3z"/><path d="M30 6l3 9-3 4-3-4z"/><path d="M46 10l3 8-3 3-3-3z"/><path d="M22 24l3 9-3 4-3-4z"/><path d="M40 24l3 9-3 4-3-4z"/></g>
      <g fill="#eafaff"><circle cx="20" cy="48" r="2.4"/><circle cx="32" cy="52" r="2.4"/><circle cx="44" cy="48" r="2.4"/></g>
    </>
  ),
  "leomund's secret chest": (
    <>
      <defs><linearGradient id="g-lsc" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a97a3a"/><stop offset="100%" stopColor="#5a3a18"/></linearGradient><radialGradient id="g-lsc-glow" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#c8b0ff" stopOpacity=".6"/><stop offset="100%" stopColor="#4a2a8a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-lsc-glow)"/>
      <path d="M10 26h44v20H10z" fill="url(#g-lsc)"/>
      <path d="M10 26l10-8h24l10 8z" fill="#c9a86a"/>
      <path d="M32 18v32" stroke="#3a2510" strokeWidth="1.6" opacity=".6"/>
      <circle cx="32" cy="38" r="3" fill="#ffd166"/>
      <path d="M32 41v6" stroke="#ffd166" strokeWidth="2.4" strokeLinecap="round"/>
    </>
  ),
  'locate creature': (
    <>
      <defs><radialGradient id="g-lcr-glow" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#bff29a" stopOpacity=".6"/><stop offset="100%" stopColor="#3f7a2a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="25" fill="url(#g-lcr-glow)"/>
      <circle cx="30" cy="30" r="14" fill="none" stroke="#bff29a" strokeWidth="2.4"/>
      <path d="M40 40l12 12" stroke="#bff29a" strokeWidth="3.4" strokeLinecap="round"/>
      <circle cx="30" cy="32" r="3" fill="#eaffd6"/><circle cx="24" cy="27" r="1.8" fill="#eaffd6"/><circle cx="27" cy="23" r="1.8" fill="#eaffd6"/><circle cx="33" cy="23" r="1.8" fill="#eaffd6"/><circle cx="36" cy="27" r="1.8" fill="#eaffd6"/>
    </>
  ),
  "mordenkainen's faithful hound": (
    <>
      <defs><radialGradient id="g-mfh-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#9cc8ff" stopOpacity=".6"/><stop offset="100%" stopColor="#3a5f9a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="34" r="26" fill="url(#g-mfh-glow)"/>
      <path d="M18 40c0-10 5-16 14-16 6 0 10 3 12 8l6 2-3 4" fill="none" stroke="#dbeaff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M18 40l-4 12M28 42l-2 12M46 40l4 12" stroke="#dbeaff" strokeWidth="2.4" strokeLinecap="round"/>
      <circle cx="30" cy="32" r="1.6" fill="#eaf6ff"/>
      <path d="M40 44c4-2 8-2 12 0" fill="none" stroke="#9cc8ff" strokeWidth="1.8" strokeDasharray="3 3" opacity=".7"/>
    </>
  ),
  "mordenkainen's private sanctum": (
    <>
      <defs><radialGradient id="g-mps-glow" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#c8b0ff" stopOpacity=".6"/><stop offset="100%" stopColor="#4a2a8a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-mps-glow)"/>
      <path d="M10 26L32 10l22 16v22H10z" fill="none" stroke="#d9c9ff" strokeWidth="2.4"/>
      <path d="M10 26h44M32 10v38M22 26v22M42 26v22" stroke="#c9a6ff" strokeWidth="1.6" opacity=".6"/>
      <circle cx="32" cy="30" r="3" fill="#e9dcff"/>
      <path d="M20 40c6 3 18 3 24 0" fill="none" stroke="#d9c9ff" strokeWidth="1.6" strokeDasharray="3 3" opacity=".6"/>
    </>
  ),
  "otiluke's resilient sphere": (
    <>
      <defs><radialGradient id="g-ors-sphere" cx="38%" cy="34%" r="65%"><stop offset="0%" stopColor="#ffffff" stopOpacity=".9"/><stop offset="60%" stopColor="#9fd0ff" stopOpacity=".5"/><stop offset="100%" stopColor="#4a7fd0" stopOpacity=".2"/></radialGradient></defs>
      <circle cx="32" cy="32" r="20" fill="url(#g-ors-sphere)" stroke="#cfe8ff" strokeWidth="2.4"/>
      <path d="M20 26a14 14 0 0 1 16-6" fill="none" stroke="#fff" strokeWidth="2" opacity=".7"/>
      <circle cx="32" cy="32" r="26" fill="none" stroke="#7cf9ff" strokeWidth="1" opacity=".4"/>
      <g fill="#eaf6ff" opacity=".7"><circle cx="14" cy="14" r="1.3"/><circle cx="50" cy="50" r="1.3"/></g>
    </>
  ),
  'phantasmal killer': (
    <>
      <defs><radialGradient id="g-phk-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#c77dff" stopOpacity=".7"/><stop offset="100%" stopColor="#3a1266" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-phk-glow)"/>
      <path d="M32 8c-7 0-12 5-12 12 0 5 3 8 5 10v4h14v-4c2-2 5-5 5-10 0-7-5-12-12-12z" fill="#7a4fd0" opacity=".85"/>
      <g fill="#c9a6ff"><circle cx="26" cy="20" r="2.4"/><circle cx="38" cy="20" r="2.4"/></g>
      <path d="M24 30c5 3 11 3 16 0" fill="none" stroke="#e9dcff" strokeWidth="2" strokeLinecap="round"/>
      <g stroke="#9a6fd0" strokeWidth="2.2" strokeLinecap="round"><path d="M12 12l5 5M52 12l-5 5M10 30h5M49 30h5"/></g>
    </>
  ),
  polymorph: (
    <>
      <defs><radialGradient id="g-ply-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#c8b0ff" stopOpacity=".6"/><stop offset="100%" stopColor="#5a2ecf" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-ply-glow)"/>
      <circle cx="32" cy="36" r="7" fill="#e9dcff"/>
      <circle cx="18" cy="28" r="3.4" fill="#b0a0ff"/><circle cx="46" cy="28" r="3.4" fill="#b0a0ff"/>
      <path d="M32 8l4 8h-8z" fill="#e9dcff"/>
      <path d="M14 52c4-4 8-4 12 0M38 52c4-4 8-4 12 0" fill="none" stroke="#c9a6ff" strokeWidth="2" strokeLinecap="round" opacity=".6"/>
    </>
  ),
  'shadow of moil': (
    <>
      <defs><radialGradient id="g-som-glow" cx="50%" cy="45%" r="60%"><stop offset="0%" stopColor="#5a2ecf" stopOpacity=".7"/><stop offset="100%" stopColor="#0a0414" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="27" fill="url(#g-som-glow)"/>
      <circle cx="32" cy="32" r="14" fill="#0a0414"/>
      <g stroke="#7a4fd0" strokeWidth="2.4" fill="none" strokeLinecap="round" opacity=".9"><path d="M32 18c-5 4-5 8 0 12s5 8 0 12M22 24c-3 6-3 12 0 18M42 24c3 6 3 12 0 18"/></g>
      <g fill="#a06bd8"><circle cx="26" cy="28" r="1.6"/><circle cx="38" cy="38" r="1.6"/></g>
    </>
  ),
  'sickening radiance': (
    <>
      <defs><radialGradient id="g-skr-glow" cx="50%" cy="40%" r="65%"><stop offset="0%" stopColor="#d9ffa0" stopOpacity=".85"/><stop offset="100%" stopColor="#6aa020" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="30" r="27" fill="url(#g-skr-glow)"/>
      <circle cx="32" cy="30" r="10" fill="#eaffb0"/>
      <g stroke="#bff29a" strokeWidth="2.4" strokeLinecap="round"><path d="M32 6v8M32 46v8M8 30h8M48 30h8M14 12l6 6M44 42l6 6M50 12l-6 6M20 42l-6 6"/></g>
      <g fill="#7a9a3a"><circle cx="24" cy="24" r="1.6"/><circle cx="40" cy="36" r="1.6"/></g>
    </>
  ),
  'staggering smite': (
    <>
      <defs><linearGradient id="g-sts-blade" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f2eaf0"/><stop offset="100%" stopColor="#8a7080"/></linearGradient><radialGradient id="g-sts-glow" cx="50%" cy="35%" r="60%"><stop offset="0%" stopColor="#c77dff" stopOpacity=".6"/><stop offset="100%" stopColor="#5a2ecf" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="28" r="26" fill="url(#g-sts-glow)"/>
      <path d="M32 4l4 8v24h-8V12z" fill="url(#g-sts-blade)"/>
      <path d="M22 36h20M28 36v14h8V36" fill="none" stroke="#b8a4b4" strokeWidth="2.6"/>
      <g stroke="#c9a6ff" strokeWidth="2.2" strokeLinecap="round" fill="none"><path d="M16 14a8 8 0 0 0 0 12M48 14a8 8 0 0 1 0 12"/></g>
      <path d="M28 22l-3 4h6zM36 22l-3 4h6z" fill="#e9dcff"/>
    </>
  ),
  'stone shape': (
    <>
      <defs><linearGradient id="g-stn" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#b0aa9a"/><stop offset="100%" stopColor="#5a5448"/></linearGradient></defs>
      <path d="M10 20l10-10 14 4 10-6 10 12-6 16-14 6-12-2-12-8z" fill="url(#g-stn)"/>
      <path d="M20 10l2 14-12 8M34 14l8 12-10 10M54 20l-8 10" stroke="#4a463c" strokeWidth="1.6" opacity=".6" fill="none"/>
      <path d="M24 30l8-6 8 4-2 12-10 4-6-8z" fill="#c9c2b0" opacity=".7"/>
      <g fill="#d9d2c0"><circle cx="40" cy="18" r="1.4"/><circle cx="18" cy="36" r="1.4"/></g>
    </>
  ),
  stoneskin: (
    <>
      <defs><radialGradient id="g-stk-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#d9b98a" stopOpacity=".6"/><stop offset="100%" stopColor="#6b5a3a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-stk-glow)"/>
      <path d="M32 8l18 7v12c0 12-8 19-18 23-10-4-18-11-18-23V15z" fill="#8a8070"/>
      <g stroke="#5a5448" strokeWidth="1.6" opacity=".7"><path d="M18 18l8 6-6 6 8 6-8 6M46 18l-8 6 6 6-8 6 8 6M32 12v10l-6 4 6 6v10"/></g>
      <path d="M32 8l18 7v4L32 12 14 19v-4z" fill="#c9c2b0" opacity=".4"/>
    </>
  ),
  'storm sphere': (
    <>
      <defs><radialGradient id="g-stms-glow" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#ffffff" stopOpacity=".8"/><stop offset="100%" stopColor="#5a9fd0" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-stms-glow)"/>
      <circle cx="32" cy="32" r="14" fill="none" stroke="#9fd0ff" strokeWidth="2" opacity=".7"/>
      <g fill="none" stroke="#8fb8ff" strokeWidth="2.4" strokeLinecap="round"><path d="M32 12a20 20 0 0 1 0 40"/><path d="M32 16a16 16 0 0 1 0 32" opacity=".7"/></g>
      <path d="M30 26l-6 10h5l-2 8 8-12h-5z" fill="#fff6c4"/>
      <g fill="#eaf6ff"><circle cx="22" cy="20" r="1.3"/><circle cx="44" cy="44" r="1.3"/></g>
    </>
  ),
  'summon aberration': (
    <>
      <defs><radialGradient id="g-sab-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#c77dff" stopOpacity=".6"/><stop offset="100%" stopColor="#3a1266" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="34" r="26" fill="url(#g-sab-glow)"/>
      <ellipse cx="32" cy="36" rx="11" ry="14" fill="#8a5cf0" opacity=".9"/>
      <g stroke="#c9a6ff" strokeWidth="3" fill="none" strokeLinecap="round"><path d="M24 24c-4-4-10-4-14 0M40 24c4-4 10-4 14 0M26 48c-4 4-10 4-14 0M38 48c4 4 10 4 14 0"/></g>
      <g fill="#1a0a2a"><circle cx="28" cy="32" r="2"/><circle cx="36" cy="32" r="2"/><circle cx="32" cy="40" r="1.4"/></g>
    </>
  ),
  'summon construct': (
    <>
      <defs><linearGradient id="g-scn" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#c9d2de"/><stop offset="100%" stopColor="#6b7788"/></linearGradient><radialGradient id="g-scn-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#cfe0ff" stopOpacity=".6"/><stop offset="100%" stopColor="#5a7fa0" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="34" r="26" fill="url(#g-scn-glow)"/>
      <rect x="24" y="12" width="16" height="14" rx="2" fill="url(#g-scn)"/>
      <rect x="20" y="28" width="24" height="20" rx="3" fill="url(#g-scn)"/>
      <g fill="#3a4a6a"><circle cx="29" cy="18" r="1.6"/><circle cx="35" cy="18" r="1.6"/></g>
      <path d="M16 32h4v12h-4zM44 32h4v12h-4zM28 48v8M36 48v8" fill="#8a98a6"/>
      <circle cx="32" cy="38" r="3" fill="#7cf9ff"/>
    </>
  ),
  'summon elemental': (
    <>
      <defs><radialGradient id="g-sel-glow" cx="50%" cy="50%" r="60%"><stop offset="0%" stopColor="#ffd6a0" stopOpacity=".6"/><stop offset="100%" stopColor="#a06020" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="34" r="26" fill="url(#g-sel-glow)"/>
      <path d="M32 8l7 8-7 8-7-8z" fill="#9fe8ff"/><path d="M16 42l7 8-7 8-7-8z" fill="#a3e635"/><path d="M48 42l7 8-7 8-7-8z" fill="#ff8a3a"/><path d="M32 42l7 8-7 8-7-8z" fill="#c9c2b0"/>
      <circle cx="32" cy="32" r="2" fill="#fff"/>
    </>
  ),
  'summon greater demon': (
    <>
      <defs><radialGradient id="g-sgd-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#ff6a6a" stopOpacity=".7"/><stop offset="100%" stopColor="#5a0a0a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="34" r="27" fill="url(#g-sgd-glow)"/>
      <path d="M32 12c5 0 8 4 8 9 0 3-1 5-3 6 4 3 6 7 6 12H21c0-5 2-9 6-12-2-1-3-3-3-6 0-5 3-9 8-9z" fill="#c02a2a"/>
      <g fill="#2a0a0a"><circle cx="28" cy="22" r="2"/><circle cx="36" cy="22" r="2"/><path d="M27 30h10" stroke="#2a0a0a" strokeWidth="2"/></g>
      <path d="M20 14l-4-6M44 14l4-6M24 18l-2-6M40 18l2-6" stroke="#ff6a6a" strokeWidth="2.4" strokeLinecap="round"/>
    </>
  ),
  'vitriolic sphere': (
    <>
      <defs><radialGradient id="g-vts" cx="42%" cy="38%" r="60%"><stop offset="0%" stopColor="#f2ffd0"/><stop offset="55%" stopColor="#a3e635"/><stop offset="100%" stopColor="#3f7a20"/></radialGradient><radialGradient id="g-vts-glow" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#cdf07a" stopOpacity=".7"/><stop offset="100%" stopColor="#4a8a20" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-vts-glow)"/>
      <circle cx="32" cy="32" r="16" fill="url(#g-vts)"/>
      <circle cx="26" cy="26" r="3.4" fill="#f2ffd0" opacity=".9"/>
      <g fill="#cdf07a"><circle cx="18" cy="18" r="1.8"/><circle cx="46" cy="18" r="1.6"/><circle cx="46" cy="46" r="1.6"/><circle cx="18" cy="46" r="1.6"/></g>
    </>
  ),
  'wall of fire': (
    <>
      <defs><linearGradient id="g-wof" x1="0" y1="1" x2="0" y2="0"><stop offset="0%" stopColor="#7a1a00"/><stop offset="55%" stopColor="#e23b00"/><stop offset="100%" stopColor="#ffe27a"/></linearGradient><radialGradient id="g-wof-glow" cx="50%" cy="60%" r="60%"><stop offset="0%" stopColor="#ff9d2e" stopOpacity=".7"/><stop offset="100%" stopColor="#d23200" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="36" r="27" fill="url(#g-wof-glow)"/>
      <path d="M6 52c2-10 6-14 6-22 0-6-4-8-4-14 4 4 8 6 8 12 0 8-4 12-4 20zM22 52c2-10 6-14 6-22 0-6-4-8-4-14 4 4 8 6 8 12 0 8-4 12-4 20zM38 52c2-10 6-14 6-22 0-6-4-8-4-14 4 4 8 6 8 12 0 8-4 12-4 20z" fill="url(#g-wof)"/>
      <g fill="#ffe9a8"><circle cx="16" cy="18" r="1.6"/><circle cx="34" cy="14" r="1.4"/><circle cx="50" cy="20" r="1.4"/></g>
    </>
  ),
  'watery sphere': (
    <>
      <defs><radialGradient id="g-wts" cx="40%" cy="35%" r="65%"><stop offset="0%" stopColor="#ffffff" stopOpacity=".9"/><stop offset="60%" stopColor="#7fc4ea" stopOpacity=".7"/><stop offset="100%" stopColor="#2f7fb0" stopOpacity=".5"/></radialGradient></defs>
      <circle cx="32" cy="32" r="20" fill="url(#g-wts)" stroke="#cfeaff" strokeWidth="2.4"/>
      <path d="M18 28c4-6 10-8 16-6M16 38c6 4 14 5 22 1" fill="none" stroke="#eafaff" strokeWidth="2" opacity=".7"/>
      <g fill="#eafaff"><circle cx="14" cy="14" r="1.6"/><circle cx="50" cy="14" r="1.6"/><circle cx="32" cy="56" r="1.4"/></g>
    </>
  ),
  'animate objects': (
    <>
      <defs><radialGradient id="g-aob-glow" cx="50%" cy="50%" r="60%"><stop offset="0%" stopColor="#c9a6ff" stopOpacity=".6"/><stop offset="100%" stopColor="#4a2a8a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="34" r="27" fill="url(#g-aob-glow)"/>
      <g fill="#c9d2de"><path d="M16 40l4-12 4 12zM28 40l4-14 4 14zM40 40l4-12 4 12z"/></g>
      <g fill="#c9a6ff"><circle cx="20" cy="24" r="1.6"/><circle cx="32" cy="20" r="1.6"/><circle cx="44" cy="24" r="1.6"/></g>
      <path d="M8 46h48M12 52h40" stroke="#8a5cf0" strokeWidth="2" strokeLinecap="round" opacity=".7"/>
    </>
  ),
  'antilife shell': (
    <>
      <defs><radialGradient id="g-als-glow" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#b7ffd0" stopOpacity=".7"/><stop offset="100%" stopColor="#3fae63" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-als-glow)"/>
      <circle cx="32" cy="32" r="18" fill="none" stroke="#7fe0a0" strokeWidth="2.6"/>
      <circle cx="32" cy="32" r="11" fill="none" stroke="#bff29a" strokeWidth="1.8" opacity=".7"/>
      <path d="M32 20c-3 4-3 8 0 12s3 8 0 12M22 26c-3 5-3 11 0 16M42 26c3 5 3 11 0 16" fill="none" stroke="#eafff1" strokeWidth="1.8" opacity=".8"/>
      <circle cx="32" cy="32" r="3" fill="#eafff1"/>
    </>
  ),
  awaken: (
    <>
      <defs><radialGradient id="g-awk-glow" cx="50%" cy="40%" r="60%"><stop offset="0%" stopColor="#b7ffd0" stopOpacity=".8"/><stop offset="100%" stopColor="#3fae63" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="30" r="27" fill="url(#g-awk-glow)"/>
      <circle cx="32" cy="30" r="10" fill="#7fe0a0"/>
      <g stroke="#eafff1" strokeWidth="2.6" strokeLinecap="round"><path d="M32 4v8M32 48v8M6 30h8M50 30h8M13 11l6 6M45 43l6 6M51 11l-6 6M19 43l-6 6"/></g>
      <path d="M28 28c2-2 6-2 8 0M28 33c2 2 6 2 8 0" fill="none" stroke="#2f6a3a" strokeWidth="1.6" strokeLinecap="round"/>
    </>
  ),
  'banishing smite': (
    <>
      <defs><linearGradient id="g-bsm-blade" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f2f6ff"/><stop offset="100%" stopColor="#8a94a2"/></linearGradient><radialGradient id="g-bsm-glow" cx="50%" cy="40%" r="60%"><stop offset="0%" stopColor="#c77dff" stopOpacity=".7"/><stop offset="100%" stopColor="#5a2ecf" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="30" r="27" fill="url(#g-bsm-glow)"/>
      <path d="M32 4l4 8v24h-8V12z" fill="url(#g-bsm-blade)"/>
      <path d="M22 36h20M28 36v14h8V36" fill="none" stroke="#c9d2de" strokeWidth="2.6"/>
      <path d="M20 16a10 10 0 0 1 6-8M44 16a10 10 0 0 0-6-8" fill="none" stroke="#c9a6ff" strokeWidth="2.4" strokeLinecap="round"/>
      <path d="M32 12l2.6 6 6 .6-4.6 4 1.2 6L32 26.4 26.8 28.6l1.2-6-4.6-4 6-.6z" fill="#e9dcff"/>
    </>
  ),
  "bigby's hand": (
    <>
      <defs><radialGradient id="g-bgh-glow" cx="50%" cy="45%" r="60%"><stop offset="0%" stopColor="#cfe0ff" stopOpacity=".7"/><stop offset="100%" stopColor="#4a6fd0" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="34" r="27" fill="url(#g-bgh-glow)"/>
      <path d="M16 48V32a4 4 0 0 1 8 0v8M24 40V24a4 4 0 0 1 8 0v12M32 36V22a4 4 0 0 1 8 0v18a12 12 0 0 1-12 12h-4a10 10 0 0 1-10-10" fill="none" stroke="#dbeaff" strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="30" cy="30" r="3" fill="#fff" opacity=".4"/>
    </>
  ),
  'circle of power': (
    <>
      <defs><radialGradient id="g-cop-glow" cx="50%" cy="55%" r="60%"><stop offset="0%" stopColor="#ffe9a8" stopOpacity=".7"/><stop offset="100%" stopColor="#d9a441" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="38" r="27" fill="url(#g-cop-glow)"/>
      <ellipse cx="32" cy="44" rx="26" ry="10" fill="none" stroke="#fff3c4" strokeWidth="2.6"/>
      <ellipse cx="32" cy="44" rx="18" ry="7" fill="none" stroke="#ffcf6b" strokeWidth="1.6"/>
      <path d="M32 12l3 6 6 .6-4.4 4 1.2 6.4L32 26.4 26.2 29l1.2-6.4L23 18.6l6-.6z" fill="#fff7dc"/>
    </>
  ),
  cloudkill: (
    <>
      <defs><radialGradient id="g-ckl-glow" cx="50%" cy="50%" r="60%"><stop offset="0%" stopColor="#c8f07a" stopOpacity=".8"/><stop offset="100%" stopColor="#4a7a20" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="34" r="27" fill="url(#g-ckl-glow)"/>
      <g fill="#8aa64a"><circle cx="18" cy="32" r="10"/><circle cx="34" cy="26" r="12"/><circle cx="46" cy="34" r="9"/><circle cx="28" cy="44" r="11"/></g>
      <g stroke="#5a7a2a" strokeWidth="2.2" strokeLinecap="round" opacity=".8"><path d="M16 20l3-6M34 12l2-6M48 22l4-5M22 54l-3 5M44 52l3 5"/></g>
      <g fill="#eaffd6" opacity=".7"><circle cx="34" cy="24" r="2.4"/><circle cx="18" cy="30" r="2"/></g>
    </>
  ),
  commune: (
    <>
      <defs><radialGradient id="g-cmm-glow" cx="50%" cy="35%" r="65%"><stop offset="0%" stopColor="#fff3c4" stopOpacity=".95"/><stop offset="100%" stopColor="#ffce6b" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="28" r="27" fill="url(#g-cmm-glow)"/>
      <circle cx="32" cy="20" r="7" fill="none" stroke="#fff7dc" strokeWidth="2.6"/>
      <path d="M18 50c0-8 6-14 14-14s14 6 14 14" fill="none" stroke="#ffe9a8" strokeWidth="2.6"/>
      <path d="M26 42l6 8M38 42l-6 8" stroke="#fff7dc" strokeWidth="2.4" strokeLinecap="round"/>
      <g stroke="#fff3c4" strokeWidth="2" strokeLinecap="round"><path d="M32 2v4M12 8l4 4M52 8l-4 4"/></g>
    </>
  ),
  'commune with nature': (
    <>
      <defs><radialGradient id="g-cwn-glow" cx="50%" cy="40%" r="65%"><stop offset="0%" stopColor="#bff29a" stopOpacity=".8"/><stop offset="100%" stopColor="#3f8a4a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="30" r="27" fill="url(#g-cwn-glow)"/>
      <path d="M32 54V28" stroke="#4a7a3a" strokeWidth="4" strokeLinecap="round"/>
      <path d="M32 30c-10-2-16-8-16-18 10 2 16 8 16 18zM32 30c10-2 16-8 16-18-10 2-16 8-16 18z" fill="#7fd18a"/>
      <g fill="#eaffd6"><circle cx="24" cy="20" r="1.4"/><circle cx="40" cy="20" r="1.4"/><circle cx="32" cy="14" r="1.4"/></g>
    </>
  ),
  'cone of cold': (
    <>
      <defs><linearGradient id="g-coc" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ffffff"/><stop offset="100%" stopColor="#7fc4ea"/></linearGradient></defs>
      <path d="M32 8L58 54H6z" fill="url(#g-coc)" opacity=".85"/>
      <g stroke="#eafaff" strokeWidth="2" opacity=".8"><path d="M22 24h20M18 34h28M14 44h36"/></g>
      <g fill="#ffffff"><circle cx="26" cy="30" r="1.6"/><circle cx="40" cy="34" r="1.4"/><circle cx="32" cy="44" r="1.4"/></g>
    </>
  ),
  'conjure elemental': (
    <>
      <defs><radialGradient id="g-coe-glow" cx="50%" cy="50%" r="60%"><stop offset="0%" stopColor="#ffd6a0" stopOpacity=".6"/><stop offset="100%" stopColor="#a06020" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="34" r="27" fill="url(#g-coe-glow)"/>
      <path d="M32 6l8 10-8 10-8-10z" fill="#9fe8ff"/>
      <path d="M10 36l8 10-8 10-4-10z" fill="#a3e635"/>
      <path d="M54 36l-8 10 8 10 4-10z" fill="#ff8a3a"/>
      <path d="M32 40l8 8-8 10-8-10z" fill="#c9c2b0"/>
      <circle cx="32" cy="30" r="3" fill="#fff"/>
    </>
  ),
  'conjure volley': (
    <>
      <defs><linearGradient id="g-cov" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#e9eef5"/><stop offset="100%" stopColor="#8494a6"/></linearGradient></defs>
      <path d="M4 58C14 34 28 18 50 8l6 8C34 28 22 42 14 58z" fill="url(#g-cov)" opacity=".9"/>
      <g fill="#cfe0ff"><circle cx="16" cy="32" r="2.2"/><circle cx="26" cy="22" r="1.8"/><circle cx="36" cy="14" r="1.6"/><circle cx="30" cy="42" r="1.6"/><circle cx="42" cy="30" r="1.4"/></g>
      <path d="M8 50c8-12 18-22 32-28" fill="none" stroke="#eaf6ff" strokeWidth="1.6" strokeDasharray="3 4" opacity=".7"/>
    </>
  ),
  'contact other plane': (
    <>
      <defs><radialGradient id="g-ctp-glow" cx="50%" cy="45%" r="60%"><stop offset="0%" stopColor="#c77dff" stopOpacity=".7"/><stop offset="100%" stopColor="#3a1266" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="27" fill="url(#g-ctp-glow)"/>
      <circle cx="32" cy="26" r="9" fill="#8a5cf0"/>
      <g fill="#e9dcff"><circle cx="28" cy="24" r="1.6"/><circle cx="36" cy="24" r="1.6"/></g>
      <path d="M24 34c5 4 11 4 16 0" fill="none" stroke="#e9dcff" strokeWidth="2" strokeLinecap="round"/>
      <g stroke="#c9a6ff" strokeWidth="2" strokeLinecap="round"><path d="M12 12l6 6M52 12l-6 6M10 30h6M48 30h6M14 48l5-5M50 48l-5-5"/></g>
    </>
  ),
  contagion: (
    <>
      <defs><radialGradient id="g-cgt-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#c8f07a" stopOpacity=".6"/><stop offset="100%" stopColor="#4a7a20" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="34" r="26" fill="url(#g-cgt-glow)"/>
      <path d="M16 44V30a4 4 0 0 1 8 0M24 40V26a4 4 0 0 1 8 0M32 40v-8a4 4 0 0 1 8 0v12a10 10 0 0 1-10 10" fill="none" stroke="#8aa64a" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
      <g fill="#5a7a2a"><circle cx="20" cy="20" r="3"/><circle cx="28" cy="14" r="2.4"/><circle cx="40" cy="20" r="2.4"/></g>
      <g stroke="#a3e635" strokeWidth="1.6" strokeLinecap="round"><path d="M20 14v-4M28 8v-4M40 14v-4"/></g>
    </>
  ),
  'control winds': (
    <>
      <defs><radialGradient id="g-cwd-glow" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#dff6ff" stopOpacity=".6"/><stop offset="100%" stopColor="#5a9fd0" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-cwd-glow)"/>
      <g fill="none" stroke="#bfe4ff" strokeWidth="2.8" strokeLinecap="round"><path d="M32 8a24 24 0 0 0 0 48"/><path d="M32 14a18 18 0 0 0 0 36" opacity=".75"/><path d="M32 20a12 12 0 0 0 0 24" opacity=".5"/></g>
      <path d="M36 22l-6 10h5l-2 8 8-12h-5z" fill="#eafaff"/>
    </>
  ),
  creation: (
    <>
      <defs><radialGradient id="g-crt-glow" cx="50%" cy="45%" r="60%"><stop offset="0%" stopColor="#c8b0ff" stopOpacity=".6"/><stop offset="100%" stopColor="#4a2a8a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="27" fill="url(#g-crt-glow)"/>
      <path d="M32 10l12 6v14l-12 6-12-6V16z" fill="#c9a6ff" opacity=".8"/>
      <path d="M20 16l12 6 12-6M32 22v14" stroke="#7a4fd0" strokeWidth="1.8" opacity=".7"/>
      <path d="M48 40l1.6 3.6L53 45l-3.4 1.4L48 50l-1.6-3.6L43 45l3.4-1.4z" fill="#fff"/>
      <path d="M14 42l1.4 3 3 1.4-3 1.4L14 51l-1.4-3.2-3-1.4 3-1.4z" fill="#e9dcff"/>
    </>
  ),
  'danse macabre': (
    <>
      <defs><radialGradient id="g-dnm-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#8a5cf0" stopOpacity=".6"/><stop offset="100%" stopColor="#1a0a2a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="34" r="26" fill="url(#g-dnm-glow)"/>
      <path d="M24 20a6 6 0 0 1 12 0v6h-12z" fill="#c9a6ff"/>
      <g fill="#1a0a2a"><circle cx="28" cy="16" r="1.4"/><circle cx="32" cy="16" r="1.4"/></g>
      <path d="M30 26v14M30 30l-10 4M30 34l10-4M30 40l-8 10M30 40l8 10" fill="none" stroke="#c9a6ff" strokeWidth="2.6" strokeLinecap="round"/>
      <g stroke="#7a4fd0" strokeWidth="2" strokeLinecap="round" opacity=".7"><path d="M44 20v8M40 24h8M46 36v6M43 39h6"/></g>
    </>
  ),
  dawn: (
    <>
      <defs><radialGradient id="g-dwn-glow" cx="50%" cy="60%" r="65%"><stop offset="0%" stopColor="#fff3c4" stopOpacity=".95"/><stop offset="100%" stopColor="#ffce6b" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="40" r="28" fill="url(#g-dwn-glow)"/>
      <path d="M6 42a26 26 0 0 1 52 0z" fill="#ffe9a8"/>
      <circle cx="32" cy="26" r="7" fill="#fff7dc"/>
      <g stroke="#fff3c4" strokeWidth="2.4" strokeLinecap="round"><path d="M32 4v8M12 10l5 5M52 10l-5 5M4 30h8M52 30h8"/></g>
      <path d="M6 46h52" stroke="#ffcf6b" strokeWidth="2.4" strokeLinecap="round"/>
    </>
  ),
  'destructive wave': (
    <>
      <defs><radialGradient id="g-dsw-glow" cx="50%" cy="60%" r="60%"><stop offset="0%" stopColor="#cfe8ff" stopOpacity=".8"/><stop offset="100%" stopColor="#5a7fd0" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="40" r="27" fill="url(#g-dsw-glow)"/>
      <g fill="none" stroke="#cfe8ff" strokeWidth="2.6" strokeLinecap="round"><path d="M6 44c8-12 20-18 34-16M10 50c8-12 20-18 34-16" opacity=".8"/></g>
      <g fill="#9fd0ff"><circle cx="18" cy="24" r="2.4"/><circle cx="32" cy="18" r="2.4"/><circle cx="46" cy="24" r="2.4"/></g>
      <path d="M32 52l-4-8 4 2 4-2z" fill="#eaf6ff"/>
    </>
  ),
  'dispel evil and good': (
    <>
      <defs><radialGradient id="g-deag-glow" cx="50%" cy="40%" r="65%"><stop offset="0%" stopColor="#fff3c4" stopOpacity=".9"/><stop offset="100%" stopColor="#ffce6b" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="30" r="27" fill="url(#g-deag-glow)"/>
      <circle cx="32" cy="24" r="8" fill="none" stroke="#fff7dc" strokeWidth="2.6"/>
      <path d="M16 50c0-8 7-14 16-14s16 6 16 14" fill="none" stroke="#ffe9a8" strokeWidth="2.6"/>
      <g stroke="#fff3c4" strokeWidth="2.4" strokeLinecap="round"><path d="M22 10l-4-4M42 10l4-4M14 22h-6M50 22h6"/></g>
      <path d="M32 18l1.6 3.2 3.4.4-2.6 2.4.8 3.4L32 25.6 28.8 27.4l.8-3.4L27 21.6l3.4-.4z" fill="#fff7dc"/>
    </>
  ),
  'dominate person': (
    <>
      <defs><radialGradient id="g-dmp-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#ffb0e6" stopOpacity=".6"/><stop offset="100%" stopColor="#7a2a66" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-dmp-glow)"/>
      <circle cx="32" cy="18" r="7" fill="#e9dcff"/>
      <path d="M18 52c0-9 6-16 14-16s14 7 14 16" fill="#c76ad1"/>
      <path d="M16 12c4 0 6 2 6 5s-2 5-6 5-6-2-6-5 2-5 6-5z" fill="#ff7ac6" opacity="0"/>
      <path d="M32 6l1.8 3.6L37 11l-3.2 1.4L32 16l-1.8-3.6L27 11l3.2-1.4z" fill="#ffe0f4"/>
      <g stroke="#ff9ecb" strokeWidth="2" strokeLinecap="round"><path d="M14 12l4 3M46 12l-4 3"/></g>
    </>
  ),
  dream: (
    <>
      <defs><radialGradient id="g-drm-glow" cx="50%" cy="40%" r="60%"><stop offset="0%" stopColor="#c8b0ff" stopOpacity=".7"/><stop offset="100%" stopColor="#3a2a6a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="30" r="27" fill="url(#g-drm-glow)"/>
      <path d="M34 10a12 12 0 1 0 10 19 9 9 0 0 1-10-19z" fill="#e9dcff"/>
      <g fill="#c9a6ff"><circle cx="20" cy="42" r="2"/><circle cx="30" cy="46" r="1.6"/><circle cx="42" cy="42" r="1.8"/></g>
      <path d="M46 22c2 2 5 3 5 5.4a3 3 0 0 1-5 2.2 3 3 0 0 1-5-2.2C41 25 44 24 46 22z" fill="#ff9ecb" opacity=".8"/>
    </>
  ),
  enervation: (
    <>
      <defs><radialGradient id="g-env-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#5a2ecf" stopOpacity=".7"/><stop offset="100%" stopColor="#0a0414" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="27" fill="url(#g-env-glow)"/>
      <path d="M14 44V30a4 4 0 0 1 8 0M22 38V26a4 4 0 0 1 8 0v12M30 36v-8a4 4 0 0 1 8 0" fill="none" stroke="#8a5cf0" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
      <g stroke="#c9a6ff" strokeWidth="2" strokeLinecap="round" fill="none" opacity=".85"><path d="M46 14c-4 6-4 14 0 20M50 18c-3 5-3 11 0 16"/></g>
      <g fill="#7a4fd0"><circle cx="18" cy="16" r="2"/><circle cx="48" cy="44" r="1.6"/></g>
    </>
  ),
  'far step': (
    <>
      <defs><radialGradient id="g-fsp-glow" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#c77dff" stopOpacity=".7"/><stop offset="100%" stopColor="#4a2a8a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-fsp-glow)"/>
      <circle cx="20" cy="32" r="6" fill="none" stroke="#c9a6ff" strokeWidth="2.2" strokeDasharray="4 3" opacity=".6"/>
      <circle cx="44" cy="32" r="8" fill="#e9dcff"/>
      <path d="M24 32h14M34 27l6 5-6 5" fill="none" stroke="#c9a6ff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M44 20l1.6 3.6L49 25l-3.4 1.4L44 30l-1.6-3.6L39 25l3.4-1.4z" fill="#fff"/>
    </>
  ),
  'flame strike': (
    <>
      <defs><linearGradient id="g-flst" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fff3c4"/><stop offset="55%" stopColor="#ff8a1e"/><stop offset="100%" stopColor="#d23200"/></linearGradient><radialGradient id="g-flst-glow" cx="50%" cy="40%" r="60%"><stop offset="0%" stopColor="#fff3c4" stopOpacity=".9"/><stop offset="100%" stopColor="#ff9d2e" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="26" r="27" fill="url(#g-flst-glow)"/>
      <path d="M18 6h28v6l-4 42H22L18 12z" fill="url(#g-flst)" opacity=".9"/>
      <path d="M24 6h16v4l-3 36h-10L24 10z" fill="#fff3c4" opacity=".6"/>
      <g fill="#ffe9a8"><circle cx="14" cy="20" r="1.6"/><circle cx="50" cy="20" r="1.6"/><circle cx="14" cy="44" r="1.4"/><circle cx="50" cy="44" r="1.4"/></g>
    </>
  ),
  geas: (
    <>
      <defs><radialGradient id="g-gea-glow" cx="50%" cy="40%" r="60%"><stop offset="0%" stopColor="#c77dff" stopOpacity=".7"/><stop offset="100%" stopColor="#4a1a8a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="30" r="27" fill="url(#g-gea-glow)"/>
      <circle cx="32" cy="26" r="10" fill="none" stroke="#c9a6ff" strokeWidth="2.6"/>
      <path d="M32 26v-6M28 22h8" stroke="#e9dcff" strokeWidth="2" strokeLinecap="round"/>
      <path d="M14 50c6-4 12-4 18 0s12 4 18 0" fill="none" stroke="#c9a6ff" strokeWidth="2.4" strokeLinecap="round"/>
      <g stroke="#9a6fd0" strokeWidth="2" strokeLinecap="round"><path d="M32 2v4M12 10l4 4M52 10l-4 4"/></g>
    </>
  ),
  'greater restoration': (
    <>
      <defs><radialGradient id="g-grt-glow" cx="50%" cy="40%" r="65%"><stop offset="0%" stopColor="#fff3c4" stopOpacity=".9"/><stop offset="100%" stopColor="#ffce6b" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="30" r="27" fill="url(#g-grt-glow)"/>
      <circle cx="32" cy="30" r="16" fill="none" stroke="#ffe9a8" strokeWidth="2.6"/>
      <path d="M32 20v20M22 30h20" stroke="#fff7dc" strokeWidth="3.6" strokeLinecap="round"/>
      <g stroke="#fff3c4" strokeWidth="2" strokeLinecap="round"><path d="M32 4v6M12 10l5 5M52 10l-5 5M8 30h6M50 30h6"/></g>
    </>
  ),
  hallow: (
    <>
      <defs><radialGradient id="g-hlw-glow" cx="50%" cy="70%" r="65%"><stop offset="0%" stopColor="#fff3c4" stopOpacity=".85"/><stop offset="100%" stopColor="#ffce6b" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="44" r="28" fill="url(#g-hlw-glow)"/>
      <ellipse cx="32" cy="48" rx="26" ry="9" fill="none" stroke="#ffe9a8" strokeWidth="2.4"/>
      <path d="M32 8a10 10 0 0 1 10 10c0 6-4 10-10 10s-10-4-10-10A10 10 0 0 1 32 8z" fill="none" stroke="#fff7dc" strokeWidth="2.6"/>
      <path d="M32 14v8M29 18h6" stroke="#fff7dc" strokeWidth="2.4" strokeLinecap="round"/>
      <g fill="#fff3c4"><circle cx="8" cy="48" r="1.4"/><circle cx="56" cy="48" r="1.4"/></g>
    </>
  ),
  'hold monster': (
    <>
      <defs><radialGradient id="g-hmn-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#bfd0ff" stopOpacity=".6"/><stop offset="100%" stopColor="#3a4aa0" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-hmn-glow)"/>
      <path d="M32 12c8 0 14 6 14 14 0 5-2 8-5 10H23c-3-2-5-5-5-10 0-8 6-14 14-14z" fill="#9fb0ff"/>
      <g fill="#1a2a5a"><circle cx="26" cy="24" r="2"/><circle cx="38" cy="24" r="2"/></g>
      <g fill="none" stroke="#7cf9ff" strokeWidth="2.2"><circle cx="32" cy="32" r="22" strokeDasharray="4 4" opacity=".7"/><path d="M12 20l40 24M52 20L12 44" opacity=".7"/></g>
    </>
  ),
  'holy weapon': (
    <>
      <defs><linearGradient id="g-hwp-blade" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fffdf0"/><stop offset="100%" stopColor="#c9a24a"/></linearGradient><radialGradient id="g-hwp-glow" cx="50%" cy="35%" r="65%"><stop offset="0%" stopColor="#fff3c4" stopOpacity=".95"/><stop offset="100%" stopColor="#ffce6b" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="26" r="27" fill="url(#g-hwp-glow)"/>
      <path d="M32 4l4 8v24h-8V12z" fill="url(#g-hwp-blade)"/>
      <path d="M22 36h20M28 36v14h8V36" fill="none" stroke="#fff7dc" strokeWidth="2.6"/>
      <g stroke="#fff3c4" strokeWidth="2.4" strokeLinecap="round"><path d="M10 12l8 8M54 12l-8 8M8 30h10M46 30h10"/></g>
      <circle cx="32" cy="16" r="3" fill="#fff"/>
    </>
  ),
  immolation: (
    <>
      <defs><radialGradient id="g-imm-glow" cx="50%" cy="45%" r="60%"><stop offset="0%" stopColor="#fff3c4" stopOpacity=".9"/><stop offset="100%" stopColor="#ff3d00" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="27" fill="url(#g-imm-glow)"/>
      <path d="M32 8c-4 8-12 10-12 18 0 8 5 14 12 14s12-6 12-14c0-8-8-10-12-18z" fill="#ff8a1e"/>
      <path d="M32 24c-1.6 3-5 4-5 7 0 3 2 5 5 5s5-2 5-5c0-3-3.4-4-5-7z" fill="#fff3c4"/>
      <g fill="#ffe9a8"><circle cx="16" cy="18" r="1.6"/><circle cx="48" cy="18" r="1.6"/><circle cx="16" cy="46" r="1.4"/><circle cx="48" cy="46" r="1.4"/></g>
    </>
  ),
  'infernal calling': (
    <>
      <defs><radialGradient id="g-ifc-glow" cx="50%" cy="45%" r="60%"><stop offset="0%" stopColor="#ff6a6a" stopOpacity=".6"/><stop offset="100%" stopColor="#3a0a0a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="27" fill="url(#g-ifc-glow)"/>
      <circle cx="32" cy="32" r="15" fill="none" stroke="#ff6a6a" strokeWidth="2.4" strokeDasharray="4 4"/>
      <path d="M32 20l6 8h-4l3 8H27l3-8h-4z" fill="#ff8a3a"/>
      <g stroke="#ff6a6a" strokeWidth="2" strokeLinecap="round"><path d="M12 12l6 6M52 12l-6 6M14 50l6-6M50 50l-6-6"/></g>
      <circle cx="32" cy="36" r="2" fill="#ffe9a8"/>
    </>
  ),
  'insect plague': (
    <>
      <defs><radialGradient id="g-inp-glow" cx="50%" cy="50%" r="60%"><stop offset="0%" stopColor="#c8f07a" stopOpacity=".6"/><stop offset="100%" stopColor="#4a7a20" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="34" r="26" fill="url(#g-inp-glow)"/>
      <g fill="#5a7a2a"><ellipse cx="20" cy="26" rx="3" ry="5"/><ellipse cx="34" cy="20" rx="3" ry="5"/><ellipse cx="46" cy="28" rx="3" ry="5"/><ellipse cx="26" cy="42" rx="3" ry="5"/><ellipse cx="42" cy="44" rx="3" ry="5"/><ellipse cx="32" cy="32" rx="3" ry="5"/></g>
      <g stroke="#3a5a1a" strokeWidth="1.2" opacity=".8"><path d="M20 21v-3M34 15v-3M46 23v-3M26 37v-3M42 39v-3M32 27v-3"/></g>
    </>
  ),
  "jallarzi's storm of radiance": (
    <>
      <defs><radialGradient id="g-jsr-glow" cx="50%" cy="40%" r="65%"><stop offset="0%" stopColor="#fff3c4" stopOpacity=".9"/><stop offset="100%" stopColor="#9fb6ff" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="28" r="27" fill="url(#g-jsr-glow)"/>
      <path d="M8 22a8 8 0 0 1 8-12 10 10 0 0 1 18-2 7 7 0 0 1 10 6" fill="none" stroke="#dbe6ff" strokeWidth="2.6" strokeLinecap="round"/>
      <path d="M30 22l-8 14h6l-2 12 10-16h-6z" fill="#fff6c4"/>
      <g stroke="#ffe9a8" strokeWidth="2" strokeLinecap="round"><path d="M12 36v8M52 36v8"/></g>
    </>
  ),
  'legend lore': (
    <>
      <defs><radialGradient id="g-lgl-glow" cx="50%" cy="45%" r="60%"><stop offset="0%" stopColor="#ffe9a8" stopOpacity=".7"/><stop offset="100%" stopColor="#a06a20" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="27" fill="url(#g-lgl-glow)"/>
      <path d="M12 12h20a6 6 0 0 1 6 6v34H18a6 6 0 0 0-6 6z" fill="#e9d6b0"/>
      <path d="M52 12H32a6 6 0 0 0-6 6v34h20a6 6 0 0 1 6 6z" fill="#d9c69a"/>
      <g stroke="#8a6a3a" strokeWidth="1.4" opacity=".6"><path d="M18 22h12M18 28h12M34 22h12M34 28h12"/></g>
      <path d="M12 12c4 0 6 2 6 6M52 12c-4 0-6 2-6 6" stroke="#8a6a3a" strokeWidth="1.6" fill="none"/>
      <path d="M32 8l1.6 3.6L37 13l-3.4 1.4L32 18l-1.6-3.6L27 13l3.4-1.4z" fill="#fff"/>
    </>
  ),
  maelstrom: (
    <>
      <defs><radialGradient id="g-mls-glow" cx="50%" cy="50%" r="60%"><stop offset="0%" stopColor="#7fc4ea" stopOpacity=".6"/><stop offset="100%" stopColor="#2f7fb0" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="34" r="27" fill="url(#g-mls-glow)"/>
      <g fill="none" stroke="#9fd0ff" strokeWidth="2.6" strokeLinecap="round"><path d="M32 54a24 24 0 1 1 18-8"/><path d="M32 46a16 16 0 1 1 12-6" opacity=".8"/><path d="M32 38a8 8 0 1 1 6-3" opacity=".6"/></g>
      <g fill="#eafaff"><circle cx="18" cy="18" r="1.6"/><circle cx="48" cy="20" r="1.4"/><circle cx="32" cy="10" r="1.2"/></g>
    </>
  ),
  'mass cure wounds': (
    <>
      <defs><radialGradient id="g-mcw-glow" cx="50%" cy="40%" r="65%"><stop offset="0%" stopColor="#b7ffd0" stopOpacity=".9"/><stop offset="100%" stopColor="#3fae63" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="27" fill="url(#g-mcw-glow)"/>
      <g stroke="#7fe0a0" strokeWidth="3" strokeLinecap="round"><path d="M18 22v10M13 27h10M32 18v12M26 24h12M46 22v10M41 27h10"/></g>
      <path d="M14 46c6 4 30 4 36 0" fill="none" stroke="#eafff1" strokeWidth="2.4" strokeLinecap="round" opacity=".7"/>
    </>
  ),
  mislead: (
    <>
      <defs><radialGradient id="g-msd-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#c8b0ff" stopOpacity=".6"/><stop offset="100%" stopColor="#4a2a8a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-msd-glow)"/>
      <circle cx="24" cy="28" r="8" fill="none" stroke="#cfe0ff" strokeWidth="2.2" strokeDasharray="4 3"/>
      <circle cx="44" cy="36" r="9" fill="#c9a6ff" opacity=".85"/>
      <circle cx="44" cy="32" r="3" fill="#2a1040" opacity="0"/>
      <path d="M24 20l8 8M40 28l8 8" stroke="#e9dcff" strokeWidth="1.8" opacity=".7"/>
      <g fill="#e9dcff"><circle cx="14" cy="14" r="1.3"/><circle cx="52" cy="14" r="1.3"/></g>
    </>
  ),
  'modify memory': (
    <>
      <defs><radialGradient id="g-mdm-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#ffb0e6" stopOpacity=".6"/><stop offset="100%" stopColor="#7a2a66" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-mdm-glow)"/>
      <path d="M30 8a12 12 0 0 0-8 21v5h14v-5a12 12 0 0 0-6-21z" fill="#c76ad1"/>
      <path d="M24 14l4 4-3 3M38 30l-4-4 3-3" fill="none" stroke="#ffe0f4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="30" cy="22" r="2" fill="#ffe0f4"/>
      <circle cx="46" cy="18" r="5" fill="none" stroke="#ff9ecb" strokeWidth="2"/>
    </>
  ),
  'negative energy flood': (
    <>
      <defs><radialGradient id="g-nef-glow" cx="50%" cy="50%" r="60%"><stop offset="0%" stopColor="#8a5cf0" stopOpacity=".7"/><stop offset="100%" stopColor="#1a0a2a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="34" r="27" fill="url(#g-nef-glow)"/>
      <path d="M32 10a12 12 0 0 0-12 12c0 4 2 7 4 9v5h16v-5c2-2 4-5 4-9A12 12 0 0 0 32 10z" fill="#5a2ecf"/>
      <g fill="#1a0a2a"><circle cx="27" cy="22" r="2"/><circle cx="37" cy="22" r="2"/><path d="M27 32h10" stroke="#1a0a2a" strokeWidth="2"/></g>
      <path d="M14 52c6-4 12-4 18 0s12 4 18 0" fill="none" stroke="#9a6fd0" strokeWidth="2.4" strokeLinecap="round" opacity=".8"/>
    </>
  ),
  passwall: (
    <>
      <defs><linearGradient id="g-pwl" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a09a8a"/><stop offset="100%" stopColor="#5a5448"/></linearGradient><radialGradient id="g-pwl-glow" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#ffe9a8" stopOpacity=".6"/><stop offset="100%" stopColor="#a06a20" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-pwl-glow)"/>
      <path d="M6 6h52v52H6z" fill="url(#g-pwl)"/>
      <path d="M22 52V26a10 10 0 0 1 20 0v26z" fill="#2a2018"/>
      <path d="M26 52V28a6 6 0 0 1 12 0v24z" fill="#0e0a06" opacity=".7"/>
      <path d="M18 14l4 4M42 12l4 4M32 8v4" stroke="#7a7468" strokeWidth="1.6" opacity=".6"/>
    </>
  ),
  'planar binding': (
    <>
      <defs><radialGradient id="g-plb-glow" cx="50%" cy="50%" r="60%"><stop offset="0%" stopColor="#c77dff" stopOpacity=".7"/><stop offset="100%" stopColor="#3a1266" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="34" r="27" fill="url(#g-plb-glow)"/>
      <ellipse cx="32" cy="46" rx="22" ry="8" fill="none" stroke="#c9a6ff" strokeWidth="2.6"/>
      <ellipse cx="32" cy="46" rx="13" ry="5" fill="none" stroke="#9a6fd0" strokeWidth="1.6"/>
      <path d="M32 10l6 10-6 8-6-8z" fill="#e9dcff"/>
      <g stroke="#c9a6ff" strokeWidth="2" strokeLinecap="round"><path d="M14 30l6-4M50 30l-6-4M22 20l4 4M42 20l-4 4"/></g>
    </>
  ),
  'raise dead': (
    <>
      <defs><radialGradient id="g-rsd-glow" cx="50%" cy="40%" r="65%"><stop offset="0%" stopColor="#fff3c4" stopOpacity=".9"/><stop offset="100%" stopColor="#ffce6b" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="30" r="27" fill="url(#g-rsd-glow)"/>
      <path d="M32 50s-16-10-16-22a9 9 0 0 1 16-5.6A9 9 0 0 1 48 28c0 12-16 22-16 22z" fill="none" stroke="#ffe9a8" strokeWidth="2.6"/>
      <path d="M32 6v16M26 12l6-6 6 6" fill="none" stroke="#fff7dc" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"/>
    </>
  ),
  "rary's telepathic bond": (
    <>
      <defs><radialGradient id="g-rtb-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#c77dff" stopOpacity=".6"/><stop offset="100%" stopColor="#4a2a8a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-rtb-glow)"/>
      <circle cx="20" cy="26" r="8" fill="#9cc8ff"/><circle cx="44" cy="26" r="8" fill="#c9a6ff"/>
      <path d="M28 26h8" stroke="#eaf6ff" strokeWidth="2.4" strokeDasharray="3 3"/>
      <g fill="#e9dcff"><circle cx="32" cy="44" r="3"/><circle cx="14" cy="44" r="2.4"/><circle cx="50" cy="44" r="2.4"/></g>
      <path d="M32 41v-6M20 34v6M44 34v6" stroke="#9a6fd0" strokeWidth="1.8" opacity=".7"/>
    </>
  ),
  reincarnate: (
    <>
      <defs><radialGradient id="g-ric-glow" cx="50%" cy="50%" r="60%"><stop offset="0%" stopColor="#b7ffd0" stopOpacity=".7"/><stop offset="100%" stopColor="#3f8a4a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="27" fill="url(#g-ric-glow)"/>
      <circle cx="32" cy="32" r="16" fill="none" stroke="#7fe0a0" strokeWidth="2.4"/>
      <path d="M32 16a16 16 0 0 1 13 25" fill="none" stroke="#bff29a" strokeWidth="2.4" opacity=".7"/>
      <path d="M32 8l4 6-4 2-4-2z" fill="#eaffd6"/>
      <path d="M32 54l-4-6 4-2 4 2z" fill="#eaffd6"/>
      <circle cx="32" cy="32" r="4" fill="#eafff1"/>
    </>
  ),
  scrying: (
    <>
      <defs><radialGradient id="g-scy-glow" cx="50%" cy="50%" r="60%"><stop offset="0%" stopColor="#a9f0e6" stopOpacity=".7"/><stop offset="100%" stopColor="#2f8f9a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="27" fill="url(#g-scy-glow)"/>
      <circle cx="32" cy="32" r="16" fill="none" stroke="#8fe0d6" strokeWidth="2.6"/>
      <circle cx="32" cy="32" r="11" fill="#2a5a60"/>
      <circle cx="32" cy="32" r="5" fill="#d6fff8" opacity=".8"/>
      <path d="M18 24c8 4 20 4 28 0" fill="none" stroke="#d6fff8" strokeWidth="1.6" opacity=".6"/>
      <g fill="#eafaff"><circle cx="14" cy="14" r="1.3"/><circle cx="50" cy="14" r="1.3"/></g>
    </>
  ),
  seeming: (
    <>
      <defs><linearGradient id="g-sem" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f0e6ff" stopOpacity=".9"/><stop offset="100%" stopColor="#a98bff" stopOpacity=".4"/></linearGradient><radialGradient id="g-sem-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#c8b0ff" stopOpacity=".6"/><stop offset="100%" stopColor="#6a4fd0" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-sem-glow)"/>
      <path d="M12 40c0-7 4-12 10-12s10 5 10 12M32 40c0-7 4-12 10-12s10 5 10 12" fill="url(#g-sem)"/>
      <g fill="#e9dcff"><circle cx="22" cy="22" r="4"/><circle cx="42" cy="22" r="4"/></g>
      <path d="M26 50c4 3 8 3 12 0" fill="none" stroke="#d9c9ff" strokeWidth="2" strokeLinecap="round" opacity=".7"/>
    </>
  ),
  'skill empowerment': (
    <>
      <defs><radialGradient id="g-skp-glow" cx="50%" cy="40%" r="60%"><stop offset="0%" stopColor="#ffe9a8" stopOpacity=".8"/><stop offset="100%" stopColor="#d07020" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="30" r="27" fill="url(#g-skp-glow)"/>
      <circle cx="32" cy="30" r="16" fill="none" stroke="#ffd6a0" strokeWidth="2.6"/>
      <path d="M32 20l3 6 6 .6-4.4 4 1.2 6L32 34.4 26.2 36.6l1.2-6-4.4-4 6-.6z" fill="#fff2c4"/>
      <g stroke="#ffcf6b" strokeWidth="2.2" strokeLinecap="round"><path d="M32 4v6M14 10l4 4M50 10l-4 4"/></g>
    </>
  ),
  'steel wind strike': (
    <>
      <defs><linearGradient id="g-sws" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#eef3f9"/><stop offset="100%" stopColor="#8494a6"/></linearGradient><radialGradient id="g-sws-glow" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#cfe0ff" stopOpacity=".6"/><stop offset="100%" stopColor="#5a6a9a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-sws-glow)"/>
      <g fill="url(#g-sws)"><path d="M6 6l12 4-8 8z"/><path d="M58 6l-4 12-8-8z"/><path d="M6 58l4-12 8 8z"/><path d="M58 58l-12-4 8-8z"/></g>
      <g stroke="#eaf6ff" strokeWidth="2" strokeLinecap="round" opacity=".8"><path d="M14 14l36 36M50 14L14 50"/></g>
      <circle cx="32" cy="32" r="3" fill="#fff"/>
    </>
  ),
  'summon celestial': (
    <>
      <defs><radialGradient id="g-smc-glow" cx="50%" cy="40%" r="65%"><stop offset="0%" stopColor="#fff3c4" stopOpacity=".9"/><stop offset="100%" stopColor="#ffce6b" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="27" fill="url(#g-smc-glow)"/>
      <circle cx="32" cy="32" r="18" fill="none" stroke="#ffe9a8" strokeWidth="1.6" strokeDasharray="4 4" opacity=".8"/>
      <circle cx="32" cy="22" r="5" fill="#fff7dc"/>
      <path d="M22 46c0-7 4-12 10-12s10 5 10 12" fill="#ffe9a8"/>
      <path d="M20 24c-6-4-12-4-14-2 4 4 10 6 14 4zM44 24c6-4 12-4 14-2-4 4-10 6-14 4z" fill="#fff7dc" opacity=".9"/>
    </>
  ),
  'summon dragon': (
    <>
      <defs><radialGradient id="g-smd-glow" cx="50%" cy="45%" r="60%"><stop offset="0%" stopColor="#ffd6a0" stopOpacity=".7"/><stop offset="100%" stopColor="#a06020" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="27" fill="url(#g-smd-glow)"/>
      <path d="M14 40c0-8 6-14 14-14 6 0 10 3 12 8l8 2-5 5" fill="none" stroke="#ffce6b" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M14 40l-6 8M20 42l-2 10M46 38l6 8" stroke="#ffce6b" strokeWidth="2.4" strokeLinecap="round"/>
      <path d="M40 18c4-4 10-4 14 0-4 0-6 2-7 5-3-2-5-3-7-5z" fill="#ff9d1e"/>
      <circle cx="34" cy="31" r="1.6" fill="#fff6c4"/>
    </>
  ),
  'swift quiver': (
    <>
      <defs><linearGradient id="g-swq-arr" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#e9eef5"/><stop offset="100%" stopColor="#7d8b9c"/></linearGradient></defs>
      <path d="M18 8l14 0v40l-7 8-7-8z" fill="#8a6a3a"/>
      <g fill="url(#g-swq-arr)"><path d="M22 4l3 8h-6z"/><path d="M30 2l3 8h-6z"/></g>
      <g fill="none" stroke="#9fd0ff" strokeWidth="2.6" strokeLinecap="round"><path d="M40 26h14M50 20l6 6-6 6M40 38h14M50 32l6 6-6 6"/></g>
      <g fill="#eaf6ff"><circle cx="44" cy="14" r="1.3"/><circle cx="46" cy="50" r="1.2"/></g>
    </>
  ),
  'synaptic static': (
    <>
      <defs><radialGradient id="g-syn-glow" cx="50%" cy="50%" r="60%"><stop offset="0%" stopColor="#c77dff" stopOpacity=".8"/><stop offset="100%" stopColor="#3a1266" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="27" fill="url(#g-syn-glow)"/>
      <circle cx="32" cy="32" r="9" fill="#e0b0ff"/>
      <g stroke="#c77dff" strokeWidth="2.6" strokeLinecap="round" fill="none" opacity=".9"><path d="M32 12l6 8-8-2M52 32l-9 5 2-8M32 52l-6-8 8 2M12 32l9-5-2 8"/></g>
      <g fill="#fff"><circle cx="32" cy="32" r="3"/></g>
      <path d="M26 18l-4-6M38 18l4-6M26 46l-4 6M38 46l4 6" stroke="#9a6fd0" strokeWidth="2" strokeLinecap="round"/>
    </>
  ),
  telekinesis: (
    <>
      <defs><radialGradient id="g-tkn-glow" cx="50%" cy="45%" r="60%"><stop offset="0%" stopColor="#c8b0ff" stopOpacity=".7"/><stop offset="100%" stopColor="#4a2a8a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="30" r="27" fill="url(#g-tkn-glow)"/>
      <path d="M22 16h6v10h12V16h6v14a4 4 0 0 1-4 4H26a4 4 0 0 1-4-4z" fill="#c9d2de" opacity=".0"/>
      <rect x="24" y="14" width="16" height="14" rx="2" fill="#c9d2de"/>
      <g fill="none" stroke="#c9a6ff" strokeWidth="2.2" strokeLinecap="round"><path d="M32 10v-6M26 40l-6 10M38 40l6 10M24 32l-8 6M40 32l8 6"/></g>
      <circle cx="32" cy="30" r="18" fill="none" stroke="#c9a6ff" strokeWidth="1.4" strokeDasharray="3 4" opacity=".6"/>
    </>
  ),
  'teleportation circle': (
    <>
      <defs><radialGradient id="g-tpc-glow" cx="50%" cy="55%" r="60%"><stop offset="0%" stopColor="#9fd0ff" stopOpacity=".7"/><stop offset="100%" stopColor="#3a5f9a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="40" r="27" fill="url(#g-tpc-glow)"/>
      <ellipse cx="32" cy="46" rx="26" ry="10" fill="none" stroke="#9cc8ff" strokeWidth="2.6"/>
      <ellipse cx="32" cy="46" rx="17" ry="6.4" fill="none" stroke="#7cf9ff" strokeWidth="1.8"/>
      <path d="M32 8l3.4 8H44l-7 5 2.6 8L32 24.6 24.4 29l2.6-8-7-5h8.6z" fill="none" stroke="#cfe8ff" strokeWidth="1.8"/>
      <g fill="#eaf6ff"><circle cx="8" cy="46" r="1.4"/><circle cx="56" cy="46" r="1.4"/></g>
    </>
  ),
  'transmute rock': (
    <>
      <defs><linearGradient id="g-tmr" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#b0aa9a"/><stop offset="100%" stopColor="#5a5448"/></linearGradient><radialGradient id="g-tmr-glow" cx="50%" cy="55%" r="55%"><stop offset="0%" stopColor="#c9a86a" stopOpacity=".5"/><stop offset="100%" stopColor="#6b4f2a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="38" r="26" fill="url(#g-tmr-glow)"/>
      <path d="M8 42l8-12 10 4 8-8 12 6 8-4v14z" fill="url(#g-tmr)"/>
      <path d="M8 46c4-3 8-3 12 0s8 3 12 0 8-3 12 0 8 3 12 0" fill="none" stroke="#8a7a5a" strokeWidth="2.4" opacity=".8"/>
      <g stroke="#d9b98a" strokeWidth="1.6" strokeLinecap="round" opacity=".7"><path d="M16 34l-3-4M34 30l-3-4M48 32l-3-4"/></g>
    </>
  ),
  'tree stride': (
    <>
      <defs><radialGradient id="g-trs-glow" cx="50%" cy="50%" r="60%"><stop offset="0%" stopColor="#bff29a" stopOpacity=".7"/><stop offset="100%" stopColor="#3f8a4a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="34" r="27" fill="url(#g-trs-glow)"/>
      <path d="M10 54V30a8 8 0 0 1 16 0v24zM38 54V30a8 8 0 0 1 16 0v24z" fill="#7a5a30"/>
      <path d="M8 30a10 10 0 0 1 20-2M36 28a10 10 0 0 1 20 2" fill="#7fd18a"/>
      <path d="M26 40h12M32 34v12" stroke="#bff29a" strokeWidth="2.4" strokeDasharray="3 3" fill="none"/>
      <circle cx="32" cy="40" r="2" fill="#eaffd6"/>
    </>
  ),
  'wall of force': (
    <>
      <defs><linearGradient id="g-wfc" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#9fd0ff" stopOpacity=".35"/><stop offset="50%" stopColor="#eaf6ff" stopOpacity=".6"/><stop offset="100%" stopColor="#9fd0ff" stopOpacity=".35"/></linearGradient></defs>
      <rect x="10" y="6" width="44" height="52" rx="4" fill="url(#g-wfc)" stroke="#cfe8ff" strokeWidth="2"/>
      <g stroke="#eaf6ff" strokeWidth="1.4" opacity=".6"><path d="M10 18h44M10 30h44M10 42h44M24 6v52M40 6v52"/></g>
      <path d="M14 10c6 4 6 44 0 48" fill="none" stroke="#fff" strokeWidth="1.6" opacity=".5"/>
      <g fill="#eaf6ff"><circle cx="18" cy="24" r="1.3"/><circle cx="46" cy="40" r="1.3"/></g>
    </>
  ),
  'wall of light': (
    <>
      <defs><linearGradient id="g-wol" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fff7dc"/><stop offset="100%" stopColor="#ffce6b"/></linearGradient><radialGradient id="g-wol-glow" cx="50%" cy="50%" r="60%"><stop offset="0%" stopColor="#fff3c4" stopOpacity=".85"/><stop offset="100%" stopColor="#ffce6b" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="27" fill="url(#g-wol-glow)"/>
      <rect x="10" y="6" width="44" height="52" rx="4" fill="url(#g-wol)" opacity=".9"/>
      <g stroke="#fff" strokeWidth="1.6" opacity=".7"><path d="M10 18h44M10 30h44M10 42h44M24 6v52M40 6v52"/></g>
      <g fill="#fff"><circle cx="18" cy="24" r="1.4"/><circle cx="46" cy="40" r="1.4"/></g>
    </>
  ),
  'wall of stone': (
    <>
      <defs><linearGradient id="g-wos" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#b0aa9a"/><stop offset="100%" stopColor="#5a5448"/></linearGradient></defs>
      <rect x="10" y="6" width="44" height="52" rx="4" fill="url(#g-wos)"/>
      <g stroke="#3f3b32" strokeWidth="1.6" opacity=".7"><path d="M10 20h44M10 34h44M10 48h44M20 6v14M36 20v14M26 34v14M42 48v10M16 34v14M32 48v10M46 6v14M24 20v14M40 34v14"/></g>
      <path d="M10 6h44v4H10z" fill="#c9c2b0" opacity=".5"/>
    </>
  ),
  'wrath of nature': (
    <>
      <defs><radialGradient id="g-won-glow" cx="50%" cy="55%" r="60%"><stop offset="0%" stopColor="#bff29a" stopOpacity=".7"/><stop offset="100%" stopColor="#3f7a2a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="36" r="27" fill="url(#g-won-glow)"/>
      <path d="M4 50h56v10H4z" fill="#4a6a2a"/>
      <g fill="#5a8a3a"><path d="M8 50l4-12 4 12z"/><path d="M20 50l4-18 4 18z"/><path d="M32 50l4-22 4 22z"/><path d="M44 50l4-16 4 16z"/></g>
      <g stroke="#7fd18a" strokeWidth="2.4" strokeLinecap="round" fill="none"><path d="M24 26c-4-4-10-4-14 0M44 24c4-4 10-4 14 0"/></g>
      <g fill="#eaffd6"><circle cx="14" cy="16" r="1.4"/><circle cx="50" cy="16" r="1.4"/></g>
    </>
  ),
  "yolande's regal presence": (
    <>
      <defs><radialGradient id="g-yrp-glow" cx="50%" cy="40%" r="65%"><stop offset="0%" stopColor="#ffb0e6" stopOpacity=".8"/><stop offset="100%" stopColor="#7a2a66" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="30" r="27" fill="url(#g-yrp-glow)"/>
      <circle cx="32" cy="20" r="6" fill="#ffe0f4"/>
      <path d="M20 46c0-8 5-14 12-14s12 6 12 14" fill="#c76ad1"/>
      <path d="M16 18l4-8 5 6 7-8 7 8 5-6 4 8z" fill="#ff7ac6"/>
      <g stroke="#ffb0e6" strokeWidth="2" strokeLinecap="round"><path d="M12 40c-3 2-5 5-5 8M52 40c3 2 5 5 5 8"/></g>
    </>
  ),
  'arcane gate': (
    <>
      <defs><radialGradient id="g-arg-glow" cx="50%" cy="50%" r="60%"><stop offset="0%" stopColor="#9fd0ff" stopOpacity=".7"/><stop offset="100%" stopColor="#3a5f9a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="27" fill="url(#g-arg-glow)"/>
      <ellipse cx="18" cy="32" rx="9" ry="18" fill="#2a3a6a"/>
      <ellipse cx="46" cy="32" rx="9" ry="18" fill="#2a3a6a"/>
      <ellipse cx="18" cy="32" rx="9" ry="18" fill="none" stroke="#9fd0ff" strokeWidth="2"/>
      <ellipse cx="46" cy="32" rx="9" ry="18" fill="none" stroke="#9fd0ff" strokeWidth="2"/>
      <path d="M27 32h10M32 27l5 5-5 5" fill="none" stroke="#eaf6ff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
    </>
  ),
  'blade barrier': (
    <>
      <defs><linearGradient id="g-bdb" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#eef3f9"/><stop offset="100%" stopColor="#8494a6"/></linearGradient></defs>
      <g fill="url(#g-bdb)"><path d="M12 10l4 10-4 4-4-4z"/><path d="M24 6l4 12-4 5-4-5z"/><path d="M36 10l4 10-4 4-4-4z"/><path d="M48 6l4 12-4 5-4-5z"/><path d="M12 34l4 10-4 4-4-4z"/><path d="M24 30l4 12-4 5-4-5z"/><path d="M36 34l4 10-4 4-4-4z"/><path d="M48 30l4 12-4 5-4-5z"/></g>
      <path d="M2 56h60" stroke="#c9d2de" strokeWidth="2" opacity=".5"/>
    </>
  ),
  'bones of the earth': (
    <>
      <defs><linearGradient id="g-boe" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#d9d2c0"/><stop offset="100%" stopColor="#7a7464"/></linearGradient></defs>
      <g fill="url(#g-boe)"><rect x="8" y="20" width="7" height="36" rx="2"/><rect x="22" y="10" width="7" height="46" rx="2"/><rect x="36" y="6" width="7" height="50" rx="2"/><rect x="50" y="18" width="7" height="38" rx="2"/></g>
      <g fill="#4a463c" opacity=".5"><ellipse cx="11.5" cy="20" rx="4" ry="2.4"/><ellipse cx="25.5" cy="10" rx="4" ry="2.4"/><ellipse cx="39.5" cy="6" rx="4" ry="2.4"/><ellipse cx="53.5" cy="18" rx="4" ry="2.4"/></g>
      <path d="M4 56h56" stroke="#8a8474" strokeWidth="2.4"/>
    </>
  ),
  'chain lightning': (
    <>
      <defs><linearGradient id="g-chn" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#ffffff"/><stop offset="100%" stopColor="#9fd0ff"/></linearGradient></defs>
      <path d="M8 10l-4 12h6l-3 12 10-14h-6l4-10z" fill="#fff6c4"/>
      <path d="M26 24l-4 12h6l-3 12 10-14h-6l4-10z" fill="#fff6c4"/>
      <path d="M44 38l-4 12h6l-3 12 10-14h-6l4-10z" fill="#fff6c4"/>
      <g fill="none" stroke="url(#g-chn)" strokeWidth="2" strokeLinecap="round" opacity=".8"><path d="M12 22c4 2 8 2 12 4M30 36c4 2 8 2 12 4"/></g>
    </>
  ),
  'circle of death': (
    <>
      <defs><radialGradient id="g-cid-glow" cx="50%" cy="50%" r="60%"><stop offset="0%" stopColor="#7a2ecf" stopOpacity=".8"/><stop offset="100%" stopColor="#0a0414" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="28" fill="url(#g-cid-glow)"/>
      <circle cx="32" cy="32" r="20" fill="#1a0a2a"/>
      <circle cx="32" cy="32" r="20" fill="none" stroke="#7a4fd0" strokeWidth="2" opacity=".8"/>
      <path d="M32 14a10 10 0 0 0-10 10c0 4 2 6 4 8v4h12v-4c2-2 4-4 4-8A10 10 0 0 0 32 14z" fill="#c9a6ff"/>
      <g fill="#1a0a2a"><circle cx="28" cy="24" r="1.8"/><circle cx="36" cy="24" r="1.8"/></g>
    </>
  ),
  'conjure fey': (
    <>
      <defs><radialGradient id="g-cfy-glow" cx="50%" cy="45%" r="60%"><stop offset="0%" stopColor="#bff29a" stopOpacity=".8"/><stop offset="100%" stopColor="#3f8a4a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="27" fill="url(#g-cfy-glow)"/>
      <circle cx="32" cy="30" r="18" fill="none" stroke="#bff29a" strokeWidth="1.6" strokeDasharray="4 4" opacity=".8"/>
      <circle cx="32" cy="22" r="5" fill="#d9ffbf"/>
      <path d="M24 44c0-7 4-12 8-12s8 5 8 12" fill="#9ad0a0"/>
      <path d="M18 24c-6-5-12-6-14-4 4 5 10 7 14 4zM46 24c6-5 12-6 14-4-4 5-10 7-14 4z" fill="#c8ffb0"/>
      <path d="M30 14l2-4 2 4" fill="#eafff1"/>
    </>
  ),
  contingency: (
    <>
      <defs><radialGradient id="g-ctg-glow" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#c8b0ff" stopOpacity=".7"/><stop offset="100%" stopColor="#4a2a8a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-ctg-glow)"/>
      <circle cx="32" cy="32" r="16" fill="none" stroke="#c9a6ff" strokeWidth="2.4"/>
      <path d="M32 22v10l7 5" stroke="#e9dcff" strokeWidth="2.6" strokeLinecap="round" fill="none"/>
      <path d="M14 14l4 4M50 14l-4 4M14 50l4-4M50 50l-4-4" stroke="#9a6fd0" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="32" cy="32" r="2.6" fill="#fff"/>
    </>
  ),
  'create homunculus': (
    <>
      <defs><radialGradient id="g-chu-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#b06bff" stopOpacity=".6"/><stop offset="100%" stopColor="#3a1266" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="34" r="26" fill="url(#g-chu-glow)"/>
      <circle cx="32" cy="22" r="7" fill="#c9a6ff"/>
      <path d="M22 46c0-7 4-12 10-12s10 5 10 12" fill="#8a5cf0"/>
      <path d="M22 20l-3-8 6 5M42 20l3-8-6 5" fill="#c9a6ff"/>
      <g fill="#1a0a2a"><circle cx="29" cy="21" r="1.4"/><circle cx="35" cy="21" r="1.4"/></g>
      <circle cx="32" cy="34" r="2" fill="#e9dcff"/>
    </>
  ),
  'create undead': (
    <>
      <defs><radialGradient id="g-cud-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#8a5cf0" stopOpacity=".6"/><stop offset="100%" stopColor="#1a0a2a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="34" r="27" fill="url(#g-cud-glow)"/>
      <path d="M32 12a13 13 0 0 0-13 13c0 5 3 8 5 10v4h16v-4c2-2 5-5 5-10A13 13 0 0 0 32 12z" fill="#c9a6ff"/>
      <g fill="#1a0a2a"><circle cx="26" cy="24" r="2.2"/><circle cx="38" cy="24" r="2.2"/><path d="M26 34h12v4H26z"/></g>
      <path d="M20 54V46c2-2 6-3 12-3s10 1 12 3v8M16 44l-4 8M48 44l4 8" fill="none" stroke="#8a5cf0" strokeWidth="3" strokeLinecap="round"/>
    </>
  ),
  disintegrate: (
    <>
      <defs><linearGradient id="g-dsg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#e0ffd6"/><stop offset="100%" stopColor="#3f8a4a"/></linearGradient></defs>
      <circle cx="40" cy="24" r="14" fill="url(#g-dsg)" opacity=".5"/>
      <circle cx="40" cy="24" r="8" fill="#bff29a"/>
      <path d="M6 54L32 28l6 6-26 26z" fill="url(#g-dsg)" opacity=".85"/>
      <g fill="#eaffd6"><circle cx="48" cy="16" r="1.4"/><circle cx="52" cy="30" r="1.2"/><circle cx="30" cy="14" r="1.2"/></g>
      <path d="M36 30l8-2M34 36l8-2" stroke="#eaffd6" strokeWidth="1.6" opacity=".7"/>
    </>
  ),
  "drawmij's instant summons": (
    <>
      <defs><radialGradient id="g-dis-glow" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#c8b0ff" stopOpacity=".7"/><stop offset="100%" stopColor="#4a2a8a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="27" fill="url(#g-dis-glow)"/>
      <path d="M30 10l4 0 2 10h-10z" fill="#c9a6ff"/>
      <path d="M26 12c-2 6 0 10 4 12M40 12c2 6 0 10-4 12" fill="none" stroke="#e9dcff" strokeWidth="1.6" opacity=".7"/>
      <path d="M20 40l6-8h12l6 8z" fill="#8a5cf0"/>
      <path d="M24 40h16v10H24z" fill="#8a5cf0" opacity=".8"/>
      <path d="M32 44v4" stroke="#e9dcff" strokeWidth="2" strokeLinecap="round"/>
    </>
  ),
  'druid grove': (
    <>
      <defs><radialGradient id="g-dgr-glow" cx="50%" cy="60%" r="65%"><stop offset="0%" stopColor="#bff29a" stopOpacity=".7"/><stop offset="100%" stopColor="#3f8a4a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="40" r="28" fill="url(#g-dgr-glow)"/>
      <ellipse cx="32" cy="48" rx="26" ry="9" fill="none" stroke="#bff29a" strokeWidth="2" strokeDasharray="4 4"/>
      <g fill="#5a8a3a"><path d="M16 48a8 8 0 0 1 16 0z"/><path d="M32 48a8 8 0 0 1 16 0z"/></g>
      <path d="M24 40V22a8 8 0 0 1 16 0v18" fill="none" stroke="#7a5a30" strokeWidth="4"/>
      <path d="M12 28a10 10 0 0 1 20-2M32 24a10 10 0 0 1 20 2" fill="#7fd18a"/>
    </>
  ),
  eyebite: (
    <>
      <defs><radialGradient id="g-eyb-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#9a6fd0" stopOpacity=".7"/><stop offset="100%" stopColor="#1a0a2a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="27" fill="url(#g-eyb-glow)"/>
      <path d="M32 20c-8 0-14 6-14 12s6 12 14 12 14-6 14-12-6-12-14-12z" fill="none" stroke="#c9a6ff" strokeWidth="2.2" opacity="0"/>
      <ellipse cx="32" cy="32" rx="14" ry="9" fill="#e9dcff"/>
      <circle cx="32" cy="32" r="5" fill="#5a2ecf"/><circle cx="32" cy="32" r="1.8" fill="#1a0a2a"/>
      <path d="M14 16l6 6M50 16l-6 6M18 50l5-5M46 50l-5-5" stroke="#9a6fd0" strokeWidth="2" strokeLinecap="round"/>
      <g fill="#c9a6ff"><circle cx="48" cy="40" r="2"/><circle cx="16" cy="38" r="2"/></g>
    </>
  ),
  'find the path': (
    <>
      <defs><radialGradient id="g-ftp-glow" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#a9f0e6" stopOpacity=".7"/><stop offset="100%" stopColor="#2f8f9a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="27" fill="url(#g-ftp-glow)"/>
      <path d="M8 48c6-2 8-8 12-8s4 6 10 6 6-8 12-10" fill="none" stroke="#8fe0d6" strokeWidth="3" strokeLinecap="round" strokeDasharray="5 5"/>
      <path d="M8 40c6-2 8-8 12-8s4 6 10 6 6-8 12-10" fill="none" stroke="#d6fff8" strokeWidth="1.6" strokeLinecap="round" opacity=".5"/>
      <path d="M32 8l2.6 6.4L41 17l-6.4 2.6L32 26l-2.6-6.4L23 17l6.4-2.6z" fill="#eafaff"/>
    </>
  ),
  'flesh to stone': (
    <>
      <defs><linearGradient id="g-fts" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#c9c2b0"/><stop offset="100%" stopColor="#6a6458"/></linearGradient><radialGradient id="g-fts-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#d9b98a" stopOpacity=".5"/><stop offset="100%" stopColor="#6b5a3a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="34" r="26" fill="url(#g-fts-glow)"/>
      <circle cx="32" cy="18" r="7" fill="url(#g-fts)"/>
      <path d="M20 50c0-9 5-16 12-16s12 7 12 16" fill="url(#g-fts)"/>
      <g stroke="#4a463c" strokeWidth="1.6" opacity=".6"><path d="M26 16l6 4-4 4M42 26l-6 4 4 4M24 40l6 3-4 4"/></g>
      <path d="M12 12l4 4M52 12l-4 4" stroke="#a09880" strokeWidth="1.8" strokeLinecap="round"/>
    </>
  ),
  forbiddance: (
    <>
      <defs><radialGradient id="g-fbd-glow" cx="50%" cy="55%" r="65%"><stop offset="0%" stopColor="#fff3c4" stopOpacity=".85"/><stop offset="100%" stopColor="#ffce6b" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="44" r="28" fill="url(#g-fbd-glow)"/>
      <ellipse cx="32" cy="50" rx="26" ry="8" fill="none" stroke="#ffe9a8" strokeWidth="2.4"/>
      <path d="M22 12h20v30H22z" fill="none" stroke="#fff7dc" strokeWidth="2.4"/>
      <path d="M28 12V6h8v6M32 18v18M26 26h12" stroke="#fff7dc" strokeWidth="2.2" strokeLinecap="round"/>
      <circle cx="32" cy="36" r="3" fill="#fff7dc"/>
    </>
  ),
  'globe of invulnerability': (
    <>
      <defs><radialGradient id="g-glo" cx="38%" cy="34%" r="65%"><stop offset="0%" stopColor="#ffffff" stopOpacity=".9"/><stop offset="60%" stopColor="#cfe0ff" stopOpacity=".5"/><stop offset="100%" stopColor="#7aa2ff" stopOpacity=".2"/></radialGradient></defs>
      <circle cx="32" cy="32" r="22" fill="url(#g-glo)" stroke="#eaf6ff" strokeWidth="2.4"/>
      <path d="M18 24a16 16 0 0 1 18-8" fill="none" stroke="#fff" strokeWidth="2" opacity=".8"/>
      <g fill="none" stroke="#9fd0ff" strokeWidth="1.4" opacity=".6"><circle cx="32" cy="32" r="16"/><circle cx="32" cy="32" r="10"/></g>
      <g fill="#eaf6ff" opacity=".7"><circle cx="12" cy="12" r="1.3"/><circle cx="52" cy="52" r="1.3"/></g>
    </>
  ),
  'guards and wards': (
    <>
      <defs><radialGradient id="g-gaw-glow" cx="50%" cy="45%" r="60%"><stop offset="0%" stopColor="#c8b0ff" stopOpacity=".6"/><stop offset="100%" stopColor="#4a2a8a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="27" fill="url(#g-gaw-glow)"/>
      <path d="M10 26L32 10l22 16v22H10z" fill="none" stroke="#d9c9ff" strokeWidth="2.4"/>
      <path d="M10 26h44M22 26v22M42 26v22M32 26v22" stroke="#c9a6ff" strokeWidth="1.4" opacity=".6"/>
      <path d="M32 16l4 6-4 6-4-6z" fill="#e9dcff"/>
      <g fill="#c9a6ff"><circle cx="18" cy="38" r="2"/><circle cx="46" cy="38" r="2"/></g>
    </>
  ),
  harm: (
    <>
      <defs><radialGradient id="g-hrm-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#8a5cf0" stopOpacity=".7"/><stop offset="100%" stopColor="#1a0a2a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="34" r="27" fill="url(#g-hrm-glow)"/>
      <path d="M14 44V30a4 4 0 0 1 8 0v6M22 36V24a4 4 0 0 1 8 0v12M30 36v-8a4 4 0 0 1 8 0v14a10 10 0 0 1-10 10h-4a10 10 0 0 1-10-10" fill="none" stroke="#c9a6ff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
      <g stroke="#7a4fd0" strokeWidth="2.2" strokeLinecap="round"><path d="M46 12l-4-6M52 20l6-4M40 6v-4"/></g>
      <path d="M44 14c2 4 2 8 0 12" fill="none" stroke="#9a6fd0" strokeWidth="2" strokeLinecap="round"/>
    </>
  ),
  heal: (
    <>
      <defs><radialGradient id="g-hll-glow" cx="50%" cy="40%" r="65%"><stop offset="0%" stopColor="#fff7dc" stopOpacity=".95"/><stop offset="100%" stopColor="#7fe0a0" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="28" fill="url(#g-hll-glow)"/>
      <circle cx="32" cy="32" r="20" fill="none" stroke="#eafff1" strokeWidth="2.4" opacity=".7"/>
      <path d="M32 18v28M18 32h28" stroke="#fff" strokeWidth="4.6" strokeLinecap="round"/>
      <g stroke="#bff29a" strokeWidth="2" strokeLinecap="round"><path d="M32 4v6M12 10l5 5M52 10l-5 5M8 32h6M50 32h6"/></g>
    </>
  ),
  "heroes' feast": (
    <>
      <defs><radialGradient id="g-hrf-glow" cx="50%" cy="40%" r="65%"><stop offset="0%" stopColor="#fff3c4" stopOpacity=".85"/><stop offset="100%" stopColor="#d9a441" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="30" r="28" fill="url(#g-hrf-glow)"/>
      <ellipse cx="32" cy="40" rx="24" ry="8" fill="#d9a441"/>
      <path d="M12 40c4-8 36-8 40 0" fill="#e9c9a0"/>
      <path d="M24 36c0-4 3-6 8-6s8 2 8 6" fill="#ff9d1e"/>
      <path d="M28 30c-2-3 0-6 4-6s6 3 4 6" fill="#7fd18a"/>
      <path d="M32 12v8M26 15h12" stroke="#fff7dc" strokeWidth="2" strokeLinecap="round" opacity=".8"/>
    </>
  ),
  'investiture of flame': (
    <>
      <defs><radialGradient id="g-iof-glow" cx="50%" cy="45%" r="65%"><stop offset="0%" stopColor="#fff3c4" stopOpacity=".95"/><stop offset="100%" stopColor="#ff3d00" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="28" fill="url(#g-iof-glow)"/>
      <circle cx="32" cy="18" r="6" fill="#ffd166"/>
      <path d="M20 50c0-8 4-14 12-14s12 6 12 14z" fill="#ff8a1e"/>
      <g fill="#fff3c4" opacity=".9"><path d="M20 24c-3 4-2 8 1 11 1-4 2-7-1-11zM44 24c3 4 2 8-1 11-1-4-2-7 1-11z"/><path d="M32 34c-3 4-2 8 1 11 1-4 2-7-1-11z"/></g>
    </>
  ),
  'investiture of ice': (
    <>
      <defs><radialGradient id="g-ioi-glow" cx="50%" cy="45%" r="65%"><stop offset="0%" stopColor="#dff4ff" stopOpacity=".9"/><stop offset="100%" stopColor="#3f8fd6" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="28" fill="url(#g-ioi-glow)"/>
      <circle cx="32" cy="18" r="6" fill="#eafaff"/>
      <path d="M20 50c0-8 4-14 12-14s12 6 12 14z" fill="#7fc4ea"/>
      <g stroke="#eafaff" strokeWidth="2.2" strokeLinecap="round"><path d="M16 26l6-2-2 6M48 26l-6-2 2 6M22 40l-4 4M42 40l4 4"/></g>
      <g fill="#fff"><circle cx="24" cy="30" r="1.6"/><circle cx="40" cy="30" r="1.6"/></g>
    </>
  ),
  'investiture of stone': (
    <>
      <defs><linearGradient id="g-ios" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#c9c2b0"/><stop offset="100%" stopColor="#6a6458"/></linearGradient><radialGradient id="g-ios-glow" cx="50%" cy="45%" r="60%"><stop offset="0%" stopColor="#d9b98a" stopOpacity=".6"/><stop offset="100%" stopColor="#6b5a3a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="27" fill="url(#g-ios-glow)"/>
      <circle cx="32" cy="18" r="6" fill="#c9c2b0"/>
      <path d="M20 50c0-8 4-14 12-14s12 6 12 14z" fill="url(#g-ios)"/>
      <g stroke="#4a463c" strokeWidth="1.6" opacity=".6"><path d="M26 16l6 4-4 4M40 26l-6 4 4 4M24 42l6 3-4 4"/></g>
    </>
  ),
  'investiture of wind': (
    <>
      <defs><radialGradient id="g-iow-glow" cx="50%" cy="45%" r="65%"><stop offset="0%" stopColor="#dff6ff" stopOpacity=".8"/><stop offset="100%" stopColor="#5a9fd0" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="28" fill="url(#g-iow-glow)"/>
      <circle cx="32" cy="18" r="6" fill="#eafaff"/>
      <path d="M20 50c0-8 4-14 12-14s12 6 12 14z" fill="#bfe4ff"/>
      <g fill="none" stroke="#eafaff" strokeWidth="2.4" strokeLinecap="round"><path d="M8 28h20M6 38h24M12 46h18M40 24c4-2 8-2 12 0"/></g>
    </>
  ),
  'magic jar': (
    <>
      <defs><linearGradient id="g-mgj" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#cfe0ff"/><stop offset="100%" stopColor="#5a7fd0"/></linearGradient><radialGradient id="g-mgj-glow" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#c77dff" stopOpacity=".6"/><stop offset="100%" stopColor="#4a2a8a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="27" fill="url(#g-mgj-glow)"/>
      <path d="M22 8h20v6l4 6v26a6 6 0 0 1-6 6H24a6 6 0 0 1-6-6V20l4-6z" fill="url(#g-mgj)" opacity=".85"/>
      <path d="M22 20h20" stroke="#eaf6ff" strokeWidth="1.6" opacity=".7"/>
      <circle cx="32" cy="36" r="5" fill="#e9dcff"/>
      <path d="M14 14l4 4M50 14l-4 4" stroke="#c9a6ff" strokeWidth="2" strokeLinecap="round"/>
    </>
  ),
  'mass suggestion': (
    <>
      <defs><radialGradient id="g-msug-glow" cx="50%" cy="45%" r="60%"><stop offset="0%" stopColor="#ffb0e6" stopOpacity=".65"/><stop offset="100%" stopColor="#7a2a66" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="27" fill="url(#g-msug-glow)"/>
      <g fill="#c76ad1"><circle cx="20" cy="22" r="6"/><circle cx="32" cy="18" r="6"/><circle cx="44" cy="22" r="6"/></g>
      <g fill="#ffe0f4"><circle cx="20" cy="22" r="1.6"/><circle cx="32" cy="18" r="1.6"/><circle cx="44" cy="22" r="1.6"/></g>
      <path d="M12 46c4-3 8-3 12 0s8 3 12 0 8-3 12 0" fill="none" stroke="#ff9ecb" strokeWidth="2.2" strokeLinecap="round" opacity=".8"/>
    </>
  ),
  'mental prison': (
    <>
      <defs><radialGradient id="g-mnp-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#c77dff" stopOpacity=".7"/><stop offset="100%" stopColor="#3a1266" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-mnp-glow)"/>
      <path d="M32 10c-6 0-10 4-10 9 0 3 1 5 3 6-2 2-3 4-3 7h20c0-3-1-5-3-7 2-1 3-3 3-6 0-5-4-9-10-9z" fill="#8a5cf0"/>
      <g stroke="#c9a6ff" strokeWidth="2.2" opacity=".9"><rect x="12" y="12" width="40" height="40" rx="0" fill="none"/><path d="M22 12v40M32 12v40M42 12v40M12 22h40M12 32h40M12 42h40"/></g>
    </>
  ),
  'move earth': (
    <>
      <defs><linearGradient id="g-mve" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#b08a5a"/><stop offset="100%" stopColor="#5a4020"/></linearGradient></defs>
      <path d="M4 46h24l4-12 8 12h20v10H4z" fill="url(#g-mve)"/>
      <path d="M22 46c4-2 8-2 12 0M40 46c4-2 8-2 12 0" fill="none" stroke="#8a6a3a" strokeWidth="2" opacity=".7"/>
      <g fill="none" stroke="#d9b98a" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M32 30V12M24 20l8-8 8 8"/></g>
      <g fill="#d9b98a"><circle cx="16" cy="38" r="1.6"/><circle cx="48" cy="38" r="1.6"/></g>
    </>
  ),
  "otiluke's freezing sphere": (
    <>
      <defs><radialGradient id="g-ofs" cx="40%" cy="35%" r="65%"><stop offset="0%" stopColor="#ffffff"/><stop offset="55%" stopColor="#9fe0ff"/><stop offset="100%" stopColor="#3f8fd6"/></radialGradient></defs>
      <circle cx="32" cy="32" r="17" fill="url(#g-ofs)"/>
      <circle cx="32" cy="32" r="17" fill="none" stroke="#eafaff" strokeWidth="1.6" opacity=".7"/>
      <g stroke="#eafaff" strokeWidth="2" strokeLinecap="round"><path d="M32 8v6M32 50v6M8 32h6M50 32h6M14 14l4 4M46 46l4 4M50 14l-4 4M18 46l-4 4"/></g>
      <circle cx="26" cy="26" r="3" fill="#fff" opacity=".85"/>
    </>
  ),
  "otto's irresistible dance": (
    <>
      <defs><radialGradient id="g-oid-glow" cx="50%" cy="45%" r="60%"><stop offset="0%" stopColor="#ffb0e6" stopOpacity=".7"/><stop offset="100%" stopColor="#7a2a66" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="27" fill="url(#g-oid-glow)"/>
      <circle cx="32" cy="16" r="5" fill="#ffe0f4"/>
      <path d="M30 22c-4 6-6 10-2 14l-4 8M32 26l8 2 4-6M31 36l-6 12M34 36l8 10" fill="none" stroke="#ff9ecb" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
      <g stroke="#c76ad1" strokeWidth="1.8" strokeLinecap="round" opacity=".8" fill="none"><path d="M14 14c4 0 6 2 6 6s-2 6-6 6M50 14c-4 0-6 2-6 6s2 6 6 6"/></g>
    </>
  ),
  'planar ally': (
    <>
      <defs><radialGradient id="g-pla-glow" cx="50%" cy="40%" r="65%"><stop offset="0%" stopColor="#fff3c4" stopOpacity=".9"/><stop offset="100%" stopColor="#ffce6b" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="30" r="28" fill="url(#g-pla-glow)"/>
      <circle cx="32" cy="32" r="18" fill="none" stroke="#ffe9a8" strokeWidth="1.6" strokeDasharray="4 4" opacity=".8"/>
      <circle cx="32" cy="20" r="5" fill="#fff7dc"/>
      <path d="M24 44c0-7 4-12 8-12s8 5 8 12" fill="#ffe9a8"/>
      <path d="M20 22c-6-4-12-4-14-2 4 4 10 6 14 4zM44 22c6-4 12-4 14-2-4 4-10 6-14 4z" fill="#fff7dc"/>
    </>
  ),
  'primordial ward': (
    <>
      <defs><radialGradient id="g-prw-glow" cx="50%" cy="45%" r="60%"><stop offset="0%" stopColor="#cfe0ff" stopOpacity=".7"/><stop offset="100%" stopColor="#5a7fd0" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="27" fill="url(#g-prw-glow)"/>
      <path d="M32 8l18 7v12c0 12-8 19-18 23-10-4-18-11-18-23V15z" fill="none" stroke="#dbeaff" strokeWidth="2.6"/>
      <circle cx="32" cy="30" r="4" fill="#ff8a3a"/>
      <circle cx="32" cy="30" r="9" fill="none" stroke="#a3e635" strokeWidth="2" opacity=".7"/>
      <circle cx="32" cy="30" r="14" fill="none" stroke="#5ad1ff" strokeWidth="2" opacity=".5"/>
      <circle cx="32" cy="30" r="19" fill="none" stroke="#c9c2b0" strokeWidth="2" opacity=".35"/>
    </>
  ),
  'programmed illusion': (
    <>
      <defs><linearGradient id="g-pri-ill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f0e6ff" stopOpacity=".85"/><stop offset="100%" stopColor="#a98bff" stopOpacity=".3"/></linearGradient><radialGradient id="g-pri-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#c8b0ff" stopOpacity=".6"/><stop offset="100%" stopColor="#6a4fd0" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="26" fill="url(#g-pri-glow)"/>
      <circle cx="32" cy="18" r="6" fill="url(#g-pri-ill)"/>
      <path d="M22 44c0-8 4-14 10-14s10 6 10 14" fill="url(#g-pri-ill)"/>
      <g stroke="#c9a6ff" strokeWidth="1.8" strokeLinecap="round" opacity=".8"><path d="M32 2v6M10 12l4 4M54 12l-4 4M8 32h5M51 32h5"/></g>
      <path d="M42 40h4v6h-4z" fill="#e9dcff"/>
    </>
  ),
  scatter: (
    <>
      <defs><radialGradient id="g-sct-glow" cx="50%" cy="50%" r="60%"><stop offset="0%" stopColor="#9fd0ff" stopOpacity=".6"/><stop offset="100%" stopColor="#3a5f9a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="27" fill="url(#g-sct-glow)"/>
      <circle cx="32" cy="32" r="5" fill="#eaf6ff"/>
      <g fill="#7cf9ff"><circle cx="14" cy="16" r="3.4"/><circle cx="50" cy="16" r="3.4"/><circle cx="14" cy="48" r="3.4"/><circle cx="50" cy="48" r="3.4"/></g>
      <g stroke="#cfe8ff" strokeWidth="2" strokeLinecap="round" strokeDasharray="3 3" fill="none"><path d="M28 28L16 18M36 28l12-10M28 36L16 46M36 36l12 10"/></g>
    </>
  ),
  'soul cage': (
    <>
      <defs><radialGradient id="g-slc-glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#b06bff" stopOpacity=".7"/><stop offset="100%" stopColor="#1a0a2a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="27" fill="url(#g-slc-glow)"/>
      <rect x="18" y="12" width="28" height="40" rx="4" fill="none" stroke="#c9a6ff" strokeWidth="2.6"/>
      <g stroke="#9a6fd0" strokeWidth="1.8" opacity=".8"><path d="M18 22h28M18 32h28M18 42h28M28 12v40M38 12v40"/></g>
      <path d="M32 22a6 6 0 0 0-6 6c0 3 2 5 4 6v2h4v-2c2-1 4-3 4-6a6 6 0 0 0-6-6z" fill="#e9dcff"/>
      <circle cx="32" cy="28" r="1.4" fill="#5a2ecf"/>
    </>
  ),
  'summon fiend': (
    <>
      <defs><radialGradient id="g-smf-glow" cx="50%" cy="45%" r="60%"><stop offset="0%" stopColor="#ff6a6a" stopOpacity=".7"/><stop offset="100%" stopColor="#5a0a0a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="34" r="27" fill="url(#g-smf-glow)"/>
      <circle cx="32" cy="34" r="18" fill="none" stroke="#ff6a6a" strokeWidth="1.6" strokeDasharray="4 4" opacity=".8"/>
      <path d="M32 14c6 0 10 5 10 11 0 4-2 6-4 8H26c-2-2-4-4-4-8 0-6 4-11 10-11z" fill="#c02a2a"/>
      <g fill="#2a0a0a"><circle cx="28" cy="24" r="2"/><circle cx="36" cy="24" r="2"/></g>
      <path d="M22 16l-4-8M42 16l4-8" stroke="#ff6a6a" strokeWidth="2.6" strokeLinecap="round"/>
    </>
  ),
  sunbeam: (
    <>
      <defs><linearGradient id="g-sun" x1="0" y1="1" x2="0" y2="0"><stop offset="0%" stopColor="#ffffff"/><stop offset="55%" stopColor="#ffe27a"/><stop offset="100%" stopColor="#fffdf0"/></linearGradient><radialGradient id="g-sun-glow" cx="50%" cy="50%" r="60%"><stop offset="0%" stopColor="#fff3c4" stopOpacity=".9"/><stop offset="100%" stopColor="#ffce6b" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="27" fill="url(#g-sun-glow)"/>
      <path d="M4 24h56v8H4z" fill="url(#g-sun)"/>
      <path d="M4 24h56v8H4z" fill="none" stroke="#fff" strokeWidth="1"/>
      <g fill="#eaf6ff"><circle cx="16" cy="48" r="1.6"/><circle cx="32" cy="50" r="1.6"/><circle cx="48" cy="48" r="1.6"/><circle cx="24" cy="12" r="1.4"/><circle cx="40" cy="12" r="1.4"/></g>
    </>
  ),
  "tasha's bubbling cauldron": (
    <>
      <defs><radialGradient id="g-tbc-glow" cx="50%" cy="50%" r="60%"><stop offset="0%" stopColor="#cdf07a" stopOpacity=".6"/><stop offset="100%" stopColor="#4a8a20" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="36" r="27" fill="url(#g-tbc-glow)"/>
      <path d="M12 30h40l-4 22a6 6 0 0 1-6 4H22a6 6 0 0 1-6-4z" fill="#6b4f2a"/>
      <ellipse cx="32" cy="30" rx="20" ry="6" fill="#8aa64a"/>
      <g fill="#cdf07a"><circle cx="24" cy="26" r="2.4"/><circle cx="34" cy="24" r="2"/><circle cx="42" cy="27" r="1.8"/></g>
      <path d="M14 24c-4-3-6-6-6-9M52 24c4-3 6-6 6-9" fill="none" stroke="#8a6a3a" strokeWidth="2.4" strokeLinecap="round"/>
    </>
  ),
  "tasha's otherworldly guise": (
    <>
      <defs><radialGradient id="g-tog-glow" cx="50%" cy="40%" r="65%"><stop offset="0%" stopColor="#c8b0ff" stopOpacity=".8"/><stop offset="100%" stopColor="#4a2a8a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="30" r="28" fill="url(#g-tog-glow)"/>
      <circle cx="32" cy="18" r="6" fill="#e9dcff"/>
      <path d="M20 50c0-9 5-16 12-16s12 7 12 16" fill="#8a5cf0"/>
      <path d="M12 26c4-6 10-8 20-8s16 2 20 8" fill="none" stroke="#c9a6ff" strokeWidth="2.4"/>
      <g fill="none" stroke="#e9dcff" strokeWidth="2" strokeLinecap="round"><path d="M24 14l-4-6M40 14l4-6M32 10V4"/></g>
    </>
  ),
  "tenser's transformation": (
    <>
      <defs><radialGradient id="g-ttf-glow" cx="50%" cy="40%" r="60%"><stop offset="0%" stopColor="#ffd6a0" stopOpacity=".8"/><stop offset="100%" stopColor="#a06020" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="30" r="27" fill="url(#g-ttf-glow)"/>
      <circle cx="32" cy="16" r="6" fill="#e9c9a0"/>
      <path d="M18 50c0-9 6-16 14-16s14 7 14 16" fill="#c9762a"/>
      <path d="M20 40l6-4M44 40l-6-4M24 30l8 4 8-4" fill="none" stroke="#ffd6a0" strokeWidth="2.4" strokeLinecap="round"/>
      <g stroke="#ffce6b" strokeWidth="2.2" strokeLinecap="round"><path d="M12 16l4 4M52 16l-4 4"/></g>
    </>
  ),
  'transport via plants': (
    <>
      <defs><radialGradient id="g-tvp-glow" cx="50%" cy="50%" r="60%"><stop offset="0%" stopColor="#bff29a" stopOpacity=".7"/><stop offset="100%" stopColor="#3f8a4a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="34" r="27" fill="url(#g-tvp-glow)"/>
      <path d="M10 54V34a9 9 0 0 1 18 0v20z" fill="#7a5a30"/>
      <path d="M36 54V34a9 9 0 0 1 18 0v20z" fill="#7a5a30"/>
      <path d="M8 34a11 11 0 0 1 22-2M34 32a11 11 0 0 1 22 2" fill="#7fd18a"/>
      <path d="M28 40h8M32 34v14" stroke="#bff29a" strokeWidth="2.4" strokeDasharray="3 3" fill="none"/>
      <circle cx="32" cy="42" r="2" fill="#eaffd6"/>
    </>
  ),
  'true seeing': (
    <>
      <defs><radialGradient id="g-tsg-glow" cx="50%" cy="50%" r="60%"><stop offset="0%" stopColor="#fff3c4" stopOpacity=".85"/><stop offset="100%" stopColor="#ffce6b" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="28" fill="url(#g-tsg-glow)"/>
      <path d="M6 32s9-13 26-13 26 13 26 13-9 13-26 13S6 32 6 32z" fill="none" stroke="#fff7dc" strokeWidth="2.6"/>
      <circle cx="32" cy="32" r="8" fill="#fff7dc"/><circle cx="32" cy="32" r="3.4" fill="#a06a20"/>
      <g stroke="#fff3c4" strokeWidth="2" strokeLinecap="round"><path d="M32 4v6M12 10l5 5M52 10l-5 5M8 32h5M51 32h5"/></g>
    </>
  ),
  'wall of ice': (
    <>
      <defs><linearGradient id="g-woi" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ffffff"/><stop offset="60%" stopColor="#9fe0ff"/><stop offset="100%" stopColor="#3f8fd6"/></linearGradient></defs>
      <path d="M8 12h48v40H8z" fill="url(#g-woi)" opacity=".9"/>
      <g stroke="#eafaff" strokeWidth="1.6" opacity=".8"><path d="M8 24h48M8 36h48M20 12v12M36 24v12M28 36v16M44 12v12M12 24v12M40 36v16"/></g>
      <ellipse cx="32" cy="14" rx="24" ry="4" fill="#fff" opacity=".5"/>
      <g fill="#fff"><circle cx="16" cy="30" r="1.4"/><circle cx="46" cy="40" r="1.4"/></g>
    </>
  ),
  'wall of thorns': (
    <>
      <defs><linearGradient id="g-wot" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#9ac04a"/><stop offset="100%" stopColor="#3f6a2a"/></linearGradient></defs>
      <path d="M8 10h48v44H8z" fill="url(#g-wot)" opacity=".9"/>
      <g fill="#eaffd6"><path d="M12 14l3 6h-6z"/><path d="M28 12l3 7h-6z"/><path d="M44 14l3 6h-6z"/><path d="M20 26l3 7h-6z"/><path d="M40 24l3 7h-6z"/><path d="M12 38l3 7h-6z"/><path d="M30 36l3 7h-6z"/><path d="M48 38l3 7h-6z"/><path d="M22 48l3 6h-6z"/><path d="M42 48l3 6h-6z"/></g>
      <g stroke="#2f5a1a" strokeWidth="1.4" opacity=".7"><path d="M8 22h48M8 34h48M8 46h48"/></g>
    </>
  ),
  'wind walk': (
    <>
      <defs><radialGradient id="g-wnw-glow" cx="50%" cy="50%" r="60%"><stop offset="0%" stopColor="#dff6ff" stopOpacity=".7"/><stop offset="100%" stopColor="#5a9fd0" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="27" fill="url(#g-wnw-glow)"/>
      <circle cx="32" cy="18" r="5" fill="#eafaff"/>
      <path d="M32 23c-4 4-4 9 1 13l-6 9M32 28l10 3 5-5M33 36l-7 12" fill="none" stroke="#bfe4ff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
      <g fill="none" stroke="#eafaff" strokeWidth="2.2" strokeLinecap="round" opacity=".85"><path d="M6 20h18M4 30h16M8 40h16"/></g>
    </>
  ),
  'word of recall': (
    <>
      <defs><radialGradient id="g-wor-glow" cx="50%" cy="55%" r="65%"><stop offset="0%" stopColor="#fff3c4" stopOpacity=".85"/><stop offset="100%" stopColor="#ffce6b" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="42" r="28" fill="url(#g-wor-glow)"/>
      <ellipse cx="32" cy="48" rx="26" ry="9" fill="none" stroke="#ffe9a8" strokeWidth="2.4"/>
      <ellipse cx="32" cy="48" rx="17" ry="6" fill="none" stroke="#ffcf6b" strokeWidth="1.6"/>
      <path d="M32 8a10 10 0 0 1 10 10c0 6-4 10-10 10s-10-4-10-10A10 10 0 0 1 32 8z" fill="none" stroke="#fff7dc" strokeWidth="2.4"/>
      <path d="M32 12l1.8 3.6L37 16.6l-2.6 2.4.8 3.6L32 20.8 28.8 22.6l.8-3.6L27 16.6l3.2-.4z" fill="#fff7dc"/>
    </>
  ),
  moonbeam: (
    <>
      <defs><linearGradient id="g-mnb" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ffffff"/><stop offset="55%" stopColor="#cfe0ff"/><stop offset="100%" stopColor="#9fb6ff" stopOpacity="0"/></linearGradient><radialGradient id="g-mnb-glow" cx="50%" cy="35%" r="60%"><stop offset="0%" stopColor="#eaf3ff" stopOpacity=".9"/><stop offset="100%" stopColor="#9fb6ff" stopOpacity="0"/></radialGradient></defs>
      <circle cx="32" cy="30" r="27" fill="url(#g-mnb-glow)"/>
      <path d="M30 6a13 13 0 1 0 12 20 10 10 0 0 1-12-20z" fill="#f2f7ff"/>
      <path d="M24 20h16v30H24z" fill="url(#g-mnb)" opacity=".85"/>
      <path d="M24 20h16v30H24z" fill="none" stroke="#eaf6ff" strokeWidth="1.2" opacity=".6"/>
      <g fill="#fff"><circle cx="18" cy="14" r="1.4"/><circle cx="48" cy="12" r="1.2"/><circle cx="50" cy="26" r="1"/></g>
    </>
  ),
};
