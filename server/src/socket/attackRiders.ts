import { randomUUID } from 'node:crypto';
import {
  abilityMod,
  attackRidersFor,
  characterLevel,
  proficiencyBonus,
  type AbilityKey,
  type AttackRiderDef,
  type EffectInstance,
  type Token,
} from 'shared';
import { controllerIdOfToken, hasResourceFor } from '../rooms';
import type { Room } from '../roomTypes';
import type { ConnCtx } from './context';
import { pushSaveMessage } from './messages';

const USED_PREFIX = 'rider-used:';
const RAGE_KEY = 'class:barbarian:rage';
const RECKLESS_KEY = 'class:barbarian:recklessAttack';

export interface AppliedRiders {
  /** Дополнительное выражение урона ('1d6+5+2'), пустая строка — нет наездников. */
  expr: string;
  /** Сообщения в чат для сработавших наездников. */
  notes: string[];
}

/**
 * Применяет бонусные черты при попадании оружием: условия (ярость/безрассудство/метка),
 * расход ресурса, учёт «раз в ход» скрытой меткой. Вызывается перед броском урона.
 */
export function applyAttackRiders(
  ctx: ConnCtx,
  room: Room,
  attacker: Token,
  mapId: string,
  target?: Token | null,
  activated?: string[]
): AppliedRiders {
  const cid = controllerIdOfToken(room, attacker);
  const sheet = cid ? room.sheets[cid] : undefined;
  if (!cid || !sheet) return { expr: '', notes: [] };

  const abilities = ctx.manager.abilitiesForToken(room, attacker) ?? {};
  const wisMod = abilityMod((abilities as Partial<Record<string, number>>).wis ?? 10);
  const level = (className: string) => sheet.classes.find((c) => c.className === className)?.level ?? 0;
  const hasEffect = (key: string) => attacker.effects.some((e) => e.sourceKey === key);
  const saveDc =
    8 +
    proficiencyBonus(characterLevel(sheet.classes)) +
    wisMod;

  const parts: string[] = [];
  const notes: string[] = [];
  for (const rider of attackRidersFor(sheet.classes)) {
    if (rider.requiresRage && !hasEffect(RAGE_KEY)) continue;
    if (rider.requiresReckless && !hasEffect(RECKLESS_KEY)) continue;
    if (rider.requiresMarker && !hasEffect(rider.requiresMarker)) continue;
    if (rider.choiceOnHit && !activated?.includes(rider.id)) continue;
    if (hasEffect(`${USED_PREFIX}${rider.id}`)) continue;
    if (rider.resourceKey && !hasResourceFor(room, cid, rider.resourceKey, rider.resourceAmount ?? 1)) continue;

    const expr = riderExpression(rider, level, abilities);
    if (!expr && !rider.save) continue;

    if (rider.resourceKey) {
      ctx.manager.spendResource(room, cid, rider.resourceKey, rider.resourceAmount ?? 1);
      ctx.emitResources(room, cid);
    }
    if (expr) parts.push(expr);
    notes.push(expr ? `${attacker.name}: ${rider.name} (+${expr})` : `${attacker.name}: ${rider.name}`);
    markUsed(ctx, room, mapId, attacker, rider);
    if (rider.save && target) applyRiderSave(ctx, room, mapId, attacker, target, rider, saveDc);
  }
  return { expr: parts.join('+'), notes };
}

/** Выбранные в окне наездники атакующего (choiceOnHit) с оплачиваемым ресурсом. */
export interface ChoiceRider {
  id: string;
  name: string;
  resourceKey?: string;
  resourceAmount?: number;
}

export function availableChoiceRiders(ctx: ConnCtx, room: Room, attacker: Token): ChoiceRider[] {
  const cid = controllerIdOfToken(room, attacker);
  const sheet = cid ? room.sheets[cid] : undefined;
  if (!cid || !sheet) return [];
  const out: ChoiceRider[] = [];
  for (const rider of attackRidersFor(sheet.classes)) {
    if (!rider.choiceOnHit) continue;
    if (attacker.effects.some((e) => e.sourceKey === `${USED_PREFIX}${rider.id}`)) continue;
    if (rider.resourceKey && !hasResourceFor(room, cid, rider.resourceKey, rider.resourceAmount ?? 1)) continue;
    out.push({ id: rider.id, name: rider.name, resourceKey: rider.resourceKey, resourceAmount: rider.resourceAmount });
  }
  return out;
}

function riderExpression(
  rider: AttackRiderDef,
  level: (className: string) => number,
  abilities: Partial<Record<AbilityKey, number>>
): string {
  const parts: string[] = [];
  if (rider.rageDamageDice) parts.push(level('barbarian') >= 9 ? '3d6' : '2d6');
  if (rider.dice) parts.push(rider.dice);
  if (rider.halfLevelBonus) {
    const flat = Math.ceil(level(rider.halfLevelBonus) / 2);
    if (flat) parts.push(String(flat));
  }
  if (rider.abilityBonus) {
    const mod = abilityMod(abilities[rider.abilityBonus] ?? 10);
    if (mod) parts.push(String(mod));
  }
  return parts.join('+');
}

/** Спасбросок цели от наездника (Ошеломляющий удар): провал — условие, успех — скорость ×1/2. */
function applyRiderSave(
  ctx: ConnCtx,
  room: Room,
  mapId: string,
  attacker: Token,
  target: Token,
  rider: AttackRiderDef,
  dc: number
): void {
  const save = rider.save;
  if (!save) return;
  const { roll, success } = ctx.manager.rollSave(room, target, save.ability, dc, { conditionsAutoFail: true });
  pushSaveMessage(ctx, room, { author: attacker.name, subject: `${rider.name} · ${target.name}`, roll, success });
  const id = randomUUID();
  const effect: EffectInstance = success
    ? {
        id,
        name: `${rider.name}: успех`,
        sourceKey: `rider:${rider.id}`,
        sourceId: attacker.id,
        duration: { type: 'endOfTurn', of: 'source' },
        modifiers: [{ id: `${id}:m0`, target: 'speed', mode: 'multiply', value: 0.5 }],
      }
    : {
        id,
        name: rider.name,
        sourceKey: `rider:${rider.id}`,
        sourceId: attacker.id,
        duration: { type: 'endOfTurn', of: 'source' },
        modifiers: [],
        conditions: [save.condition],
      };
  ctx.manager.applyEffect(room, target, effect);
  ctx.emitToken(room, 'token:update', mapId, target);
}

/** Ставит скрытую метку «использовано до конца хода» и снимает метку-активатор. */
function markUsed(ctx: ConnCtx, room: Room, mapId: string, attacker: Token, rider: AttackRiderDef): void {
  const usedKey = `${USED_PREFIX}${rider.id}`;
  if (rider.requiresMarker) {
    for (const effect of attacker.effects.filter((e) => e.sourceKey === rider.requiresMarker)) {
      ctx.manager.removeEffect(room, attacker, effect.id);
    }
  }
  ctx.manager.applyEffect(room, attacker, {
    id: randomUUID(),
    name: `${rider.name}: использовано`,
    sourceKey: usedKey,
    sourceId: attacker.id,
    duration: { type: 'endOfTurn', of: 'target' },
    modifiers: [],
    hidden: true,
  });
  ctx.emitToken(room, 'token:update', mapId, attacker);
}
