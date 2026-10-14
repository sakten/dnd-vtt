import type { AbilityKey } from '../domain/core';
import { abilityMod } from '../domain/core';
import type { EffectInstance } from '../domain/effects';
import type { FeatureChoice } from '../domain/feature';
import type { CharacterSheet, ClassLevel, SheetHands } from '../domain/sheet';
import type { AttackEntry } from '../domain/token';
import { proficiencyBonus } from './classes';
import { handAttackOf, rightGrip, type HandKey } from './hands';
import { kenseiWeaponKeyOf } from './kensei';
import { d20Expr } from './sheet';
import { damageExpression, isMonkWeapon, weaponAttackEntry, weaponByKey, type WeaponContext, type WeaponDef } from './weapons';

/** Контекст оружия из листа персонажа (характеристики, классы, выборы). */
export function weaponContextOf(sheet?: CharacterSheet | null): WeaponContext {
  return {
    abilities: sheet?.abilities ?? {},
    classes: sheet?.classes ?? [],
    ...(sheet?.choices ? { choices: sheet.choices } : {}),
  };
}

/** Лоадаут актора: атаки, руки и контекст пересчёта оружия. */
export interface ActorLoadout {
  attacks: AttackEntry[];
  hands?: SheetHands;
  context: WeaponContext;
}

export interface LoadoutInput {
  /** Сохранённые атаки (листа персонажа или токена/формы) — выбирает вызывающий. */
  attacks?: AttackEntry[];
  hands?: SheetHands;
  effects?: EffectInstance[];
  abilities?: Partial<Record<AbilityKey, number>>;
  classes?: ClassLevel[];
  choices?: FeatureChoice[];
}

/** Префикс синтетических id атак Shadow Blade (`shadow:<effectId>[:thrown]`). */
export const SHADOW_BLADE_PREFIX = 'shadow:';

/** id эффекта-клинка тени из синтетической атаки (undefined — обычная запись листа). */
export function shadowBladeEffectIdOf(attack: AttackEntry): string | undefined {
  const id = attack.id;
  if (!id?.startsWith(SHADOW_BLADE_PREFIX)) return undefined;
  return id.slice(SHADOW_BLADE_PREFIX.length).replace(/:thrown$/, '');
}

/** Брошенный клинок тени (дальняя синтетическая атака) — после броска клинок исчезает. */
export function isShadowBladeThrown(attack: AttackEntry): boolean {
  return !!attack.id?.startsWith(SHADOW_BLADE_PREFIX) && !!attack.id.endsWith(':thrown');
}

/** Атаки клинка тени: ближняя 5 фт и метание 20/60 (психический, ловкость/сила). */
function shadowBladeEntries(effect: EffectInstance, context: WeaponContext): AttackEntry[] {
  const blade = effect.shadowBlade;
  if (!blade?.inHand) return [];
  const totalLevel = context.classes.reduce((acc, c) => acc + Math.max(1, c.level), 0);
  const pb = proficiencyBonus(totalLevel || 1);
  const mod = Math.max(abilityMod(context.abilities.str ?? 10), abilityMod(context.abilities.dex ?? 10));
  const melee: AttackEntry = {
    id: `${SHADOW_BLADE_PREFIX}${effect.id}`,
    name: 'Клинок тени',
    hit: d20Expr(pb + mod),
    damage: damageExpression(blade.dice, mod),
    damageType: 'psychic',
    rangeType: 'melee',
    rangeNormal: 5,
    rangeLong: 0,
  };
  return [
    melee,
    {
      ...melee,
      id: `${melee.id}:thrown`,
      name: 'Клинок тени (метание)',
      rangeType: 'ranged',
      rangeNormal: 20,
      rangeLong: 60,
    },
  ];
}

/**
 * Производный лоадаут: сохранённые атаки/руки + оружие и оверрайды от активных
 * эффектов (Shadow Blade — временный клинок в правой руке, Shillelagh — кость и
 * характеристика клуба/посоха) + оружие монаха (кость боевых искусств и лучшая
 * из Силы/Ловкости). Чистая функция, одинаковая на клиенте и сервере,
 * поэтому порядок и индексы атак совпадают. Без таких эффектов возвращает исходные
 * значения без копирования.
 */
