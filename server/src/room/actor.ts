import {
  DEFAULT_SPEED,
  abilityMod,
  statNumber,
  type AbilityKey,
  type AttackEntry,
  type DamageDefense,
  type Sense,
  type Token,
} from 'shared';
import type { Room } from '../roomTypes';
import { controllerIdOfToken } from './helpers';

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
  const dexMod = abilityMod(sheet.abilities.dex ?? 10);
  return {
    character: true,
    controllerId,
    name: sheet.name.trim() || token.name,
    abilities: sheet.abilities,
    ac: statNumber(sheet.ac),
    speed: sheet.speed ?? DEFAULT_SPEED,
    senses: sheet.senses ?? [],
    attacks: sheet.attacks ?? [],
    damageDefenses: sheet.damageDefenses ?? [],
    hp: res && res.hp.max > 0 ? { max: res.hp.max, current: res.hp.current, temp: res.hp.temp } : tokenHp,
    initiativeBonus: dexMod >= 0 ? `+${dexMod}` : `${dexMod}`,
  };
}
