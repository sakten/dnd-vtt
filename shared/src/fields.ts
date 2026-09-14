import { clampCells, statsPaired } from './domain/core';
import type { LibraryItem, Token, TokenFields } from './domain/token';
import { normalizeAttacks, normalizeDamageDefenses } from './normalize/attacks';

/**
 * Реестр полей токена/предмета библиотеки — единственное место, где описано,
 * как поле нормализуется (полностью и в patch), и какие поля скрываются от игроков.
 * Новое поле добавляется здесь + в `TokenFields`; типы заставляют заполнить запись.
 */

const trim = (value: unknown, limit: number): string =>
  typeof value === 'string' ? (limit > 0 ? value.slice(0, limit) : value) : '';

type FieldValue = TokenFields[keyof TokenFields];

interface NormalizeOpts {
  /** Лимит имени: 40 — токен, 60 — предмет библиотеки. */
  nameLimit: number;
  /** Не требовать пару AC+hpMax (данные с диска старых версий). */
  keepAcHp: boolean;
}

interface FieldSpec {
  /** Полная нормализация значения (создание/гидратация). */
  full: (raw: Partial<TokenFields>, opts: NormalizeOpts) => FieldValue;
  /** Patch: `undefined` — поле не прислано или недоступно. */
  patch: (
    raw: Partial<TokenFields>,
    prev: Pick<TokenFields, 'ac' | 'hpMax'>,
    includeDm: boolean
  ) => FieldValue | undefined;
  /** Заглушки для скрытия от игроков (AC/HP/атаки/защиты); нет — поле видно всегда. */
  hidden?: { token?: FieldValue; library?: FieldValue };
}

export const TOKEN_FIELD_SPECS: Record<keyof TokenFields, FieldSpec> = {
  name: {
    full: (raw, opts) => trim(raw.name, opts.nameLimit),
    patch: (raw) => (typeof raw.name === 'string' ? raw.name.slice(0, 40) : undefined),
  },
  description: {
    full: (raw) => trim(raw.description, 200),
    patch: (raw) => (typeof raw.description === 'string' ? raw.description.slice(0, 200) : undefined),
  },
  imageUrl: {
    full: (raw) => trim(raw.imageUrl, 0),
    // Картинка загружается отдельным событием и в patch не приходит.
    patch: () => undefined,
  },
  cells: {
    full: (raw) => clampCells(typeof raw.cells === 'number' ? raw.cells : 1),
    patch: (raw) =>
      typeof raw.cells === 'number' && Number.isFinite(raw.cells) ? clampCells(raw.cells) : undefined,
  },
  round: {
    full: (raw) => raw.round === true,
    patch: (raw) => (typeof raw.round === 'boolean' ? raw.round : undefined),
  },
  initiativeBonus: {
    full: (raw) => trim(raw.initiativeBonus, 10),
    patch: (raw) => (typeof raw.initiativeBonus === 'string' ? raw.initiativeBonus.slice(0, 10) : undefined),
  },
  isPlayerToken: {
    full: (raw) => raw.isPlayerToken === true,
    patch: (raw, _prev, includeDm) =>
      includeDm && typeof raw.isPlayerToken === 'boolean' ? raw.isPlayerToken : undefined,
  },
  owner: {
    full: (raw) => trim(raw.owner, 40),
    patch: (raw, _prev, includeDm) => (includeDm && typeof raw.owner === 'string' ? raw.owner.slice(0, 40) : undefined),
  },
  attacks: {
    full: (raw) => normalizeAttacks(raw.attacks),
    patch: (raw) => (Array.isArray(raw.attacks) ? normalizeAttacks(raw.attacks) : undefined),
    // У токена атаки нужны панели действий; в библиотеке игрокам их не показываем.
    hidden: { library: [] },
  },
  ac: {
    full: (raw, opts) => {
      const ac = trim(raw.ac, 10);
      return !opts.keepAcHp && !statsPaired(ac, trim(raw.hpMax, 10)) ? '' : ac;
    },
    patch: (raw, prev) => {
      if (typeof raw.ac !== 'string') return undefined;
      const ac = raw.ac.slice(0, 10);
      const hpMax = typeof raw.hpMax === 'string' ? raw.hpMax.slice(0, 10) : prev.hpMax;
      return statsPaired(ac, hpMax) ? ac : undefined;
    },
    hidden: { token: '', library: '' },
  },
  hpMax: {
    full: (raw, opts) => {
      const hpMax = trim(raw.hpMax, 10);
      return !opts.keepAcHp && !statsPaired(trim(raw.ac, 10), hpMax) ? '' : hpMax;
    },
    patch: (raw, prev) => {
      if (typeof raw.hpMax !== 'string') return undefined;
      const hpMax = raw.hpMax.slice(0, 10);
      const ac = typeof raw.ac === 'string' ? raw.ac.slice(0, 10) : prev.ac;
      return statsPaired(ac, hpMax) ? hpMax : undefined;
    },
    hidden: { token: '', library: '' },
  },
  showStats: {
    full: (raw) => raw.showStats === true,
    patch: (raw, _prev, includeDm) => (includeDm && typeof raw.showStats === 'boolean' ? raw.showStats : undefined),
  },
  damageDefenses: {
    full: (raw) => normalizeDamageDefenses(raw.damageDefenses),
    patch: (raw) => (Array.isArray(raw.damageDefenses) ? normalizeDamageDefenses(raw.damageDefenses) : undefined),
    hidden: { token: [], library: [] },
  },
};

