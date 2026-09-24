import {
  gridDistanceFeet,
  gridOfMap,
  gripAdjustedDamage,
  handAttackOf,
  hostileTokens,
  isBanished,
  rightGrip,
  rollDice,
  seesInvisible,
  tokenVisibleFrom,
  weaponByKey,
  type AutomationDef,
  type SpellStats,
  type Token,
} from 'shared';
import type { Room } from '../roomTypes';
import { sheetOfToken } from '../room/helpers';
import type { ConnCtx } from './context';
import { applyDamage } from './damage';
import { resolveWeaponAttackWithReactions } from './reactions/attack';
import type { SpellCastInput } from './spellResolve';

/**
 * Клинок-кантрип (Green-Flame Blade): каст резолвится оружейной атакой правой
 * руки (хват универсального учитывается), райдер — на попадании, вторичная
 * цель выбирается автоматически — ближайший враждебный в 5 фт от основной.
 */
export function runBladeCantrip(ctx: ConnCtx, room: Room, input: SpellCastInput, def: AutomationDef): void {
  const spec = def.weaponAttack;
  const target = input.targets.find((t): t is Token => !!t);
  if (!spec || !target) return;
  const sheet = sheetOfToken(room, input.caster).sheet;
  const held = sheet ? handAttackOf(sheet.attacks, sheet.hands, 'right') : undefined;
  if (!held || held.rangeType !== 'melee') return;
  const weapon = held.weaponKey ? weaponByKey(held.weaponKey) : undefined;
  const attack =
    weapon && sheet
      ? { ...held, damage: gripAdjustedDamage(held.damage, weapon, rightGrip(sheet.attacks, sheet.hands)) }
      : held;
  resolveWeaponAttackWithReactions(ctx, {
    attacker: input.caster,
    attackerMapId: input.mapId,
    target,
    targetMapId: input.mapId,
    attack,
    prefix: input.caster.name,
    advantage: input.advantage,
    author: input.author,
    ...(spec.riderDice ? { riderDice: spec.riderDice } : {}),
    afterHit: () => {
      if (spec.secondary) applySecondary(ctx, room, input, target, spec.secondary, input.stats);
    },
  });
}

/** Вторичный урон: мод заклинательной + кости уровня, ближайший враждебный в радиусе. */
function applySecondary(
  ctx: ConnCtx,
  room: Room,
  input: SpellCastInput,
  primary: Token,
  spec: NonNullable<AutomationDef['weaponAttack']>['secondary'],
  stats: SpellStats | null
): void {
  if (!spec) return;
  const map = ctx.manager.findMap(room, input.mapId);
  if (!map) return;
  const grid = gridOfMap(map, room.scene.grid);
  const seesHidden = seesInvisible(input.caster.effects);
  const victim = map.tokens
    .filter(
      (t) =>
        t.id !== primary.id &&
        !isBanished(t) &&
        hostileTokens(input.caster, t) &&
        gridDistanceFeet(primary, t, grid.size) <= spec.rangeFeet &&
        tokenVisibleFrom(input.caster, t, map.walls, grid) &&
        (seesHidden || !t.conditions.some((c) => c.key === 'invisible'))
    )
    .sort((a, b) => gridDistanceFeet(primary, a, grid.size) - gridDistanceFeet(primary, b, grid.size))[0];
  if (!victim) return;
  const mod = stats ? Math.round(stats.mod) : 0;
  const expr = [mod > 0 ? String(mod) : '', spec.dice ?? ''].filter(Boolean).join('+');
  if (!expr) return;
  const roll = rollDice(expr);
  const result = applyDamage(ctx, {
    target: victim,
    mapId: input.mapId,
    amount: roll.total,
    damageType: spec.damageType,
    parts: roll.damageParts,
    roll,
    author: input.author,
    params: { subject: `${input.spell.name} · ${victim.name}`, damageType: spec.damageType },
  });
  if (result.applied && result.amount > 0) {
    ctx.systemMessage(room, {
      code: 'automation.greenFlame',
      params: {
        name: input.caster.name,
        target: victim.name,
        amount: result.amount,
        type: spec.damageType,
      },
    });
  }
}
