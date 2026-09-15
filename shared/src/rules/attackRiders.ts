import type { AbilityKey } from '../domain/core';
import type { ConditionKey } from '../domain/effects';
import type { ClassLevel } from '../domain/sheet';

/**
 * Бонусный урон классовых черт при попадании оружием (R8.8, партия подклассов).
 * Срабатывают автоматически в момент нанесения урона (`applyWeaponAttackDamage`),
 * условия (ярость/безрассудство/метка/ресурс) проверяет сервер.
 */
export interface AttackRiderDef {
  /** Ключ черты (`класс[.подкласс]:имя`). */
  id: string;
  name: string;
  className: string;
  subclass?: string;
  levelReq: number;
  /** Нужна активная Ярость (эффект `class:barbarian:rage`). */
  requiresRage?: boolean;
  /** Только при активной Безрассудной атаке. */
  requiresReckless?: boolean;
  /** Срабатывает только с активной меткой (`sourceKey` эффекта-метки). */
  requiresMarker?: string;
  /** Не автоматический: предлагается окном после попадания (Ошеломляющий удар). */
  choiceOnHit?: boolean;
  /** Расход ресурса при срабатывании. */
  resourceKey?: string;
  resourceAmount?: number;
  /** Добавочные кости (`2d6`); у Frenzy подставляются по уровню варвара. */
  dice?: string;
  /** Кости = бонус урона Ярости: 2d6 до 9 уровня, 3d6 с 9-го. */
  rageDamageDice?: boolean;
  /** Плоский бонус = половина уровня класса (вверх) — Divine Fury. */
  halfLevelBonus?: string;
  /** Плоский бонус = модификатор способности — Psionic Strike (+Int). */
  abilityBonus?: AbilityKey;
  /** Тип урона добавки (не задан — как у атаки). */
  damageType?: string;
  /**
   * Спасбросок цели при срабатывании (Ошеломляющий удар): при провале — condition,
   * при успехе — скорость ×1/2. СЛ = 8 + бонус владения + мод Мудрости монаха.
   */
  save?: { ability: AbilityKey; condition: ConditionKey; halfSpeedOnSuccess?: boolean };
}

export const ATTACK_RIDERS: AttackRiderDef[] = [
  {
    id: 'barbarian.zealot:divineFury',
    name: 'Божественная ярость',
    className: 'barbarian',
    subclass: 'zealot',
    levelReq: 3,
    requiresRage: true,
    dice: '1d6',
    halfLevelBonus: 'barbarian',
    damageType: 'radiant',
  },
  {
    id: 'barbarian.berserker:frenzy',
    name: 'Неистовство',
    className: 'barbarian',
    subclass: 'berserker',
    levelReq: 3,
    requiresRage: true,
    requiresReckless: true,
    rageDamageDice: true,
  },
  {
    id: 'fighter.psiWarrior:psionicStrike',
    name: 'Псионический удар',
    className: 'fighter',
    subclass: 'psiWarrior',
    levelReq: 3,
    choiceOnHit: true,
    resourceKey: 'fighter.psiWarrior:psionicEnergyDice',
    resourceAmount: 1,
    dice: '1d6',
    abilityBonus: 'int',
    damageType: 'force',
  },
  {
    id: 'monk:stunningStrike',
    name: 'Ошеломляющий удар',
    className: 'monk',
    levelReq: 5,
    choiceOnHit: true,
    resourceKey: 'monk:focus',
    resourceAmount: 1,
    save: { ability: 'con', condition: 'stunned', halfSpeedOnSuccess: true },
  },
];

/** Бонусные «наездники» персонажа по классам/подклассам и уровню. */
export function attackRidersFor(classes: ClassLevel[]): AttackRiderDef[] {
  const out: AttackRiderDef[] = [];
  for (const def of ATTACK_RIDERS) {
    const entry = classes.find((c) => c.className === def.className);
    if (!entry) continue;
    if (def.subclass && entry.subclass !== def.subclass) continue;
    if (entry.level < def.levelReq) continue;
    out.push(def);
  }
  return out;
}
