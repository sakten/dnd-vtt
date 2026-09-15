import type { ReactionTriggerKind } from '../domain/actions';
import type { AbilityKey } from '../domain/core';
import type { ClassLevel } from '../domain/sheet';

/**
 * Триггеры реакционных заклинаний (R1/R2). Ключ — ключ заклинания,
 * значение — момент, когда его можно предложить.
 */
export const REACTION_SPELL_TRIGGERS: Record<string, ReactionTriggerKind> = {
  'XPHB:Shield': 'attackHit',
  'XGE:Absorb Elements': 'attackHit',
  'XPHB:Hellish Rebuke': 'damage',
  'XPHB:Counterspell': 'spellCast',
};

export function reactionSpellTrigger(key: string): ReactionTriggerKind | undefined {
  return REACTION_SPELL_TRIGGERS[key];
}

/** Параметры Counterspell (R1/R2): ключ, круг, дистанция срабатывания. */
export const COUNTERSPELL = { key: 'XPHB:Counterspell', level: 3, rangeFeet: 60 } as const;

/** Типы урона Absorb Elements (при получении — сопротивление до следующего хода). */
export const ABSORB_ELEMENTS_TYPES = ['acid', 'cold', 'fire', 'lightning', 'thunder'];

/** Реакции-поглощения: ключ заклинания → типы урона, дающие сопротивление. */
export const ABSORB_SPELL_TYPES: Record<string, string[]> = {
  'XGE:Absorb Elements': ABSORB_ELEMENTS_TYPES,
};

export function absorbTypesOf(spellKey: string): string[] {
  return ABSORB_SPELL_TYPES[spellKey] ?? [];
}

/**
 * Реакционные черты классов/подклассов (ручной каталог). Эффекты автоматизируются
 * на сервере по `kind`: halveDamage — половина урона атаки, acBonus — кость в AC,
 * reduceDamage — снижение урона союзнику на кости, acBonusAlly — кость в AC союзнику.
 */
export interface ReactionFeatureDef {
  id: string;
  name: string;
  className: string;
  subclass?: string;
  levelReq: number;
  trigger: ReactionTriggerKind;
  kind: 'halveDamage' | 'acBonus' | 'disadvantage' | 'counterAttack' | 'reduceDamage' | 'acBonusAlly' | 'rollBonus';
  resourceKey?: string;
  resourceAmount?: number;
  /** Максимальная дистанция до защищаемого союзника, футы. */
  rangeFeet?: number;
  /** Готовый бонус к броску атаки (Направленный удар: +10). */
  amount?: number;
  /** Кости эффекта (reduceDamage/acBonusAlly). */
  dice?: string;
  /** Плюс модификатор способности к снижению (Отражение атак, +Ловкость). */
  abilityBonus?: AbilityKey;
  /** Плюс уровень класса к снижению (Отражение атак, +уровень монаха). */
  levelBonusClass?: string;
  /** Полное снижение урона даёт окно перенаправления (Отражение атак). */
  redirect?: { save: AbilityKey; meleeRangeFeet: number; rangedRangeFeet: number; martialArtsDice: number };
}

const REACTION_FEATURES: ReactionFeatureDef[] = [
  {
    id: 'cleric.light:wardingFlare',
    name: 'Палящая вспышка',
    className: 'cleric',
    subclass: 'light',
    levelReq: 1,
    trigger: 'attackRoll',
    kind: 'disadvantage',
    resourceKey: 'cleric.light:wardingFlare',
    resourceAmount: 1,
  },
  {
    id: 'rogue:uncannyDodge',
    name: 'Невероятное уклонение',
    className: 'rogue',
    levelReq: 5,
    trigger: 'attackHit',
    kind: 'halveDamage',
  },
  {
    id: 'fighter.battleMaster:parry',
    name: 'Парирование',
    className: 'fighter',
    subclass: 'battleMaster',
    levelReq: 3,
    trigger: 'attackHit',
    kind: 'acBonus',
    resourceKey: 'fighter.battleMaster:superiorityDice',
    resourceAmount: 1,
  },
  {
    id: 'fighter.battleMaster:riposte',
    name: 'Ответный удар',
    className: 'fighter',
    subclass: 'battleMaster',
    levelReq: 3,
    trigger: 'attackMiss',
    kind: 'counterAttack',
    resourceKey: 'fighter.battleMaster:superiorityDice',
    resourceAmount: 1,
  },
  {
    id: 'barbarian.ancestralGuardian:spiritShield',
    name: 'Щит духов',
    className: 'barbarian',
    subclass: 'ancestralGuardian',
    levelReq: 6,
    trigger: 'attackHit',
    kind: 'reduceDamage',
    rangeFeet: 30,
    dice: '2d6',
  },
  {
    id: 'fighter.cavalier:wardingManeuver',
    name: 'Защитный манёвр',
    className: 'fighter',
    subclass: 'cavalier',
    levelReq: 7,
    trigger: 'attackHit',
    kind: 'acBonusAlly',
    rangeFeet: 5,
    dice: '1d8',
    resourceKey: 'fighter.cavalier:wardingManeuver',
    resourceAmount: 1,
  },
  {
    id: 'monk:deflectAttacks',
    name: 'Отражение атак',
    className: 'monk',
    levelReq: 3,
    trigger: 'attackHit',
    kind: 'reduceDamage',
    dice: '1d10',
    abilityBonus: 'dex',
    levelBonusClass: 'monk',
    redirect: { save: 'dex', meleeRangeFeet: 5, rangedRangeFeet: 60, martialArtsDice: 2 },
  },
  {
    id: 'cleric.war:guidedStrike',
    name: 'Направленный удар',
    className: 'cleric',
    subclass: 'war',
    levelReq: 3,
    trigger: 'attackMiss',
    kind: 'rollBonus',
    amount: 10,
    resourceKey: 'cleric:channelDivinity',
    resourceAmount: 1,
    rangeFeet: 30,
  },
  {
    id: 'barbarian.berserker:retaliation',
    name: 'Возмездие',
    className: 'barbarian',
    subclass: 'berserker',
    levelReq: 10,
    trigger: 'damage',
    kind: 'counterAttack',
    rangeFeet: 5,
  },
];

/** Кость превосходства боевого мастера по уровню воина. */
export function superiorityDie(level: number): number {
  if (level >= 18) return 12;
  if (level >= 10) return 10;
  return 8;
}

/** Реакционные черты, доступные персонажу по его классам/подклассам и уровню. */
export function reactionFeatures(classes: ClassLevel[]): ReactionFeatureDef[] {
  const out: ReactionFeatureDef[] = [];
  for (const def of REACTION_FEATURES) {
    const entry = classes.find((c) => c.className === def.className);
    if (!entry) continue;
    if (def.subclass && entry.subclass !== def.subclass) continue;
    if (entry.level < def.levelReq) continue;
    out.push(def);
  }
  return out;
}

