import {
  attacksPerAction,
  DEFAULT_SPEED,
  abilityMod,
  invocationSenses,
  sheetProficiencyBonus,
  statNumber,
  type AbilityKey,
  type AttackEntry,
  type DamageDefense,
  type Sense,
  type Token,
  type TokenStatblock,
} from 'shared';
import type { Room } from '../roomTypes';
import { controllerIdOfToken } from './helpers';
import { formOf, mergeShapeAbilities, revertShape, shapeGrid } from './shape';

/**
 * Единое правило «чей источник истины»: если у токена есть контролёр с листом,
 * истина — лист и ресурсы персонажа; иначе — поля токена и статблок монстра.
 * Все чтения статов должны идти сюда, а не напрямую в `token.ac`/`sheet.ac`.
 */
export interface ActorStats {
  character: boolean;
  controllerId?: string;
  name: string;
  abilities?: Record<AbilityKey, number>;
  /** Базовый AC (0 — не задан; вызывающий сам решает про DEFAULT_AC). */
  ac: number;
  /** Базовая скорость до эффектов. */
  speed: number;
  senses: Sense[];
  attacks: AttackEntry[];
  damageDefenses: DamageDefense[];
  /** HP: у персонажа — ресурсы (если настроены), иначе поля токена. */
  hp: { max: number; current: number; temp: number };
  /** Бонус инициативы: персонажу — от Ловкости листа, иначе — поле токена. */
  initiativeBonus: string;
  /** Явные бонусы спасбросков (владение): у персонажа — мод + владение. */
  saves?: Partial<Record<AbilityKey, number>>;
  /** Атак за действие (Extra Attack) у персонажа. */
  attacksPerAction?: number;
  /** Описание: у формы — зверя, иначе своё поле токена. */
  description: string;
  /** Картинка: у формы — зверя, иначе своё поле токена. */
  imageUrl: string;
  /** Подошва в клетках: у формы — зверя, иначе своя. */
  cells: number;
  /** Статблок панелей: персонажу — из листа (спасброски/мультиатака), форме/монстру — свой. */
  statblock?: TokenStatblock;
}

export function actorStats(room: Room, token: Token): ActorStats {
  const controllerId = controllerIdOfToken(room, token);
  const sheet = controllerId ? room.sheets[controllerId] : undefined;
  const res = controllerId ? room.resources[controllerId] : undefined;
  const tokenHp = {
    max: statNumber(token.hpMax),
    current: token.hpCurrent ?? 0,
    temp: token.hpTemp ?? 0,
  };
  if (!sheet) {
    return {
      character: false,
      controllerId,
      name: token.name,
      abilities: token.statblock?.abilities,
      ac: statNumber(token.ac),
      speed: token.speed ?? DEFAULT_SPEED,
      senses: token.senses ?? [],
      attacks: token.attacks ?? [],
      damageDefenses: token.damageDefenses ?? [],
      hp: tokenHp,
      initiativeBonus: (token.initiativeBonus ?? '').trim(),
      description: token.description,
      imageUrl: token.imageUrl,
      cells: token.cells,
      statblock: token.statblock,
    };
  }
  // Форма (Wild Shape/Polymorph): статы — зверя (резолвер), свои — HP и владения.
  if (token.shape) {
    const form = formOf(token);
    if (form) {
      const polymorph = token.shape.kind === 'polymorph';
      const pb = sheetProficiencyBonus(sheet);
      // Polymorph (XPHB 2024): статы целиком из статблока зверя, свои владения не сохраняются.
      const abilities = polymorph
        ? form.entry.abilities
        : mergeShapeAbilities(sheet.abilities, form.entry.abilities) ?? sheet.abilities;
      const saves: Partial<Record<AbilityKey, number>> = {};
      if (polymorph) {
        for (const [key, value] of Object.entries(form.entry.saves ?? {}) as [AbilityKey, number][]) {
          saves[key] = value;
        }
      } else {
        for (const key of Object.keys(sheet.abilities) as AbilityKey[]) {
          if (sheet.saves[key]) saves[key] = abilityMod(sheet.abilities[key] ?? 10) + pb;
        }
        for (const [key, value] of Object.entries(form.entry.saves ?? {}) as [AbilityKey, number][]) {
          if (value > (saves[key] ?? Number.NEGATIVE_INFINITY)) saves[key] = value;
        }
      }
      const senses = [...form.entry.senses];
      if (!polymorph) {
        for (const sense of invocationSenses(sheet)) {
          if (!senses.some((s) => s.type === sense.type)) senses.push(sense);
        }
      }
      return {
        character: true,
        controllerId,
        name: form.fields.name,
        abilities,
        ac: form.ac,
        speed: form.entry.speed,
        senses,
        attacks: form.fields.attacks,
        damageDefenses: form.fields.damageDefenses,
        hp: res && res.hp.max > 0 ? { max: res.hp.max, current: res.hp.current, temp: res.hp.temp } : tokenHp,
        initiativeBonus: form.fields.initiativeBonus,
        saves: Object.keys(saves).length ? saves : undefined,
        description: form.fields.description,
        imageUrl: form.fields.imageUrl,
        cells: form.fields.cells,
        statblock: form.fields.statblock,
      };
    }
  }
  const dexMod = abilityMod(sheet.abilities.dex ?? 10);
  const pb = sheetProficiencyBonus(sheet);
  const saves: Partial<Record<AbilityKey, number>> = {};
  for (const key of Object.keys(sheet.abilities) as AbilityKey[]) {
    if (sheet.saves[key]) saves[key] = abilityMod(sheet.abilities[key] ?? 10) + pb;
  }
  const senses = [...(sheet.senses ?? [])];
  for (const sense of invocationSenses(sheet)) {
    if (!senses.some((s) => s.type === sense.type)) senses.push(sense);
  }
  const attacksPer = attacksPerAction(sheet.classes);
  const statblock: TokenStatblock = {
    abilities: sheet.abilities,
    ...(Object.keys(saves).length ? { saves } : {}),
    ...(attacksPer > 1 ? { multiattack: attacksPer } : {}),
  };
  return {
    character: true,
    controllerId,
    name: sheet.name.trim() || token.name,
    abilities: sheet.abilities,
    ac: statNumber(sheet.ac),
    speed: sheet.speed ?? DEFAULT_SPEED,
    senses,
    attacks: sheet.attacks ?? [],
    damageDefenses: sheet.damageDefenses ?? [],
    hp: res && res.hp.max > 0 ? { max: res.hp.max, current: res.hp.current, temp: res.hp.temp } : tokenHp,
    initiativeBonus: dexMod >= 0 ? `+${dexMod}` : `${dexMod}`,
    saves: Object.keys(saves).length ? saves : undefined,
    attacksPerAction: attacksPer,
    description: token.description,
    imageUrl: token.imageUrl,
    cells: token.cells,
    statblock,
  };
}

