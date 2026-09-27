import type { AutomationDef, AutomationEffect, AutomationPayload, AutomationSave, GrantedAction, LightSource, ZoneDef } from '../../domain/automation';
import type { AbilityKey } from '../../domain/core';
import type { ConditionKey, Modifier } from '../../domain/effects';
import { spellCantripDice, spellDamageExpression, spellUpcastAt, spellUpcastDice, wallArea } from '../spellCast';
import type { DamagePartRole, Spell } from '../spells';
import { SPELL_BASES } from './bases';
import { CONCENTRATION, PERMANENT, RESISTANCE_TYPES, UNTIL_NEXT_TURN, spellEffect, zoneMoveAction } from './header';
import { SPELL_VARIANTS } from './variants';
import type { AutomationOptions } from './variants';

/** Кость части данных по роли (нет роли — запасное литеральное значение). */
function partDice(spell: Spell, role: DamagePartRole, fallback: string): string {
  return spell.damage?.parts?.find((part) => part.role === role)?.dice ?? fallback;
}

/** Все части данных с ролью (составной урон — несколько `main` в порядке текста). */
function partsOfRole(spell: Spell, role: DamagePartRole): { dice: string; types: string[] }[] {
  return (spell.damage?.parts ?? []).filter((part) => part.role === role);
}

/** Заклинания с собранной в коде автоматизацией (билдеры, не строки каталога). */
export const BUILTIN_AUTOMATION = new Set([
  "XPHB:Dragon's Breath",
  'XPHB:Vampiric Touch',
  'XPHB:Flame Blade',
  'XPHB:Guardian of Faith',
  'XPHB:Conjure Fey',
  'XPHB:Dispel Evil and Good',
  'XPHB:Telekinesis',
  'TCE:Green-Flame Blade',
  'TCE:Booming Blade',
  'XPHB:True Strike',
  'XGE:Zephyr Strike',
  'XPHB:Sunbeam',
  'XPHB:Heat Metal',
  'XPHB:Call Lightning',
  'XPHB:Heal',
  'XPHB:Heroism',
  'XPHB:Enhance Ability',
  'XGE:Skill Empowerment',
  'XPHB:Command',
  'XGE:Far Step',
  'XPHB:Dimension Door',
  'XGE:Thunder Step',
  'XGE:Healing Spirit',
  'XPHB:Cordon of Arrows',
  'XGE:Storm Sphere',
  'XPHB:Armor of Agathys',
  'XPHB:Magic Weapon',
  'XPHB:Shillelagh',
  'XGE:Shadow Blade',
  'XGE:Magic Stone',
  'XPHB:Conjure Minor Elementals',
  'XPHB:Elemental Weapon',
  'TCE:Spirit Shroud',
  'XGE:Flame Arrows',
  'XPHB:Fire Shield',
  'XGE:Shadow of Moil',
  'XPHB:Eyebite',
  'XPHB:Invisibility',
  'XPHB:Greater Invisibility',
  'XPHB:Searing Smite',
  'XPHB:Ensnaring Strike',
  'XPHB:Divine Smite',
  'XPHB:Thunderous Smite',
  'XPHB:Wrathful Smite',
  'XPHB:Blinding Smite',
  'XPHB:Shining Smite',
  'XPHB:Staggering Smite',
  'XPHB:Banishing Smite',
  'XPHB:Hail of Thorns',
  'XPHB:Lightning Arrow',
  'XPHB:Protection from Energy',
  'XPHB:Aid',
  "XPHB:Heroes' Feast",
  'XPHB:Resistance',
  'XGE:Elemental Bane',
  'XPHB:Flame Strike',
  'XPHB:Ice Storm',
  'XPHB:Destructive Wave',
  'XPHB:Wall of Thorns',
  'XPHB:Wall of Fire',
  'XPHB:Blade Barrier',
  'XGE:Wall of Sand',
  'XPHB:Wall of Ice',
  'XPHB:Wall of Force',
  'XPHB:Wall of Stone',
  'XGE:Wall of Light',
  'XPHB:Ice Knife',
  'XPHB:Vitriolic Sphere',
  'XPHB:False Life',
  'XGE:Negative Energy Flood',
  "XPHB:Jallarzi's Storm of Radiance",
  'XPHB:Dominate Beast',
  'XPHB:Dominate Person',
  'XPHB:Blindness/Deafness',
  'XGE:Life Transference',
  'XPHB:Bestow Curse',
  'XPHB:Witch Bolt',
  "XPHB:Melf's Acid Arrow",
  'XGE:Enervation',
  "XGE:Melf's Minute Meteors",
  'XGE:Immolation',
]);

/** Реализована ли механика заклинания билдером кода (для маркера «не автоматизировано»). */
export function spellBuiltinAutomated(spellKey: string): boolean {
  return BUILTIN_AUTOMATION.has(spellKey);
}

/** Кость заклинания с учётом круга/уровня; `fallback` — если данных нет. */
export function spellDice(spell: Spell, opts: AutomationOptions, fallback = ''): string {
  return spellDamageExpression(spell, opts.castLevel ?? Math.max(1, spell.level), opts.characterLevel ?? 1) ?? fallback;
}

/** Эффект-носитель выданного действия: бафф на себя (или цель у DB) с `actions`. */
export function actionCarrier(
  spell: Spell,
  action: GrantedAction,
  opts: { to?: 'self' | 'targets'; variant?: string; light?: LightSource } = {}
): AutomationEffect {
  return {
    name: spell.name,
    duration: CONCENTRATION,
    concentration: true,
    to: opts.to ?? 'self',
    modifiers: [],
    ...(opts.variant ? { variant: opts.variant } : {}),
    ...(opts.light ? { light: opts.light } : {}),
    actions: [action],
  };
}

/**
 * Dragon's Breath: бафф-эффект выдаёт действие-выдох (конус 15 фт, спас DEX,
 * тип урона и скейл от круга фиксируются при касте).
 */
export function breathSpellDef(spell: Spell, opts: AutomationOptions): AutomationDef | undefined {
  if (spell.key !== "XPHB:Dragon's Breath") return undefined;
  const variant = SPELL_VARIANTS[spell.key];
  if (!variant || variant.param !== 'damageType') return undefined;
  const type = variant.options.includes(opts.variant ?? '') ? opts.variant! : variant.options[0]!;
  const dice = spellDice(spell, opts);
  const area = spell.areaSpec ?? { shape: 'cone' as const, size: 15 };
  const breath: AutomationDef = {
    key: spell.key,
    name: 'Выдох',
    resolution: 'save',
    save: { ability: 'dex', half: true },
    ...(dice ? { damage: { dice, types: [type] } } : {}),
    area,
    targeting: { kind: 'area', area, range: Math.max(5, area.size) },
  };
  return {
    key: spell.key,
    name: spell.name,
    resolution: 'effect',
    concentration: true,
    effects: [
      actionCarrier(spell, { id: 'breath', name: 'Выдох', cost: 'action', def: breath }, { to: 'targets', variant: type }),
    ],
  };
}

/** Vampiric Touch (XPHB 2024): атака при касте, повтор магическим действием, лечение на половину урона. */
export function vampiricTouchDef(spell: Spell, opts: AutomationOptions): AutomationDef | undefined {
  if (spell.key !== 'XPHB:Vampiric Touch') return undefined;
  const dice = spellDice(spell, opts);
  const strike = (name: string, targeting?: AutomationDef['targeting']): AutomationDef => ({
    key: spell.key,
    name,
    resolution: 'attack',
    attack: { rangeType: 'melee' },
    ...(dice ? { damage: { dice, types: ['necrotic'] } } : {}),
    lifesteal: true,
    ...(targeting ? { targeting } : {}),
  });
  return {
    ...strike(spell.name),
    concentration: true,
    effects: [actionCarrier(spell, { id: 'touch', name: 'Касание', cost: 'action', def: strike('Касание', { kind: 'creature', range: 5 }) })],
  };
}

/** Flame Blade (XPHB 2024): бонусным действием — клинок; магическим — атака огнём (+мод. характеристики). */
export function flameBladeDef(spell: Spell, opts: AutomationOptions): AutomationDef | undefined {
  if (spell.key !== 'XPHB:Flame Blade') return undefined;
  const dice = spellDice(spell, opts, '3d6');
  const blade: AutomationDef = {
    key: spell.key,
    name: 'Огненный клинок',
    resolution: 'attack',
    attack: { rangeType: 'melee' },
    damage: { dice, types: ['fire'], abilityMod: true },
    targeting: { kind: 'creature', range: 5 },
  };
  return {
    key: spell.key,
    name: spell.name,
    resolution: 'effect',
    concentration: true,
    effects: [actionCarrier(spell, { id: 'blade', name: 'Клинок', cost: 'action', def: blade }, { light: { bright: 10, dim: 10 } })],
  };
}

/** Sunbeam (XPHB 2024): луч 60×5 от себя; повтор магическим действием, слепота до начала вашего след. хода. */
export function sunbeamDef(spell: Spell, opts: AutomationOptions): AutomationDef | undefined {
  if (spell.key !== 'XPHB:Sunbeam') return undefined;
  const dice = spellDice(spell, opts, '6d8');
  const area = spell.areaSpec ?? { shape: 'line' as const, size: 60, width: 5 };
  const payload = {
    save: { ability: 'con' as const, half: true },
    damage: { dice, types: ['radiant'] },
    area,
  };
  const blind: AutomationEffect = {
    name: 'Sunbeam',
    duration: { type: 'endOfTurn', of: 'source' },
    to: 'targets',
    conditions: ['blinded'],
    modifiers: [],
  };
  const beam: AutomationDef = {
    key: spell.key,
    name: 'Луч',
    resolution: 'save',
    ...payload,
    targeting: { kind: 'area', area, range: Math.max(5, area.size) },
    effects: [blind],
  };
  return {
    key: spell.key,
    name: spell.name,
    resolution: 'save',
    concentration: true,
    ...payload,
    effects: [blind, actionCarrier(spell, { id: 'beam', name: 'Луч', cost: 'action', def: beam }, { light: { bright: 30, dim: 30, sunlight: true } })],
  };
}

/** Heat Metal (XPHB 2024): авто-урон 2d8 огня + помеха на атаки/проверки; повтор бонусным действием. */
export function heatMetalDef(spell: Spell, opts: AutomationOptions): AutomationDef | undefined {
  if (spell.key !== 'XPHB:Heat Metal') return undefined;
  const damage = { dice: spellDice(spell, opts, '2d8'), types: ['fire'] };
  const holding: AutomationEffect = {
    name: 'Heat Metal',
    duration: { type: 'endOfTurn', of: 'source' },
    to: 'targets',
    modifiers: [
      { target: 'attack', mode: 'disadvantage' },
      { target: 'check', mode: 'disadvantage' },
    ],
  };
  const burn: AutomationDef = {
    key: spell.key,
    name: 'Раскалённый металл',
    resolution: 'auto',
    damage,
    targeting: { kind: 'creature', range: 60 },
    effects: [holding],
  };
  return {
    key: spell.key,
    name: spell.name,
    resolution: 'auto',
    concentration: true,
    damage,
    effects: [holding, actionCarrier(spell, { id: 'burn', name: 'Раскалённый металл', cost: 'bonus', def: burn })],
  };
}

/**
 * Witch Bolt (XPHB 2024): дальняя атака 2к12 (+1к12/круг к первичному урону);
 * связь — на попадании и при промахе: бонусным действием 1к12 электричеством
 * без броска (каркас Heat Metal). Обрыв по дистанции/укрытию не отслеживается.
 */
export function witchBoltDef(spell: Spell, opts: AutomationOptions): AutomationDef | undefined {
  if (spell.key !== 'XPHB:Witch Bolt') return undefined;
  const level = Math.max(spell.level, opts.castLevel ?? spell.level);
  const initial = scaledDice(partDice(spell, 'main', '2d12'), spell.upcast?.dice, upcastSteps(spell, level));
  const bolt: AutomationDef = {
    key: spell.key,
    name: 'Разряд',
    resolution: 'auto',
    damage: { dice: partDice(spell, 'repeat', '1d12'), types: ['lightning'] },
    targeting: { kind: 'creature', range: 60 },
  };
  return {
    key: spell.key,
    name: spell.name,
    resolution: 'attack',
    attack: { rangeType: 'ranged' },
    count: 1,
    concentration: true,
    damage: { dice: `${initial}lightning`, types: ['lightning'] },
    effects: [actionCarrier(spell, { id: 'bolt', name: 'Разряд', cost: 'bonus', def: bolt })],
  };
}

