import type { ReactNode } from 'react';

/**
 * Цветные иконки действий, выданных заклинаниями (эффектами и зонами).
 * Ключ — `<ключ заклинания-источника>:<id действия>`; общий запасной глиф — по id действия.
 * Наполняется вместе с билдерами автоматизации; deploy-тест следит за покрытием.
 */
export const ACTION_ICONS: Record<string, ReactNode> = {
  // Irresistible Dance — «Собраться»: танцующая нота под запретом
  "XPHB:Otto's Irresistible Dance:stopDancing": (
    <>
      <defs>
        <linearGradient id="aiDanceNote" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffd6f2" />
          <stop offset="1" stopColor="#b06bd8" />
        </linearGradient>
      </defs>
      <path d="M14.6 4.1l4.4-1.1v2.2l-4.4 1.1z" fill="url(#aiDanceNote)" />
      <path d="M14.6 4.1v9.3a2.5 2.5 0 1 1-1.5-2.3" fill="none" stroke="url(#aiDanceNote)" strokeWidth="1.7" strokeLinejoin="round" />
      <circle cx="16.4" cy="16.5" r="5" fill="none" stroke="#ff5470" strokeWidth="1.7" />
      <path d="M12.9 13l7 7" stroke="#ff5470" strokeWidth="1.7" strokeLinecap="round" />
    </>
  ),

  // Call Lightning — удар из грозовой тучи
  'XPHB:Call Lightning:strike': (
    <>
      <defs>
        <linearGradient id="aiStrikeCloud" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6d7fa8" />
          <stop offset="1" stopColor="#2b3350" />
        </linearGradient>
        <linearGradient id="aiStrikeBolt" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff6c2" />
          <stop offset="1" stopColor="#ffab00" />
        </linearGradient>
      </defs>
      <path
        d="M7.2 9.6a4.1 4.1 0 0 1 7.8-1.3 3.6 3.6 0 0 1 3.4 3.9 3.1 3.1 0 0 1-1 6.1H7.6a4.2 4.2 0 0 1-.4-8.7z"
        fill="url(#aiStrikeCloud)"
      />
      <path d="M12.9 10.4 9.2 15.6h2.4l-1.2 4.6 4-5.6h-2.5z" fill="url(#aiStrikeBolt)" stroke="#8a5a00" strokeWidth="0.4" strokeLinejoin="round" />
    </>
  ),

  // Moonbeam — лунный луч по кругу
  'XPHB:Moonbeam:move': (
    <>
      <defs>
        <linearGradient id="aiMoonOrb" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f4f9ff" />
          <stop offset="1" stopColor="#9fc7ff" />
        </linearGradient>
      </defs>
      <path d="M15.6 3.4a8.2 8.2 0 1 0 5.8 9.9 6.5 6.5 0 0 1-5.8-9.9z" fill="url(#aiMoonOrb)" />
      <path d="M4.4 15.9a7.6 7.6 0 0 0 6.4 4.6" fill="none" stroke="#8fb8ff" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M4.1 13.1l.3 3.1 3-.6" fill="none" stroke="#8fb8ff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="18.6" cy="18.4" r="1.2" fill="#dceaff" />
      <circle cx="21" cy="14.8" r="0.8" fill="#dceaff" opacity="0.8" />
    </>
  ),

  // Flaming Sphere — огненный шар катится
  'XPHB:Flaming Sphere:move': (
    <>
      <defs>
        <radialGradient id="aiSphereFire" cx="0.4" cy="0.35" r="0.75">
          <stop offset="0" stopColor="#fff3a8" />
          <stop offset="0.5" stopColor="#ffab2e" />
          <stop offset="1" stopColor="#e2481b" />
        </radialGradient>
      </defs>
      <circle cx="12" cy="10.4" r="5.4" fill="url(#aiSphereFire)" />
      <path d="M12 2.6c1 1.6 2.4 2.4 2.4 4.2a2.4 2.4 0 0 1-4.8 0c0-1.8 1.4-2.6 2.4-4.2z" fill="#ffd166" />
      <path d="M3.6 17.6a9 9 0 0 0 16.8 0" fill="none" stroke="#ff9f43" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M20.9 15.2l-.5 2.9-2.9-.6" fill="none" stroke="#ff9f43" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),

  // Faithful Hound — верный пёс рыщет
  "XPHB:Mordenkainen's Faithful Hound:move": (
    <>
      <path d="M5.4 12.6 4 8.8l3.2.9 2-2.6 5.2 1a4.6 4.6 0 0 1 4 4.6c0 2.6-2 4.8-4.6 4.8h-4.2a4.4 4.4 0 0 1-4.2-4.9z" fill="#8d6e63" />
      <path d="M4.4 8.6 3 5.4l4 1.2z" fill="#5d4037" />
      <circle cx="16.2" cy="12" r="1.1" fill="#ffe082" />
      <path d="M5.2 13.8c-1.4.4-2.4 1.6-2.6 3" fill="none" stroke="#5d4037" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M18.6 20.4a8 8 0 0 0 2.4-5.2" fill="none" stroke="#7fd1c8" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M21.4 12.6l-.3 2.8-2.7-.7" fill="none" stroke="#7fd1c8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),

  // Expeditious Retreat — стремительный отход
  'XPHB:Expeditious Retreat:dash': (
    <>
      <path d="M4.2 7.4l4.4 2.7-4.4 2.7z" fill="#ffd166" />
      <path d="M8.8 7.4l4.4 2.7-4.4 2.7z" fill="#ff9f43" />
      <path
        d="M13.6 5.8h3.4v6.4l2.8 1.8c.8.5 1.2 1.4 1.2 2.3V18a1 1 0 0 1-1 1h-8.4a1 1 0 0 1-1-1v-7.6"
        fill="#e8791e"
        stroke="#7a3a00"
        strokeWidth="0.7"
        strokeLinejoin="round"
      />
      <path d="M11.6 16.4h8.4" stroke="#7a3a00" strokeWidth="0.7" />
    </>
  ),

  // Dragon's Breath — дыхание дракона
  "XPHB:Dragon's Breath:breath": (
    <>
      <defs>
        <linearGradient id="aiBreathCone" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ff6b6b" />
          <stop offset="0.5" stopColor="#ffd166" />
          <stop offset="1" stopColor="#4dabf7" />
        </linearGradient>
      </defs>
      <path d="M11.4 9.6c3.4-1.2 6.8-1.2 10.2 0-3.4 1.2-6.8 1.2-10.2 0z" fill="url(#aiBreathCone)" />
      <path d="M11.4 12c3-.9 6-.9 9 0-3 .9-6 .9-9 0z" fill="url(#aiBreathCone)" opacity="0.75" />
      <path d="M11.4 14.2c2.6-.7 5.2-.7 7.8 0-2.6.7-5.2.7-7.8 0z" fill="url(#aiBreathCone)" opacity="0.5" />
      <circle cx="6.6" cy="10.6" r="4.2" fill="#2f7d4f" />
      <path d="M5 7.8 4 4.6l3.4 1z" fill="#1f5c39" />
      <path d="M9.2 8.6 11.6 6l-.6 3.4z" fill="#3f9d63" />
      <circle cx="5.6" cy="10" r="0.9" fill="#ffe066" />
      <circle cx="5.9" cy="10" r="0.4" fill="#1b1b1b" />
    </>
  ),

  // Vampiric Touch — вытягивающее жизнь касание
  'XPHB:Vampiric Touch:touch': (
    <>
      <path
        d="M7.2 15.6V9.4a1.3 1.3 0 0 1 2.6 0v3.2M9.8 12.6V8a1.3 1.3 0 0 1 2.6 0v4.6M12.4 12.6V9a1.3 1.3 0 0 1 2.6 0v3.6M15 12.8V10a1.2 1.2 0 0 1 2.4 0v5.6a5.2 5.2 0 0 1-5.2 5.2h-1a4.8 4.8 0 0 1-4.8-4.8v-1.6"
        fill="#c0392b"
        stroke="#5e1409"
        strokeWidth="0.7"
        strokeLinejoin="round"
      />
      <path d="M18.6 3.4c1.6 2.4 2.6 3.9 2.6 5.2a2.6 2.6 0 0 1-5.2 0c0-1.3 1-2.8 2.6-5.2z" fill="#e63946" />
      <path d="M18.6 6.2c.6 1 1 1.6 1 2.2a1 1 0 0 1-2 0c0-.6.4-1.2 1-2.2z" fill="#ffb3ba" />
    </>
  ),

  // Flame Blade — пылающий клинок
  'XPHB:Flame Blade:blade': (
    <>
      <defs>
        <linearGradient id="aiFlameBlade" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#e2481b" />
          <stop offset="0.5" stopColor="#ff9f1c" />
          <stop offset="1" stopColor="#fff3a8" />
        </linearGradient>
      </defs>
      <path d="M6.2 18.6c6-1.2 10.4-5.4 12.6-13.2-6.6 2.6-10.8 7-12.6 13.2z" fill="url(#aiFlameBlade)" />
      <path d="M6.4 18.4c4.6-1.4 8-4.8 10.4-10.2-4.6 2.8-8 6.2-10.4 10.2z" fill="#fff3a8" opacity="0.55" />
      <path d="M5.4 19.2 3.6 21" stroke="#8a5a2b" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="3.2" cy="21.2" r="1.6" fill="#b07a3a" />
    </>
  ),

  // Sunbeam — ослепительный луч
  'XPHB:Sunbeam:beam': (
    <>
      <defs>
        <linearGradient id="aiSunRay" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff3a8" />
          <stop offset="1" stopColor="#ffcf40" stopOpacity="0.25" />
        </linearGradient>
      </defs>
      <path d="M7.6 14.2 20.8 6l-2.4 5.4 1 3.8-6.4.6z" fill="url(#aiSunRay)" />
      <circle cx="7" cy="16.4" r="4.4" fill="#ffb400" />
      <circle cx="7" cy="16.4" r="2.6" fill="#fff3a8" />
      <path
        d="M7 9.4v-2.6M2.8 11.2 1 9.6M4.6 20.4l-2.2 1.2M11.4 21.4l1.8 1.4M12.8 14.6l2.2-1.8"
        stroke="#ffcf40"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </>
  ),

  // Conjure Woodland Beings — лесные духи уводят от удара
  'XPHB:Conjure Woodland Beings:disengage': (
    <>
      <path d="M12.6 3.6c4 0 7 2.8 7 6.6 0 4.4-3.6 8-8 8.6" fill="none" stroke="#57cc99" strokeWidth="1.6" strokeLinecap="round" strokeDasharray="3 2.4" />
      <path d="M12.6 3.6c2.6.2 4.6 1.6 5.8 3.6-2-.4-4 .2-5.4 1.6z" fill="#80ed99" />
      <path d="M18.4 7.2c.8 1.6 1.2 3.2 1 5-1.6-1.2-3.4-1.6-5.2-1z" fill="#57cc99" />
      <path d="M19.4 12.2c-.6 2-1.8 3.6-3.4 4.8-.6-1.8-.2-3.6 1-5z" fill="#80ed99" />
      <path d="M8.4 4.2c1.6-.8 3.2-1 4.8-.6-1.2 1.4-1.8 3-1.6 4.8z" fill="#57cc99" />
      <path d="M4.6 8.2C3.8 10 3.6 12 4 14" fill="none" stroke="#80ed99" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="6.2" cy="18.6" r="1.1" fill="#ffe066" />
      <circle cx="9.8" cy="20.4" r="0.8" fill="#ffe066" opacity="0.85" />
      <circle cx="13.6" cy="19" r="0.7" fill="#ffe066" opacity="0.7" />
    </>
  ),

  // Heat Metal — раскалённый металл
  'XPHB:Heat Metal:burn': (
    <>
      <defs>
        <linearGradient id="aiHeatMetal" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe066" />
          <stop offset="0.5" stopColor="#ff7b00" />
          <stop offset="1" stopColor="#b32400" />
        </linearGradient>
      </defs>
      <path d="M11.4 18c1.6-2 2.2-3.6 2-5-.2-1-1-1.8-2-2.2.8-.2 1.6 0 2.2.6.4-1.6 0-3-1.2-4.2 2.2 1 3.4 2.8 3.6 5.2.2 2.4-1.2 4.4-4.6 5.6z" fill="#ff7b00" opacity="0.9" />
      <path d="M4.4 14.6h15.2l-2.4 6.2H6.8z" fill="url(#aiHeatMetal)" stroke="#6b1a00" strokeWidth="0.6" strokeLinejoin="round" />
      <path d="M8 14.6v-1.4M12 14.4v-1.8M16 14.6v-1.4" stroke="#ffe066" strokeWidth="1.2" strokeLinecap="round" />
    </>
  ),

  // Hex — проклятие-метка
  'XPHB:Hex:remark': (
    <>
      <path d="M12 3.2 20 8v8l-8 4.8L4 16V8z" fill="#5f3dc4" />
      <path d="M12 5.4 17.8 9v6l-5.8 3.6L6.2 15V9z" fill="#845ef7" />
      <path d="M12 8.4l3.4 2v3.2L12 15.6l-3.4-2v-3.2z" fill="#1f1147" />
      <circle cx="12" cy="12" r="1.4" fill="#e5dbff" />
      <path d="M12 3.2V1.4M20 8l2-1M4 8 2 7" stroke="#ccb7ff" strokeWidth="1.2" strokeLinecap="round" />
    </>
  ),

  // Hunter's Mark — метка охотника
  "XPHB:Hunter's Mark:remark": (
    <>
      <circle cx="12" cy="12" r="8.2" fill="none" stroke="#7cb342" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="4.6" fill="none" stroke="#aeea00" strokeWidth="1.2" />
      <circle cx="12" cy="12" r="1.4" fill="#f9a825" />
      <path
        d="M12 1.8v3.4M12 18.8v3.4M1.8 12h3.4M18.8 12h3.4"
        stroke="#aeea00"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path d="M12 8.6c.9 1.4 1.4 2.3 1.4 3a1.4 1.4 0 0 1-2.8 0c0-.7.5-1.6 1.4-3z" fill="#dcedc8" />
    </>
  ),

  // Holy Weapon — «Разряд»: вспышка священного света
  'XGE:Holy Weapon:burst': (
    <>
      <defs>
        <radialGradient id="aiHolyBurst" cx="0.5" cy="0.5" r="0.6">
          <stop offset="0" stopColor="#fffdf0" />
          <stop offset="0.6" stopColor="#ffd54f" />
          <stop offset="1" stopColor="#ffb300" />
        </radialGradient>
      </defs>
      <circle cx="12" cy="12" r="5.2" fill="url(#aiHolyBurst)" />
      <path
        d="M12 1.6v4.2M12 18.2v4.2M1.6 12h4.2M18.2 12h4.2M4.6 4.6l3 3M16.4 16.4l3 3M19.4 4.6l-3 3M7.6 16.4l-3 3"
        stroke="#ffd54f"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="12" cy="12" r="2.2" fill="#fffdf0" />
    </>
  ),

  // Shadow Blade — «Вернуть клинок»: клинок тени возвращается в руку (стрелка вниз)
  'XGE:Shadow Blade:return': (
    <>
      <defs>
        <linearGradient id="aiShadowBlade" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ded1ff" />
          <stop offset="1" stopColor="#3b2a5e" />
        </linearGradient>
      </defs>
      <path d="M12 2.2 13.8 6v7.4h-3.6V6z" fill="url(#aiShadowBlade)" />
      <path d="M8.2 13.4h7.6" stroke="#b9a4ff" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M12 15v3.2" stroke="#b9a4ff" strokeWidth="1.6" strokeLinecap="round" />
      <path
        d="M9.4 16.2 12 18.8l2.6-2.6"
        fill="none"
        stroke="#e7dcff"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),

  // Magic Stone — «Бросок камня»: светящийся камень в полёте
  'XGE:Magic Stone:throw': (
    <>
      <defs>
        <radialGradient id="aiStoneGlow" cx="0.5" cy="0.45" r="0.6">
          <stop offset="0" stopColor="#cfd8ff" stopOpacity="0.85" />
          <stop offset="1" stopColor="#6b7bd8" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="12" cy="11.4" r="9" fill="url(#aiStoneGlow)" />
      <path
        d="M12 5.2c2.5 0 4.4 1.9 4.4 4.4 0 3.1-1.7 6.2-4.4 8.3-2.7-2.1-4.4-5.2-4.4-8.3 0-2.5 1.9-4.4 4.4-4.4z"
        fill="#8d94a8"
        stroke="#3a3f52"
        strokeWidth="0.6"
      />
      <path d="M10.3 8.2c.8-1 2-1.4 3.3-1" stroke="rgba(255,255,255,0.5)" strokeWidth="0.8" fill="none" strokeLinecap="round" />
      <path d="M5.6 5.6l2.2 1.6M18.4 5.6l-2.2 1.6" stroke="#b9c3ff" strokeWidth="1.2" strokeLinecap="round" />
    </>
  ),
};

/** Запасные глифы действий по id (когда точного ключа «заклинание:действие» нет). */
export const ACTION_ICON_FALLBACKS: Record<string, ReactNode> = {
  move: (
    <>
      <path d="M6 15.6a6.6 6.6 0 0 1 9.4-5.9" fill="none" stroke="#8fb8ff" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M18 15.6A6.6 6.6 0 0 1 8.6 21.5" fill="none" stroke="#8fb8ff" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M14.6 8.6l1.4 1.6-2 1.1z" fill="#8fb8ff" />
      <path d="M9.4 21.4l-1.4-1.6 2-1.1z" fill="#8fb8ff" />
      <circle cx="12" cy="12" r="2.4" fill="#dceaff" />
    </>
  ),
  remark: (
    <>
      <path d="M12 3.4 19.6 12 12 20.6 4.4 12z" fill="#845ef7" />
      <path d="M12 6.6 16.8 12 12 17.4 7.2 12z" fill="#3b1d78" />
      <circle cx="12" cy="12" r="1.6" fill="#e5dbff" />
      <path d="M12 3.4V1.6M19.6 12l1.8 0M4.4 12H2.6" stroke="#ccb7ff" strokeWidth="1.2" strokeLinecap="round" />
    </>
  ),
  dash: (
    <>
      <path d="M4.6 7.6l4.6 2.8-4.6 2.8z" fill="#ffd166" />
      <path d="M9.4 7.6l4.6 2.8-4.6 2.8z" fill="#ff9f43" />
      <path d="M14.6 6.6h3v6l2.8 1.8v3.4h-8.4v-8" fill="#e8791e" stroke="#7a3a00" strokeWidth="0.7" strokeLinejoin="round" />
    </>
  ),
  disengage: (
    <>
      <path d="M13.4 4.6h4.8v14.8h-4.8" fill="none" stroke="#57cc99" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M12.6 12H3.4" stroke="#80ed99" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M7 8.2 3 12l4 3.8" fill="none" stroke="#80ed99" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  strike: (
    <>
      <path d="M13.4 2.6 5.6 13.4h5l-1.8 8 7.8-10.8h-5z" fill="#ffd166" stroke="#8a5a00" strokeWidth="0.6" strokeLinejoin="round" />
    </>
  ),
  touch: (
    <>
      <path
        d="M7.4 15.4V9.6a1.2 1.2 0 0 1 2.4 0v3M9.8 12.6V8.2a1.2 1.2 0 0 1 2.4 0v4.4M12.2 12.6V9.2a1.2 1.2 0 0 1 2.4 0v3.4M14.6 12.8V10a1.1 1.1 0 0 1 2.2 0v5.4a5 5 0 0 1-5 5h-1a4.6 4.6 0 0 1-4.6-4.6v-1.4"
        fill="#c0392b"
        stroke="#5e1409"
        strokeWidth="0.7"
        strokeLinejoin="round"
      />
      <circle cx="17.6" cy="5.4" r="2.2" fill="#e63946" />
    </>
  ),
  blade: (
    <>
      <path d="M6.6 18.4c5.6-1.2 9.8-5.2 11.8-12.4-6.2 2.4-10.2 6.6-11.8 12.4z" fill="#ff9f1c" />
      <path d="M6.8 18.2c4.4-1.4 7.6-4.6 9.8-9.6-4.4 2.6-7.6 5.8-9.8 9.6z" fill="#fff3a8" opacity="0.6" />
      <path d="M5.6 19 4 20.6" stroke="#8a5a2b" strokeWidth="1.6" strokeLinecap="round" />
    </>
  ),
  beam: (
    <>
      <path d="M8 13.6 20.4 6.4l-2.2 5 1 3.4-6 .8z" fill="#ffcf40" />
      <circle cx="7" cy="16.2" r="3.8" fill="#ffb400" />
      <circle cx="7" cy="16.2" r="2.1" fill="#fff3a8" />
      <path d="M7 10.2V8M3.4 11.6 1.8 10.2M5 20l-2 1.2M11 20.8l1.6 1.4" stroke="#ffcf40" strokeWidth="1.4" strokeLinecap="round" />
    </>
  ),
  breath: (
    <>
      <path d="M11.4 8.8c3.6-1.2 7.2-1.2 10.8 0-3.6 1.2-7.2 1.2-10.8 0z" fill="#ff6b6b" />
      <path d="M11.4 12c3.2-1 6.4-1 9.6 0-3.2 1-6.4 1-9.6 0z" fill="#ffd166" />
      <path d="M11.4 15c2.6-.8 5.2-.8 7.8 0-2.6.8-5.2.8-7.8 0z" fill="#4dabf7" />
      <circle cx="6.6" cy="11" r="4.2" fill="#2f7d4f" />
      <path d="M5 8.2 4 5l3.4 1z" fill="#1f5c39" />
      <circle cx="5.6" cy="10.4" r="0.9" fill="#ffe066" />
    </>
  ),
  farStep: (
    <>
      <circle cx="12" cy="12" r="7.4" fill="none" stroke="#a98bff" strokeWidth="1.8" strokeDasharray="3.6 2.8" />
      <path d="M12 3.6 9.6 7.2h4.8z" fill="#d6c8ff" />
      <path d="M12 20.4l-2.4-3.6h4.8z" fill="#d6c8ff" />
      <circle cx="12" cy="12" r="2.6" fill="#6d4bd8" />
      <circle cx="12" cy="12" r="1.1" fill="#efe9ff" />
    </>
  ),
  burn: (
    <>
      <path d="M12 2.6c1.2 4.2 4.8 5.6 4.8 10a4.8 4.8 0 0 1-9.6 0c0-1.9.8-3.3 1.8-4.5.4 1.2 1 2 1.9 2.4C10.4 8.2 12 5.6 12 2.6z" fill="#ff7b00" />
      <path d="M12 9.4c.7 2.2 2.4 3 2.4 5.1a2.4 2.4 0 0 1-4.8 0c0-1.1.5-1.9 1.2-2.6.2.7.6 1.2 1.1 1.4-.3-1.4.1-2.7.1-3.9z" fill="#ffe066" />
      <path d="M5 20.6h14" stroke="#b32400" strokeWidth="1.6" strokeLinecap="round" />
    </>
  ),
  asleep: (
    <>
      <path d="M15.6 3.4a8.2 8.2 0 1 0 5.8 9.9 6.5 6.5 0 0 1-5.8-9.9z" fill="#8fa8ff" />
      <path d="M5 8h4l-4 4h4" stroke="#dbe4ff" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  panicked: (
    <>
      <path d="M12 3l9 16H3z" fill="#ffb703" stroke="#7a4b00" strokeWidth="0.7" strokeLinejoin="round" />
      <path d="M12 9.4v4.2M12 16.2h.01" stroke="#4a2c00" strokeWidth="1.8" strokeLinecap="round" />
    </>
  ),
  sickened: (
    <>
      <path d="M12 3.4s6 6.3 6 10.2a6 6 0 1 1-12 0c0-3.9 6-10.2 6-10.2z" fill="#7cd06a" stroke="#2f6b28" strokeWidth="0.7" />
      <path d="M9 13.6h6" stroke="#eafff0" strokeWidth="1.5" strokeLinecap="round" />
    </>
  ),
};

/** id действия из ключа `<ключ заклинания>:<id>` (последний сегмент). */
function actionIdOf(iconKey: string): string {
  return iconKey.slice(iconKey.lastIndexOf(':') + 1);
}

/** Есть ли цветная иконка для действия (точная или запасная по id). */
export function hasActionIcon(iconKey?: string): boolean {
  if (!iconKey) return false;
  return iconKey in ACTION_ICONS || actionIdOf(iconKey) in ACTION_ICON_FALLBACKS;
}

/** Цветная иконка действия (без бейджей): 24×24, собственные цвета. */
export default function ActionGlyph({ iconKey, className }: { iconKey?: string; className?: string }) {
  if (!iconKey) return null;
  const icon = ACTION_ICONS[iconKey] ?? ACTION_ICON_FALLBACKS[actionIdOf(iconKey)];
  if (!icon) return null;
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {icon}
    </svg>
  );
}
