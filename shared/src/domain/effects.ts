import type { GrantedAction, LightSource } from './automation';
import type { AbilityKey } from './core';
import type { Sense } from './sense';
import type { AttackRangeType } from './token';

export type ConditionKey =
  | 'blinded'
  | 'charmed'
  | 'deafened'
  | 'exhaustion'
  | 'frightened'
  | 'grappled'
  | 'incapacitated'
  | 'invisible'
  | 'paralyzed'
  | 'petrified'
  | 'poisoned'
  | 'prone'
  | 'restrained'
  | 'stunned'
  | 'unconscious'
  | 'surrounded'
  | 'dead'
  | 'custom';

export interface ConditionInstance {
  key: ConditionKey;
  name: string;
  /** Осталось раундов; null — до снятия/бессрочно. */
  rounds?: number | null;
  /** Уровень истощения (для key='exhaustion'), 1..6. */
  level?: number;
  /** Повторный спасбросок для снятия. */
  save?: { ability: AbilityKey; dc: number; timing: 'start' | 'end' };
  /** Кто наложил состояние. */
  sourceId?: string;
  /** Ключ заклинания-источника (для иконки). */
  sourceKey?: string;
  /** id эффекта, наложившего состояние (снимается вместе с ним). */
  effectId?: string;
}

export type ModifierTarget =
  | 'attack'
  | 'damage'
  | 'ac'
  | 'save'
  | 'check'
  | 'speed'
  | 'initiative'
  | 'maxHp'
  | 'spellDc'
  | 'spellAttack'
  | 'extraActions'
  | 'extraBonusActions'
  /** Бонус к досягаемости ближних атак, футы. */
  | 'reach';

export type ModifierMode =
  | 'add'
  | 'multiply'
  | 'set'
  | 'advantage'
  | 'disadvantage'
  | 'resistance'
  | 'immunity'
  | 'vulnerability';

export interface ModifierFilter {
  attackType?: 'melee' | 'ranged';
  ability?: AbilityKey;
  skill?: string;
  damageType?: string;
  rangeType?: AttackRangeType;
  /** Модификатор действует только против конкретного токена (Hex/Hunter's Mark). */
  targetId?: string;
  /**
   * Направление для модификаторов атаки: `self` — свои броски атаки,
   * `against` — атаки по носителю. Без значения — как раньше (обе стороны).
   */
  direction?: 'self' | 'against';
  /** Только броски атак оружием (не заклинаниями). */
  weapon?: boolean;
}

export interface Modifier {
  id: string;
  target: ModifierTarget;
  mode: ModifierMode;
  /** Число, формула ('13+dex') или кость ('1d4'); нужно для add/set/multiply. */
  value?: number | string;
  filter?: ModifierFilter;
}

export type EffectDuration =
  | { type: 'rounds'; rounds: number }
  | { type: 'untilSave'; ability: AbilityKey; dc: number; timing: 'start' | 'end' }
  | { type: 'endOfTurn'; of: 'source' | 'target' }
  | { type: 'concentration' }
  | { type: 'permanent' };

/** Смена состояния при провале повторного спасброска (Sleep: incapacitated → unconscious). */
export interface EffectEscalation {
  condition: ConditionKey;
  /** Новая длительность после эскалации (по умолчанию — прежняя). */
  duration?: EffectDuration;
}

/** Действие «Выпутаться»: проверка характеристики против СЛ эффекта (Web и подобные). */
export interface EffectEscape {
  ability: AbilityKey;
  /** Навык (Athletics и т.п.), даёт владение при броске. */
  skill?: string;
  dc: number;
}

/**
 * Ограничения экономики/действий от эффектов (Slow, Stinking Cloud).
 * Условия дают базовые запреты (`isIncapacitated`), эффекты — точечные.
 */
export interface Restrictions {
  noActions?: boolean;
  noBonus?: boolean;
  noReactions?: boolean;
  /** Нельзя атаковать по возможности (Shocking Grasp). */
  noOpportunityAttacks?: boolean;
  /** Движение не провоцирует атаки по возможности (Мантия вдохновения). */
  ignoresOpportunityAttacks?: boolean;
  /** Если действие «Атака» — только одна атака за ход (Slow). */
  oneAttackOnly?: boolean;
  /** Действие или бонусное действие, но не оба (Slow). */
  actionOrBonusOnly?: boolean;
  /** Шанс провала заклинания с соматическим компонентом, % (Slow). */
  spellFailureChance?: number;
  /** Нельзя использовать заклинания (Ярость и подобные эффекты). */
  noSpells?: boolean;
}

export interface EffectInstance {
  id: string;
  name: string;
  /** Ключ источника (заклинание/способность). */
  sourceKey?: string;
  /** id существа-источника. */
  sourceId?: string;
  concentration?: boolean;
  duration: EffectDuration;
  modifiers: Modifier[];
  /** Ключи накладываемых состояний. */
  conditions?: ConditionKey[];
  /** При провале повторного спасброска состояние меняется (Sleep). */
  escalate?: EffectEscalation;
  /** Урон снимает эффект (Sleep, Hypnotic Pattern). */
  wakeOnDamage?: boolean;
  /** Повторный спасбросок при получении урона; успех снимает эффект (Hideous Laughter). */
  saveOnDamage?: { advantage?: boolean };
  /** Ограничения экономики/действий, пока эффект активен. */
  restrictions?: Restrictions;
  /** id зоны-источника (аура): снимается при выходе из зоны и её окончании. */
  zoneId?: string;
  /** Можно ли выпутаться действием (Web: STR/Athletics против СЛ). */
  escape?: EffectEscape;
  /** Подмена попадания образами (Mirror Image): заряды, кость, порог. */
  misdirect?: { charges: number; die: string; threshold: number };
  /** Кость бонуса к d20-тесту, тратится при использовании (Бардовское вдохновение). */
  bonusDie?: string;
  /** Доп. способы траты кости (Боевое вдохновение коллегии Доблести): урон/AC. */
  bonusDieUses?: ('damage' | 'ac')[];
  /** Служебный эффект (пассивная черта класса): не показывается в чипах. */
  hidden?: boolean;
  /** Восприятие, выдаваемое эффектом (Darkvision и подобные). */
  senses?: Sense[];
  /** Действия, выдаваемые эффектом (Expeditious Retreat: Рывок бонусным действием). */
  actions?: GrantedAction[];
  /** Выбранный при касте вариант (Dragon's Breath: тип урона) — для подписи. */
  variant?: string;
  /** Метка-прицел на цели (Hex/Hunter's Mark): клиент рисует прицел поверх токена. */
  mark?: boolean;
  /** Одноразовое мастерство (Sap/Vex): сгорает после ближайшего броска атаки носителя. */
  consumeOnAttackRoll?: boolean;
  /** Свет, исходящий от эффекта (Light, Flame Blade, Sunbeam-огонёк). */
  light?: LightSource;
}
