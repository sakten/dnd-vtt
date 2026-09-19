import type { BestiaryEntry } from '../domain/bestiary';
import { damageTypeColor } from '../labels';
import { creatureArt, creatureFeatures, creatureTint } from './creatureArt';

/**
 * Процедурная иконка существа (до нормальных портретов): схематичный силуэт
 * по имени (см. `creatureArt.ts`), акцентный цвет — от защиты/урона, метка
 * типа — бейдж в правом верхнем углу. Детерминированно для одного ключа.
 */

const GLOW = '#f4f7fc';
const DARK = '#171b22';
const BG = '#20252e';
const DEFAULT_ACCENT = '#8fb7ff';
const LEGENDARY_RING = '#ffd98a';
const VIEW = 96;

function mix(hex: string, other: string, t: number): string {
  const parse = (value: string) => [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16));
  const [r1, g1, b1] = parse(hex);
  const [r2, g2, b2] = parse(other);
  const channel = (a: number, b: number) => Math.round(a + (b - a) * t).toString(16).padStart(2, '0');
  return `#${channel(r1!, r2!)}${channel(g1!, g2!)}${channel(b1!, b2!)}`;
}

/** Глифы типов (0..64) — бейдж в углу иконки. */
const TYPE_GLYPHS: Record<string, string> = {
  beast:
    '<ellipse cx="32" cy="41" rx="12" ry="10"/><circle cx="18" cy="28" r="5"/><circle cx="27" cy="21" r="5"/><circle cx="38" cy="21" r="5"/><circle cx="47" cy="28" r="5"/>',
  dragon:
    '<path d="M10 38 L28 20 L46 24 L58 34 L46 40 L42 50 L32 46 L22 50 Z"/><path d="M28 20 L23 6 L34 18 Z"/><path d="M46 24 L52 10 L42 20 Z"/><circle cx="45" cy="31" r="2.4" fill="' +
    DARK +
    '"/>',
  undead:
    '<path d="M32 10 C19 10 12 19 12 30 C12 37 15 42 20 45 L20 52 L26 52 L26 56 L38 56 L38 52 L44 52 L44 45 C49 42 52 37 52 30 C52 19 45 10 32 10 Z"/><circle cx="23" cy="30" r="4.2" fill="' +
    DARK +
    '"/><circle cx="41" cy="30" r="4.2" fill="' +
    DARK +
    '"/><rect x="30" y="38" width="4" height="6" fill="' +
    DARK +
    '"/>',
  fiend:
    '<path d="M19 15 C11 11 7 5 9 2 C15 5 20 10 23 14 Z"/><path d="M45 15 C53 11 57 5 55 2 C49 5 44 10 41 14 Z"/><path d="M32 14 C22 14 16 21 16 30 C16 36 18 40 22 42 L22 48 L27 48 L27 52 L37 52 L37 48 L42 48 L42 42 C46 40 48 36 48 30 C48 21 42 14 32 14 Z"/><circle cx="25" cy="30" r="3.6" fill="' +
    DARK +
    '"/><circle cx="39" cy="30" r="3.6" fill="' +
    DARK +
    '"/>',
  celestial:
    '<ellipse cx="32" cy="32" rx="7" ry="10"/><path d="M25 28 C16 22 8 24 4 32 C12 32 18 34 25 38 Z"/><path d="M39 28 C48 22 56 24 60 32 C52 32 46 34 39 38 Z"/><circle cx="32" cy="13" r="5.5" fill="none" stroke="' +
    GLOW +
    '" stroke-width="3"/>',
  fey:
    '<ellipse cx="20" cy="24" rx="12" ry="9" transform="rotate(-24 20 24)"/><ellipse cx="44" cy="24" rx="12" ry="9" transform="rotate(24 44 24)"/><ellipse cx="22" cy="43" rx="9" ry="7" transform="rotate(24 22 43)"/><ellipse cx="42" cy="43" rx="9" ry="7" transform="rotate(-24 42 43)"/><rect x="30" y="16" width="4" height="34" rx="2"/>',
  aberration:
    '<ellipse cx="32" cy="26" rx="19" ry="12"/><circle cx="32" cy="26" r="6" fill="' +
    DARK +
    '"/><path d="M22 38 C18 46 22 50 18 56" fill="none" stroke="' +
    GLOW +
    '" stroke-width="3" stroke-linecap="round"/><path d="M42 38 C46 46 42 50 46 56" fill="none" stroke="' +
    GLOW +
    '" stroke-width="3" stroke-linecap="round"/>',
  construct:
    '<circle cx="32" cy="32" r="13"/><circle cx="32" cy="32" r="5.5" fill="' +
    DARK +
    '"/>' +
    [0, 45, 90, 135, 180, 225, 270, 315]
      .map((angle) => `<rect x="29" y="11" width="6" height="9" rx="2" transform="rotate(${angle} 32 32)"/>`)
      .join(''),
  elemental:
    '<path d="M32 6 C40 20 49 26 49 38 C49 49 41 57 32 57 C23 57 15 49 15 38 C15 30 21 23 26 16 C27 23 29 26 32 29 C35 22 33 13 32 6 Z"/><path d="M32 31 C36 36 40 39 40 44 C40 49 36 52 32 52 C28 52 24 49 24 44 C24 40 28 36 32 31 Z" fill="' +
    DARK +
    '"/>',
  ooze:
    '<path d="M10 40 C10 27 19 19 32 19 C45 19 54 27 54 40 C54 47 49 53 41 54 L39 60 L34 54 L30 60 L28 54 C17 53 10 47 10 40 Z"/><circle cx="26" cy="38" r="3.5" fill="' +
    DARK +
    '"/><circle cx="38" cy="38" r="3.5" fill="' +
    DARK +
    '"/>',
  plant:
    '<rect x="30" y="20" width="4" height="36" rx="2"/><path d="M32 32 C20 32 11 25 9 12 C23 12 32 19 32 32 Z"/><path d="M32 40 C44 40 53 33 55 20 C41 20 32 27 32 40 Z"/>',
  humanoid:
    '<circle cx="32" cy="21" r="10"/><path d="M11 56 C11 42 20 35 32 35 C44 35 53 42 53 56 Z"/>',
  giant:
    '<circle cx="27" cy="19" r="9"/><path d="M8 56 C8 40 17 33 27 33 C38 33 46 40 46 56 Z"/><rect x="47" y="6" width="13" height="7" rx="3" transform="rotate(38 53 10)"/><rect x="44" y="14" width="5" height="26" rx="2" transform="rotate(30 46 27)"/>',
  monstrosity:
    '<path d="M18 6 C24 20 24 40 18 58" fill="none" stroke="' +
    GLOW +
    '" stroke-width="7" stroke-linecap="round"/><path d="M32 4 C39 20 39 42 32 60" fill="none" stroke="' +
    GLOW +
    '" stroke-width="7" stroke-linecap="round"/><path d="M46 6 C52 20 52 40 46 58" fill="none" stroke="' +
    GLOW +
    '" stroke-width="7" stroke-linecap="round"/>',
  swarm:
    '<circle cx="18" cy="18" r="4"/><circle cx="32" cy="14" r="3.5"/><circle cx="46" cy="20" r="4"/><circle cx="22" cy="32" r="3.5"/><circle cx="36" cy="30" r="4"/><circle cx="50" cy="34" r="3"/><circle cx="18" cy="46" r="3.5"/><circle cx="32" cy="44" r="4"/><circle cx="46" cy="48" r="3.5"/>',
};

