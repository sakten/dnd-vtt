import { DEFAULT_SPEED, statNumber } from '../domain/core';
import type { LibraryItem, Token, TokenFields } from '../domain/token';
import { normalizeTokenFields } from '../fields';
import { normalizeConditions, normalizeEffects } from './effects';
import { isRecord } from './guards';
import { normalizeSenses } from './sense';

export interface NormalizeEntityOptions {
  /** Лимит имени: 40 — токен, 60 — предмет библиотеки. */
  nameLimit?: number;
  /** Не требовать пару AC+hpMax (данные с диска старых версий). */
  keepAcHp?: boolean;
}

/**
 * Полная нормализация токена: поля реестра `TokenFields` + боевые поля вне него.
 * Неизвестные поля сохраняются (прямая и обратная совместимость формата).
 */
export function normalizeToken(raw: unknown, opts: NormalizeEntityOptions = {}): Token {
  const source = isRecord(raw) ? raw : {};
  const fields = normalizeTokenFields(source as Partial<TokenFields>, opts.nameLimit ?? 40, {
    keepAcHp: opts.keepAcHp === true,
  });
  const token: Token = {
    ...(source as unknown as Token),
    ...fields,
    libraryItemId: typeof source.libraryItemId === 'string' ? source.libraryItemId : '',
    hpCurrent:
      typeof source.hpCurrent === 'number' && Number.isFinite(source.hpCurrent)
        ? source.hpCurrent
        : statNumber(fields.hpMax),
    hpTemp:
      typeof source.hpTemp === 'number' && Number.isFinite(source.hpTemp)
        ? Math.max(0, Math.round(source.hpTemp))
        : 0,
    faction:
      source.faction === 'ally' || source.faction === 'enemy' || source.faction === 'neutral'
        ? source.faction
        : 'neutral',
    speed:
      typeof source.speed === 'number' && Number.isFinite(source.speed)
        ? Math.max(0, Math.round(source.speed))
        : DEFAULT_SPEED,
    senses: normalizeSenses(source.senses, source.darkvision),
    conditions: normalizeConditions(source.conditions),
    effects: normalizeEffects(source.effects),
  };
  if (!token.statblock) delete token.statblock;
  return token;
}

/** Полная нормализация предмета библиотеки (legacy `url` → `imageUrl`). */
export function normalizeLibraryItem(raw: unknown): LibraryItem {
  const { url, ...rest } = isRecord(raw) ? raw : {};
  const source = rest as Record<string, unknown>;
  const imageUrl =
    typeof source.imageUrl === 'string' ? source.imageUrl : typeof url === 'string' ? url : '';
  const fields = normalizeTokenFields({ ...source, imageUrl } as Partial<TokenFields>, 60, {
    keepAcHp: true,
  });
  return {
    ...(source as unknown as LibraryItem),
    ...fields,
    id: typeof source.id === 'string' ? source.id : '',
  };
}