/**
 * Melf's Acid Arrow (XPHB 2024): дальняя атака 4к4 кислотой; при попадании — ещё
 * 2к4 в конце следующего хода цели (одноразовый `triggers.endOfTurn`); при промахе —
 * половина первичного урона (`halfOnMiss`). Апкаст +1к4 к обеим частям.
 */
export function acidArrowDef(spell: Spell, opts: AutomationOptions): AutomationDef | undefined {
  if (spell.key !== "XPHB:Melf's Acid Arrow") return undefined;
  const level = Math.max(spell.level, opts.castLevel ?? spell.level);
  const steps = upcastSteps(spell, level);
  const primary = scaledDice(partDice(spell, 'main', '4d4'), spell.upcast?.dice, steps);
  const delayed = scaledDice(partDice(spell, 'repeat', '2d4'), spell.upcast?.dice, steps);
  return {
    key: spell.key,
    name: spell.name,
    resolution: 'attack',
    attack: { rangeType: 'ranged' },
    count: 1,
    halfOnMiss: true,
    damage: { dice: `${primary}acid`, types: ['acid'] },
    effects: [
      {
        name: spell.name,
        duration: PERMANENT,
        to: 'targets',
        modifiers: [],
        triggers: { endOfTurn: { damage: { dice: `${delayed}acid`, types: ['acid'] } } },
      },
    ],
  };
}

/**
 * Enervation (XGE): спас DEX; успех — половина урона и конец (аппроксимация:
 * 4к8/2 вместо броска 2к8); провал — 4к8 некротикой и повтор действием 4к8
 * с лечением половины (концентрация; каркас Heat Metal + `lifesteal`).
 */
export function enervationDef(spell: Spell, opts: AutomationOptions): AutomationDef | undefined {
  if (spell.key !== 'XGE:Enervation') return undefined;
  const level = Math.max(spell.level, opts.castLevel ?? spell.level);
  const steps = upcastSteps(spell, level);
  // Части из данных: успех 2к8, провал 4к8, повтор действием 4к8; всё +1к8/круг.
  const success = scaledDice(partDice(spell, 'success', '2d8'), spell.upcast?.dice, steps);
  const initial = scaledDice(partDice(spell, 'main', '4d8'), spell.upcast?.dice, steps);
  const repeat = scaledDice(partDice(spell, 'repeat', '4d8'), spell.upcast?.dice, steps);
  const drain: AutomationDef = {
    key: spell.key,
    name: 'Вытягивание жизни',
    resolution: 'auto',
    damage: { dice: `${repeat}necrotic`, types: ['necrotic'] },
    lifesteal: true,
    targeting: { kind: 'creature', range: 60 },
  };
  const carrier = actionCarrier(spell, { id: 'drain', name: 'Вытягивание жизни', cost: 'action', def: drain });
  carrier.selfOnFail = true;
  return {
    key: spell.key,
    name: spell.name,
    resolution: 'save',
    concentration: true,
    save: { ability: 'dex' },
    damage: { dice: `${initial}necrotic`, types: ['necrotic'] },
    successDamage: { dice: `${success}necrotic`, types: ['necrotic'] },
    effects: [carrier],
  };
}

/**
 * Melf's Minute Meteors (XGE): 6 метеоров (+2 за круг выше 3); бонусным действием
 * метеор в точку ≤120 фт — бурст 5 фт, спас DEX, 2к6 огнём (половина при успехе).
 */
export function minuteMeteorsDef(spell: Spell, opts: AutomationOptions): AutomationDef | undefined {
  if (spell.key !== "XGE:Melf's Minute Meteors") return undefined;
  const level = Math.max(spell.level, opts.castLevel ?? spell.level);
  const charges = 6 + 2 * Math.max(0, level - 3);
  const meteorDice = spell.damage?.dice?.[0] ?? '2d6';
  const burst: AutomationDef = {
    key: spell.key,
    name: 'Метеор',
    resolution: 'save',
    save: { ability: 'dex', half: true },
    damage: { dice: meteorDice, types: ['fire'] },
    area: { shape: 'sphere', size: 5 },
    targeting: { kind: 'area', area: { shape: 'sphere', size: 5 }, range: 120 },
  };
  const effect: AutomationEffect = {
    name: spell.name,
    duration: CONCENTRATION,
    concentration: true,
    to: 'self',
    modifiers: [],
    charges: { count: charges },
    actions: [{ id: 'meteor', name: 'Метеор', cost: 'bonus', def: burst }],
  };
  return { key: spell.key, name: spell.name, resolution: 'effect', concentration: true, effects: [effect] };
}

/**
 * Immolation (XGE): спас DEX — 8к6 огнём (половина при успехе); провал — цель
 * горит (яркий свет 30 + тусклый 30), в конце каждого её хода повтор DEX: провал —
 * ещё 4к6 огнём, успех — конец заклинания. Апкаста нет.
 */
export function immolationDef(spell: Spell): AutomationDef | undefined {
  if (spell.key !== 'XGE:Immolation') return undefined;
  const initial = partDice(spell, 'main', spell.damage?.dice?.[0] ?? '8d6');
  const burnDice = partDice(spell, 'repeat', spell.damage?.dice?.[1] ?? '4d6');
  const burn: AutomationEffect = {
    name: spell.name,
    duration: {
      type: 'untilSave',
      ability: 'dex',
      dc: 0,
      timing: 'end',
      damage: { dice: `${burnDice}fire`, types: ['fire'] },
    },
    concentration: true,
    to: 'targets',
    modifiers: [],
    light: { bright: 30, dim: 30 },
  };
  return {
    key: spell.key,
    name: spell.name,
    resolution: 'save',
    concentration: true,
    save: { ability: 'dex', half: true },
    damage: { dice: `${initial}fire`, types: ['fire'] },
    effects: [burn],
  };
}

/** Call Lightning (XPHB 2024): туча-цилиндр 60 фт, удар 5 фт при касте (в центр) и повтор действием. */
export function callLightningDef(spell: Spell, opts: AutomationOptions): AutomationDef | undefined {
  if (spell.key !== 'XPHB:Call Lightning') return undefined;
  const dice = spellDice(spell, opts, '3d10');
  const impact: AutomationDef = {
    key: spell.key,
    name: 'Удар молнии',
    resolution: 'save',
    save: { ability: 'dex', half: true },
    damage: { dice, types: ['lightning'] },
    area: { shape: 'sphere', size: 5 },
    targeting: { kind: 'area', area: { shape: 'sphere', size: 5 }, range: 60 },
  };
  return {
    key: spell.key,
    name: spell.name,
    resolution: 'save',
    concentration: true,
    save: { ability: 'dex', half: true },
    damage: { dice, types: ['lightning'] },
    area: { shape: 'sphere', size: 5 },
    zone: {
      area: { shape: 'cylinder', size: 60 },
      origin: 'point',
      duration: CONCENTRATION,
      flags: { subtle: true },
      actions: [{ id: 'strike', name: 'Удар молнии', cost: 'action', def: impact }],
    },
  };
}

/** Heroism: иммунитет к испугу + временные HP (мод заклинательной характеристики) в начале хода цели. */
export function heroismDef(spell: Spell, opts: AutomationOptions): AutomationDef | undefined {
  if (spell.key !== 'XPHB:Heroism') return undefined;
  const mod = Math.max(0, Math.round(opts.spellMod ?? 0));
  const effect: AutomationEffect = {
    name: spell.name,
    duration: CONCENTRATION,
    concentration: true,
    to: 'targets',
    modifiers: [],
    conditionImmunities: ['frightened'],
    ...(mod > 0 ? { triggers: { startOfTurn: { tempHp: mod } } } : {}),
  };
  return { key: spell.key, name: spell.name, resolution: 'effect', concentration: true, effects: [effect] };
}

/** Protection from Energy: выбранный при касте тип — сопротивление ему у цели (концентрация). */
export function protectionFromEnergyDef(spell: Spell, opts: AutomationOptions): AutomationDef | undefined {
  if (spell.key !== 'XPHB:Protection from Energy') return undefined;
  const variant = SPELL_VARIANTS[spell.key];
  if (!variant) return undefined;
  const type = variant.options.includes(opts.variant ?? '') ? opts.variant! : variant.options[0]!;
  const effect: AutomationEffect = {
    name: spell.name,
    duration: CONCENTRATION,
    concentration: true,
    to: 'targets',
    modifiers: [{ target: 'damage', mode: 'resistance', value: 0, filter: { damageType: type } }],
    variant: type,
  };
  return { key: spell.key, name: spell.name, resolution: 'effect', concentration: true, effects: [effect] };
}

/** Resistance (XPHB 2024): выбранный тип — −1d4 получаемого урона этого типа, заряд раз в ход. */
export function resistanceDef(spell: Spell, opts: AutomationOptions): AutomationDef | undefined {
  if (spell.key !== 'XPHB:Resistance') return undefined;
  const variant = SPELL_VARIANTS[spell.key];
  const type = variant?.options.includes(opts.variant ?? '') ? opts.variant! : variant?.options[0] ?? RESISTANCE_TYPES[0]!;
  const effect: AutomationEffect = {
    name: spell.name,
    duration: CONCENTRATION,
    concentration: true,
    to: 'targets',
    modifiers: [],
    damageReduce: { dice: SPELL_BASES.resistance.damageReduceDice, types: [type] },
    charges: { count: 1 },
    variant: type,
  };
  return { key: spell.key, name: spell.name, resolution: 'effect', concentration: true, effects: [effect] };
}

/**
 * Elemental Bane (XGE): спас CON; при провале цель теряет сопротивление выбранному
 * типу, а первый урон этим типом за ход наносит ей дополнительно 2к6 того же типа.
 * Апкаст из данных (`upcast.targets`) — доп. цели, кости не растут.
 */
export function elementalBaneDef(spell: Spell, opts: AutomationOptions): AutomationDef | undefined {
  if (spell.key !== 'XGE:Elemental Bane') return undefined;
  const variant = SPELL_VARIANTS[spell.key];
  const type = variant?.options.includes(opts.variant ?? '') ? opts.variant! : variant?.options[0] ?? 'acid';
  const effect: AutomationEffect = {
    name: spell.name,
    duration: CONCENTRATION,
    concentration: true,
    to: 'targets',
    targets: 1,
    modifiers: [],
    elementalBane: { damageType: type, dice: SPELL_BASES.elementalBane.extraDice },
    variant: type,
  };
  return spellEffect(spell.key, spell.name, [effect], { ability: 'con' });
}

/** Skill Empowerment: выбранный навык — экспертиза цели (ПБ носителя добавляется ещё раз). */
export function skillEmpowermentDef(spell: Spell, opts: AutomationOptions): AutomationDef | undefined {
  if (spell.key !== 'XGE:Skill Empowerment') return undefined;
  const variant = SPELL_VARIANTS[spell.key];
  if (!variant || variant.param !== 'skill') return undefined;
  const skill = variant.options.includes(opts.variant ?? '') ? opts.variant! : variant.options[0]!;
  const effect: AutomationEffect = {
    name: spell.name,
    duration: CONCENTRATION,
    concentration: true,
    to: 'targets',
    modifiers: [{ target: 'check', mode: 'add', value: '$proficiency', filter: { skill } }],
    variant: skill,
  };
  return { key: spell.key, name: spell.name, resolution: 'effect', concentration: true, effects: [effect] };
}

/** Armor of Agathys (XPHB): 5 врем. HP и ответный холод атакующему (+5 за круг выше 1). */
export function armorOfAgathysDef(spell: Spell, opts: AutomationOptions): AutomationDef | undefined {
  if (spell.key !== 'XPHB:Armor of Agathys') return undefined;
  const castLevel = Math.max(1, opts.castLevel ?? Math.max(1, spell.level));
  const amount = 5 + (spellUpcastAt(spell, castLevel).flat ?? 0);
  const effect: AutomationEffect = {
    name: spell.name,
    duration: PERMANENT,
    to: 'self',
    modifiers: [],
    tempHp: amount,
    retaliate: { damageType: 'cold', amount },
  };
  return { key: spell.key, name: spell.name, resolution: 'effect', effects: [effect] };
}