export function loadoutOf(input: LoadoutInput): ActorLoadout {
  const attacks = input.attacks ?? [];
  const context: WeaponContext = {
    abilities: input.abilities ?? {},
    classes: input.classes ?? [],
    ...(input.choices ? { choices: input.choices } : {}),
  };
  const effects = input.effects ?? [];
  const hasOverrides = effects.some((e) => e.weaponOverride);
  const blades = effects.filter((e) => e.shadowBlade);
  // Монах: оружие монаха (2024) и кэнсэй-оружие основной руки — max(Сила, Ловкость) и кость боевых искусств.
  const monkLevel = context.classes.find((c) => c.className === 'monk')?.level ?? 0;
  const kenseiKey = kenseiWeaponKeyOf({ attacks, hands: input.hands, classes: input.classes });
  const hasMonk =
    monkLevel > 0 &&
    attacks.some(
      (attack) =>
        !!attack.weaponKey &&
        (attack.weaponKey === kenseiKey || isMonkWeapon(weaponByKey(attack.weaponKey)))
    );
  if (!hasOverrides && !blades.length && !hasMonk) return { attacks, hands: input.hands, context };
  let mapped = hasMonk
    ? attacks.map((attack) => applyMonkWeapon(attack, attacks, input.hands, context, kenseiKey))
    : attacks;
  if (hasOverrides) mapped = mapped.map((attack) => applyWeaponOverrides(attack, effects, context));
  const extra = blades.flatMap((effect) => shadowBladeEntries(effect, context));
  // Клинок тени занимает правую руку вместо оружия; после конца эффекта руки возвращаются.
  const activeBlade = blades.find((e) => e.shadowBlade?.inHand);
  const hands = activeBlade ? { ...input.hands, right: `${SHADOW_BLADE_PREFIX}${activeBlade.id}` } : input.hands;
  return { attacks: extra.length ? [...mapped, ...extra] : mapped, hands, context };
}

/**
 * Монах: оружие монаха (простое рукопашное/лёгкое воинское) и кэнсэй-оружие
 * основной руки — попадание и урон от лучшей характеристики, кость боевых
 * искусств вместо меньшей кости оружия (XGE «Kensei Weapons» / PHB'24 «Martial Arts»).
 * Имя, тип урона и дистанции остаются из листа.
 */
function applyMonkWeapon(
  attack: AttackEntry,
  attacks: AttackEntry[],
  hands: SheetHands | undefined,
  context: WeaponContext,
  kenseiKey: string | undefined
): AttackEntry {
  if (!attack.weaponKey) return attack;
  const weapon = weaponByKey(attack.weaponKey);
  if (!weapon || weapon.unarmed) return attack;
  const kensei = attack.weaponKey === kenseiKey;
  if (!kensei && !isMonkWeapon(weapon)) return attack;
  const baseOpts = { ...(!kensei && hands?.right === attack.id ? { grip: rightGrip(attacks, hands) } : {}) };
  // Базовый (немонашеский) расчёт — для сравнения: совпадает → запись считаем авторасчётом.
  const base = weaponAttackEntry(weapon, context, { ...baseOpts, monkWeapon: false });
  const entry = weaponAttackEntry(weapon, context, { ...baseOpts, monkWeapon: true });
  // Пометка: `true` — правили вручную; `false` — явный авторасчёт (добавлено из списка);
  // `undefined` — старая запись: ручной считаем, если формула не совпала с авторасчётом
  // (сохраняем ручное «+1»-оружие), иначе обновляем по правилам класса.
  const autoHit =
    attack.manualHit === false || (attack.manualHit === undefined && attack.hit.trim() === base.hit);
  const autoDamage =
    attack.manualDamage === false ||
    (attack.manualDamage === undefined && damageIsAuto(weapon, context, baseOpts, attack.damage, base.damage));
  const hit = autoHit ? entry.hit : attack.hit;
  const damage = autoDamage ? entry.damage : attack.damage;
  if (hit === attack.hit && damage === attack.damage) return attack;
  return { ...attack, hit, damage };
}

/** Совпадает ли урон с авторасчётом: текущий хват или второй хват универсального оружия. */
function damageIsAuto(
  weapon: WeaponDef,
  context: WeaponContext,
  baseOpts: { grip?: '1h' | '2h' },
  damage: string,
  baseDamage: string
): boolean {
  if (damage.trim() === baseDamage) return true;
  if (!weapon.properties.includes('V') || !weapon.versatileDamage) return false;
  const otherGrip = baseOpts.grip === '1h' ? '2h' : '1h';
  return damage.trim() === weaponAttackEntry(weapon, context, { ...baseOpts, grip: otherGrip, monkWeapon: false }).damage;
}

/**
 * Подмена атаки оружия эффектами (Shillelagh): кость, тип урона и характеристика
 * (`abilityMod` зафиксирован при касте). `offhand` — вторая рука: урон без
 * модификатора (как `weaponAttackEntry` с `offhand: true`).
 */
export function applyWeaponOverrides(
  attack: AttackEntry,
  effects: EffectInstance[] | undefined,
  context: WeaponContext,
  opts: { offhand?: boolean } = {}
): AttackEntry {
  if (!attack.weaponKey) return attack;
  let result = attack;
  for (const override of effects ?? []) {
    const o = override.weaponOverride;
    if (!o || !o.weapons.includes(attack.weaponKey)) continue;
    const totalLevel = context.classes.reduce((acc, c) => acc + Math.max(1, c.level), 0);
    const pb = proficiencyBonus(totalLevel || 1);
    const mod = opts.offhand ? Math.min(0, o.abilityMod) : o.abilityMod;
    result = {
      ...result,
      hit: d20Expr(pb + o.abilityMod),
      damage: damageExpression(o.dice, mod),
      damageType: o.damageType,
    };
  }
  return result;
}

/** Оружие в руке из лоадаута (с учётом производных от эффектов). */
export function handOf(loadout: ActorLoadout, hand: HandKey): AttackEntry | undefined {
  return handAttackOf(loadout.attacks, loadout.hands, hand);
}
