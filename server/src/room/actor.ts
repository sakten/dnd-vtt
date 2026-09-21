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
} from 'shared';
import type { Room } from '../roomTypes';
import { controllerIdOfToken } from './helpers';
import { formOf, mergeShapeAbilities } from './shape';

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
    attacksPerAction: attacksPerAction(sheet.classes),
  };
}

/**
 * Заморозка при отвязке персонажа: статы из листа/ресурсов один раз копируются
 * в токены, чтобы после снятия контролёра токен остался обычным, а не «пустым».
 * Вызывать до удаления `controllers[playerId]`.
 */
export function freezeCharacterTokens(room: Room, playerId: string): { mapId: string; token: Token }[] {
  const libId = room.controllers[playerId];
  if (!libId) return [];
  const out: { mapId: string; token: Token }[] = [];
  for (const map of room.scene.maps) {
    for (const token of map.tokens) {
      if (token.libraryItemId !== libId) continue;
      const stats = actorStats(room, token);
      token.name = stats.name;
      token.ac = stats.ac > 0 ? String(stats.ac) : '';
      token.hpMax = stats.hp.max > 0 ? String(stats.hp.max) : '';
      token.hpCurrent = stats.hp.current;
      token.hpTemp = stats.hp.temp;
      token.speed = stats.speed;
      token.senses = stats.senses;
      token.attacks = stats.attacks;
      token.damageDefenses = stats.damageDefenses;
      token.initiativeBonus = stats.initiativeBonus;
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
