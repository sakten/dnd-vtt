import type { ReactionTriggerKind } from '../domain/actions';
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
 * на сервере по `kind`: halveDamage — половина урона атаки, acBonus — кость в AC.
 */
export interface ReactionFeatureDef {
  id: string;
  name: string;
  className: string;
  subclass?: string;
  levelReq: number;
  trigger: ReactionTriggerKind;
  kind: 'halveDamage' | 'acBonus' | 'disadvantage' | 'counterAttack';
  resourceKey?: string;
  resourceAmount?: number;
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

