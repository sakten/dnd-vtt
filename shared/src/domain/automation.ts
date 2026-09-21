import type { ActionCost, ActionTargeting, AreaSpec } from './actions';
import type { Sense } from './sense';
import type { AbilityKey } from './core';
import type { ConditionKey, EffectDuration, EffectEscalation, Modifier, Restrictions } from './effects';

/**
 * Схема автоматизации (R8.1): единое описание того, что происходит при
 * применении заклинания/черты. `resolution` — как разрешается применение,
 * payload-поля (`save`/`damage`/`heal`/`effects`) — что получается в итоге;
 * они ортогональны и комбинируются (Wall of Fire: урон + зона).
 * `zone`/`summon` зарезервированы под будущие движки: пока обработчиков нет,
 * строки с ними в каталог не заводим.
 */

export type AutomationResolution = 'attack' | 'save' | 'auto' | 'effect' | 'utility' | 'summon' | 'shape' | 'manual';

export interface AutomationAttack {
  rangeType: 'melee' | 'ranged';
}

export interface AutomationSave {
  ability: AbilityKey;
  /** Успешный спасбросок — половина урона (иначе 0). */
  half?: boolean;
}

export interface AutomationDice {
  /** Выражение костей с учётом скейла (апкаст/кантрип). */
  dice: string;
  types?: string[];
  /** Прибавка за уровень класса (Second Wind: `1d10` + уровень воина). */
  classLevelBonus?: { className: string; per?: number };
  /** Число костей = модификатор характеристики, минимум `min` (Sear Undead: кd8 по Мдр). */
  abilityDice?: { ability: AbilityKey; min?: number };
}

export interface AutomationEffect {
  name: string;
  duration: EffectDuration;
  concentration?: boolean;
  /** `to`: self — кастер, targets — выбранные цели. */
  to?: 'self' | 'targets';
  /** Максимум целей (мультицелевые баффы/дебаффы, напр. Bless — 3). */
  targets?: number;
  /** Наложить на союзников в радиусе от кастера без выбора целей (Zealous Presence). */
  radiusFeet?: number;
  /**
   * Привязать эффект к цели каста: модификаторам проставляется filter.targetId
   * (Hex/Hunter's Mark накладываются на кастера, но бьют только по метке).
   */
  markTarget?: boolean;
  /** Служебный эффект (пассивная черта класса): не показывается в чипах. */
  hidden?: boolean;
  /** Модификаторы без id — id присваивает сервер при наложении. */
  modifiers: Omit<Modifier, 'id'>[];
  conditions?: ConditionKey[];
  /** При провале повторного спасброска состояние меняется (Sleep: incapacitated → unconscious). */
  escalate?: EffectEscalation;
  /** Урон/встряска снимает эффект (Sleep, Hypnotic Pattern). */
  wakeOnDamage?: boolean;
  /** Временные HP, выдаваемые при наложении (Fighting Spirit и подобные). */
  tempHp?: number;
  /** Кость бонуса к d20-тесту, тратится при использовании (Бардовское вдохновение). */
  bonusDie?: string;
  /** Доп. способы траты кости (Боевое вдохновение): урон/AC. */
  bonusDieUses?: ('damage' | 'ac')[];
  /** Подмена попадания дубликатами (Mirror Image): бросок die ≥ threshold уничтожает заряд. */
  misdirect?: { charges: number; die: string; threshold: number };
  /** Ограничения экономики/действий, пока эффект активен. */
  restrictions?: Restrictions;
  /** Выпутывание действием: проверка характеристики против СЛ каста (Web). */
  escape?: { ability: AbilityKey; skill?: string };
  /** Восприятие, выдаваемое эффектом (Darkvision и подобные). */
  senses?: Sense[];
}

/** Что происходит в результате применения (ортогонально способу разрешения). */
export interface AutomationPayload {
  save?: AutomationSave;
  damage?: AutomationDice;
  heal?: AutomationDice;
  effects?: AutomationEffect[];
  /**
   * Как считать попадание для этого payload'а: `anyCell` — любое пересечение,
   * `fullyWithin` — токен целиком внутри. Без значения — как у зоны.
   */
  containment?: 'anyCell' | 'fullyWithin';
}

export interface ZoneDef {
  area: AreaSpec;
  origin: 'self' | 'point';
  duration: EffectDuration;
  /** Аура привязана к источнику и перемещается с ним (Spirit Guardians). */
  anchor?: 'source' | 'point';
  /** «Полностью внутри» для состояний аурой (Hunger of Hadar). */
  containment?: 'anyCell' | 'fullyWithin';
  /** Вход срабатывает первый раз за ход (Spirit Guardians). */
  enterOncePerTurn?: boolean;
  movable?: boolean;
  aura?: AutomationPayload;
  /** Аура и триггеры зоны не действуют на источник (Spirit Guardians). */
  excludeSource?: boolean;
  triggers?: {
    enter?: AutomationPayload;
    exit?: AutomationPayload;
    startOfTurn?: AutomationPayload;
    endOfTurn?: AutomationPayload;
  };
  /** Немеханизируемые/будущие свойства (сложная местность, обскурация). */
  flags?: {
    difficultTerrain?: boolean;
    obscured?: 'light' | 'heavy';
    blocksLight?: boolean;
    blocksMovement?: boolean;
    blocksLineOfSight?: boolean;
  };
}

