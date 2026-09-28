import type { AutomationDef, AutomationEffect, AutomationSave, GrantedAction, LightSource, ZoneDef } from '../../domain/automation';
import { spellDamageExpression } from '../spellCast';
import type { DamagePartRole, Spell } from '../spells';
import { SPELL_BASES } from './bases';
import { CONCENTRATION, PERMANENT } from './header';
import type { AutomationOptions } from './variants';

/** Кость части данных по роли (нет роли — запасное литеральное значение). */
function partDice(spell: Spell, role: DamagePartRole, fallback: string): string {
  return spell.damage?.parts?.find((part) => part.role === role)?.dice ?? fallback;
}

/** Заклинания с собранной в коде автоматизацией (билдеры, не строки каталога). */
export const BUILTIN_AUTOMATION = new Set([
  'XPHB:Dispel Evil and Good',
  'XPHB:Heal',
  'XPHB:Heroism',
  'XPHB:Searing Smite',
  'XPHB:Ensnaring Strike',
  "XPHB:Heroes' Feast",
  'XPHB:Vitriolic Sphere',
  'XGE:Negative Energy Flood',
  "XPHB:Melf's Acid Arrow",
  'XGE:Enervation',
]);

/** Реализована ли механика заклинания билдером кода (для маркера «не автоматизировано»). */
export function spellBuiltinAutomated(spellKey: string): boolean {
  return BUILTIN_AUTOMATION.has(spellKey);
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



/** Сумма костей одного вида: `1d8` + `1d8` → `2d8` (иначе обычное сложение). */
export function addDice(expr: string | undefined, extra: string): string {
  if (!expr) return extra;
  const a = expr.match(/^(\d*)d(\d+)$/);
  const b = extra.match(/^(\d*)d(\d+)$/);
  if (a && b && a[2] === b[2]) return `${Number(a[1] || 1) + Number(b[1] || 1)}d${a[2]}`;
  return `${expr} + ${extra}`;
}
