import type { AutomationDef, AutomationEffect, AutomationPayload, AutomationSave, GrantedAction, LightSource, ZoneDef } from '../../domain/automation';
import { spellDamageExpression, spellUpcastAt } from '../spellCast';
import type { DamagePartRole, Spell } from '../spells';
import { SPELL_BASES } from './bases';
import { CONCENTRATION, PERMANENT, UNTIL_NEXT_TURN, zoneMoveAction } from './header';
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

/** Сумма костей одного вида: `1d8` + `1d8` → `2d8` (иначе обычное сложение). */
export function addDice(expr: string | undefined, extra: string): string {
  if (!expr) return extra;
  const a = expr.match(/^(\d*)d(\d+)$/);
  const b = extra.match(/^(\d*)d(\d+)$/);
  if (a && b && a[2] === b[2]) return `${Number(a[1] || 1) + Number(b[1] || 1)}d${a[2]}`;
  return `${expr} + ${extra}`;
}
