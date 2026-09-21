import {
  abilityMod,
  bestiaryTokenFields,
  DEFAULT_GRID,
  gridOfMap,
  snapToGrid,
  statNumber,
  type AttackEntry,
  type BestiaryEntry,
  type Token,
  type TokenFields,
  type TokenStatblock,
} from 'shared';
import bestiaryData from 'shared/bestiaryData';

/**
 * Трансформа токена (Wild Shape/Polymorph). Свои поля токена НЕ перезаписываются:
 * статы формы отдаёт резолвер (`formOf`/`shape*`), физически меняется только
 * геометрия (клетки подошвы и позиция), а пул HP живёт в `token.shape.hp`.
 * Урон по пулу и правила возврата — в `room/effects.ts`.
 */

export type ShapeKind = 'wildShape' | 'polymorph';

export interface BeginShapeInput {
  entry: BestiaryEntry;
  kind: ShapeKind;
  /** Пул HP формы (Wild Shape — уровень/3×уровень, Polymorph — HP зверя). */
  tempHp: number;
  /** Модификатор Мудрости: круг луны — AC = max(13 + WIS, AC зверя). */
  wisMod?: number;
  /** Источник (Polymorph): токен-кастер для снятия по концентрации. */
  sourceTokenId?: string;
  spellKey?: string;
}

/** Сетка карты (с фолбэком на сетку комнаты) — размер и смещения для снапа формы. */
export interface ShapeGrid {
  size: number;
  offsetX: number;
  offsetY: number;
  snap: boolean;
}

export function shapeGrid(
  room: { scene: { maps: { id: string; grid: Partial<ShapeGrid> }[]; grid: Partial<ShapeGrid> } },
  mapId?: string
): ShapeGrid {
  const map = mapId ? room.scene.maps.find((m) => m.id === mapId) : undefined;
  return gridOfMap(map, room.scene.grid);
}

/** Поля формы из каталога: кэш по ключу (звери переиспользуются между токенами). */
const fieldsCache = new Map<string, TokenFields>();

function fieldsFor(entry: BestiaryEntry): TokenFields {
  const cached = fieldsCache.get(entry.key);
  if (cached) return cached;
  const fields = bestiaryTokenFields(entry);
  fieldsCache.set(entry.key, fields);
  return fields;
}

/** Запись каталога для формы токена (undefined — токен не в форме/ключ не найден). */
export function shapeEntryOf(token: Pick<Token, 'shape'>): BestiaryEntry | undefined {
  const key = token.shape?.key;
  return key ? bestiaryData.entries.find((e) => e.key === key) : undefined;
}

export interface FormView {
  entry: BestiaryEntry;
  fields: TokenFields;
  /** AC формы (зафиксирован при принятии: учитывает круг луны). */
  ac: number;
}

/** Резолвер формы: статы зверя (undefined — токен не в форме). */
export function formOf(token: Pick<Token, 'shape'>): FormView | undefined {
  if (!token.shape) return undefined;
  const entry = shapeEntryOf(token);
  if (!entry) return undefined;
  const fields = fieldsFor(entry);
  return { entry, fields, ac: token.shape.ac ?? statNumber(fields.ac) };
}

export function shapeName(token: Token): string {
  return formOf(token)?.fields.name ?? token.name;
}

export function shapeImageUrl(token: Token): string {
  return formOf(token)?.fields.imageUrl ?? token.imageUrl;
}

export function shapeAttacks(token: Token): AttackEntry[] {
  return formOf(token)?.fields.attacks ?? token.attacks;
}

export function shapeStatblock(token: Token): TokenStatblock | undefined {
  return formOf(token)?.fields.statblock ?? token.statblock;
}

export function shapeSpeed(token: Token): number {
  return formOf(token)?.entry.speed ?? token.speed;
}

/** Пересчёт размера подошвы и привязка центра к сетке. */
function applyShapeSize(token: Token, cells: number, grid: ShapeGrid): void {
  token.cells = cells;
  token.w = cells * grid.size;
  token.h = cells * grid.size;
  if (!grid.snap) return;
  token.x = snapToGrid(token.x, grid.offsetX, grid.size, cells);
  token.y = snapToGrid(token.y, grid.offsetY, grid.size, cells);
}

/** Вводит токен в форму: меняется только метка формы и геометрия подошвы. */
export function beginShape(token: Token, input: BeginShapeInput, grid: ShapeGrid = DEFAULT_GRID): void {
  if (token.shape) revertShape(token, grid);
  const fields = fieldsFor(input.entry);
  const beastAc = statNumber(fields.ac);
  const ac = input.wisMod !== undefined ? Math.max(13 + input.wisMod, beastAc) : beastAc;
  const pool = Math.max(0, Math.round(input.tempHp));
  token.shape = {
    key: input.entry.key,
    name: input.entry.name,
    kind: input.kind,
    hp: pool,
    maxHp: pool,
    ...(ac > 0 ? { ac } : {}),
    ownCells: token.cells,
    ...(input.sourceTokenId ? { sourceTokenId: input.sourceTokenId } : {}),
    ...(input.spellKey ? { spellKey: input.spellKey } : {}),
  };
  applyShapeSize(token, fields.cells, grid);
}

/** Возврат в свою форму: снимается метка, геометрия возвращается. false — формы не было. */
export function revertShape(token: Token, grid: ShapeGrid = DEFAULT_GRID): boolean {
  if (!token.shape) return false;
  applyShapeSize(token, token.shape.ownCells ?? token.cells, grid);
  delete token.shape;
  return true;
}

/** Токены с формой от указанных источников (для снятия по концентрации). */
export function shapesOfSource(room: { scene: { maps: { id: string; tokens: Token[] }[] } }, sourceIds: Set<string>) {
  const out: { mapId: string; token: Token }[] = [];
  for (const map of room.scene.maps) {
    for (const token of map.tokens) {
      const sourceId = token.shape?.sourceTokenId;
      if (sourceId && sourceIds.has(sourceId)) out.push({ mapId: map.id, token });
    }
  }
  return out;
}

/** Сводные характеристики формы: физические — зверя, ментальные — свои (XPHB). */
export function mergeShapeAbilities(
  own: Record<string, number> | undefined,
  beast: Record<string, number> | undefined
): Record<string, number> | undefined {
  if (!beast) return own;
  if (!own) return beast;
  return {
    ...own,
    str: beast.str ?? own.str ?? 10,
    dex: beast.dex ?? own.dex ?? 10,
    con: beast.con ?? own.con ?? 10,
  };
}

/** Модификатор Мудрости листа (для AC/спасбросков круга луны). */
export function wisdomModOf(abilities: Record<string, number> | undefined): number | undefined {
  const wis = abilities?.wis;
  return typeof wis === 'number' ? abilityMod(wis) : undefined;
}