/** Созданная на карте зона (Web, Spirit Guardians, Hunger of Hadar). */
export interface ZoneInstance {
  id: string;
  name: string;
  sourceKey: string;
  /** id существа-источника (аура, концентрация, снятие). */
  sourceId: string;
  /** Точка привязки в мире; для `anchor: 'source'` обновляется по источнику. */
  origin: { x: number; y: number };
  direction?: { x: number; y: number } | null;
  area: AreaSpec;
  duration: EffectDuration;
  concentration?: boolean;
  anchor?: 'source' | 'point';
  movable?: boolean;
  containment?: 'anyCell' | 'fullyWithin';
  /** Вход срабатывает первый раз за ход (Spirit Guardians). */
  enterOncePerTurn?: boolean;
  /** Аура и триггеры не действуют на источник зоны. */
  excludeSource?: boolean;
  /** СЛ спасбросков payload'ов (посчитана при касте). */
  dc?: number;
  aura?: AutomationPayload;
  triggers?: {
    enter?: AutomationPayload;
    exit?: AutomationPayload;
    startOfTurn?: AutomationPayload;
    endOfTurn?: AutomationPayload;
  };
  flags?: ZoneDef['flags'];
  /** id токенов внутри (для enter/exit и аур). */
  occupants?: string[];
  /** Ключ хода, на котором токен уже входил (для `enterOncePerTurn`). */
  enteredThisTurn?: Record<string, string>;
}

export interface SummonDef {
  /** Выбранный шаблон каталога (`XPHB:Fey Spirit`); пусто — выбор формы на клиенте. */
  creature?: string;
  /** Доступные формы (Find Familiar / Pact of the Chain). */
  choices?: string[];
  count?: number;
  duration: EffectDuration;
  initiative: 'afterCaster' | 'own';
  /** Круг ячейки: скейл HP/AC/урона шаблона. */
  level?: number;
  /** Атаки шаблона — модификатором атаки заклинанием кастера. */
  spellAttack?: boolean;
  /** Спасброски шаблона — СЛ заклинаний кастера. */
  spellDc?: boolean;
}

/** Трансформа цели заклинанием (Polymorph): форма — зверь, выбранный кастером. */
export interface ShapeDef {
  kind: 'polymorph';
  /** Максимальный CR формы: CR/уровень цели (у монстров без CR — без проверки). */
  crByTarget?: boolean;
}

export interface AutomationUtility {
  kind:
    | 'extraAction'
    | 'extraMovement'
    | 'disengage'
    | 'check'
    | 'extraAttacks'
    | 'weaponAttack'
    | 'healPool'
    | 'tempHp'
    | 'patientDefense'
    | 'stepOfTheWind';
  amount?: number;
  ability?: AbilityKey;
  /** Кость временных HP (tempHp), бросается один раз на всех. */
  dice?: string;
  /** Множитель брошенной кости (Мантия вдохновения: 2×кость). */
  multiplier?: number;
  /** После выдачи — ходы «только движение» в порядке инициативы (Мантия вдохновения). */
  thenMove?: boolean;
}

export interface AutomationDef extends AutomationPayload {
  /** Ключ заклинания (`источник:имя`) или id действия (`class:barbarian:rage`). */
  key: string;
  name: string;
  resolution: AutomationResolution;
  concentration?: boolean;
  attack?: AutomationAttack;
  /** Число атак/снарядов/повторов; скейл (апкаст/уровень персонажа) уже учтён. */
  count?: number;
  /** Область заклинания (для зон/фич; цели обычного каста собирает вызывающий). */
  area?: AreaSpec;
  /** Массовая цель без области: до N существ (Mass Healing Word — 6). */
  targets?: number;
  /** Максимум целей = модификатор способности (Мантия вдохновения: Харизма, min 1). */
  targetsAbility?: AbilityKey;
  /** Автосбор целей в радиусе от кастера (черты без мультивыбора): враги или союзники. */
  autoTargets?: { feet: number; side: 'hostile' | 'ally' };
  /** Стоимость/цель черты (для классовых действий). */
  costs?: ActionCost[];
  targeting?: ActionTargeting;
  zone?: ZoneDef;
  summon?: SummonDef;
  /** Трансформа цели (Polymorph): спасбросок + форма-зверь. */
  shape?: ShapeDef;
  /** Вынужденное перемещение попавших/проваливших сейв целей (Repelling Blast, Thunderwave). */
  force?: { kind: 'push' | 'pull'; feet: number; maxSize?: 'normal' | 'large' | 'huge' };
  utility?: AutomationUtility;
}