/** Aid (XPHB): +5 к максимуму HP, ещё +5 за каждый круг выше 2 (до 3 целей). */
export function aidDef(spell: Spell, opts: AutomationOptions): AutomationDef | undefined {
  if (spell.key !== 'XPHB:Aid') return undefined;
  const castLevel = Math.max(spell.level, opts.castLevel ?? spell.level);
  const amount = 5 + (spellUpcastAt(spell, castLevel).flat ?? 0);
  const effect: AutomationEffect = {
    name: spell.name,
    duration: PERMANENT,
    to: 'targets',
    targets: 3,
    modifiers: [{ target: 'maxHp', mode: 'add', value: amount }],
  };
  return { key: spell.key, name: spell.name, resolution: 'effect', effects: [effect] };
}

/**
 * Heroes' Feast (XPHB 2024): до 12 существ — сопротивление яду, иммунитет к испугу
 * и отравлению, +2к10 к максимуму и текущим HP (24 часа; в VTT — до долгого отдыха).
 * Пир идёт 1 час и эффекты вступают после него — внебоевые часы не моделируются.
 */
export function heroesFeastDef(spell: Spell): AutomationDef | undefined {
  if (spell.key !== "XPHB:Heroes' Feast") return undefined;
  const effect: AutomationEffect = {
    name: spell.name,
    duration: PERMANENT,
    to: 'targets',
    targets: 12,
    modifiers: [{ target: 'damage', mode: 'resistance', value: 0, filter: { damageType: 'poison' } }],
    conditionImmunities: ['frightened', 'poisoned'],
    maxHpBonus: { dice: SPELL_BASES.heroesFeast.maxHpDice },
  };
  return { key: spell.key, name: spell.name, resolution: 'effect', effects: [effect] };
}

/**
 * Bestow Curse (XPHB 2024): спас WIS; выбранное проклятие — помеха проверкам и
 * спасброскам характеристики, помеха атак против вас, запрет действий (принудительное
 * Уклонение) или +1d8 некротикой с ваших атак. Апкаст: 4-й круг — 10 минут концентрации,
 * 5-й+ — без концентрации (8/24 часа и до снятия — в VTT до долгого отдыха).
 */
export function bestowCurseDef(spell: Spell, opts: AutomationOptions): AutomationDef | undefined {
  if (spell.key !== 'XPHB:Bestow Curse') return undefined;
  const castLevel = opts.castLevel ?? spell.level;
  const option = SPELL_VARIANTS[spell.key]?.options.includes(opts.variant ?? '')
    ? opts.variant!
    : 'checks-str';
  const effect: AutomationEffect = {
    name: spell.name,
    duration: castLevel >= 5 ? PERMANENT : CONCENTRATION,
    concentration: castLevel < 5,
    to: 'targets',
    targets: 1,
    modifiers: [],
    variant: option,
  };
  if (option.startsWith('checks-')) {
    const ability = option.slice('checks-'.length) as AbilityKey;
    effect.modifiers = [
      { target: 'check', mode: 'disadvantage', filter: { ability } },
      { target: 'save', mode: 'disadvantage', filter: { ability } },
    ];
  } else if (option === 'attacks') {
    effect.modifiers = [{ target: 'attack', mode: 'disadvantage', filter: { direction: 'against' } }];
  } else if (option === 'dodge') {
    effect.turnDodge = { ability: 'wis' };
  } else {
    effect.takesExtraDamage = { dice: '1d8', damageType: 'necrotic' };
  }
  return {
    key: spell.key,
    name: spell.name,
    resolution: 'effect',
    save: { ability: 'wis' },
    ...(castLevel < 5 ? { concentration: true } : {}),
    ...(castLevel === 4 ? { maxRounds: 100 } : {}),
    ...(castLevel >= 5 ? { maxRounds: null } : {}),
    effects: [effect],
  };
}

/** Command (XPHB): выбранный приказ действует до конца следующего хода цели; Approach/Drop/Flee — ручные. */
export function commandDef(spell: Spell, opts: AutomationOptions): AutomationDef | undefined {
  if (spell.key !== 'XPHB:Command') return undefined;
  const variants = SPELL_VARIANTS[spell.key];
  const variant = variants?.options.includes(opts.variant ?? '') ? opts.variant! : 'halt';
  const modifiers: Omit<Modifier, 'id'>[] = [];
  const conditions: ConditionKey[] = [];
  if (variant === 'halt' || variant === 'grovel') modifiers.push({ target: 'speed', mode: 'multiply', value: 0 });
  if (variant === 'grovel') conditions.push('prone');
  const effect: AutomationEffect = {
    name: spell.name,
    duration: { type: 'endOfTurn', of: 'target' },
    to: 'targets',
    targets: 1,
    modifiers,
    ...(conditions.length ? { conditions } : {}),
    // Обычное и бонусное действие теряется у всех вариантов приказа.
    restrictions: { noActions: true, noBonus: true },
    variant,
  };
  return {
    key: spell.key,
    name: spell.name,
    resolution: 'effect',
    save: { ability: 'wis' },
    excludeCreatureTypes: ['undead'],
    effects: [effect],
  };
}

/** Типы существ для Dominate Beast/Person (XPHB 2024). */
export const DOMINATE_TYPES: Record<string, string> = {
  'XPHB:Dominate Beast': 'beast',
  'XPHB:Dominate Person': 'humanoid',
};

/**
 * Dominate Beast/Person (XPHB 2024): спас WIS (в бою — с преимуществом), очарование
 * и контроль цели, пока держится концентрация; урон даёт повторный спас. Апкаст —
 * длительность: выше базового круга лимит «1 минута» (10 раундов) снимается.
 */
export function dominateDef(spell: Spell, opts: AutomationOptions): AutomationDef | undefined {
  const creatureType = DOMINATE_TYPES[spell.key];
  if (!creatureType) return undefined;
  const castLevel = Math.max(spell.level, opts.castLevel ?? spell.level);
  const effect: AutomationEffect = {
    name: spell.name,
    duration: { type: 'untilSave', ability: 'wis', dc: 0, timing: 'damage' },
    concentration: true,
    to: 'targets',
    modifiers: [],
    conditions: ['charmed'],
    saveOnDamage: {},
    dominates: true,
  };
  return {
    key: spell.key,
    name: spell.name,
    resolution: 'effect',
    concentration: true,
    save: { ability: 'wis' },
    saveAdvantageInCombat: true,
    requiresCreatureTypes: [creatureType],
    ...(castLevel > spell.level ? { maxRounds: null } : {}),
    effects: [effect],
  };
}

/**
 * Blindness/Deafness (XPHB 2024): спас CON, выбранное состояние (вариант),
 * повтор спасброска в конце каждого хода цели; апкаст — доп. цели.
 */
export function blindnessDeafnessDef(spell: Spell, opts: AutomationOptions): AutomationDef | undefined {
  if (spell.key !== 'XPHB:Blindness/Deafness') return undefined;
  const variant = SPELL_VARIANTS[spell.key];
  const condition = (variant?.options.includes(opts.variant ?? '') ? opts.variant! : 'blinded') as ConditionKey;
  const effect: AutomationEffect = {
    name: spell.name,
    duration: { type: 'untilSave', ability: 'con', dc: 0, timing: 'end' },
    to: 'targets',
    targets: 1,
    modifiers: [],
    conditions: [condition],
    variant: condition,
  };
  return {
    key: spell.key,
    name: spell.name,
    resolution: 'effect',
    save: { ability: 'con' },
    effects: [effect],
  };
}

/** Far Step (XGE): телепорт 60 фт при касте; пока концентрация — тем же бонусным действием. */export function farStepDef(spell: Spell): AutomationDef | undefined {
  if (spell.key !== 'XGE:Far Step') return undefined;
  const jump: AutomationDef = {
    key: spell.key,
    name: 'Прыжок',
    resolution: 'utility',
    utility: { kind: 'teleport', amount: 60 },
    targeting: { kind: 'point', range: 60 },
  };
  return {
    key: spell.key,
    name: spell.name,
    resolution: 'utility',
    concentration: true,
    utility: { kind: 'teleport', amount: 60 },
    effects: [actionCarrier(spell, { id: 'farStep', name: 'Прыжок', cost: 'bonus', def: jump })],
  };
}

/**
 * Dimension Door (XPHB 2024): телепорт до 500 фт, можно взять одно согласное
 * существо в 5 фт (приземляется в 5 фт от точки прибытия). Точку можно не видеть
 * (сквозь стены); занятая/непроходимая точка — провал: ячейка тратится, кастер
 * и пассажир получают 4к6 силового урона, никто не перемещается.
 */
export function dimensionDoorDef(spell: Spell): AutomationDef | undefined {
  if (spell.key !== 'XPHB:Dimension Door') return undefined;
  return {
    key: spell.key,
    name: spell.name,
    resolution: 'utility',
    utility: {
      kind: 'teleport',
      amount: 500,
      passenger: { feet: 5, destFeet: 5 },
      // RAW: точку можно не видеть (сквозь стены); занятая точка — провал каста
      // с уроном 4к6 силовым кастеру и пассажиру (ячейка уже потрачена).
      ignoreSight: true,
      blockedDamage: { dice: spell.damage?.dice?.[0] ?? '4d6', types: ['force'] },
    },
    targeting: { kind: 'point', range: 500 },
  };
}

/**
 * Thunder Step (XGE): телепорт до 90 фт; пассажир не крупнее кастера (нет места
 * рядом с точкой — остаётся); сразу после исчезновения — спас CON всем в 10 фт
 * от покинутой точки, 3к10 звуком (половина при успехе), +1к10 за круг выше 3-го.
 */
export function thunderStepDef(spell: Spell, opts: AutomationOptions): AutomationDef | undefined {
  if (spell.key !== 'XGE:Thunder Step') return undefined;
  const level = Math.max(spell.level, opts.castLevel ?? spell.level);
  const dice = scaledDice(partDice(spell, 'main', '3d10'), spell.upcast?.dice, upcastSteps(spell, level));
  return {
    key: spell.key,
    name: spell.name,
    resolution: 'utility',
    utility: {
      kind: 'teleport',
      amount: 90,
      passenger: { feet: 5, destFeet: 5, maxSize: true },
      fromBurst: { feet: 10, save: { ability: 'con', half: true }, damage: { dice, types: ['thunder'] } },
    },
    targeting: { kind: 'point', range: 90 },
  };
}

/** Enhance Ability: выбранная при касте характеристика — преимущество на её проверки. */
export function enhanceAbilityDef(spell: Spell, opts: AutomationOptions): AutomationDef | undefined {
  const variant = SPELL_VARIANTS[spell.key];
  if (!variant || variant.param !== 'ability') return undefined;
  const ability = (variant.options.includes(opts.variant ?? '') ? opts.variant! : variant.options[0]!) as AbilityKey;
  // Апкаст: +1 цель за круг выше 2 (характеристика одна на каст).
  const targets = Math.max(1, (opts.castLevel ?? Math.max(1, spell.level)) - 1);
  const effect: AutomationEffect = {
    name: spell.name,
    duration: CONCENTRATION,
    concentration: true,
    to: 'targets',
    targets,
    modifiers: [{ target: 'check', mode: 'advantage', filter: { ability } }],
    variant: ability,
  };
  return { key: spell.key, name: spell.name, resolution: 'effect', concentration: true, effects: [effect] };
}

/**
 * Invisibility: цель невидима до конца концентрации; бросок атаки или каст
 * носителя досрочно обрывают эффект. Апкаст: +1 цель за круг выше 2-го.
 * Greater Invisibility — без обрыва и апкаста.
 */
export function invisibilityDef(spell: Spell, opts: AutomationOptions): AutomationDef | undefined {
  if (spell.key !== 'XPHB:Invisibility' && spell.key !== 'XPHB:Greater Invisibility') return undefined;
  const greater = spell.key === 'XPHB:Greater Invisibility';
  const targets = greater ? 1 : Math.max(1, (opts.castLevel ?? Math.max(1, spell.level)) - 1);
  const effect: AutomationEffect = {
    name: spell.name,
    duration: PERMANENT,
    concentration: true,
    to: 'targets',
    targets,
    modifiers: [],
    conditions: ['invisible'],
    ...(greater ? {} : { breakOn: ['attack', 'spell'] as const }),
  };
  return { key: spell.key, name: spell.name, resolution: 'effect', concentration: true, effects: [effect] };
}

