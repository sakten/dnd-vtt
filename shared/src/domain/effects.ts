import type { GrantedAction, LightSource, WeaponOverride } from './automation';
import type { AbilityKey, Faction } from './core';
import type { Sense } from './sense';
import type { AttackRangeType } from './token';

/** Направление принудительного движения (Compulsion: бонусное действие мастера). */
export type DirectionKey = 'up' | 'down' | 'left' | 'right';

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
  /** Только атаки кэнсэй-оружием основной руки (XGE, Kensei). */
  kenseiWeapon?: boolean;
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
  | {
      type: 'untilSave';
      ability: AbilityKey;
      dc: number;
      timing: 'start' | 'end' | 'damage';
      /** Урон при провале повторного спасброска (Immolation: 4d6 огнём, эффект остаётся). */
      damage?: { dice: string; types: string[] };
    }
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

/** Событие триггера эффекта (R16): точки рантайма, на которые ссылаются способности. */
export type TriggerEvent =
  | 'startOfTurn'
  | 'endOfTurn'
  | 'targetedByAttack'
  | 'damaged'
  | 'hpReachedZero'
  | 'healReceived'
  | 'deathSave'
  | 'ownAttackRoll'
  | 'ownSpellCast'
  | 'ownDamageDealt'
  | 'willingMove'
  | 'saveSucceeded';

/** Реакция на событие: окно с выбором (Primordial Ward, Fount of Moonlight). */
export type TriggerReaction =
  | { kind: 'ward'; types: string[] }
  | { kind: 'saveCondition'; ability: AbilityKey; feet: number; condition: ConditionKey };

/** Runtime-метка «раз в ход» доп. урона (Elemental Bane): ключ хода или null вне боя. */
export type TriggerUsedMark = { usedTurn?: string | null };

/**
 * Инстанс триггера эффекта: событие + типизированный payload (R16, AUTOMATION.md §3.2).
 * Единый формат вместо именованных полей: способности ссылаются на событие, а не
 * заводят поле под механику.
 */
export interface TriggerInstance extends TriggerUsedMark {
  on: TriggerEvent;
  /** Спас носителя события (Sanctuary: WIS против СЛ каста; `dc` подставляет apply). */
  save?: { ability: AbilityKey; dc?: number; advantage?: boolean };
  /** Урон: ответный источнику (`to:'source'`) или носителю (Booming Blade, `feet`). */
  damage?: { dice?: string; amount?: number; damageType?: string; to: 'source' | 'self'; feet?: number };
  /** Снижение входящего урона перечисленных типов (Resistance). */
  reduce?: { dice: string; types: string[] };
  /** Доп. урон по носителю: `oncePerTurn` — Elemental Bane, `from:'source'` — Spirit Shroud/CME. */
  extraDamage?: { dice: string; damageType: string; oncePerTurn?: boolean; from?: 'source' };
  /** Перенос входящего урона на источник эффекта (Warding Bond). */
  redirect?: 'linked';
  /** Снятие эффекта по событию (пробуждение, обрыв невидимости, расход). */
  endEffect?: true;
  /** Повторный спас против длительности при уроне (Hideous Laughter). */
  repeatSave?: { advantage?: boolean };
  /** Носитель не восстанавливает HP (Chill Touch). */
  preventHeal?: true;
  /** Лечение носителя — максимум костей (Beacon of Hope). */
  maximizeHeal?: true;
  /** Падение до 0 HP заменяется на 1 (Death Ward). */
  survive?: { hp: 1 };
  /** Преимущество на спас от смерти (Beacon of Hope). */
  rollMode?: 'advantage';
  /** Успешный спас отменяет урон полностью (Circle of Power). */
  noDamageOnSuccess?: true;
  /** Реакция на событие (окно выбора). */
  reaction?: TriggerReaction;
  /** Payload начала/конца хода (Heroism: врем. HP; смайты: отложенный урон). */
  turn?: EffectTurnPayload;
}

export interface EffectInstance {
  id: string;
  name: string;
  /** Ключ источника (заклинание/способность). */
  sourceKey?: string;
  /** id существа-источника. */
  sourceId?: string;
  concentration?: boolean;
  /**
   * Служебный якорь концентрации: пустая запись на кастере, которая лишь держит
   * каст (chips/зоны/выданные действия). `true` — якорь; отсутствие — реальный эффект.
   * Только по этому флагу `pruneConcentration` отличает якорь от эффекта-цели.
   */
  anchor?: boolean;
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
  /**
   * Эффект при снятии носителя (Haste: «вялость до конца следующего хода»):
   * подмножество `AutomationEffect`, накладывается на того же носителя.
   */
  onEnd?: {
    name: string;
    duration: EffectDuration;
    modifiers: Modifier[];
    restrictions?: Restrictions;
    conditions?: ConditionKey[];
  };
  /** Bestow Curse (режим «Уклонение»): спас в начале хода, при провале — Уклонение на ход. */
  turnDodge?: { ability: AbilityKey; dc: number };
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
  /** Одноразовый штраф: сгорает после ближайшего спасброска носителя (Mind Sliver). */
  consumeOnSave?: boolean;
  /** Свет, исходящий от эффекта (Light, Flame Blade, Sunbeam-огонёк). */
  light?: LightSource;
  /** Состояния, к которым носитель получает иммунитет (Freedom of Movement, Heroism). */
  conditionImmunities?: ConditionKey[];
  /** Иммунитет к состояниям только от существ указанных типов (Protection from Evil and Good). */
  conditionImmunitiesFrom?: { conditions: ConditionKey[]; types: string[] };
  /**
   * Срабатывания эффекта (R16): начало/конец хода (`turn`), перехваты урона/HP,
   * обрывы, реакции. Единый словарь событий × операций.
   */
  triggers?: TriggerInstance[];
  /** Оружейные атаки носителя считаются магическими (Magic Weapon). */
  magicWeapon?: boolean;
  /** Shillelagh: дубинка/посох в руке бьёт новой костью, типом и характеристикой. */
  weaponOverride?: WeaponOverride;
  /** Shadow Blade: синтетический клинок тени (кость, в руке/брошен). */
  shadowBlade?: { dice: string; inHand: boolean };
  /** Eyebite: скрытая метка «спасся против этого каста» (повторно не цель). */
  saveMarker?: boolean;
  /** Магические эффекты не снижают скорость (Freedom of Movement). */
  immuneToSpeedReduction?: boolean;
  /** Сложная местность (и союзники) не замедляют (Freedom of Movement). */
  ignoresDifficultTerrain?: boolean;
  /** Носитель видит невидимых (See Invisibility). */
  seesInvisible?: boolean;
  /** Banishment: точка возврата изгнанного существа после снятия эффекта. */
  banish?: { x: number; y: number };
  /** Dominate Beast/Person: носитель под контролем источника (команды), пока эффект жив. */
  dominates?: boolean;
  /** Прежняя фракция до доминирования — для отката при снятии эффекта. */
  prevFaction?: Faction;
  /** Расходуемый счётчик (Flame Arrows: 12 боеприпасов; Magic Stone: 3 камня). */
  charges?: { remaining: number; on?: 'rangedWeaponAttack' };
  /** Zephyr Strike: одноразовая атака — 1d8 силовым и скорость до конца хода. */
  zephyrStrike?: { dice: string; damageType: string; speedFeet: number };
  /** Compulsion: выбранное направление — плашка над целью до её хода (ведёт мастер). */
  commandDirection?: DirectionKey;
}