/** Единый маппинг статов в поля токена: и resolved-вид для клиента, и заморозка. */
export function applyActorStats(target: Token, stats: ActorStats): void {
  target.name = stats.name;
  target.description = stats.description;
  target.imageUrl = stats.imageUrl;
  target.cells = stats.cells;
  target.ac = stats.ac > 0 ? String(stats.ac) : '';
  target.hpMax = stats.hp.max > 0 ? String(stats.hp.max) : '';
  target.hpCurrent = stats.hp.current;
  target.hpTemp = stats.hp.temp;
  target.speed = stats.speed;
  target.initiativeBonus = stats.initiativeBonus;
  target.senses = stats.senses;
  target.attacks = stats.attacks;
  target.damageDefenses = stats.damageDefenses;
  if (stats.statblock) target.statblock = stats.statblock;
  else delete target.statblock;
}

/**
 * Заморозка при отвязке персонажа: форма снимается (её статы не резолвятся без листа),
 * затем статы из листа/ресурсов один раз копируются в токены, чтобы после снятия
 * контролёра токен остался обычным, а не «пустым».
 * Вызывать до удаления `controllers[playerId]`.
 */
export function freezeCharacterTokens(room: Room, playerId: string): { mapId: string; token: Token }[] {
  const libId = room.controllers[playerId];
  if (!libId) return [];
  const out: { mapId: string; token: Token }[] = [];
  for (const map of room.scene.maps) {
    for (const token of map.tokens) {
      if (token.libraryItemId !== libId) continue;
      // Форма не переживает отвязку: возвращаем свои поля и геометрию до чтения статов.
      if (token.shape) revertShape(token, shapeGrid(room, map.id));
      applyActorStats(token, actorStats(room, token));
      out.push({ mapId: map.id, token });
    }
  }
  return out;
}

/** Заморозка всех токенов предмета (например, при удалении предмета из библиотеки). */
export function freezeCharacterTokensOfItem(room: Room, libraryItemId: string): { mapId: string; token: Token }[] {
  const players = Object.keys(room.controllers).filter((pid) => room.controllers[pid] === libraryItemId);
  return players.flatMap((pid) => freezeCharacterTokens(room, pid));
}
