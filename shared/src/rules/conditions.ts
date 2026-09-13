import type { AbilityKey, AttackRangeType, ConditionInstance, ConditionKey } from '../types';

/**
 * Состояния (Ф8): каталог, названия и авто-эффекты. Чистые функции, общие для
 * сервера (применение) и клиента (отображение/подсказки).
 */

export const CONDITION_NAMES: Record<ConditionKey, string> = {
  blinded: 'Ослеплён',
  charmed: 'Очарован',
  deafened: 'Оглох',
  exhaustion: 'Истощение',
  frightened: 'Испуган',
  grappled: 'Схвачен',
  incapacitated: 'Недееспособен',
  invisible: 'Невидим',
  paralyzed: 'Парализован',
  petrified: 'Окаменел',
  poisoned: 'Отравлен',
  prone: 'Сбит с ног',
  restrained: 'Обездвижен',
  stunned: 'Ошеломлён',
  unconscious: 'Без сознания',
  dead: 'Мёртв',
  custom: 'Состояние',
};

export const CONDITION_KEYS = Object.keys(CONDITION_NAMES) as ConditionKey[];

export const CONDITION_DESCRIPTIONS: Record<ConditionKey, string> = {
  blinded: 'Не видит: свои атаки с помехой, по нему — с преимуществом.',
  charmed: 'Не может атаковать очаровавшего; тот имеет преимущество на социальные проверки.',
  deafened: 'Не слышит; провал проверок, требующих слуха.',
  exhaustion: '−2 к броскам d20 и −5 фт скорости за каждый уровень; 6 — смерть.',
  frightened: 'Помеха на атаки и проверки, пока источник в поле зрения; не может приближаться.',
  grappled: 'Скорость 0; помеха на атаки; по нему — преимущество.',
  incapacitated: 'Не может совершать действия и реакции.',
  invisible: 'Атаки с преимуществом; по нему — с помехой; не отображается игрокам.',
  paralyzed: 'Недееспособен, не двигается; авто-провал спасбросков Str/Dex; атаки в упор — авто-крит.',
  petrified: 'Окаменел: недееспособен, не двигается; сопротивление всем типам урона.',
  poisoned: 'Помеха на атаки и проверки характеристик.',
  prone: 'Только ползком; свои атаки с помехой; в упор по нему — преимущество, дальние — помеха.',
  restrained: 'Скорость 0; помеха атакам и спасброскам Ловкости; по нему — преимущество.',
  stunned: 'Недееспособен, не двигается; авто-провал спасбросков Str/Dex; по нему — преимущество.',
  unconscious: 'Без сознания: недееспособен, не двигается; авто-провал спасбросков Str/Dex; авто-крит в упор.',
  dead: 'Мёртв.',
  custom: 'Особое состояние.',
};

export function conditionDescription(key: ConditionKey): string {
  return CONDITION_DESCRIPTIONS[key] ?? CONDITION_DESCRIPTIONS.custom;
}

const NAME_TO_KEY = new Map<string, ConditionKey>(
  (Object.keys(CONDITION_NAMES) as ConditionKey[]).map((k) => [CONDITION_NAMES[k].toLowerCase(), k])
);

export function conditionName(key: ConditionKey): string {
  return CONDITION_NAMES[key] ?? CONDITION_NAMES.custom;
}

/** Ключ состояния по названию 5e.tools/русскому/слагу; неизвестное — `custom`. */
export function conditionKeyOf(name: string): ConditionKey {
  const raw = name.toLowerCase().trim();
  if (raw in CONDITION_NAMES) return raw as ConditionKey;
  return NAME_TO_KEY.get(raw) ?? 'custom';
}

export function hasCondition(conditions: ConditionInstance[] | undefined, key: ConditionKey): boolean {
  return !!conditions?.some((c) => c.key === key);
}

const has = (c: ConditionInstance[] | undefined, ...keys: ConditionKey[]) =>
  !!c?.some((x) => keys.includes(x.key));

/** Атакующий получает преимущество (Невидим, скрыт и т.п.). */
export function attackerAdvantage(conditions: ConditionInstance[] | undefined): boolean {
  return has(conditions, 'invisible');
}

/** Атакующий получает помеху (Отравлен, Ослеплён, Испуган, Сбит с ног, Схвачен, Обездвижен). */
export function attackerDisadvantage(conditions: ConditionInstance[] | undefined): boolean {
  return has(conditions, 'poisoned', 'blinded', 'frightened', 'prone', 'grappled', 'restrained');
}

/** Преимущество по цели (Ослеплён, Схвачен, Парализован, Ошеломлён, Без сознания, Окаменел; Сбит с ног — ближний). */
export function advantageAgainst(
  conditions: ConditionInstance[] | undefined,
  rangeType: AttackRangeType = 'melee'
): boolean {
  if (has(conditions, 'blinded', 'grappled', 'paralyzed', 'stunned', 'unconscious', 'petrified')) return true;
  return rangeType === 'melee' && has(conditions, 'prone');
}

/** Помеха по цели (Невидим; Сбит с ног — дальний). */
export function disadvantageAgainst(
  conditions: ConditionInstance[] | undefined,
  rangeType: AttackRangeType = 'melee'
): boolean {
  if (has(conditions, 'invisible')) return true;
  return rangeType === 'ranged' && has(conditions, 'prone');
}

/** Авто-крит: атака в пределах 5 фт по Парализован/Без сознания. */
export function autoCrit(
  conditions: ConditionInstance[] | undefined,
  distanceFeet: number,
  rangeType: AttackRangeType = 'melee'
): boolean {
  if (rangeType === 'ranged') return false;
  return distanceFeet <= 5 && has(conditions, 'paralyzed', 'unconscious');
}

/** Авто-провал спасбросков Силы/Ловкости. */
export function autoFailSave(conditions: ConditionInstance[] | undefined, ability: AbilityKey): boolean {
  if (ability !== 'str' && ability !== 'dex') return false;
  return has(conditions, 'paralyzed', 'stunned', 'unconscious', 'petrified');
}

/** Нельзя передвигаться (игрокам; DM — обход). */
export function movementBlocked(conditions: ConditionInstance[] | undefined): boolean {
  return has(conditions, 'grappled', 'restrained', 'paralyzed', 'stunned', 'unconscious', 'petrified');
}

/** Не может совершать действия/бонусные/реакции. */
export function isIncapacitated(conditions: ConditionInstance[] | undefined): boolean {
  return has(conditions, 'incapacitated', 'paralyzed', 'stunned', 'unconscious', 'petrified');
}

/** Уровень истощения (0 — нет). */
export function exhaustionLevel(conditions: ConditionInstance[] | undefined): number {
  const c = conditions?.find((x) => x.key === 'exhaustion');
  return c ? Math.max(1, Math.min(6, Math.round(c.level ?? 1))) : 0;
}

/** Штраф истощения к d20-броскам: −2 за уровень. */
export function exhaustionRollPenalty(conditions: ConditionInstance[] | undefined): number {
  return -2 * exhaustionLevel(conditions);
}

/** Штраф истощения к скорости: −5 фт за уровень. */
export function exhaustionSpeedPenalty(conditions: ConditionInstance[] | undefined): number {
  return -5 * exhaustionLevel(conditions);
}
