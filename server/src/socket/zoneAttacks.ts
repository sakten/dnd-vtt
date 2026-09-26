import {
  attackRange,
  crossesWalls,
  gridDistanceFeet,
  gridOfMap,
  hostileTokens,
  magicWeaponAttacks,
  magicalDamageType,
  modifiedValue,
  nearestSegmentPoint,
  segmentRectDistance,
  tokenRect,
  wallsWithZones,
  zoneWallSegments,
  type AttackEntry,
  type Token,
  type ZoneInstance,
  type ZoneTargetRef,
} from 'shared';
import type { ConnCtx } from './context';
import type { Room } from '../roomTypes';
import { attackDamageRoll, prepareWeaponAttack, rollPreparedAttack } from './attackResolve';
import { fail } from './errors';
import { pushRollMessage } from './messages';
import { hitZoneSection } from './zones';

/**
 * Атака по секции тонкой стены-зоны (Wall of Ice): цель `zone:<id>#<секция>`
 * (`zoneTargetId`). Боевая математика — общий поток `prepareWeaponAttack`/
 * `rollPreparedAttack` (дистанция/помеха передаются `rangeOverride`, КЗ —
 * `targetAcOverride`), урон уходит в секцию, а не в существо; окон реакций нет.
 */

export interface ZoneSectionAttackInput {
  attacker: Token;
  mapId: string;
  attack: AttackEntry;
  ref: ZoneTargetRef;
  author: string;
  advantage?: 'a' | 'd';
  /** Списание действия в момент броска; false — отмена (ресурс не тратится). */
  beforeRoll?: () => boolean;
}

/** Атака оружием/безоружным по секции стены: дистанция → обзор → d20 vs КЗ → урон секции. */
export function resolveZoneSectionAttack(ctx: ConnCtx, room: Room, input: ZoneSectionAttackInput): void {
  const { manager } = ctx;
  const map = manager.findMap(room, input.mapId);
  const zone: ZoneInstance | undefined = map?.zones?.find((z) => z.id === input.ref.zoneId);
  if (!map || !zone?.wall) {
    fail(ctx, 'spellNoTarget');
    return;
  }
  // Wall of Force: иммунитет ко всему урону (секций нет).
  if (zone.wall.immune) {
    fail(ctx, 'wallImmune', { name: zone.name });
    return;
  }
  const section = zone.sections?.[input.ref.section];
  if (!section || section.broken) {
    fail(ctx, 'spellNoTarget');
    return;
  }
  const grid = gridOfMap(map, room.scene.grid);
  const segments = zoneWallSegments(zone, grid).filter((s) => s.section === input.ref.section);
  // Дистанция — как у дверей: от подошвы до отрезка, в клетках (касание = 5 фт);
  // большие токены достают вплотную, стена по центру клетки — тоже соседняя.
  const rect = tokenRect(input.attacker);
  let gapPx = Infinity;
  for (const segment of segments) gapPx = Math.min(gapPx, segmentRectDistance(segment.a, segment.b, rect));
  const distanceFeet = Number.isFinite(gapPx) ? (Math.floor(gapPx / grid.size + 1e-6) + 1) * 5 : Infinity;
  const reachBonus = modifiedValue(0, input.attacker.effects, 'reach');
  const adjacentEnemy = map.tokens.some(
    (t) =>
      t.id !== input.attacker.id &&
      hostileTokens(input.attacker, t) &&
      gridDistanceFeet(input.attacker, t, grid.size) <= 5
  );
  const range = attackRange(input.attack, distanceFeet, adjacentEnemy, reachBonus);
  if (range.outOfRange) {
    const code = range.error?.code;
    fail(ctx, code === 'attackOutOfReach' || code === 'attackTooFar' ? code : 'attackOutOfRange', {
      feet: Math.round(distanceFeet),
    });
    return;
  }
  // Обзор до секции: мешают стены карты и чужие стены; своя стена поверхностью не мешает.
  const otherWalls = wallsWithZones(
    map.walls,
    map.zones?.filter((z) => z.id !== zone.id),
    grid
  );
  const aimPoint = nearestSegmentPoint({ x: input.attacker.x, y: input.attacker.y }, segments);
  if (aimPoint && crossesWalls({ x: input.attacker.x, y: input.attacker.y }, aimPoint, otherWalls, 'sight')) {
    fail(ctx, 'noClearPath');
    return;
  }

  const { error, prep } = prepareWeaponAttack(ctx, {
    attacker: input.attacker,
    attackerMapId: input.mapId,
    target: null,
    targetMapId: null,
    attack: input.attack,
    prefix: input.attacker.name,
    advantage: input.advantage,
    author: input.author,
    rangeOverride: {
      distanceFeet,
      ...(range.disadvantage ? { disadvantage: true, disadvantageCode: range.disadvantageCode } : {}),
    },
    targetAcOverride: zone.wall.ac ?? 0,
  });
  if (error) {
    ctx.socket.emit('chat:error', error);
    return;
  }
  if (!prep) {
    fail(ctx, 'noWeapon');
    return;
  }
  // Метка броска: секция стены вместо цели-существа.
  prep.baseParams.subject = `${input.attacker.name} → ${zone.name} · секция ${input.ref.section + 1}`;

  if (input.beforeRoll && !input.beforeRoll()) return;
  const { plan } = rollPreparedAttack(ctx, prep);
  if (!plan || plan.hitSuccess !== true || !plan.damageExpr) return;

  const damageRoll = attackDamageRoll(plan.damageExpr, undefined, plan.crit);
  const magicWeapon = magicWeaponAttacks(input.attacker.effects);
  const mainType = magicWeapon
    ? magicalDamageType(plan.attack.damageType) ?? plan.attack.damageType
    : plan.attack.damageType;
  pushRollMessage(ctx, room, {
    author: input.author,
    roll: damageRoll,
    kind: 'damage',
    params: { ...prep.baseParams, damageType: plan.attack.damageType },
  });
  const parts = damageRoll.damageParts.length ? damageRoll.damageParts : [{ amount: damageRoll.total }];
  const result = hitZoneSection(ctx, room, input.mapId, zone, input.ref.section, parts, mainType);
  if (result?.broken) {
    ctx.systemMessage(room, {
      code: 'automation.wallBreached',
      params: { name: zone.name, section: input.ref.section + 1 },
    });
  }
}