/** Magic Weapon: оружейные атаки цели — магические, +1/+2/+3 к попаданию и урону (апкаст). */
export function magicWeaponDef(spell: Spell, opts: AutomationOptions): AutomationDef | undefined {
  if (spell.key !== 'XPHB:Magic Weapon') return undefined;
  const castLevel = opts.castLevel ?? Math.max(1, spell.level);
  const bonus = castLevel >= 6 ? 3 : castLevel >= 3 ? 2 : 1;
  const effect: AutomationEffect = {
    name: spell.name,
    duration: PERMANENT,
    to: 'targets',
    modifiers: [
      { target: 'attack', mode: 'add', value: bonus, filter: { weapon: true, unarmed: false } },
      { target: 'damage', mode: 'add', value: bonus, filter: { weapon: true, unarmed: false } },
    ],
    magicWeapon: true,
  };
  return { key: spell.key, name: spell.name, resolution: 'effect', effects: [effect] };
}

/**
 * Shillelagh (XPHB): дубинка или посох в руке — кость кантрипа (d8/d10/d12/2d6 по
 * уровню персонажа), заклинательная характеристика и силовой тип урона. Число
 * характеристики фиксируется при касте в `weaponOverride` (см. `loadoutOf`).
 */
export function shillelaghDef(spell: Spell, opts: AutomationOptions): AutomationDef | undefined {
  if (spell.key !== 'XPHB:Shillelagh') return undefined;
  const effect: AutomationEffect = {
    name: spell.name,
    duration: PERMANENT,
    to: 'self',
    modifiers: [],
    weaponOverride: {
      weapons: ['XPHB:Club', 'XPHB:Quarterstaff'],
      dice: spellCantripDice(spell, opts.characterLevel ?? 1) ?? spell.damage?.dice?.[0] ?? '1d8',
      damageType: spell.damage?.types?.[0] ?? 'force',
      abilityMod: opts.spellMod ?? 0,
    },
  };
  return { key: spell.key, name: spell.name, resolution: 'effect', effects: [effect] };
}

/**
 * Shadow Blade: выданное действие «Вернуть клинок» (живёт в эффекте всегда;
 * клиент показывает его, только пока клинок брошен — `shadowBlade.inHand`).
 */
export function shadowBladeReturnAction(): GrantedAction {
  return {
    id: 'return',
    name: 'Вернуть клинок',
    cost: 'bonus',
    def: {
      key: 'XGE:Shadow Blade:return',
      name: 'Вернуть клинок',
      resolution: 'utility',
      utility: { kind: 'recallWeapon' },
    },
  };
}

/**
 * Shadow Blade (XGE): бонусным действием — синтетический клинок тени в руке
 * (кость по кругу 2d8…5d8, психический, ловкость/сила). Клинок появляется в
 * лоадауте отдельными атаками (ближняя и метание 20/60) и занимает правую руку;
 * брошенный исчезает и возвращается бонусным действием (`shadowBlade.inHand`).
 */
export function shadowBladeDef(spell: Spell, opts: AutomationOptions): AutomationDef | undefined {
  if (spell.key !== 'XGE:Shadow Blade') return undefined;
  const castLevel = Math.max(spell.level, opts.castLevel ?? spell.level);
  const effect: AutomationEffect = {
    name: spell.name,
    duration: CONCENTRATION,
    concentration: true,
    to: 'self',
    modifiers: [],
    shadowBlade: { dice: spellUpcastAt(spell, castLevel).dice ?? spell.damage?.dice?.[0] ?? '2d8', inHand: true },
    actions: [shadowBladeReturnAction()],
  };
  return { key: spell.key, name: spell.name, resolution: 'effect', concentration: true, effects: [effect] };
}

/**
 * Magic Stone (XGE): бонусным действием — до трёх камней. Бросок камня — дальняя
 * заклинательная атака (60 фт): 1d6 + заклинательная характеристика дробящим.
 * Каждый бросок (попал или нет) тратит камень; на нуле эффект гаснет.
 */
export function magicStoneDef(spell: Spell): AutomationDef | undefined {
  if (spell.key !== 'XGE:Magic Stone') return undefined;
  const throwStone: AutomationDef = {
    key: spell.key,
    name: 'Бросок камня',
    resolution: 'attack',
    attack: { rangeType: 'ranged' },
    damage: { dice: spell.damage?.dice?.[0] ?? '1d6', types: ['bludgeoning'], abilityMod: true },
    targeting: { kind: 'creature', range: 60 },
  };
  const effect: AutomationEffect = {
    name: spell.name,
    duration: PERMANENT,
    to: 'self',
    modifiers: [],
    charges: { count: 3 },
    actions: [{ id: 'throw', name: 'Бросок камня', cost: 'action', def: throwStone }],
  };
  return { key: spell.key, name: spell.name, resolution: 'effect', effects: [effect] };
}

/**
 * Conjure Minor Elementals (XPHB 2024): эманация 15 фт вокруг кастера — любая его
 * атака по существу в эманации наносит +2d8 (тип выбран при касте); земля в
 * эманации — сложная местность для врагов.
 */
export function conjureMinorElementalsDef(spell: Spell, opts: AutomationOptions): AutomationDef | undefined {
  if (spell.key !== 'XPHB:Conjure Minor Elementals') return undefined;
  const variants = SPELL_VARIANTS[spell.key];
  const type = variants?.options.includes(opts.variant ?? '') ? opts.variant! : variants?.options[0] ?? 'fire';
  const castLevel = Math.max(spell.level, opts.castLevel ?? spell.level);
  const dice = addDiceExpression(spell.damage?.dice?.[0] ?? '2d8', spellUpcastDice(spell, castLevel));
  return {
    key: spell.key,
    name: spell.name,
    resolution: 'effect',
    concentration: true,
    zone: {
      area: { shape: 'sphere', size: 15 },
      origin: 'self',
      anchor: 'source',
      duration: CONCENTRATION,
      side: 'hostile',
      flags: { difficultTerrain: true },
      aura: {
        effects: [
          {
            name: spell.name,
            duration: PERMANENT,
            to: 'targets',
            modifiers: [],
            takesExtraDamage: { dice, damageType: type },
            variant: type,
          },
        ],
      },
    },
  };
}

/**
 * Elemental Weapon (XPHB): оружие цели — магическое, +1 к попаданию и +1d4 стихией
 * (ступени 5/7: +2/2d4 и +3/3d4 из данных); тип выбирается при касте.
 */
export function elementalWeaponDef(spell: Spell, opts: AutomationOptions): AutomationDef | undefined {
  if (spell.key !== 'XPHB:Elemental Weapon') return undefined;
  const variants = SPELL_VARIANTS[spell.key];
  const type = variants?.options.includes(opts.variant ?? '') ? opts.variant! : variants?.options[0] ?? 'fire';
  const castLevel = Math.max(1, opts.castLevel ?? Math.max(1, spell.level));
  const at = spellUpcastAt(spell, castLevel);
  const effect: AutomationEffect = {
    name: spell.name,
    duration: CONCENTRATION,
    concentration: true,
    to: 'targets',
    modifiers: [
      { target: 'attack', mode: 'add', value: at.attack ?? 1, filter: { weapon: true, unarmed: false } },
      {
        target: 'damage',
        mode: 'add',
        value: `${at.dice ?? spell.damage?.dice?.[0] ?? '1d4'}${type}`,
        filter: { weapon: true, unarmed: false },
      },
    ],
    magicWeapon: true,
    variant: type,
  };
  return {
    key: spell.key,
    name: spell.name,
    resolution: 'effect',
    concentration: true,
    targeting: { kind: 'creature', range: 5 },
    effects: [effect],
  };
}

/** Складывает базовую кость с однотипными костями апкаста: `'1d8'` + `'1d8 + 1d8'` → `'3d8'`. */
export function addDiceExpression(base: string, extra: string | undefined): string {
  if (!extra) return base;
  const m = base.match(/^(\d*)d(\d+)$/);
  if (!m) return `${base} + ${extra}`;
  const terms = extra
    .split('+')
    .map((term) => term.trim())
    .filter(Boolean);
  if (!terms.length || terms.some((term) => !new RegExp(`^\\d*d${m[2]}$`).test(term))) return `${base} + ${extra}`;
  return `${Number(m[1] || 1) + terms.length}d${m[2]}`;
}

/**
 * Spirit Shroud (TCE): аура 10 фт — враги в ней теряют 10 футов скорости и получают
 * доп. урон выбранного типа от атак кастера (аура-метка `takesExtraDamage`).
 */
export function spiritShroudDef(spell: Spell, opts: AutomationOptions): AutomationDef | undefined {
  if (spell.key !== 'TCE:Spirit Shroud') return undefined;
  const variants = SPELL_VARIANTS[spell.key];
  const type = variants?.options.includes(opts.variant ?? '') ? opts.variant! : variants?.options[0] ?? 'cold';
  const castLevel = Math.max(1, opts.castLevel ?? Math.max(1, spell.level));
  const baseDice = spell.damage?.dice?.[0] ?? '1d8';
  const dice = addDiceExpression(baseDice, spellUpcastDice(spell, castLevel));
  return {
    key: spell.key,
    name: spell.name,
    resolution: 'effect',
    concentration: true,
    zone: {
      area: { shape: 'sphere', size: 10 },
      origin: 'self',
      anchor: 'source',
      duration: CONCENTRATION,
      side: 'hostile',
      aura: {
        effects: [
          {
            name: spell.name,
            duration: PERMANENT,
            to: 'targets',
            modifiers: [{ target: 'speed', mode: 'add', value: -10 }],
            takesExtraDamage: { dice, damageType: type },
            variant: type,
          },
        ],
      },
    },
  };
}

/** Flame Arrows (XGE): колчан на 12 боеприпасов — дальние оружейные атаки бьют +1d6 огнём. */
export function flameArrowsDef(spell: Spell): AutomationDef | undefined {
  if (spell.key !== 'XGE:Flame Arrows') return undefined;
  const effect: AutomationEffect = {
    name: spell.name,
    duration: CONCENTRATION,
    concentration: true,
    to: 'targets',
    modifiers: [
      {
        target: 'damage',
        mode: 'add',
        value: '1d6fire',
        filter: { weapon: true, unarmed: false, attackType: 'ranged' },
      },
    ],
    charges: { count: 12, on: 'rangedWeaponAttack' },
  };
  return {
    key: spell.key,
    name: spell.name,
    resolution: 'effect',
    concentration: true,
    targeting: { kind: 'creature', range: 5 },
    effects: [effect],
  };
}

/** Fire Shield (XPHB): тёплый/холодный щит — сопротивление и ответные 2d8 в ближнем бою. */
export function fireShieldDef(spell: Spell, opts: AutomationOptions): AutomationDef | undefined {
  if (spell.key !== 'XPHB:Fire Shield') return undefined;
  const warm = (opts.variant ?? 'warm') !== 'chill';
  const effect: AutomationEffect = {
    name: spell.name,
    duration: PERMANENT,
    to: 'self',
    modifiers: [
      { target: 'damage', mode: 'resistance', value: 0, filter: { damageType: warm ? 'cold' : 'fire' } },
    ],
    retaliate: { damageType: warm ? 'fire' : 'cold', dice: '2d8' },
    variant: warm ? 'warm' : 'chill',
  };
  return { key: spell.key, name: spell.name, resolution: 'effect', effects: [effect] };
}

/** Shadow of Moil (XGE): помеха атакам по носителю, сопротивление излучению, ответные 2d8 некротикой. */
export function shadowOfMoilDef(spell: Spell): AutomationDef | undefined {
  if (spell.key !== 'XGE:Shadow of Moil') return undefined;
  const effect: AutomationEffect = {
    name: spell.name,
    duration: CONCENTRATION,
    concentration: true,
    to: 'self',
    modifiers: [
      { target: 'attack', mode: 'disadvantage', filter: { direction: 'against' } },
      { target: 'damage', mode: 'resistance', value: 0, filter: { damageType: 'radiant' } },
    ],
    retaliate: { damageType: 'necrotic', dice: '2d8' },
  };
  return { key: spell.key, name: spell.name, resolution: 'effect', effects: [effect] };
}