export function normalizeTokenFields(
  raw: Partial<TokenFields>,
  nameLimit = 40,
  opts: { keepAcHp?: boolean } = {}
): TokenFields {
  const out = {} as TokenFields;
  const fullOpts: NormalizeOpts = { nameLimit, keepAcHp: opts.keepAcHp === true };
  for (const key of Object.keys(TOKEN_FIELD_SPECS) as (keyof TokenFields)[]) {
    (out as unknown as Record<string, unknown>)[key] = TOKEN_FIELD_SPECS[key].full(raw, fullOpts);
  }
  return out;
}

/** Только присланные поля patch-обновления; AC/HP — парой относительно prev. */
export function normalizeTokenFieldsPatch(
  raw: Partial<TokenFields>,
  prev: Pick<TokenFields, 'ac' | 'hpMax'>,
  opts: { includeDm?: boolean } = {}
): Partial<TokenFields> {
  const out: Partial<TokenFields> = {};
  for (const key of Object.keys(TOKEN_FIELD_SPECS) as (keyof TokenFields)[]) {
    const value = TOKEN_FIELD_SPECS[key].patch(raw, prev, opts.includeDm === true);
    if (value !== undefined) (out as unknown as Record<string, unknown>)[key] = value;
  }
  return out;
}

/**
 * Версия статов для игроков без прав: поля с `hidden.token` заменяются заглушками.
 * `hpCurrent`/`statblock` — вне `TokenFields`, поэтому скрываются явно.
 */
export function redactToken(token: Token): Token {
  const out: Token = { ...token };
  for (const key of Object.keys(TOKEN_FIELD_SPECS) as (keyof TokenFields)[]) {
    const hidden = TOKEN_FIELD_SPECS[key].hidden;
    if (hidden && 'token' in hidden) (out as unknown as Record<string, unknown>)[key] = hidden.token;
  }
  out.hpCurrent = 0;
  out.statblock = undefined;
  return out;
}

/** Версия предмета библиотеки для игроков без прав (то же, ветка `hidden.library`). */
export function redactLibraryItem(item: LibraryItem): LibraryItem {
  const out: LibraryItem = { ...item };
  for (const key of Object.keys(TOKEN_FIELD_SPECS) as (keyof TokenFields)[]) {
    const hidden = TOKEN_FIELD_SPECS[key].hidden;
    if (hidden && 'library' in hidden) (out as unknown as Record<string, unknown>)[key] = hidden.library;
  }
  return out;
}