const DEFAULT_GLYPH = '<path d="M32 8 L52 18 L52 34 C52 46 43 54 32 58 C21 54 12 46 12 34 L12 18 Z"/>';

/** Стабильный сид ключа: микро-наклон и масштаб, чтобы иконки не совпадали. */
function seedOf(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function badgeGlyph(type: string): string {
  const base = type.split('/')[0]!.trim().toLowerCase();
  return TYPE_GLYPHS[base] ?? DEFAULT_GLYPH;
}

function accentFor(entry: BestiaryEntry): string {
  const type =
    entry.immunities[0] ??
    entry.resistances[0] ??
    entry.attacks.find((attack) => attack.damageType)?.damageType ??
    (entry.spellcasting ? 'force' : undefined);
  return damageTypeColor(type) ?? DEFAULT_ACCENT;
}

/** SVG-иконка существа (96×96): силуэт по имени + бейдж типа в правом верхнем углу. */
export function bestiaryIconSvg(entry: BestiaryEntry): string {
  const accent = creatureTint(entry, accentFor(entry));
  const fill = mix(GLOW, accent, 0.12);
  const outline = mix(accent, DARK, 0.3);
  const sizeScale = entry.size === 'T' || entry.size === 'S' ? 0.92 : entry.size === 'H' || entry.size === 'G' ? 1.04 : 1;
  const seed = seedOf(entry.key);
  const tilt = ((seed % 401) - 200) / 100;
  const micro = 1 + (Math.floor(seed / 512) % 401 - 200) / 1000;
  const scale = (sizeScale * micro).toFixed(4);
  const features = creatureFeatures(entry, fill, DARK, accent);

  const badge =
    `<g transform="translate(70 2)"><circle cx="12" cy="12" r="12.5" fill="${DARK}" opacity="0.92"/>` +
    `<circle cx="12" cy="12" r="12.5" fill="none" stroke="${accent}" stroke-width="1.6" opacity="0.9"/>` +
    `<g transform="translate(1.6 1.6) scale(0.325)" fill="${GLOW}">${badgeGlyph(entry.type)}</g></g>`;

  const ring = entry.legendaryMax
    ? `<circle cx="48" cy="48" r="45.5" fill="none" stroke="${LEGENDARY_RING}" stroke-width="2.5" opacity="0.9"/>`
    : '';

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW} ${VIEW}" width="${VIEW}" height="${VIEW}" role="img">` +
    `<defs><radialGradient id="bg" cx="50%" cy="36%" r="74%">` +
    `<stop offset="0%" stop-color="${accent}" stop-opacity="0.4"/>` +
    `<stop offset="100%" stop-color="${BG}" stop-opacity="1"/>` +
    '</radialGradient></defs>' +
    `<rect x="1.5" y="1.5" width="93" height="93" rx="20" fill="${DARK}"/>` +
    '<rect x="1.5" y="1.5" width="93" height="93" rx="20" fill="url(#bg)"/>' +
    `<g fill="${fill}" stroke="${outline}" stroke-width="1.4" stroke-linejoin="round" transform="rotate(${tilt} 48 47) translate(48 47) scale(${scale}) translate(-48 -47)">` +
    features.behind +
    creatureArt(entry, fill, DARK, accent) +
    features.front +
    '</g>' +
    `<rect x="1.5" y="1.5" width="93" height="93" rx="20" fill="none" stroke="${accent}" stroke-width="2.5" opacity="0.85"/>` +
    badge +
    ring +
    '</svg>'
  );
}

/** Data-URL иконки — годится и для `imageUrl` выставляемого токена. */
export function bestiaryIconUrl(entry: BestiaryEntry): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(bestiaryIconSvg(entry))}`;
}