/** Eyebite: эффект варианта на цель (Сон/Паника/Тошнота). */
export function eyebiteEffect(name: string, variant: string): AutomationEffect {
  const base = { name, duration: CONCENTRATION, concentration: true, to: 'targets' as const, modifiers: [] };
  if (variant === 'panicked') return { ...base, conditions: ['frightened'] };
  if (variant === 'sickened') return { ...base, conditions: ['poisoned'] };
  return { ...base, conditions: ['unconscious'], wakeOnDamage: true };
}

/**
 * Eyebite: первичная цель — выбранный эффект (WIS-спас), плюс на кастере
 * носитель с тремя действиями на каждый следующий ход. Спасшиеся помечаются
 * скрытой меткой (`markSaved`) — повторно их не выбрать до конца каста.
 */
export function eyebiteDef(spell: Spell, opts: AutomationOptions): AutomationDef | undefined {
  if (spell.key !== 'XPHB:Eyebite') return undefined;
  const variants = SPELL_VARIANTS[spell.key];
  const variant = variants?.options.includes(opts.variant ?? '') ? opts.variant! : variants?.options[0] ?? 'asleep';
  const action = (id: 'asleep' | 'panicked' | 'sickened', name: string): GrantedAction => ({
    id: `eyebite:${id}`,
    name,
    cost: 'action',
    def: {
      key: `XPHB:Eyebite:${id}`,
      name,
      resolution: 'save',
      save: { ability: 'wis' },
      targeting: { kind: 'creature', range: 60 },
      effects: [eyebiteEffect(name, id)],
    },
  });
  const carrier: AutomationEffect = {
    name: spell.name,
    duration: CONCENTRATION,
    concentration: true,
    to: 'self',
    modifiers: [],
    actions: [
      action('asleep', 'Eyebite: Сон'),
      action('panicked', 'Eyebite: Паника'),
      action('sickened', 'Eyebite: Тошнота'),
    ],
  };
  return {
    key: spell.key,
    name: spell.name,
    resolution: 'effect',
    concentration: true,
    save: { ability: 'wis' },
    targeting: { kind: 'creature', range: 60 },
    effects: [carrier, { ...eyebiteEffect(spell.name, variant), markSaved: true }],
  };
}

/** Searing Smite: доп. 1d6 огня при попадании + урон и спас CON в начале каждого хода цели. */
export function searingSmiteDef(spell: Spell, opts: AutomationOptions): AutomationDef | undefined {
  if (spell.key !== 'XPHB:Searing Smite') return undefined;
  const castLevel = opts.castLevel ?? spell.level;
  const dice = spellDamageExpression(spell, castLevel, opts.characterLevel ?? 1) ?? '1d6';
  return {
    key: spell.key,
    name: spell.name,
    resolution: 'auto',
    damage: { dice, types: ['fire'] },
    effects: [
      {
        name: spell.name,
        duration: { type: 'untilSave', ability: 'con', dc: 0, timing: 'start' },
        to: 'targets',
        modifiers: [],
        triggers: { startOfTurn: { damage: { dice, types: ['fire'] } } },
      },
    ],
  };
}

/** Ensnaring Strike: спас STR или опутан; урон 1d6 в начале хода; выпутывание действием. */
export function ensnaringStrikeDef(spell: Spell, opts: AutomationOptions): AutomationDef | undefined {
  if (spell.key !== 'XPHB:Ensnaring Strike') return undefined;
  const castLevel = opts.castLevel ?? spell.level;
  const dice = spellDamageExpression(spell, castLevel, opts.characterLevel ?? 1) ?? '1d6';
  return {
    key: spell.key,
    name: spell.name,
    resolution: 'save',
    concentration: true,
    save: { ability: 'str' },
    effects: [
      {
        name: spell.name,
        duration: CONCENTRATION,
        concentration: true,
        to: 'targets',
        modifiers: [],
        conditions: ['restrained'],
        escape: { ability: 'str', skill: 'athletics' },
        triggers: { startOfTurn: { damage: { dice, types: ['piercing'] } } },
      },
    ],
  };
}

/** Конфигурация XPHB-смайта (2024): тип урона, спас и эффект при провале. */
export interface SmiteConfig {
  /** Тип добавочного урона. */
  type: string;
  save?: AbilityKey;
  effect?: Omit<AutomationEffect, 'name'>;
  concentration?: boolean;
  /** Вынужденный сдвиг при провале спаса (Thunderous: толчок на 10 фт). */
  forceFeet?: number;
  /** Кости заменяют урон оружия, а не добавляются (Lightning Arrow). */
  replace?: boolean;
  /** Вторичный спас вокруг цели (Hail — 5 фт, Lightning — 10 фт). */
  burst?: {
    rangeFeet: number;
    save: AbilityKey;
    /** Индекс базовой кости всплеска в `damage.dice` (Lightning: 1 → 2d8). */
    diceIndex?: number;
    type?: string;
    includePrimary?: boolean;
  };
}

/**
 * Смайты XPHB (2024): бонусным действием сразу после попадания — доп. кости
 * урона и, при провале спаса, эффект/сдвиг. База и апкаст — из данных
 * (`damage.dice` + `upcast`), не захардкожены.
 */
export const SMITE_CONFIGS: Record<string, SmiteConfig> = {
  'XPHB:Divine Smite': { type: 'radiant' },
  'XPHB:Thunderous Smite': {
    type: 'thunder',
    save: 'str',
    forceFeet: 10,
    effect: { duration: PERMANENT, to: 'targets', modifiers: [], conditions: ['prone'] },
  },
  'XPHB:Wrathful Smite': {
    type: 'necrotic',
    save: 'wis',
    concentration: true,
    effect: {
      duration: { type: 'untilSave', ability: 'wis', dc: 0, timing: 'start' },
      concentration: true,
      to: 'targets',
      modifiers: [],
      conditions: ['frightened'],
    },
  },
  'XPHB:Blinding Smite': {
    type: 'radiant',
    save: 'con',
    concentration: true,
    effect: {
      duration: { type: 'untilSave', ability: 'con', dc: 0, timing: 'start' },
      concentration: true,
      to: 'targets',
      modifiers: [],
      conditions: ['blinded'],
    },
  },
  'XPHB:Shining Smite': {
    type: 'radiant',
    concentration: true,
    effect: {
      duration: CONCENTRATION,
      concentration: true,
      to: 'targets',
      modifiers: [{ target: 'attack', mode: 'advantage', filter: { direction: 'against' } }],
      conditions: [],
      conditionImmunities: ['invisible'],
      light: { bright: 0, dim: 5 },
    },
  },
  'XPHB:Staggering Smite': {
    type: 'psychic',
    save: 'wis',
    effect: { duration: UNTIL_NEXT_TURN, to: 'targets', modifiers: [], conditions: ['stunned'] },
  },
  'XPHB:Banishing Smite': {
    type: 'force',
    save: 'cha',
    concentration: true,
    effect: {
      duration: { type: 'rounds', rounds: 10 },
      concentration: true,
      to: 'targets',
      modifiers: [],
      conditions: ['incapacitated'],
      banish: true,
    },
  },
  'XPHB:Hail of Thorns': {
    type: 'piercing',
    burst: { rangeFeet: 5, save: 'dex', includePrimary: true },
  },
  'XPHB:Lightning Arrow': {
    type: 'lightning',
    replace: true,
    burst: { rangeFeet: 10, save: 'dex', diceIndex: 1 },
  },
};

/** Билдер XPHB-смайта: кости/апкаст из данных, спас и эффект при провале. */
export function xphbSmiteDef(spell: Spell, opts: AutomationOptions): AutomationDef | undefined {
  const cfg = SMITE_CONFIGS[spell.key];
  if (!cfg || !spell.damage?.dice?.length) return undefined;
  const level = Math.max(spell.level, opts.castLevel ?? spell.level);
  const up = spellUpcastDice(spell, level);
  const dice = spellDamageExpression(spell, level, opts.characterLevel ?? 1) ?? spell.damage.dice[0]!;
  const secondary = cfg.burst
    ? {
        rangeFeet: cfg.burst.rangeFeet,
        dice: [spell.damage.dice[cfg.burst.diceIndex ?? 0] ?? spell.damage.dice[0]!, up].filter(Boolean).join(' + '),
        damageType: cfg.burst.type ?? cfg.type,
        save: { ability: cfg.burst.save, half: true },
        ...(cfg.burst.includePrimary ? { includePrimary: true } : {}),
      }
    : undefined;
  return {
    key: spell.key,
    name: spell.name,
    resolution: 'auto',
    ...(cfg.concentration ? { concentration: true } : {}),
    damage: { dice, types: [cfg.type] },
    ...(cfg.save ? { save: { ability: cfg.save } } : {}),
    ...(cfg.forceFeet ? { force: { kind: 'push' as const, feet: cfg.forceFeet } } : {}),
    ...(cfg.effect ? { effects: [{ name: spell.name, ...cfg.effect }] } : {}),
    ...(secondary || cfg.replace
      ? { weaponAttack: { ...(cfg.replace ? { replace: true } : {}), ...(secondary ? { secondary } : {}) } }
      : {}),
  };
}

/** Heal (XPHB 2024): плоское лечение 70 (+10 за круг выше 6), снимает Blinded/Deafened/Poisoned. */
export function healSpellDef(spell: Spell, opts: AutomationOptions): AutomationDef | undefined {
  if (spell.key !== 'XPHB:Heal') return undefined;
  const castLevel = Math.max(spell.level, opts.castLevel ?? spell.level);
  const { flat, perLevel, above } = SPELL_BASES.heal;
  const amount = flat + perLevel * Math.max(0, castLevel - above);
  return {
    key: spell.key,
    name: spell.name,
    resolution: 'auto',
    heal: { dice: String(amount) },
    endConditions: ['blinded', 'deafened', 'poisoned'],
  };
}

/**
 * Steel Wind Strike (XPHB 2024): до 5 существ в 30 фт — заклинательная атака
 * 6к10 силовым (+1к10 за круг выше 5); после атак телепорт в 5 фт от любой цели.
 */
export function steelWindStrikeDef(spell: Spell, opts: AutomationOptions): AutomationDef | undefined {
  if (spell.key !== 'XPHB:Steel Wind Strike') return undefined;
  const castLevel = Math.max(5, opts.castLevel ?? spell.level);
  return {
    key: spell.key,
    name: spell.name,
    resolution: 'attack',
    attack: { rangeType: 'melee' },
    targets: 5,
    count: 5,
    damage: { dice: scaledDice('6d10', '1d10', castLevel - 5), types: ['force'] },
    teleportAfter: { feet: 5 },
  };
}

/**
 * Spiritual Weapon (XPHB 2024): бонусным действием — сила в точке ≤60 фт.
 * Каст заряжает бесплатный «Удар силы» (цель в 5 фт от неё, 1к8 + мод, +1к8/круг).
 * Позже бонусным действием «Перенос силы» двигает её ≤20 фт и снова заряжает удар.
 */
export function spiritualWeaponDef(spell: Spell, opts: AutomationOptions): AutomationDef | undefined {
  if (spell.key !== 'XPHB:Spiritual Weapon') return undefined;
  const castLevel = Math.max(2, opts.castLevel ?? spell.level);
  const damage = {
    dice: scaledDice(spell.damage?.dice?.[0] ?? '1d8', '1d8', castLevel - 2),
    types: ['force'],
    abilityMod: true,
  };
  const strike: GrantedAction = {
    id: 'strike',
    name: 'Удар силы',
    cost: 'free',
    def: {
      key: spell.key,
      name: spell.name,
      resolution: 'attack',
      attack: { rangeType: 'melee' },
      count: 1,
      damage,
      targeting: { kind: 'creature', range: 5, from: 'origin' },
    },
  };
  return {
    key: spell.key,
    name: spell.name,
    resolution: 'effect',
    concentration: true,
    zone: {
      area: { shape: 'sphere', size: 0 },
      origin: 'point',
      duration: CONCENTRATION,
      movable: true,
      actions: [zoneMoveAction('Перенос силы', 'bonus', 20), strike],
      flags: { subtle: true, sprite: 'hammer' },
    },
  };
}

/**
 * Guardian of Faith (XPHB 2024): призрачный страж (спектральный, проход не блокирует)
 * в 30 фт; враг, впервые за ход вошедший в 10 фт или начавший там ход, — спас DEX,
 * 20 излучением (половина при успехе). Страж исчезает, нанеся суммарно 60 урона.
 * Сетка квантует центр: аура r15 от клетки стража ≈ 10 фт по всем направлениям (5×5).
 */
