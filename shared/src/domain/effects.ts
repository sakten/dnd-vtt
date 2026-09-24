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
  /** Безоружный удар (Divine Favor/Magic Weapon: `false` — только оружие в руках). */
  unarmed?: boolean;
  /** Спасбросок против набора состояний: совпадение с любым из списка (Protection from Poison, Aura of Purity). */
  conditions?: ConditionKey[];
  /** Только спасброски против заклинаний и магических эффектов (Circle of Power). */
  magical?: boolean;
  /** Тип существа атакующего (Protection from Evil and Good: помеха от шести типов). */
  creatureTypes?: string[];
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

/** Срабатывание эффекта в начале хода носителя (Heroism, Searing Smite, Ensnaring Strike). */
export interface EffectTurnPayload {
  /** Временные HP в начале хода (Heroism; значение посчитано при касте). */
  tempHp?: number;
  /** Повторный урон (Searing Smite, Ensnaring Strike). */
  damage?: { dice: string; types?: string[] };
}

/** Смена состояния при провале повторного спасброска (Sleep: incapacitated → unconscious). */
export interface EffectEscalation {
  condition: ConditionKey;
  /** Новая длительность после эскалации (по умолчанию — прежняя). */
  duration?: EffectDuration;
}

/** Действие «Выпутаться»: проверка характеристики или спасбросок против СЛ эффекта (Web, Dance). */
export interface EffectEscape {
  /** `check` — проверка характеристики (по умолчанию), `save` — спасбросок. */
  kind?: 'check' | 'save';
  ability: AbilityKey;
  /** Навык (Athletics и т.п.), даёт владение при броске. */
  skill?: string;
  dc: number;
  /** Подпись действия (иначе «Выпутаться»). */
  label?: string;
  /** Ключ иконки действия (`<источник>:<id>`), иначе запасной глиф. */
  iconKey?: string;
}

/**
 * Ограничения экономики/действий от эффектов (Slow, Stinking Cloud).
 * Условия дают базовые запреты (`isIncapacitated`), эффекты — точечные.
 */
export interface Restrictions {
  noActions?: boolean;
  noBonus?: boolean;
  /** `noActions` пришёл от эффекта, а не от состояния (эффекты не обходит даже DM). */
  noActionsFromEffect?: boolean;
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
  /**
   * Лимит «1 минута» = 10 раундов: эффект гаснет на 10-м ходу носителя, даже если
   * его не сняли спас/концентрация. Ставится спеллам длительностью ровно 1 минута
   * (`spellMaxRounds`); длительности больше минуты не лимитируются.
   */
  maxRounds?: number;
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
  /** Death Ward: первое падение до 0 HP от урона — 1 HP вместо этого, эффект гаснет. */
  deathWard?: boolean;
  /** Состояния, к которым носитель получает иммунитет (Freedom of Movement, Heroism). */
  conditionImmunities?: ConditionKey[];
  /** Иммунитет к состояниям только от существ указанных типов (Protection from Evil and Good). */
  conditionImmunitiesFrom?: { conditions: ConditionKey[]; types: string[] };
  /** Срабатывание в начале хода носителя (Heroism: temp HP; смайты: повторный урон). */
  triggers?: { startOfTurn?: EffectTurnPayload };
  /** Оружейные атаки носителя считаются магическими (Magic Weapon). */
  magicWeapon?: boolean;
  /** Warding Bond: урон носителя тем же количеством переносится на токен-источник. */
  damageLink?: { tokenId: string };
  /** Eyebite: скрытая метка «спасся против этого каста» (повторно не цель). */
  saveMarker?: boolean;
  /** Магические эффекты не снижают скорость (Freedom of Movement). */
  immuneToSpeedReduction?: boolean;
  /** Сложная местность (и союзники) не замедляют (Freedom of Movement). */
  ignoresDifficultTerrain?: boolean;
  /** Носитель видит невидимых (See Invisibility). */
  seesInvisible?: boolean;
  /** Primordial Ward: типы, по которым реакцией можно получить иммунитет (включая спровоцировавший урон). */
  ward?: string[];
  /** Banishment: точка возврата изгнанного существа после снятия эффекта. */
  banish?: { x: number; y: number };
  /** Досрочный обрыв эффекта: носитель совершил бросок атаки или применил заклинание (Invisibility). */
  breakOn?: ('attack' | 'spell' | 'damage')[];
  /** Sanctuary: атакующие носителя обязаны пройти спас WIS (СЛ каста) или потерять атаку/заклинание. */
  sanctuary?: { dc: number };
  /** Лечение носителя берёт максимум костей (Beacon of Hope). */
  maximizeHealing?: boolean;
  /** Преимущество на спасброски от смерти (Beacon of Hope). */
  deathSaveAdvantage?: boolean;
  /** Успешный спасбросок полностью отменяет урон вместо половины (Circle of Power). */
  saveNoDamage?: boolean;
  /** Armor of Agathys: ответный урон атакующему в ближнем бою, пока есть врем. HP. */
  retaliate?: { damageType: string; amount: number };
  /** Booming Blade: добровольное перемещение на `feet`+ — урон `dice` и эффект гаснет. */
  onWillingMove?: { dice: string; damageType: string; feet: number };
  /** Zephyr Strike: одноразовая атака — 1d8 силовым и скорость до конца хода. */
  zephyrStrike?: { dice: string; damageType: string; speedFeet: number };
}
