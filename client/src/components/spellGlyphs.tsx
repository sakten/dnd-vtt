import type { ReactNode } from 'react';

/**
 * Нарисованные вручную иконки заклинаний (24×24, линейные). Ключ — имя заклинания в нижнем регистре.
 * Батч 1: круг 0 (фокусы) и круг 1.
 */
export const SPELL_GLYPHS: Record<string, ReactNode> = {
  // ===== Круг 0 =====
  'acid splash': (
    <>
      <path d="M12 3s4 5 4 8a4 4 0 0 1-8 0c0-3 4-8 4-8z" />
      <path d="M5 19l2-2M12 21l1-2M19 19l-2-2" />
    </>
  ),
  'blade ward': (
    <>
      <path d="M7 3l1.5 3v7h-3V6z" />
      <path d="M4.5 13h6M7 13v6h1.5v-6" />
      <path d="M16 5a5 5 0 0 1 4 4v4a5 5 0 0 1-4 4c-2 0-3.5-1.5-3.5-3.5" />
    </>
  ),
  'booming blade': (
    <>
      <path d="M8 14V6l1.6-2.5L11.2 6v8z" />
      <path d="M6.5 14h6.5M9.7 14v6h1.6v-6" />
      <path d="M15 6a6 6 0 0 1 4 3M16 10a5 5 0 0 1 3.5 2.5" />
    </>
  ),
  'chill touch': (
    <>
      <path d="M8 13V6.5M10.5 12V5.5M13 12V6.5M15.5 13v-6" />
      <path d="M8 13c0 4 2 6.5 4 7 2-.5 4.5-3 4.5-7" />
      <path d="M4 5l1.5 1.5M20 5l-1.5 1.5M4 9h1.8" />
    </>
  ),
  'control flames': (
    <>
      <path d="M12 4c1 2.6 3.4 3.6 3.4 6.4A3.4 3.4 0 0 1 12 14a3.4 3.4 0 0 1-3.4-3.6C8.6 7.6 11 6.6 12 4z" />
      <path d="M6 18h12M9 21h6M4 15h3M17 15h3" />
    </>
  ),
  'create bonfire': (
    <>
      <path d="M12 3c1 2.4 3.2 3.4 3.2 6a3.2 3.2 0 0 1-6.4 0c0-2.6 2.2-3.6 3.2-6z" />
      <path d="M5 20l14-4M19 20L5 16" />
    </>
  ),
  'dancing lights': (
    <>
      <circle cx="6" cy="7" r="2" />
      <circle cx="14" cy="5" r="1.6" />
      <circle cx="18" cy="11" r="1.8" />
      <circle cx="11" cy="12" r="2.2" />
      <path d="M5 17c2 1.5 5 2 7 2s5-.5 7-2" opacity="0.6" />
    </>
  ),
  druidcraft: (
    <>
      <path d="M12 20c0-6 2.5-10 8-12-.8 6.5-3.4 10.5-8 12z" />
      <path d="M12 20c-2.4-4-6-6.4-9-7 2 5 5 6.6 9 7z" opacity="0.8" />
      <path d="M12 8l1.5-2.5L12 2l-1.5 3.5z" />
    </>
  ),
  'eldritch blast': (
    <>
      <path d="M3 12h10" />
      <path d="M9 9.5L12 12l-3 2.5" />
      <circle cx="16" cy="12" r="3" />
      <path d="M19 8l1.5-1.5M21 12h-2M19 16l1.5 1.5" />
    </>
  ),
  elementalism: (
    <>
      <path d="M12 3l6 6-6 6-6-6z" />
      <path d="M12 12v9M8 16l4 2 4-2" opacity="0.7" />
      <path d="M12 3v3M12 13v3" opacity="0.6" />
    </>
  ),
  'fire bolt': (
    <>
      <circle cx="5" cy="19" r="2" />
      <path d="M7 17L19 5" />
      <path d="M16 4c.8 1.6 2.4 2 2.4 3.8A2.4 2.4 0 0 1 14 7.8C14 6 15.2 5.6 16 4z" />
    </>
  ),
  friends: (
    <>
      <circle cx="8.5" cy="12" r="4" />
      <circle cx="15.5" cy="12" r="4" />
      <path d="M7 11h3M14 11h3" />
      <path d="M12 3l1 2 2 1-2 1-1 2-1-2-2-1 2-1z" opacity="0.8" />
    </>
  ),
  frostbite: (
    <>
      <path d="M9 12V7a1.4 1.4 0 0 1 2.8 0v5M11.8 12V6a1.4 1.4 0 0 1 2.8 0v6" />
      <path d="M14.6 12v-2a1.4 1.4 0 0 1 2.8 0v4a5 5 0 0 1-5 5h-1" />
      <path d="M5 5v6M2.5 6.5l5 3M7.5 6.5l-5 3" />
    </>
  ),
  'green-flame blade': (
    <>
      <path d="M9 15V6l1.6-2.5L12.2 6v9z" />
      <path d="M7.5 15h7M10.7 15v5h1.6v-5" />
      <path d="M16 6c.9 1.8 2.6 2.4 2.6 4.4A2.6 2.6 0 0 1 16 13" />
    </>
  ),
  guidance: (
    <>
      <path d="M8 20v-6M8 14a4 4 0 0 1 4-4h3" />
      <path d="M12 6a2.5 2.5 0 1 1 5 0 2.5 2.5 0 0 1-5 0z" />
      <path d="M18 3l.8 1.7L20.5 5.5l-1.7.8L18 8l-.8-1.7L15.5 5.5l1.7-.8z" opacity="0.8" />
    </>
  ),
  gust: (
    <>
      <path d="M3 9h11a2.5 2.5 0 1 0-2.5-2.5" />
      <path d="M3 13h14a2.5 2.5 0 1 1-2.5 2.5" />
      <path d="M3 17h8" opacity="0.7" />
    </>
  ),
  infestation: (
    <>
      <circle cx="12" cy="12" r="2" />
      <path d="M10 12l-4-3M14 12l4-3M10 13l-4 3M14 13l4 3M12 10l-1.5-4M12 10l1.5-4" />
      <circle cx="6" cy="18" r="1.2" />
      <circle cx="18" cy="18" r="1.2" />
    </>
  ),
  light: (
    <>
      <circle cx="12" cy="10" r="3" />
      <path d="M12 2v2M12 16v2M3 10h2M19 10h2M5.5 3.5l1.4 1.4M17.1 15.1l1.4 1.4M18.5 3.5l-1.4 1.4M6.9 15.1l-1.4 1.4" />
    </>
  ),
  'lightning lure': (
    <>
      <path d="M8 2L3 10h4l-1 8 7-9H9z" />
      <path d="M14 12h7M18 9l3 3-3 3" />
    </>
  ),
  'mage hand': (
    <>
      <path d="M7 13V8.5a1.3 1.3 0 0 1 2.6 0V11" />
      <path d="M9.6 11V7.5a1.3 1.3 0 0 1 2.6 0V11" />
      <path d="M12.2 11V8a1.3 1.3 0 0 1 2.6 0v3" />
      <path d="M14.8 11a1.3 1.3 0 0 1 2.6 0v4a5 5 0 0 1-5 5h-1.5a4.5 4.5 0 0 1-4.5-4.5" />
    </>
  ),
  'magic stone': (
    <>
      <circle cx="8" cy="15" r="3" />
      <circle cx="14.5" cy="10" r="3" />
      <circle cx="18" cy="16.5" r="2.6" />
    </>
  ),
  mending: (
    <>
      <path d="M8 4l2 3-3 2-3-2z" />
      <path d="M16 15l2 3-3 2-3-2z" />
      <path d="M11 9l3 3M8 12l4 4" opacity="0.7" />
    </>
  ),
  message: (
    <>
      <path d="M6 5h9a4 4 0 0 1 4 4v3a4 4 0 0 1-4 4H9l-4 4V9a4 4 0 0 1 1-4z" />
      <path d="M9 10h6M9 12.5h3" opacity="0.7" />
    </>
  ),
  'mind sliver': (
    <>
      <path d="M9 4a5 5 0 0 0-3 9v3h6v-3a5 5 0 0 0-3-9z" />
      <path d="M11 6l1 2h-2l1 2" />
      <path d="M18 3l3 3-3 3M16 12h6" opacity="0.7" />
    </>
  ),
  'minor illusion': (
    <>
      <path d="M4 7c2-1.6 4-2.2 8-2.2S18 5.4 20 7c-2 1.6-4 2.2-8 2.2S6 8.6 4 7z" />
      <path d="M5 7v3.5C5 13 8.2 15 12 15s7-2 7-4.5V7" />
      <circle cx="9.5" cy="10.5" r=".8" />
      <circle cx="14.5" cy="10.5" r=".8" />
    </>
  ),
  'mold earth': (
    <>
      <path d="M4 18h10l-2-5H6z" />
      <path d="M14 18v4M12 18l3-4" />
      <path d="M18 5v7M15.5 7L18 4.5 20.5 7" />
    </>
  ),
  'poison spray': (
    <>
      <path d="M5 9h8a3 3 0 0 1 0 6H9l-4 3z" opacity="0.0" />
      <path d="M6 10a5 5 0 0 0 5 6h3a4 4 0 0 0 4-4" />
      <circle cx="9" cy="13" r="1" />
      <circle cx="13" cy="15" r="1" />
      <circle cx="17" cy="12" r="1" />
      <path d="M6 10l-2-2M8 8V5" />
    </>
  ),
  prestidigitation: (
    <>
      <path d="M5 20L14 11" />
      <circle cx="15.5" cy="9.5" r="1.6" />
      <path d="M18 4l.7 1.6 1.6.7-1.6.7L18 8.6l-.7-1.6-1.6-.7 1.6-.7z" />
      <path d="M8 5l.6 1.4L10 7l-1.4.6L8 9l-.6-1.4L6 7l1.4-.6z" opacity="0.8" />
    </>
  ),
  'primal savagery': (
    <>
      <path d="M6 4c-1 4 0 9 5 14M11 4c-1 4 0 9 5 14M16 4c-1 4 0 9 5 14" />
      <path d="M12 3l1 2h-2z" opacity="0.7" />
    </>
  ),
  'produce flame': (
    <>
      <path d="M8 16c0-2 4-2.5 4-5 0 2.5 4 3 4 5" />
      <path d="M9 18h6l-1 3h-4z" />
      <path d="M12 3c.9 2 2.6 2.6 2.6 4.6A2.6 2.6 0 0 1 12 10a2.6 2.6 0 0 1-2.6-2.4C9.4 5.6 11.1 5 12 3z" />
    </>
  ),
  'ray of frost': (
    <>
      <circle cx="4" cy="20" r="2" />
      <path d="M6 18L18 6" />
      <path d="M20 4l-1.5 3.5L15 9l3.5 1.5L20 14l1.5-3.5" opacity="0.0" />
      <path d="M16 4v5M13.5 6.5l5 0M14.5 4.5l3 3M17.5 4.5l-3 3" />
    </>
  ),
  resistance: (
    <>
      <path d="M12 3l7 3v5c0 4.2-3 7-7 9-4-2-7-4.8-7-9V6z" />
      <path d="M12 8v6M9 11h6" />
    </>
  ),
  'sacred flame': (
    <>
      <path d="M12 2v5" />
      <path d="M12 7c1.4 2.6 4 3.4 4 6.4A4 4 0 0 1 12 18a4 4 0 0 1-4-4.6C8 10.4 10.6 9.6 12 7z" />
      <path d="M7 20h10" opacity="0.7" />
    </>
  ),
  'shape water': (
    <>
      <path d="M12 3s5 6 5 9.5A5 5 0 0 1 7 12.5C7 9 12 3 12 3z" />
      <path d="M5 20c2-1.5 4-1.5 6 0s4 1.5 6 0" opacity="0.7" />
    </>
  ),
  shillelagh: (
    <>
      <path d="M9 21l6-13" />
      <path d="M15 8c-1.5-2-1-4.5 1-5.5 2 1 2.5 3.5 1 5.5" />
      <path d="M13 11l3-1M11 15l3-1" opacity="0.7" />
    </>
  ),
  'shocking grasp': (
    <>
      <path d="M8 13V8a1.4 1.4 0 0 1 2.8 0v4M10.8 12V6.5a1.4 1.4 0 0 1 2.8 0V12" />
      <path d="M13.6 12v-2a1.4 1.4 0 0 1 2.8 0v4a5 5 0 0 1-5 5h-1.5" />
      <path d="M5 3l-2 5h3l-2 5" />
    </>
  ),
  'sorcerous burst': (
    <>
      <circle cx="12" cy="12" r="2.4" />
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l2.8 2.8M16.2 16.2L19 19M19 5l-2.8 2.8M7.8 16.2L5 19" />
    </>
  ),
  'spare the dying': (
    <>
      <path d="M12 20s-7-4.5-7-9.5A4 4 0 0 1 12 8a4 4 0 0 1 7 2.5" />
      <path d="M16 14v6M13 17h6" />
    </>
  ),
  'starry wisp': (
    <>
      <path d="M8 3l1.4 3.6L13 8l-3.6 1.4L8 13l-1.4-3.6L3 8l3.6-1.4z" />
      <path d="M16 13c3 0 5 1.6 5 3.5 0 1.4-1.2 2.5-2.8 2.5H14" />
      <circle cx="17.5" cy="10" r="1" />
    </>
  ),
  'sword burst': (
    <>
      <path d="M12 2v8M12 22v-8M2 12h8M22 12h-8" />
      <path d="M6 6l4 4M18 18l-4-4M18 6l-4 4M6 18l4-4" />
      <circle cx="12" cy="12" r="1.6" />
    </>
  ),
  thaumaturgy: (
    <>
      <path d="M4 10c2-2 5-2 7 0M13 10c2-2 5-2 7 0" />
      <circle cx="7.5" cy="11.5" r="1.4" />
      <circle cx="16.5" cy="11.5" r="1.4" />
      <path d="M12 3l1 2.5L12 8l-1-2.5zM8 16c3 2 5 2 8 0" opacity="0.8" />
    </>
  ),
  'thorn whip': (
    <>
      <path d="M3 4c6 3 8 8 6 13 4-1 7 1 9 4" />
      <path d="M9 9l-2 .5M11 13l-2 1M14 17l1-2M7 6l-.5 2" />
    </>
  ),
  thunderclap: (
    <>
      <path d="M12 4v3M12 17v3M4 12h3M17 12h3M6 6l2 2M16 16l2 2M18 6l-2 2M8 16l-2 2" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  'toll the dead': (
    <>
      <path d="M6 16a6 6 0 0 1 12 0z" />
      <path d="M4 16h16M12 6V4M12 16v1.5M9 21h6" />
    </>
  ),
  'true strike': (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="2" />
      <path d="M3 3l5 5M18 18l3 3M6 17l6-6" />
    </>
  ),
  'vicious mockery': (
    <>
      <path d="M4 8a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v3a4 4 0 0 1-4 4h-3l-5 4v-4H8a4 4 0 0 1-4-4z" />
      <path d="M8 10c1-1 2-1 3 0M14 10c1-1 2-1 3 0" opacity="0.8" />
      <path d="M8 13.5h8" />
    </>
  ),
  'word of radiance': (
    <>
      <path d="M12 2v3M12 8v3M5 5l2 2M17 17l2 2M19 5l-2 2" />
      <path d="M8 12h2v6H8a3 3 0 0 1 0-6zM14 12h2a3 3 0 0 1 0 6h-2z" />
      <path d="M9 19h6" opacity="0.7" />
    </>
  ),

  // ===== Круг 1 =====
  'absorb elements': (
    <>
      <path d="M12 3l7 3v5c0 4.2-3 7-7 9-4-2-7-4.8-7-9V6z" />
      <path d="M12 8v8M9 11h6" />
      <path d="M5 4l-2 4h3l-1 3" opacity="0.8" />
    </>
  ),
  alarm: (
    <>
      <path d="M12 3a6 6 0 0 1 6 6c0 4 1 5 2 6H4c1-1 2-2 2-6a6 6 0 0 1 6-6z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
      <path d="M2 5l2-2M22 5l-2-2" opacity="0.7" />
    </>
  ),
  'animal friendship': (
    <>
      <circle cx="12" cy="14" r="3.2" />
      <circle cx="6.5" cy="9.5" r="2" />
      <circle cx="10.5" cy="6" r="2" />
      <circle cx="14.5" cy="6" r="2" />
      <circle cx="18.5" cy="9.5" r="2" />
      <path d="M15 17l4-4" opacity="0.0" />
      <path d="M17 18l2-2 1 1.5-2 2z" opacity="0.8" />
    </>
  ),
  'armor of agathys': (
    <>
      <path d="M12 3l7 3v5.5c0 4-3 6.8-7 8.5-4-1.7-7-4.5-7-8.5V6z" />
      <path d="M12 7v3M12 13v.5M9 9.5l3 1 3-1M9 14l3-1 3 1" />
    </>
  ),
  'arms of hadar': (
    <>
      <path d="M12 20V9M8 20c0-4 1-7 4-11M16 20c0-4-1-7-4-11" />
      <path d="M5 12l-2-2M19 12l2-2M6 16l-2-1M18 16l2-1M9 8L7 6M15 8l2-2" />
    </>
  ),
  bane: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M9 10l2 2-2 2M15 10l-2 2 2 2" />
      <path d="M12 4v16" opacity="0.5" />
    </>
  ),
  'beast bond': (
    <>
      <circle cx="12" cy="15" r="2.6" />
      <circle cx="7" cy="11" r="1.6" />
      <circle cx="10" cy="8" r="1.6" />
      <circle cx="14" cy="8" r="1.6" />
      <circle cx="17" cy="11" r="1.6" />
      <path d="M5 20c3-2 11-2 14 0" opacity="0.7" />
    </>
  ),
  bless: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 6v12M9 9h6" />
      <path d="M4 4l1.5 1.5M20 4l-1.5 1.5" opacity="0.7" />
    </>
  ),
  'burning hands': (
    <>
      <path d="M6 15V8.5a1.5 1.5 0 0 1 3 0M9 15V7a1.5 1.5 0 0 1 3 0M12 15V7a1.5 1.5 0 0 1 3 0M15 15V9a1.5 1.5 0 0 1 3 0v5" />
      <path d="M6 16c3 4 9 4 12 0M9 4c1 1.4 2 2 2 3.2M13 3c1 1.6 2.4 2.2 2.4 4" opacity="0.8" />
    </>
  ),
  catapult: (
    <>
      <path d="M4 20l8-8" />
      <path d="M4 20h6M12 12l4-4" />
      <circle cx="17" cy="7" r="2.5" />
      <path d="M6 14l-2-2" opacity="0.7" />
    </>
  ),
  'cause fear': (
    <>
      <path d="M12 3a7 7 0 0 0-7 7c0 3 1.8 4.6 3 5.5V19h8v-3.5c1.2-.9 3-2.5 3-5.5a7 7 0 0 0-7-7z" />
      <circle cx="9.5" cy="11" r="1.3" />
      <circle cx="14.5" cy="11" r="1.3" />
      <path d="M4 4l-2-1M20 4l2-1" />
    </>
  ),
  ceremony: (
    <>
      <path d="M5 20V9a7 7 0 0 1 14 0v11" />
      <path d="M3 20h18M12 5V2M9 3h6" opacity="0.8" />
    </>
  ),
  'chaos bolt': (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l2.5 2.5M16.5 16.5L19 19M19 5l-2.5 2.5M7.5 16.5L5 19" />
      <path d="M12 9l1.2 1.8L15 12l-1.8 1.2L12 15l-1.2-1.8L9 12l1.8-1z" opacity="0.6" />
    </>
  ),
  'charm person': (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20a6 6 0 0 1 10-4.5" />
      <path d="M18 12s3 2.6 3 4.6a3 3 0 0 1-6 0c0-2 3-4.6 3-4.6z" />
    </>
  ),
  'chromatic orb': (
    <>
      <circle cx="12" cy="12" r="5" />
      <path d="M12 7a5 5 0 0 1 0 10M12 9.5a2.5 2.5 0 0 1 0 5" opacity="0.7" />
      <circle cx="12" cy="12" r="1.4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2" opacity="0.6" />
    </>
  ),
  'color spray': (
    <>
      <path d="M4 20l7-7" />
      <path d="M11 13l3-6 1.5 2.5L18 8l-1 3 3 .5-2.5 2" />
      <path d="M6 16l-2 2M14 5l-1-2M20 14l2-1" opacity="0.8" />
    </>
  ),
  command: (
    <>
      <circle cx="12" cy="7" r="3" />
      <path d="M12 10v7M8 14l4 3 4-3" />
      <path d="M7 20h10" />
      <path d="M16 4l2 -1M16 8l2 1" opacity="0.7" />
    </>
  ),
  'compelled duel': (
    <>
      <path d="M5 18l4-4M9 14l4-4M13 10l4-4" opacity="0.6" />
      <path d="M8 5l2 3v5H8zM7 13h4M9.5 13v5" />
      <path d="M16 5l2 3v5h-2zM15 13h4M17.5 13v5" />
    </>
  ),
  'comprehend languages': (
    <>
      <path d="M4 6h12M10 6v2c0 5-3 9-6 10M7 10c1.5 3 4 6 7 7" />
      <path d="M15 8h5l-2 3 2 3h-5z" opacity="0.8" />
    </>
  ),
  'create or destroy water': (
    <>
      <path d="M8 3s4 5 4 8a4 4 0 0 1-8 0c0-3 4-8 4-8z" />
      <path d="M16 8v6M13 11h6" />
    </>
  ),
  'cure wounds': (
    <>
      <path d="M12 20s-6-4-6-9a3.5 3.5 0 0 1 6-2.4A3.5 3.5 0 0 1 18 11" />
      <path d="M17 14v6M14 17h6" />
    </>
  ),
  'detect evil and good': (
    <>
      <path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12z" />
      <circle cx="12" cy="12" r="2.4" />
      <path d="M12 4l1 2-2 0z" opacity="0.8" />
    </>
  ),
  'detect magic': (
    <>
      <path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12z" />
      <circle cx="12" cy="12" r="2.4" />
      <path d="M18 3l.7 1.6L20 5.3l-1.3.7L18 7.6l-.7-1.6L16 5.3l1.3-.7z" />
    </>
  ),
  'detect poison and disease': (
    <>
      <path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12z" />
      <circle cx="12" cy="12" r="2.4" />
      <path d="M17 4s2 2.4 2 3.6a2 2 0 0 1-4 0C15 6.4 17 4 17 4z" />
    </>
  ),
  'disguise self': (
    <>
      <path d="M4 8c2-2 5-3 8-3s6 1 8 3c-2 2.5-5 4-8 4s-6-1.5-8-4z" />
      <path d="M6 17c2 1.6 4 2.4 6 2.4s4-.8 6-2.4" />
      <circle cx="9.5" cy="8.5" r="1" />
      <circle cx="14.5" cy="8.5" r="1" />
    </>
  ),
  'dissonant whispers': (
    <>
      <path d="M5 9a7 7 0 0 1 0 6M8 6a11 11 0 0 1 0 12M11 4a14 14 0 0 1 0 16" opacity="0.8" />
      <path d="M15 8l4-3v6zM15 14l4-3v6z" />
    </>
  ),
  'divine favor': (
    <>
      <path d="M12 13l1.8 2.5L18 14l-1.5 3.5L20 20H4l3.5-2.5L6 14l4.2 1.5z" />
      <path d="M12 2v6M10 4h4" opacity="0.8" />
    </>
  ),
  'divine smite': (
    <>
      <path d="M12 2l2 4v7h-4V6z" />
      <path d="M8 13h8M11 13v5h2v-5" />
      <path d="M12 20v2M5 19l1-1M19 19l-1-1" />
      <path d="M12 1l1 2.5L12 6l-1-2.5z" opacity="0.8" />
    </>
  ),
  'earth tremor': (
    <>
      <path d="M3 20h18" />
      <path d="M6 20c0-2 2-2 2-4M12 20c0-3 3-3 3-6M18 20c0-1.5 1.5-1.5 1.5-3.5" />
      <path d="M4 13l3-3 3 2 4-4 3 3 3-4" opacity="0.7" />
    </>
  ),
  'ensnaring strike': (
    <>
      <path d="M4 4c6 2 8 7 7 13" />
      <path d="M11 17l-3 1M8 12l-3 1M6 8l-3 1" />
      <path d="M15 5l4 4-4 4" opacity="0.0" />
      <path d="M16 6l4 4M20 6l-4 4" opacity="0.8" />
    </>
  ),
  entangle: (
    <>
      <path d="M4 21c3-3 5-3 8-1 3-2 5-2 8 1" />
      <path d="M6 18c0-4 2-7 5-9M18 18c0-4-2-7-5-9M12 9V3" />
      <path d="M12 6l-2-2M12 6l2-2" opacity="0.7" />
    </>
  ),
  'expeditious retreat': (
    <>
      <path d="M9 21V5l3-2 3 2v16" />
      <path d="M6 21h12" />
      <path d="M4 10h4M4 14h4M16 10h4M16 14h4" opacity="0.7" />
    </>
  ),
  'faerie fire': (
    <>
      <circle cx="8" cy="7" r="1.6" />
      <circle cx="16" cy="6" r="1.4" />
      <circle cx="12" cy="11" r="1.8" />
      <path d="M5 13c2 4 5 6 7 6s5-2 7-6" />
      <path d="M12 3l.8 1.8L14.5 5.5l-1.7.8L12 8l-.8-1.7L9.5 5.5l1.7-.7z" opacity="0.7" />
    </>
  ),
  'false life': (
    <>
      <path d="M12 20s-6-4-6-9a3.5 3.5 0 0 1 6-2.4A3.5 3.5 0 0 1 18 11" />
      <path d="M17 13l2.5 3.5L17 20l-2.5-3.5z" opacity="0.8" />
    </>
  ),
  'feather fall': (
    <>
      <path d="M18 3c-6 0-10 4-11 10l-2 5" />
      <path d="M7 13h8M9 9h6M12 5v6" opacity="0.8" />
    </>
  ),
  'find familiar': (
    <>
      <circle cx="12" cy="14" r="3.4" />
      <path d="M9.5 11l-1.5-4 3 2M14.5 11l1.5-4-3 2" />
      <circle cx="10.5" cy="13.5" r=".8" />
      <circle cx="13.5" cy="13.5" r=".8" />
      <path d="M6 20c3-1.6 9-1.6 12 0" opacity="0.7" />
    </>
  ),
  'fog cloud': (
    <>
      <path d="M6 15a3.5 3.5 0 0 1 .3-7A5 5 0 0 1 16 8.5a3.5 3.5 0 0 1 .7 6.5" />
      <path d="M5 18c2-1 4-1 6 0s4 1 6 0M7 21c1.5-.8 3-.8 4.5 0" opacity="0.8" />
    </>
  ),
  goodberry: (
    <>
      <path d="M12 21c0-5 0-9 0-12" />
      <path d="M12 12c-3 0-5-2-5-5 3 0 5 2 5 5zM12 14c3 0 5-2 5-5-3 0-5 2-5 5z" />
      <circle cx="12" cy="19" r="2" />
    </>
  ),
  grease: (
    <>
      <path d="M4 16c4-3 12-3 16 0" />
      <path d="M4 20c4-3 12-3 16 0" />
      <circle cx="8" cy="10" r="1.4" />
      <circle cx="14" cy="7" r="1.4" />
      <circle cx="18" cy="11" r="1.2" />
    </>
  ),
  'guiding bolt': (
    <>
      <path d="M12 2v18" />
      <path d="M8 6l4-4 4 4" />
      <path d="M8 22l4-4 4 4" opacity="0.8" />
      <circle cx="12" cy="14" r="2" />
    </>
  ),
  'hail of thorns': (
    <>
      <path d="M4 4c6 2 8 7 7 13" />
      <path d="M11 17l-3 1M8 12l-3 1M6 8l-3 1" />
      <path d="M16 5l1 2 2 1-2 1-1 2-1-2-2-1 2-1zM19 13l.7 1.4 1.4.7-1.4.7L19 17l-.7-1.2-1.4-.7 1.4-.7z" opacity="0.8" />
    </>
  ),
  'healing word': (
    <>
      <path d="M6 10h3v-3h6v3h3v6h-3v3H9v-3H6z" opacity="0.0" />
      <path d="M12 6v12M6 12h12" />
      <path d="M17 6a5 5 0 0 1 3 3M18 17a5 5 0 0 1-3 3" opacity="0.7" />
    </>
  ),
  'hellish rebuke': (
    <>
      <path d="M12 3c1.4 3 4.6 4 4.6 7.4A4.6 4.6 0 0 1 12 15a4.6 4.6 0 0 1-4.6-4.6C7.4 7 10.6 6 12 3z" />
      <path d="M5 18c2 1.5 4.6 2 7 2s5-.5 7-2" />
      <path d="M9 20l-1 2M15 20l1 2" opacity="0.8" />
    </>
  ),
  heroism: (
    <>
      <path d="M12 3l7 3v5c0 4.2-3 7-7 9-4-2-7-4.8-7-9V6z" />
      <path d="M12 8l1.4 3 3.1-.9-1.6 2.8 2.6 1.6-3.2.4.6 3-2.9-1.6-2.9 1.6.6-3-3.2-.4 2.6-1.6L7.5 10l3.1.9z" opacity="0.75" />
    </>
  ),
  hex: (
    <>
      <path d="M12 3a7 7 0 0 0-7 7c0 3 1.8 4.6 3 5.5V19h8v-3.5c1.2-.9 3-2.5 3-5.5a7 7 0 0 0-7-7z" />
      <path d="M9 12h6M12 9v6" opacity="0.8" />
      <path d="M3 3l3 1-1 3" opacity="0.7" />
    </>
  ),
  "hunter's mark": (
    <>
      <path d="M12 3a6 6 0 1 0 6 6" />
      <path d="M12 6v3M10.5 7.5h3" />
      <path d="M12 15v6M9 21l3-2 3 2" />
      <path d="M18 3l2 2M21 8h-2" opacity="0.7" />
    </>
  ),
  'ice knife': (
    <>
      <path d="M12 2l2 5v6h-4V7z" />
      <path d="M9 13h6M11 13v5h2v-5" />
      <path d="M4 4l1.5 1.5M20 4l-1.5 1.5M4 9h2M18 9h2" opacity="0.8" />
    </>
  ),
  identify: (
    <>
      <circle cx="10" cy="10" r="6" />
      <path d="M15 15l5 5" />
      <path d="M10 7v6M7 10h6" />
    </>
  ),
  'illusory script': (
    <>
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M15 3v4h4" />
      <path d="M9 12h7M9 15h7M9 18h4" />
      <path d="M12 6l1 2-2 0z" opacity="0.8" />
    </>
  ),
  'inflict wounds': (
    <>
      <path d="M8 13V7.5a1.4 1.4 0 0 1 2.8 0V11M10.8 11V6.5a1.4 1.4 0 0 1 2.8 0V11" />
      <path d="M13.6 11V7.5a1.4 1.4 0 0 1 2.8 0V13a5 5 0 0 1-5 5h-1.5" />
      <path d="M5 8l-2-2M5 12H2M8 4L6 2" opacity="0.8" />
    </>
  ),
  jump: (
    <>
      <path d="M6 20c0-6 3-9 6-9s6 3 6 9" />
      <path d="M12 11V3M9.5 5.5L12 3l2.5 2.5" />
    </>
  ),
  longstrider: (
    <>
      <path d="M8 21l2-8-2-4 4-2 3 3-2 3 3 2" />
      <path d="M12 3h6M15 6h3M14 9h4" opacity="0.7" />
    </>
  ),
  'mage armor': (
    <>
      <path d="M12 3l6 2.5V11c0 4-2.6 6.6-6 8-3.4-1.4-6-4-6-8V5.5z" />
      <path d="M9 9l3 2 3-2M9 13l3 2 3-2" opacity="0.7" />
    </>
  ),
  'magic missile': (
    <>
      <circle cx="5" cy="19" r="2" />
      <path d="M7 17l8-8" />
      <circle cx="12" cy="8" r="1.4" />
      <circle cx="15" cy="5.5" r="1.2" />
      <circle cx="18" cy="3.5" r="1" />
    </>
  ),
  'protection from evil and good': (
    <>
      <path d="M12 3l7 3v5c0 4.2-3 7-7 9-4-2-7-4.8-7-9V6z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  'purify food and drink': (
    <>
      <path d="M6 10h12l-1.5 10h-9z" />
      <path d="M9 10V6a3 3 0 0 1 6 0v4" />
      <path d="M12 14v3M10.5 15.5h3" opacity="0.8" />
    </>
  ),
  'ray of sickness': (
    <>
      <circle cx="4" cy="20" r="2" />
      <path d="M6 18L16 8" />
      <path d="M18 4s3 3 3 5a3 3 0 0 1-6 0c0-2 3-5 3-5z" />
    </>
  ),
  sanctuary: (
    <>
      <path d="M12 3l7 3v5c0 4.2-3 7-7 9-4-2-7-4.8-7-9V6z" />
      <circle cx="12" cy="11" r="2.4" />
      <path d="M12 2v2M4 4l1.5 1.5M20 4l-1.5 1.5" opacity="0.7" />
    </>
  ),
  'searing smite': (
    <>
      <path d="M12 3l2 3.5v7h-4v-7z" />
      <path d="M8 13h8M11 13v5h2v-5" />
      <path d="M5 5c1 1.8 2.6 2.6 2.6 4.6M8 3c1 2 3 2.8 3 5" opacity="0.8" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3l7 3v5c0 4.2-3 7-7 9-4-2-7-4.8-7-9V6z" />
      <path d="M9 11l2 2 4-4" opacity="0.0" />
      <circle cx="12" cy="11" r="1.6" opacity="0.8" />
    </>
  ),
  'shield of faith': (
    <>
      <path d="M12 3l7 3v5c0 4.2-3 7-7 9-4-2-7-4.8-7-9V6z" />
      <path d="M12 7v8M9.5 9.5L12 7l2.5 2.5" />
      <path d="M12 1.5l1 2.5-1 2-1-2z" opacity="0.8" />
    </>
  ),
  'silent image': (
    <>
      <path d="M4 6c2-1.5 4-2 8-2s6 .5 8 2c-2 1.6-4 2.2-8 2.2S6 7.6 4 6z" />
      <path d="M4 6v6c0 3 3.6 5.2 8 5.2S20 15 20 12V6" />
      <path d="M9 22l3-2 3 2" opacity="0.0" />
      <path d="M10 11h4" opacity="0.6" />
    </>
  ),
  sleep: (
    <>
      <path d="M13 4h6l-6 7h6" />
      <path d="M6 10h4l-4 5h4" opacity="0.8" />
      <path d="M9 16h3l-3 4h3" opacity="0.6" />
    </>
  ),
  snare: (
    <>
      <path d="M12 3v18" />
      <path d="M12 6l-3 3 3 3 3-3z" />
      <path d="M4 20h16" />
      <path d="M12 6V3" opacity="0.7" />
    </>
  ),
  'speak with animals': (
    <>
      <path d="M4 6h11v7a3 3 0 0 1-3 3H8l-4 3z" />
      <path d="M9 10h4" opacity="0.7" />
      <circle cx="18" cy="14" r="1.6" />
      <path d="M16 12l-1-2 2 1M20 12l1-2-2 1" opacity="0.8" />
    </>
  ),
  "tasha's caustic brew": (
    <>
      <path d="M8 3h8v4l1 12a3 3 0 0 1-3 3h-4a3 3 0 0 1-3-3z" />
      <path d="M9 12h6M10 16h4" />
      <path d="M8 7h8" opacity="0.7" />
    </>
  ),
  "tasha's hideous laughter": (
    <>
      <path d="M4 8a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v3a4 4 0 0 1-4 4h-2v3l-4-3H8a4 4 0 0 1-4-4z" />
      <path d="M8 9c1 1.2 2 1.2 3 0M13 9c1 1.2 2 1.2 3 0" opacity="0.9" />
      <path d="M8 13c2 1.6 6 1.6 8 0" />
    </>
  ),
  "tenser's floating disk": (
    <>
      <ellipse cx="12" cy="16" rx="8" ry="3" />
      <path d="M4 14c0-3 3-5 8-5s8 2 8 5" opacity="0.0" />
      <path d="M6 8c2-2 10-2 12 0" opacity="0.6" />
      <path d="M9 5c1.5-1 4.5-1 6 0" opacity="0.4" />
    </>
  ),
  'thunderous smite': (
    <>
      <path d="M12 3l2 3.5v7h-4v-7z" />
      <path d="M8 13h8M11 13v5h2v-5" />
      <path d="M4 4c1.5 1.5 2 3 2 5M20 4c-1.5 1.5-2 3-2 5M4 10c1 1 1.5 2 1.5 3.5M20 10c-1 1-1.5 2-1.5 3.5" opacity="0.8" />
    </>
  ),
  thunderwave: (
    <>
      <path d="M12 8a4 4 0 0 1 0 8M12 5a7 7 0 0 1 0 14M12 2a10 10 0 0 1 0 20" opacity="0.8" />
      <circle cx="12" cy="12" r="1.4" />
    </>
  ),
  'unseen servant': (
    <>
      <path d="M6 6c2-2 10-2 12 0" opacity="0.0" />
      <path d="M8 10c0-1.5 8-1.5 8 0v4c0 1.5-8 1.5-8 0z" opacity="0.0" />
      <circle cx="12" cy="8" r="3" opacity="0.6" />
      <path d="M12 11v5M8 16h8M6 20h12" opacity="0.7" />
      <path d="M9 5c0-1 6-1 6 0" opacity="0.4" />
    </>
  ),
  'witch bolt': (
    <>
      <path d="M4 4l5 2-2 4 6 1-4 5 6 2" opacity="0.0" />
      <path d="M13 2L7 11h4l-1 8 6-9h-4z" />
      <path d="M5 19c1.5-1 3-1 4.5 0" opacity="0.7" />
    </>
  ),
  'wrathful smite': (
    <>
      <path d="M12 3l2 3.5v7h-4v-7z" />
      <path d="M8 13h8M11 13v5h2v-5" />
      <path d="M5 4a4 4 0 0 1 3-2M19 4a4 4 0 0 0-3-2" opacity="0.8" />
      <path d="M9 19h6" opacity="0.6" />
    </>
  ),
  'zephyr strike': (
    <>
      <path d="M12 3l2 4v7h-4V7z" />
      <path d="M8 14h8M11 14v6h2v-6" />
      <path d="M3 6h6M2 9h5M4 12h5" opacity="0.8" />
    </>
  ),
};