export function guardianOfFaithDef(spell: Spell): AutomationDef | undefined {
  if (spell.key !== 'XPHB:Guardian of Faith') return undefined;
  const trigger: AutomationPayload = {
    save: { ability: 'dex', half: true },
    damage: { dice: '20', types: ['radiant'] },
  };
  return {
    key: spell.key,
    name: spell.name,
    resolution: 'effect',
    zone: {
      area: { shape: 'sphere', size: 15 },
      origin: 'point',
      duration: PERMANENT,
      side: 'hostile',
      excludeSource: true,
      enterOncePerTurn: true,
      dealtLimit: 60,
      triggers: { enter: trigger, startOfTurn: trigger },
    },
  };
}

/**
 * Dispel Evil and Good (XPHB 2024): каст (концентрация) выдаёт действие «Изгнание» —
 * существо типов Celestial/Elemental/Fey/Fiend/Undead в 5 фт, спас CHA; провал —
 * отправка на родной план (токен удаляется навсегда). Бафф «помеха их атакам по вам»
 * и снятие очарования/испуга касанием — TODO (решение владельца, сессия 18).
 */
export function dispelEvilGoodDef(spell: Spell): AutomationDef | undefined {
  if (spell.key !== 'XPHB:Dispel Evil and Good') return undefined;
  const banish: AutomationDef = {
    key: spell.key,
    name: 'Изгнание',
    resolution: 'save',
    save: { ability: 'cha' },
    banishOnFail: true,
    requiresCreatureTypes: ['celestial', 'elemental', 'fey', 'fiend', 'undead'],
    targeting: { kind: 'creature', range: 5 },
  };
  return {
    key: spell.key,
    name: spell.name,
    resolution: 'effect',
    concentration: true,
    effects: [actionCarrier(spell, { id: 'banish', name: 'Изгнание', cost: 'action', def: banish })],
  };
}

/**
 * Telekinesis (XPHB 2024): каст (концентрация) выдаёт действие «Телекинез» (Magic action,
 * повторяется каждый ход): существо до Huge в 60 фт, спас STR; на провале его двигают
 * кликом до 30 фт (по клеткам, вынужденно) и он restrained до начала вашего след. хода.
 * Предметы/носимые вещи и высота — вне скоупа (решение владельца, сессия 18).
 */
export function telekinesisDef(spell: Spell): AutomationDef | undefined {
  if (spell.key !== 'XPHB:Telekinesis') return undefined;
  const restrained: AutomationEffect = {
    name: spell.name,
    duration: UNTIL_NEXT_TURN,
    to: 'targets',
    modifiers: [],
    conditions: ['restrained'],
    concentration: true,
  };
  const grip: AutomationDef = {
    key: spell.key,
    name: 'Телекинез',
    resolution: 'utility',
    save: { ability: 'str' },
    effects: [restrained],
    utility: { kind: 'telekinesis', amount: 30, maxSize: 'huge' },
    targeting: { kind: 'creature', range: 60 },
  };
  return {
    key: spell.key,
    name: spell.name,
    resolution: 'effect',
    concentration: true,
    effects: [actionCarrier(spell, { id: 'grip', name: 'Телекинез', cost: 'action', def: grip })],
  };
}

/**
 * Conjure Fey (XPHB 2024): дух-зона как у Spiritual Weapon: при касте — удар
 * (3к12 + мод. характеристики психическим, испуг до начала вашего след. хода),
 * далее бонусным действием телепорт духа на 30 фт и повторный удар.
 */
export function conjureFeyDef(spell: Spell, opts: AutomationOptions): AutomationDef | undefined {
  if (spell.key !== 'XPHB:Conjure Fey') return undefined;
  const dice = spellDice(spell, opts, '3d12');
  const frightened: AutomationEffect = {
    name: spell.name,
    duration: UNTIL_NEXT_TURN,
    to: 'targets',
    modifiers: [],
    conditions: ['frightened'],
  };
  const strike: GrantedAction = {
    id: 'strike',
    name: 'Удар духа',
    cost: 'free',
    def: {
      key: spell.key,
      name: spell.name,
      resolution: 'attack',
      attack: { rangeType: 'melee' },
      count: 1,
      damage: { dice, types: ['psychic'], abilityMod: true },
      effects: [frightened],
      targeting: { kind: 'creature', range: 5, from: 'origin' },
    },
  };
  return {
    key: spell.key,
    name: spell.name,
    resolution: 'effect',
    concentration: true,
    zone: {
      area: { shape: 'sphere', size: 0 },
      origin: 'point',
      duration: CONCENTRATION,
      movable: true,
      actions: [zoneMoveAction('Шаг духа', 'bonus', 30), strike],
      flags: { subtle: true, sprite: 'fey' },
    },
  };
}

/**
 * Healing Spirit (XGE): дух в кубе 5 фт (в 60 фт, концентрация). Союзное существо,
 * впервые за ход вошедшее в куб или начавшее там ход, лечится 1к6 (+1к6 за круг
 * выше 2); конструктов и нежить дух не лечит. Лимит лечений — 1 + мод.
 * характеристики (мин 2) — заряды зоны; бонусным действием дух движется на 30 фт.
 */
export function healingSpiritDef(spell: Spell, opts: AutomationOptions): AutomationDef | undefined {
  if (spell.key !== 'XGE:Healing Spirit') return undefined;
  const steps = upcastSteps(spell, Math.max(spell.level, opts.castLevel ?? spell.level));
  const heal = { dice: scaledDice(partDice(spell, 'main', '1d6'), spell.upcast?.dice, steps) };
  const trigger: AutomationPayload = { heal };
  return {
    key: spell.key,
    name: spell.name,
    resolution: 'effect',
    concentration: true,
    zone: {
      area: { shape: 'cube', size: 5 },
      origin: 'point',
      duration: CONCENTRATION,
      enterOncePerTurn: true,
      movable: true,
      side: 'ally',
      charges: Math.max(2, 1 + Math.round(opts.spellMod ?? 0)),
      excludeCreatureTypes: ['construct', 'undead'],
      actions: [zoneMoveAction('Перемещение духа', 'bonus', 30)],
      triggers: { enter: trigger, startOfTurn: trigger },
    },
  };
}

/**
 * Cordon of Arrows (XPHB 2024): 4 стрелы в своей клетке (+2 за круг выше 2).
 * Враждебное существо, впервые за ход вошедшее в 30 фт или закончившее там ход,
 * проходит спас DEX или получает 2к4 колющего; стрела тратится. Без стрел конец.
 * Решение владельца: заклинание не трогает союзников источника (side hostile).
 */
export function cordonOfArrowsDef(spell: Spell, opts: AutomationOptions): AutomationDef | undefined {
  if (spell.key !== 'XPHB:Cordon of Arrows') return undefined;
  const castLevel = Math.max(spell.level, opts.castLevel ?? spell.level);
  const payload: AutomationPayload = {
    save: { ability: 'dex' },
    damage: { dice: partDice(spell, 'main', '2d4'), types: ['piercing'] },
  };
  return {
    key: spell.key,
    name: spell.name,
    resolution: 'effect',
    zone: {
      area: { shape: 'sphere', size: 30 },
      origin: 'self',
      duration: PERMANENT,
      enterOncePerTurn: true,
      excludeSource: true,
      side: 'hostile',
      charges: 4 + 2 * (castLevel - spell.level),
      triggers: { enter: payload, endOfTurn: payload },
    },
  };
}

/**
 * Storm Sphere (XGE): сфера r20 (150 фт, концентрация, труднопроходима). Существа
 * в сфере при появлении и в конце своего хода — спас STR, иначе 2к6 дробящего.
 * Бонусным действием — молния по существу в 60 фт от центра: атака заклинанием,
 * 4к6 электричеством, преимущество, если цель внутри сферы. Оба урона +1к6/круг
 * выше 4. Помеха слуховому Восприятию в 30 фт — нарратив (механики проверки нет).
 */
export function stormSphereDef(spell: Spell, opts: AutomationOptions): AutomationDef | undefined {
  if (spell.key !== 'XGE:Storm Sphere') return undefined;
  const steps = upcastSteps(spell, Math.max(spell.level, opts.castLevel ?? spell.level));
  const trigger: AutomationPayload = {
    save: { ability: 'str' },
    damage: {
      dice: scaledDice(partDice(spell, 'trigger', '2d6'), spell.upcast?.dice, steps),
      types: ['bludgeoning'],
    },
  };
  return {
    key: spell.key,
    name: spell.name,
    resolution: 'effect',
    concentration: true,
    zone: {
      area: { shape: 'sphere', size: 20 },
      origin: 'point',
      duration: CONCENTRATION,
      flags: { difficultTerrain: true },
      onCreate: trigger,
      triggers: { endOfTurn: trigger },
      actions: [
        {
          id: 'bolt',
          name: 'Молния',
          cost: 'bonus',
          def: {
            key: spell.key,
            name: 'Молния',
            resolution: 'attack',
            attack: { rangeType: 'ranged', advantageInZone: true },
            count: 1,
            damage: {
              dice: scaledDice(partDice(spell, 'repeat', '4d6'), spell.upcast?.dice, steps),
              types: ['lightning'],
            },
            targeting: { kind: 'creature', range: 60, from: 'origin' },
          },
        },
      ],
    },
  };
}

/**
 * Chain Lightning (XPHB 2024): игрок выбирает первую цель (150 фт); три скачка
 * (+1 за круг выше 6) добираются авто по враждебным существам в 30 фт от неё;
 * все цели — спас DEX, один бросок 10к8 электричеством (половина при успехе).
 */
export function chainLightningDef(spell: Spell, opts: AutomationOptions): AutomationDef | undefined {
  if (spell.key !== 'XPHB:Chain Lightning') return undefined;
  const castLevel = Math.max(6, opts.castLevel ?? spell.level);
  return {
    key: spell.key,
    name: spell.name,
    resolution: 'save',
    save: { ability: 'dex', half: true },
    damage: { dice: spell.damage?.dice?.[0] ?? '10d8', types: ['lightning'] },
    chain: { jumps: 3 + (castLevel - 6), feet: 30 },
  };
}

/**
 * Ice Knife (XPHB 2024): дальняя заклинательная атака (1к10 колющим); вне
 * зависимости от попадания осколок взрывается — цель и все в 5 фт проходят
 * спас DEX и получают 2к6 холодом (апкаст +1к6; при успехе урона нет).
 */
export function iceKnifeDef(spell: Spell, opts: AutomationOptions): AutomationDef | undefined {
  if (spell.key !== 'XPHB:Ice Knife') return undefined;
  const level = Math.max(spell.level, opts.castLevel ?? spell.level);
  const cold = scaledDice(partDice(spell, 'trigger', '2d6'), spell.upcast?.dice, upcastSteps(spell, level));
  return {
    key: spell.key,
    name: spell.name,
    resolution: 'attack',
    attack: { rangeType: 'ranged' },
    count: 1,
    damage: { dice: `${partDice(spell, 'main', '1d10')}piercing`, types: ['piercing'] },
    burst: {
      rangeFeet: 5,
      dice: `${cold}cold`,
      damageType: 'cold',
      save: { ability: 'dex', half: false },
      includePrimary: true,
    },
  };
}

/**
 * Vitriolic Sphere (XPHB 2024): спас DEX (успех — половина первичного урона),
 * 10к4 кислотой (+2к4 за круг выше 4); провал — в конце следующего хода
 * носителя ещё 5к4 кислотой (одноразовый `triggers.endOfTurn`).
 */
export function vitriolicSphereDef(spell: Spell, opts: AutomationOptions): AutomationDef | undefined {
  if (spell.key !== 'XPHB:Vitriolic Sphere') return undefined;
  const level = Math.max(spell.level, opts.castLevel ?? spell.level);
  const primary = scaledDice(partDice(spell, 'main', '10d4'), spell.upcast?.dice, upcastSteps(spell, level));
  return {
    key: spell.key,
    name: spell.name,
    resolution: 'save',
    save: { ability: 'dex', half: true },
    damage: { dice: `${primary}acid`, types: ['acid'] },
    effects: [
      {
        name: spell.name,
        duration: PERMANENT,
        to: 'targets',
        modifiers: [],
        triggers: { endOfTurn: { damage: { dice: `${partDice(spell, 'repeat', '5d4')}acid`, types: ['acid'] } } },
      },
    ],
  };
}

