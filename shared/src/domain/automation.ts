import type { ActionCost, ActionTargeting, AreaSpec } from './actions';
import type { Sense } from './sense';
import type { AbilityKey } from './core';
import type {
  ConditionKey,
  EffectDuration,
  EffectEscalation,
  EffectTurnPayload,
  Modifier,
  Restrictions,
} from './effects';

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
  /** Прибавить модификатор заклинательной характеристики кастера (Flame Blade). */
  abilityMod?: boolean;
}

/** Источник света эффекта/зоны: яркий радиус + сумеречное кольцо за ним. */
export interface LightSource {
  /** Радиус яркого света, футы. */
  bright: number;
  /** Дополнительный радиус сумерек за ярким (0 — только яркий). */
  dim: number;
  /** Свет — солнечный (вампиры/регенерация — позже; сейчас только тег). */
  sunlight?: boolean;
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
  /** Повторный спасбросок при получении урона; успех снимает эффект (Hideous Laughter). */
  saveOnDamage?: { advantage?: boolean };
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
  /** Действия, выдаваемые эффектом на время его действия (Expeditious Retreat, Dragon's Breath). */
  actions?: GrantedAction[];
  /** Выбранный при касте вариант (Dragon's Breath: тип урона) — для подписи. */
  variant?: string;
  /** Метка-прицел на цели (Hex/Hunter's Mark): клиент рисует прицел поверх токена. */
  mark?: boolean;
  /** Свет, исходящий от эффекта (Light, Flame Blade, Sunbeam-огонёк). */
  light?: LightSource;
  /** Death Ward: первое падение до 0 HP от урона — 1 HP вместо этого, эффект гаснет. */
  deathWard?: boolean;
  /** Состояния, к которым носитель получает иммунитет (Freedom of Movement, Heroism). */
  conditionImmunities?: ConditionKey[];
  /** Срабатывание в начале хода носителя (Heroism: temp HP; смайты: повторный урон). */
  triggers?: { startOfTurn?: EffectTurnPayload };
  /** Оружейные атаки носителя считаются магическими (Magic Weapon). */
  magicWeapon?: boolean;
  /** Warding Bond: переносить получаемый урон на источник эффекта. */
  damageLink?: boolean;
  /** Магические эффекты не снижают скорость (Freedom of Movement). */
  immuneToSpeedReduction?: boolean;
  /** Сложная местность (и союзники) не замедляют (Freedom of Movement). */
  ignoresDifficultTerrain?: boolean;
}

/** Что происходит в результате применения (ортогонально способу разрешения). */
export interface AutomationPayload {
  save?: AutomationSave;
  damage?: AutomationDice;
  heal?: AutomationDice;
  effects?: AutomationEffect[];
  /** Состояния, снимаемые с цели (Heal, Lesser/Greater Restoration). */
  endConditions?: ConditionKey[];
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
  /** Действия владельца зоны, пока она на карте (перемещение Moonbeam/Flaming Sphere). */
  actions?: GrantedAction[];
  /** Аура привязана к источнику и перемещается с ним (Spirit Guardians). */
  anchor?: 'source' | 'point';
  /** «Полностью внутри» для состояний аурой (Hunger of Hadar). */
  containment?: 'anyCell' | 'fullyWithin';
  /** Аура и триггеры зоны действуют только на враждебных/союзных источнику. */
  side?: 'hostile' | 'ally';
  /** Свет, исходящий от зоны (Daylight, Moonbeam, Flaming Sphere). */
  light?: LightSource;
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
    /** Почти незаметный визуал зоны (туча Call Lightning): только тонкий контур. */
    subtle?: boolean;
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
  /** Аура и триггеры зоны действуют только на враждебных/союзных источнику. */
  side?: 'hostile' | 'ally';
  /** Свет, исходящий от зоны. */
  light?: LightSource;
  /** Вход срабатывает первый раз за ход (Spirit Guardians). */
  enterOncePerTurn?: boolean;
  /** Аура и триггеры не действуют на источник зоны. */
  excludeSource?: boolean;
  /** Действия владельца зоны, пока она на карте (перемещение). */
  actions?: GrantedAction[];
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
    | 'stepOfTheWind'
    | 'moveZone'
    | 'teleport'
    /** Revivify: вернуть мёртвую цель к жизни с 1 HP. */
    | 'revive'
    /** Spare the Dying: цель на 0 HP становится стабильной. */
    | 'stabilize'
    /** Lesser/Greater Restoration: снять одно состояние из `endConditions` (выбор при касте). */
    | 'endCondition';
  amount?: number;
  ability?: AbilityKey;
  /** Кость временных HP (tempHp), бросается один раз на всех. */
  dice?: string;
  /** Множитель брошенной кости (Мантия вдохновения: 2×кость). */
  multiplier?: number;
  /** После выдачи — ходы «только движение» в порядке инициативы (Мантия вдохновения). */
  thenMove?: boolean;
}

/** Действие, выдаваемое эффектом (Expeditious Retreat: Рывок бонусным действием). */
export interface GrantedAction {
  id: string;
  name: string;
  cost: 'action' | 'bonus';
  /** Механика базового действия каталога (`dash`) — payload не дублируется. */
  baseActionId?: string;
  /** Своя механика, если действие не ссылается на базовое (Dragon's Breath). */
  def?: AutomationDef;
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
  /** Автосбор целей в радиусе от кастера (черты без мультивыбора): сторона и дистанция. */
  autoTargets?: { feet: number; side: 'hostile' | 'ally' | 'any' };
  /** Стоимость/цель черты (для классовых действий). */
  costs?: ActionCost[];
  targeting?: ActionTargeting;
  zone?: ZoneDef;
  summon?: SummonDef;
  /** Трансформа цели (Polymorph): спасбросок + форма-зверь. */
  shape?: ShapeDef;
  /** Вынужденное перемещение попавших/проваливших сейв целей (Repelling Blast, Thunderwave). */
  force?: { kind: 'push' | 'pull'; feet: number; maxSize?: 'normal' | 'large' | 'huge' };
  /** Фильтр целей по отношению к кастеру (Conjure Woodland Beings: только враги). */
  side?: 'hostile' | 'ally';
  /** Лечение на половину фактически нанесённого урона (Vampiric Touch). */
  lifesteal?: boolean;
  /** Перенос метки эффекта на новую цель (Hex/Hunter's Mark): обновляет filter.targetId. */
  retarget?: boolean;
  utility?: AutomationUtility;
}
