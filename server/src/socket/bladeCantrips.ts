import {
  gridOfMap,
  gripAdjustedDamage,
  handOf,
  hostileTokens,
  isBanished,
  loadoutOf,
  rightGrip,
  rollDice,
  seesInvisible,
  tokenVisibleFrom,
  tokensNearFeet,
  weaponByKey,
  weaponContextOf,
  type AutomationDef,
  type SpellStats,
  type Token,
} from 'shared';
import type { Room } from '../roomTypes';
import { sheetOfToken } from '../room/helpers';
import type { ConnCtx } from './context';
import { applyDamage } from './damage';
import { applyEffectTo } from './effectsApply';
import { resolveWeaponAttackWithReactions } from './reactions/attack';
import type { SpellCastInput } from './spellResolve';

/**
 * Клинок-кантрип (Green-Flame/Booming Blade, True Strike): каст резолвится оружейной
 * атакой правой руки (хват универсального учитывается), райдер — на попадании,
 * вторичная цель выбирается автоматически. True Strike бьёт любым оружием и
 * считает атаку/урон от заклинательной характеристики.
 */
export function runBladeCantrip(ctx: ConnCtx, room: Room, input: SpellCastInput, def: AutomationDef): void {
  const spec = def.weaponAttack;
  const target = input.targets.find((t): t is Token => !!t);
  if (!spec || !target) return;
  const sheet = sheetOfToken(room, input.caster).sheet;
  const loadout = loadoutOf({
    attacks: sheet?.attacks,
    hands: sheet?.hands,
    effects: input.caster.effects,
    ...weaponContextOf(sheet),
  });
  const held = sheet ? handOf(loadout, 'right') : undefined;
  if (!held || (!spec.anyWeapon && held.rangeType !== 'melee')) return;
  const weapon = held.weaponKey ? weaponByKey(held.weaponKey) : undefined;
  const base =
    weapon && sheet
      ? { ...held, damage: gripAdjustedDamage(held.damage, weapon, rightGrip(loadout.attacks, loadout.hands)) }
      : held;
  // True Strike: базовый урон — излучением (вариант) или обычным типом оружия.
  const attack = spec.spellAbility && input.variant === 'radiant' ? { ...base, damageType: 'radiant' } : base;
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
    ...(spec.spellAbility && input.stats ? { attackAbility: input.stats.ability } : {}),
    afterHit: () => {
      if (spec.secondary) applySecondary(ctx, room, input, target, spec.secondary, input.stats);
      if (spec.hitEffect) applyHitEffect(ctx, room, input, target, spec.hitEffect);
    },
  });
}

/** Эффект на цель при попадании (Booming Blade): носится до начала вашего след. хода. */
function applyHitEffect(
  ctx: ConnCtx,
  room: Room,
  input: SpellCastInput,
  target: Token,
  effectDef: NonNullable<AutomationDef['weaponAttack']>['hitEffect']
): void {
  if (!effectDef) return;
  applyEffectTo(ctx, room, {
    sourceKey: input.spell.key,
    sourceId: input.caster.id,
    mapId: input.mapId,
    effectDef,
    target,
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
  const victim = tokensNearFeet(map.tokens, primary, spec.rangeFeet, grid.size).find(
    (t) =>
      t.id !== primary.id &&
      !isBanished(t) &&
      hostileTokens(input.caster, t) &&
      tokenVisibleFrom(input.caster, t, map.walls, grid) &&
      (seesHidden || !t.conditions.some((c) => c.key === 'invisible'))
  );
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