/**
 * False Life (XPHB 2024): временные хиты 2к4 + 4 (+5 за круг выше 1) —
 * утилита `tempHp`: кость бросается один раз и выдаётся кастеру.
 */
export function falseLifeDef(spell: Spell, opts: AutomationOptions): AutomationDef | undefined {
  if (spell.key !== 'XPHB:False Life') return undefined;
  const level = Math.max(spell.level, opts.castLevel ?? spell.level);
  const base = SPELL_BASES.falseLife;
  const bonus = base.perLevel * Math.max(0, level - base.above);
  return {
    key: spell.key,
    name: spell.name,
    resolution: 'utility',
    utility: { kind: 'tempHp', dice: `${base.dice} + ${base.flat}${bonus ? ` + ${bonus}` : ''}` },
  };
}

/**
 * Life Transference (XGE 2024): кастер получает 4к8 некротикой (неуменьшаемой,
 * +1к8 за круг выше 3), одна цель в 30 фт лечится на ×2 полученного урона.
 */
export function lifeTransferenceDef(spell: Spell, opts: AutomationOptions): AutomationDef | undefined {
  if (spell.key !== 'XGE:Life Transference') return undefined;
  const castLevel = Math.max(spell.level, opts.castLevel ?? spell.level);
  const dice = spellDamageExpression(spell, castLevel, opts.characterLevel ?? 1) ?? '4d8';
  return {
    key: spell.key,
    name: spell.name,
    resolution: 'auto',
    damage: { dice, types: ['necrotic'] },
    lifeTransfer: { factor: 2 },
    targeting: { kind: 'creature', range: 30 },
  };
}

/**
 * Negative Energy Flood (XGE): спас CON (успех — половина), 5d12 некротикой;
 * нежить спас не бросает — вместо урона получает половину броска врем. хитами.
 * Убитый этим уроном поднимается зомби (ветка в исполнителе).
 */
export function negativeEnergyFloodDef(spell: Spell): AutomationDef | undefined {
  if (spell.key !== 'XGE:Negative Energy Flood') return undefined;
  const dice = spell.damage?.dice?.[0] ?? '5d12';
  return {
    key: spell.key,
    name: spell.name,
    resolution: 'save',
    save: { ability: 'con', half: true },
    damage: { dice: `${dice}necrotic`, types: ['necrotic'] },
    undeadTempHp: true,
  };
}

/** Часть составного урона: кость и тип (Flame Strike: 5d6 огнём + 5d6 излучением). */
export interface CompositePart {
  dice: string;
  type: string;
}

/** Составной урон одним броском: части, апкаст, выбор типа, спас и эффекты при провале. */
export interface CompositeConfig {
  parts: CompositePart[];
  /** Какие части растут апкастом: `all` — обе (Flame Strike), `first` — только первая (Ice Storm). */
  upcast?: 'all' | 'first';
  /** Индекс части, тип которой выбирается при касте (Destructive Wave: изл./некр.). */
  variantPart?: number;
  save: AutomationSave;
  /** Эффекты при провале спаса (Destructive Wave: ничком). */
  onFail?: Omit<AutomationEffect, 'name'>[];
  /** Зона после каста (Ice Storm: град — труднопроходимость до конца следующего хода). */
  zone?: ZoneDef;
}

export const COMPOSITE_CONFIGS: Record<string, CompositeConfig> = {
  'XPHB:Flame Strike': {
    parts: [
      { dice: '5d6', type: 'fire' },
      { dice: '5d6', type: 'radiant' },
    ],
    upcast: 'all',
    save: { ability: 'dex', half: true },
  },
  'XPHB:Ice Storm': {
    parts: [
      { dice: '2d10', type: 'bludgeoning' },
      { dice: '4d6', type: 'cold' },
    ],
    upcast: 'first',
    save: { ability: 'dex', half: true },
    // Град: труднопроходимость «до конца вашего следующего хода» — круги тикают
    // в начале хода источника, поэтому два.
    zone: {
      area: { shape: 'sphere', size: 20 },
      origin: 'point',
      duration: { type: 'rounds', rounds: 2 },
      flags: { difficultTerrain: true },
    },
  },
  'XPHB:Destructive Wave': {
    parts: [
      { dice: '5d6', type: 'thunder' },
      { dice: '5d6', type: 'radiant' },
    ],
    variantPart: 1,
    save: { ability: 'con', half: true },
    onFail: [{ duration: PERMANENT, to: 'targets', modifiers: [], conditions: ['prone'] }],
  },
};

/** Число шагов апкаста выше базового круга (`upcast.above/every`); 0 — не растёт. */
export function upcastSteps(spell: Spell, castLevel: number): number {
  const up = spell.upcast;
  if (!up?.dice || up.above === undefined || castLevel <= up.above) return 0;
  return Math.floor((castLevel - up.above) / Math.max(1, up.every ?? 1));
}

/** Кость части со скейлом: `base` + `steps` × `extra` (одинаковые кости суммируются). */
export function scaledDice(base: string, extra: string | undefined, steps: number): string {
  let out = base;
  for (let i = 0; i < steps && extra; i++) out = addDice(out, extra);
  return out;
}

/**
 * Составной урон (Flame Strike, Ice Storm, Destructive Wave): части одним броском
 * с типизированными костями (`5d6fire + 5d6radiant`) — защиты цели считаются
 * по каждой части отдельно (`applyDamageToParts`).
 */
export function compositeDamageDef(spell: Spell, opts: AutomationOptions): AutomationDef | undefined {
  const cfg = COMPOSITE_CONFIGS[spell.key];
  if (!cfg) return undefined;
  const castLevel = Math.max(spell.level, opts.castLevel ?? spell.level);
  const steps = upcastSteps(spell, castLevel);
  const componentMains = partsOfRole(spell, 'main');
  const source =
    componentMains.length === cfg.parts.length && !componentMains.some((part) => !part.types.length)
      ? componentMains.map((part) => ({ dice: part.dice, type: part.types[0] ?? '' }))
      : cfg.parts;
  const parts = source.map((part, i) => {
    const scaled =
      cfg.upcast === 'all' || (cfg.upcast === 'first' && i === 0)
        ? scaledDice(part.dice, spell.upcast?.dice, steps)
        : part.dice;
    return {
      dice: scaled,
      // Вариантный тип: выбранный при касте, иначе — дефолт конфига (не порядок типов в данных).
      type: cfg.variantPart === i ? (opts.variant ?? cfg.parts[i]?.type ?? part.type) : part.type,
    };
  });
  return {
    key: spell.key,
    name: spell.name,
    resolution: 'save',
    concentration: spell.concentration === true || undefined,
    save: cfg.save,
    damage: {
      dice: parts.map((p) => `${p.dice}${p.type}`).join(' + '),
      types: [...new Set(parts.map((p) => p.type))],
    },
    ...(cfg.onFail ? { effects: cfg.onFail.map((e) => ({ ...e, name: spell.name })) } : {}),
    ...(cfg.zone ? { zone: cfg.zone } : {}),
  };
}

/**
 * Wall of Thorns (XPHB 2024): стена шипов — при появлении сейв DEX (7d8 колющим),
 * вход/конец хода — сейв DEX (7d8 рубящим, раз за ход); движение сквозь стену ×4,
 * обзор — мгла (`obscured: heavy`; LOS-флаг зон движком пока не читается).
 * Форма — вариант каста: вертикальная/горизонтальная стена или кольцо
 * (внутри свободно 10 фт, стена 5 фт наружу).
 */
export function wallOfThornsDef(spell: Spell, opts: AutomationOptions): AutomationDef | undefined {
  if (spell.key !== 'XPHB:Wall of Thorns') return undefined;
  const castLevel = Math.max(spell.level, opts.castLevel ?? spell.level);
  const steps = upcastSteps(spell, castLevel);
  const piercing = scaledDice(partDice(spell, 'main', '7d8'), spell.upcast?.dice, steps);
  const slashing = scaledDice(partDice(spell, 'trigger', '7d8'), spell.upcast?.dice, steps);
  const thornPayload: AutomationPayload = {
    containment: 'anyCell',
    save: { ability: 'dex', half: true },
    damage: { dice: `${slashing}slashing`, types: ['slashing'] },
  };
  return {
    key: spell.key,
    name: spell.name,
    resolution: 'save',
    concentration: true,
    save: { ability: 'dex', half: true },
    damage: { dice: `${piercing}piercing`, types: ['piercing'] },
    zone: {
      area: wallArea(spell.key, opts.variant)!,
      origin: 'point',
      duration: CONCENTRATION,
      enterOncePerTurn: true,
      triggers: { enter: thornPayload, endOfTurn: thornPayload },
      flags: { difficultTerrain: true, obscured: 'heavy', movementCost: 4 },
    },
  };
}

/**
 * Wall of Fire (XPHB 2024): полоса огня 60×10 или кольцо r10/r5 (концентрация, 1 мин).
 * Появление: спас DEX, 5к8 огнём (половина при успехе); вход/конец хода внутри —
 * тот же спас раз за ход. Решение владельца: полоса 10 фт бьёт с обеих сторон
 * (упрощение RAW-выбора одной стороны; ширина — параметр `WALL_DIMS`).
 */
export function wallOfFireDef(spell: Spell, opts: AutomationOptions): AutomationDef | undefined {
  if (spell.key !== 'XPHB:Wall of Fire') return undefined;
  const castLevel = Math.max(spell.level, opts.castLevel ?? spell.level);
  const steps = upcastSteps(spell, castLevel);
  const dice = scaledDice(partDice(spell, 'main', '5d8'), spell.upcast?.dice, steps);
  const payload: AutomationPayload = {
    containment: 'anyCell',
    save: { ability: 'dex', half: true },
    damage: { dice: `${dice}fire`, types: ['fire'] },
  };
  return {
    key: spell.key,
    name: spell.name,
    resolution: 'save',
    concentration: true,
    save: { ability: 'dex', half: true },
    damage: { dice: `${dice}fire`, types: ['fire'] },
    zone: {
      area: wallArea(spell.key, opts.variant)!,
      origin: 'point',
      duration: CONCENTRATION,
      enterOncePerTurn: true,
      triggers: { enter: payload, endOfTurn: payload },
      // RAW: стена непрозрачна (движок читает мглу; LOS-флаг зон пока не используется).
      flags: { obscured: 'heavy' },
    },
  };
}

/**
 * Blade Barrier (XPHB 2024): стена клинков — линия 100×5 или кольцо r30/r25
 * (концентрация, 10 мин, труднопроходима). Появление/вход/конец хода: спас DEX,
 * 6к10 силовым (половина при успехе). Укрытие 3/4 не механизировано.
 */
export function bladeBarrierDef(spell: Spell, opts: AutomationOptions): AutomationDef | undefined {
  if (spell.key !== 'XPHB:Blade Barrier') return undefined;
  const dice = partDice(spell, 'main', '6d10');
  const payload: AutomationPayload = {
    containment: 'anyCell',
    save: { ability: 'dex', half: true },
    damage: { dice: `${dice}force`, types: ['force'] },
  };
  return {
    key: spell.key,
    name: spell.name,
    resolution: 'save',
    concentration: true,
    save: { ability: 'dex', half: true },
    damage: { dice: `${dice}force`, types: ['force'] },
    zone: {
      area: wallArea(spell.key, opts.variant)!,
      origin: 'point',
      duration: CONCENTRATION,
      enterOncePerTurn: true,
      triggers: { enter: payload, endOfTurn: payload },
      flags: { difficultTerrain: true },
    },
  };
}

/**
 * Wall of Sand (XGE): стена песка 30×10 (концентрация, 10 мин). Блокирует обзор
 * (мгла), движение — нет; внутри существо ослеплено и тратит ×3 движения.
 */
export function wallOfSandDef(spell: Spell, opts: AutomationOptions): AutomationDef | undefined {
  if (spell.key !== 'XGE:Wall of Sand') return undefined;
  const effect: AutomationEffect = {
    name: spell.name,
    duration: PERMANENT,
    to: 'targets',
    modifiers: [],
    conditions: ['blinded'],
    ...(opts.variant ? { variant: opts.variant } : {}),
  };
  return {
    key: spell.key,
    name: spell.name,
    resolution: 'effect',
    concentration: true,
    zone: {
      area: wallArea(spell.key, opts.variant)!,
      origin: 'point',
      duration: CONCENTRATION,
      aura: { effects: [effect] },
      flags: { obscured: 'heavy', movementCost: 3 },
    },
  };
}

