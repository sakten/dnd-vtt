import type { AbilityKey } from '../domain/core';
import type { ConditionKey, EffectDuration, Modifier } from '../domain/effects';
import type { RaceSelection } from '../domain/race';
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
  /** Классовая черта; у видов не задаётся. */
  className?: string;
  subclass?: string;
  /** Черта вида и выбранный вариант наследия. */
  raceKey?: string;
  raceChoice?: { id: string; key: string };
  levelReq: number;
  /** Нужна активная Ярость (эффект `class:barbarian:rage`). */
  requiresRage?: boolean;
  /** Только при активной Безрассудной атаке. */
  requiresReckless?: boolean;
  /** Срабатывает только с активной меткой (`sourceKey` эффекта-метки). */
  requiresMarker?: string;
  /** Только попадание кэнсэй-оружием основной руки (XGE, Kensei). */
  kensei?: boolean;
  /** Не автоматический: предлагается окном после попадания (Ошеломляющий удар). */
  choiceOnHit?: boolean;
  /** Расход ресурса при срабатывании. */
  resourceKey?: string;
  resourceAmount?: number;
  /** Добавочные кости (`2d6`); у Frenzy подставляются по уровню варвара. */
  dice?: string;
  /** Кости = кость боевых искусств монаха (Deft Strike). */
  martialArtsDice?: boolean;
  /** Кости = бонус урона Ярости: 2d6 до 9 уровня, 3d6 с 9-го. */
  rageDamageDice?: boolean;
  /** Плоский бонус = половина уровня класса (вверх) — Divine Fury. */
  halfLevelBonus?: string;
  /** Плоский бонус = модификатор способности — Psionic Strike (+Int). */
  abilityBonus?: AbilityKey;
  /** Тип урона добавки (не задан — как у атаки). */
  damageType?: string;
  /** Состояние цели без спасброска (Кувырок холма: сбит с ног). */
  conditionOnHit?: { condition: ConditionKey; duration?: EffectDuration };
  /** Временный эффект на цель (Холод мороза: −10 фт скорости). */
  targetEffect?: { name: string; duration: EffectDuration; modifiers: Omit<Modifier, 'id'>[]; conditions?: ConditionKey[] };
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
  {
    id: 'monk.kensei:deftStrike',
    name: 'Ловкий удар',
    className: 'monk',
    subclass: 'kensei',
    levelReq: 6,
    kensei: true,
    choiceOnHit: true,
    resourceKey: 'monk:focus',
    resourceAmount: 1,
    martialArtsDice: true,
  },
  {
    id: 'race:XPHB:Goliath:giantAncestry:fire',
    name: 'Ожог огня',
    raceKey: 'XPHB:Goliath',
    raceChoice: { id: 'giant', key: 'fire' },
    levelReq: 1,
    choiceOnHit: true,
    resourceKey: 'race:XPHB:Goliath:giantAncestry',
    resourceAmount: 1,
    dice: '1d10',
    damageType: 'fire',
  },
  {
    id: 'race:XPHB:Goliath:giantAncestry:frost',
    name: 'Холод мороза',
    raceKey: 'XPHB:Goliath',
    raceChoice: { id: 'giant', key: 'frost' },
    levelReq: 1,
    choiceOnHit: true,
    resourceKey: 'race:XPHB:Goliath:giantAncestry',
    resourceAmount: 1,
    dice: '1d6',
    damageType: 'cold',
    targetEffect: {
      name: 'Холод мороза',
      duration: { type: 'endOfTurn', of: 'source' },
      modifiers: [{ target: 'speed', mode: 'add', value: -10 }],
    },
  },
  {
    id: 'race:XPHB:Goliath:giantAncestry:hill',
    name: 'Кувырок холма',
    raceKey: 'XPHB:Goliath',
    raceChoice: { id: 'giant', key: 'hill' },
    levelReq: 1,
    choiceOnHit: true,
    resourceKey: 'race:XPHB:Goliath:giantAncestry',
    resourceAmount: 1,
    conditionOnHit: { condition: 'prone', duration: { type: 'endOfTurn', of: 'target' } },
  },
];

/** Бонусные «наездники» персонажа по классам/подклассам, виду и уровню. */
export function attackRidersFor(classes: ClassLevel[], race?: RaceSelection): AttackRiderDef[] {
  const out: AttackRiderDef[] = [];
  const total = classes.reduce((sum, entry) => sum + entry.level, 0);
  for (const def of ATTACK_RIDERS) {
    if (def.raceKey) {
      if (race?.key !== def.raceKey) continue;
      if (def.raceChoice && race.choices?.[def.raceChoice.id] !== def.raceChoice.key) continue;
      if (total < def.levelReq) continue;
      out.push(def);
      continue;
    }
    if (!def.className) continue;
    const entry = classes.find((c) => c.className === def.className);
    if (!entry) continue;
    if (def.subclass && entry.subclass !== def.subclass) continue;
    if (entry.level < def.levelReq) continue;
    out.push(def);
  }
  return out;
}