/**
 * Wall of Ice (XPHB 2024): стена льда 100×1 фт или купол/сфера r10 (концентрация, 10 мин).
 * Появление: спас DEX, 10к6 холодом (+2к6 за круг выше 6), половина при успехе.
 * Секции по 10 фт: КЗ 12, 30 HP, иммунитеты холод/яд/психика, уязвимость к огню;
 * пробой оставляет «лист холода» — проход сквозь секцию, спас CON 5к6 (+1к6 за круг).
 */
export function wallOfIceDef(spell: Spell, opts: AutomationOptions): AutomationDef | undefined {
  if (spell.key !== 'XPHB:Wall of Ice') return undefined;
  const castLevel = Math.max(spell.level, opts.castLevel ?? spell.level);
  const steps = upcastSteps(spell, castLevel);
  const appear = scaledDice(partDice(spell, 'main', '10d6'), '2d6', steps);
  const sheet = scaledDice(partDice(spell, 'trigger', '5d6'), '1d6', steps);
  return {
    key: spell.key,
    name: spell.name,
    resolution: 'save',
    concentration: true,
    save: { ability: 'dex', half: true },
    damage: { dice: `${appear}cold`, types: ['cold'] },
    zone: {
      area: wallArea(spell.key, opts.variant)!,
      origin: 'point',
      duration: CONCENTRATION,
      wall: {
        sectionFeet: 10,
        hp: 30,
        ac: 12,
        immunities: ['cold', 'poison', 'psychic'],
        vulnerabilities: ['fire'],
        breach: {
          save: { ability: 'con', half: true },
          damage: { dice: `${sheet}cold`, types: ['cold'] },
        },
      },
      flags: { blocksMovement: true, blocksLineOfSight: true },
    },
  };
}

/**
 * Wall of Force (XPHB 2024): невидимая стена 1/4 дюйма — цепочка панелей 10×10
 * или купол/сфера r10 (концентрация, 10 мин). Ничего не проходит физически,
 * обзор сквозь неё свободен, урона нет: неуязвима (секции не создаются),
 * разрезанных при появлении выталкивает.
 */
export function wallOfForceDef(spell: Spell, opts: AutomationOptions): AutomationDef | undefined {
  if (spell.key !== 'XPHB:Wall of Force') return undefined;
  return {
    key: spell.key,
    name: spell.name,
    resolution: 'effect',
    concentration: true,
    zone: {
      area: wallArea(spell.key, opts.variant)!,
      origin: 'point',
      duration: CONCENTRATION,
      wall: { sectionFeet: 10, immune: true, blocksLineOfSight: false },
      flags: { blocksMovement: true },
    },
  };
}

/**
 * Wall of Stone (XPHB 2024): каменная стена 6 дюймов — цепочка панелей 10×10
 * (концентрация, 10 мин; постоянство за полную длительность пока не отслеживаем).
 * Секции: КЗ 15, 30 HP за дюйм → 180 HP, иммунитет яд/психика; пробой — дыра.
 */
export function wallOfStoneDef(spell: Spell, opts: AutomationOptions): AutomationDef | undefined {
  if (spell.key !== 'XPHB:Wall of Stone') return undefined;
  return {
    key: spell.key,
    name: spell.name,
    resolution: 'effect',
    concentration: true,
    zone: {
      area: wallArea(spell.key, opts.variant)!,
      origin: 'point',
      duration: CONCENTRATION,
      wall: {
        sectionFeet: 10,
        hp: 180,
        ac: 15,
        immunities: ['poison', 'psychic'],
        blocksLineOfSight: true,
      },
      flags: { blocksMovement: true, blocksLineOfSight: true },
    },
  };
}

/**
 * Wall of Light (XGE): светящаяся полоса 60×5 фт (концентрация, 10 мин), проходима.
 * Появление: спас CON, 4к8 излучением (половина при успехе) + `blinded` до конца
 * спасброска в конце хода; конец хода внутри — 4к8 без спасброска; стена блокирует
 * обзор, но не проход; свет 120/120. Действие «Луч»: дальняя заклинательная атака
 * (60 фт от стены, 4к8 излучением), после попадания или промаха стена короче на 10 фт.
 */
export function wallOfLightDef(spell: Spell, opts: AutomationOptions): AutomationDef | undefined {
  if (spell.key !== 'XGE:Wall of Light') return undefined;
  const castLevel = Math.max(spell.level, opts.castLevel ?? spell.level);
  const steps = upcastSteps(spell, castLevel);
  const appear = scaledDice(partsOfRole(spell, 'main')[0]?.dice ?? '4d8', spell.upcast?.dice, steps);
  const repeats = partsOfRole(spell, 'repeat');
  const endDice = scaledDice(repeats[0]?.dice ?? '4d8', spell.upcast?.dice, steps);
  const beamDice = scaledDice(repeats[1]?.dice ?? '4d8', spell.upcast?.dice, steps);
  const blind: AutomationEffect = {
    name: spell.name,
    duration: { type: 'untilSave', ability: 'con', dc: 0, timing: 'end' },
    to: 'targets',
    modifiers: [],
    conditions: ['blinded'],
  };
  const beam: GrantedAction = {
    id: 'beam',
    name: 'Луч',
    cost: 'action',
    shrinkFeet: 10,
    def: {
      key: spell.key,
      name: 'Луч света',
      resolution: 'attack',
      attack: { rangeType: 'ranged' },
      count: 1,
      damage: { dice: `${beamDice}radiant`, types: ['radiant'] },
      targeting: { kind: 'creature', range: 60, from: 'origin' },
    },
  };
  return {
    key: spell.key,
    name: spell.name,
    resolution: 'save',
    concentration: true,
    save: { ability: 'con', half: true },
    damage: { dice: `${appear}radiant`, types: ['radiant'] },
    effects: [blind],
    zone: {
      area: wallArea(spell.key, opts.variant)!,
      origin: 'point',
      duration: CONCENTRATION,
      light: { bright: 120, dim: 120 },
      // Стена блокирует обзор, но проходима: непрозрачные клетки, не мгла.
      flags: { blocksLineOfSight: true },
      triggers: { endOfTurn: { damage: { dice: `${endDice}radiant`, types: ['radiant'] } } },
      actions: [beam],
    },
  };
}

/**
 * Jallarzi's Storm of Radiance (XPHB 2024): цилиндр r10 — внутри ослеплённый,
 * оглохший и запрет вербальных; появление/вход/конец хода — спас CON,
 * 2d10 излучением + 2d10 звуком (+1d10 обеим частям за круг выше 5).
 */
export function jallarziDef(spell: Spell, opts: AutomationOptions): AutomationDef | undefined {
  if (spell.key !== "XPHB:Jallarzi's Storm of Radiance") return undefined;
  const castLevel = Math.max(spell.level, opts.castLevel ?? spell.level);
  const steps = upcastSteps(spell, castLevel);
  const mains = partsOfRole(spell, 'main');
  const radiant = scaledDice(mains[0]?.dice ?? '2d10', spell.upcast?.dice, steps);
  const thunder = scaledDice(mains[1]?.dice ?? '2d10', spell.upcast?.dice, steps);
  const save: AutomationSave = { ability: 'con', half: true };
  const storm: AutomationPayload = {
    save,
    damage: { dice: `${radiant}radiant + ${thunder}thunder`, types: ['radiant', 'thunder'] },
  };
  return {
    key: spell.key,
    name: spell.name,
    resolution: 'save',
    concentration: true,
    save,
    damage: storm.damage,
    zone: {
      area: { shape: 'cylinder', size: 10 },
      origin: 'point',
      duration: CONCENTRATION,
      enterOncePerTurn: true,
      flags: { silence: true },
      aura: {
        effects: [
          {
            name: spell.name,
            duration: PERMANENT,
            to: 'targets',
            modifiers: [],
            conditions: ['blinded', 'deafened'],
          },
        ],
      },
      triggers: { enter: storm, endOfTurn: storm },
    },
  };
}

/**
 * Green-Flame Blade (TCE 2024): атака оружием правой руки; на попадании —
 * райдер огнём (0/1к8/2к8/3к8 на 1/5/11/17) и вторичная цель в 5 фт:
 * урон огнём = мод заклинательной характеристики + те же кости.
 */
export function greenFlameBladeDef(spell: Spell, opts: AutomationOptions): AutomationDef | undefined {
  if (spell.key !== 'TCE:Green-Flame Blade') return undefined;
  const dice = spellCantripDice(spell, opts.characterLevel ?? 1);
  return {
    key: spell.key,
    name: spell.name,
    resolution: 'attack',
    attack: { rangeType: 'melee' },
    weaponAttack: {
      ...(dice ? { riderDice: `${dice}fire` } : {}),
      secondary: { rangeFeet: 5, ...(dice ? { dice } : {}), damageType: 'fire' },
    },
  };
}

/** Сумма костей одного вида: `1d8` + `1d8` → `2d8` (иначе обычное сложение). */
export function addDice(expr: string | undefined, extra: string): string {
  if (!expr) return extra;
  const a = expr.match(/^(\d*)d(\d+)$/);
  const b = extra.match(/^(\d*)d(\d+)$/);
  if (a && b && a[2] === b[2]) return `${Number(a[1] || 1) + Number(b[1] || 1)}d${a[2]}`;
  return `${expr} + ${extra}`;
}

/**
 * Booming Blade (TCE): атака оружием правой руки; на попадании — райдер звуком
 * (0/1к8/2к8/3к8 на 1/5/11/17) и эффект «гремящей энергии» до начала вашего
 * следующего хода: добровольное перемещение ≥5 фт — урон 1к8…4к8 и конец.
 */
export function boomingBladeDef(spell: Spell, opts: AutomationOptions): AutomationDef | undefined {
  if (spell.key !== 'TCE:Booming Blade') return undefined;
  const hitDice = spellCantripDice(spell, opts.characterLevel ?? 1);
  const moveDice = addDice(hitDice, '1d8');
  return {
    key: spell.key,
    name: spell.name,
    resolution: 'attack',
    attack: { rangeType: 'melee' },
    weaponAttack: {
      ...(hitDice ? { riderDice: `${hitDice}thunder` } : {}),
      hitEffect: {
        name: spell.name,
        duration: UNTIL_NEXT_TURN,
        to: 'targets',
        modifiers: [],
        onWillingMove: { dice: moveDice, damageType: 'thunder', feet: 5 },
      },
    },
  };
}

/** True Strike (XPHB): атака оружием от заклинательной характеристики, +1к6/2к6/3к6 излучением на 5/11/17. */
export function trueStrikeDef(spell: Spell, opts: AutomationOptions): AutomationDef | undefined {
  if (spell.key !== 'XPHB:True Strike') return undefined;
  const dice = spellCantripDice(spell, opts.characterLevel ?? 1);
  return {
    key: spell.key,
    name: spell.name,
    resolution: 'attack',
    weaponAttack: {
      anyWeapon: true,
      spellAbility: true,
      ...(dice ? { riderDice: `${dice}radiant` } : {}),
    },
  };
}

/**
 * Zephyr Strike (XGE): бонусным действием — перемещение не провоцирует атаки;
 * один раз за время действия атака оружием с преимуществом (+1d8 силовым и
 * скорость +30 до конца хода) — расход и райдер обрабатывает резолв атаки.
 */
export function zephyrStrikeDef(spell: Spell): AutomationDef | undefined {
  if (spell.key !== 'XGE:Zephyr Strike') return undefined;
  return {
    key: spell.key,
    name: spell.name,
    resolution: 'effect',
    concentration: true,
    effects: [
      {
        name: spell.name,
        duration: CONCENTRATION,
        concentration: true,
        to: 'self',
        modifiers: [{ target: 'attack', mode: 'advantage', filter: { weapon: true } }],
        restrictions: { ignoresOpportunityAttacks: true },
        consumeOnAttackRoll: true,
        zephyrStrike: { dice: '1d8', damageType: 'force', speedFeet: 30 },
      },
    ],
  };
}