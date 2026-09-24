import type { ActionCost, ActionTargeting, AreaSpec } from './actions';
import type { Sense } from './sense';
import type { AbilityKey } from './core';
import type {
  ConditionKey,
  EffectDuration,
  EffectEscalation,
  EffectInstance,
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

/**
 * Shillelagh: подмена атаки оружия на время эффекта — кость урона, тип и
 * характеристика атаки. Применяется в `loadoutOf` к атакам указанных оружий
 * (характеристика фиксируется числом при касте).
 */
export interface WeaponOverride {
  /** Ключи оружия справочника (`attack.weaponKey`), к которым применяется подмена. */
  weapons: string[];
  /** Новая кость урона (со скейлом кантрипа: d8/d10/d12/2d6). */
  dice: string;
  damageType: string;
  /** Модификатор характеристики атаки и урона (заклинательная кастера на касте). */
  abilityMod: number;
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
  /** Привязать эффект к цели каста: модификаторам проставляется filter.targetId
   * (Hex/Hunter's Mark накладываются на кастера, но бьют только по метке).
   */
  markTarget?: boolean;
  /** Одноразовый эффект: сгорает после ближайшего броска атаки носителя (Zephyr Strike). */
  consumeOnAttackRoll?: boolean;
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
  /** Выпутывание действием: проверка характеристики или спасбросок против СЛ каста (Web, Dance). */
  escape?: { kind?: 'check' | 'save'; ability: AbilityKey; skill?: string; dc?: number; label?: string; iconKey?: string };
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
  /** Иммунитет к состояниям только от существ указанных типов (Protection from Evil and Good). */
  conditionImmunitiesFrom?: { conditions: ConditionKey[]; types: string[] };
  /** Срабатывание в начале хода носителя (Heroism: temp HP; смайты: повторный урон). */
  triggers?: { startOfTurn?: EffectTurnPayload };
  /** Оружейные атаки носителя считаются магическими (Magic Weapon). */
  magicWeapon?: boolean;
  /** Shillelagh: клуб/посох в руке бьёт новой костью, типом и характеристикой. */
  weaponOverride?: WeaponOverride;
  /** Warding Bond: переносить получаемый урон на источник эффекта. */
  damageLink?: boolean;
  /** Eyebite: успешный спас цели ставит скрытую метку — повторно её не выбрать до конца каста. */
  markSaved?: boolean;
  /** Магические эффекты не снижают скорость (Freedom of Movement). */
  immuneToSpeedReduction?: boolean;
  /** Сложная местность (и союзники) не замедляют (Freedom of Movement). */
  ignoresDifficultTerrain?: boolean;
  /** Носитель видит невидимых (See Invisibility). */
  seesInvisible?: boolean;
  /** Primordial Ward: типы, по которым реакцией можно получить иммунитет (включая спровоцировавший урон). */
  ward?: string[];
  /**
   * Fount of Moonlight: реакция носителя на урон от видимого существа в `feet` —
   * нанёсший урон проходит спасбросок `ability` против СЛ источника, при провале
   * получает `condition` до начала следующего хода источника. Стоит реакцию.
   */
  damageReaction?: { ability: AbilityKey; feet: number; condition: ConditionKey };
  /**
   * Banishment: носитель изгнан на полуплоскость — скрыт с карты и не является
   * целью/помехой, пока эффект активен. При снятии возвращается в исходную
   * клетку (или ближайшую свободную); при естественном истечении срока
   * экстрапланетные существа не возвращаются (токен удаляется).
   */
  banish?: boolean;
  /** Досрочный обрыв эффекта: носитель совершил бросок атаки, применил заклинание или нанёс урон. */
  breakOn?: ('attack' | 'spell' | 'damage')[];
  /** Sanctuary: атакующие носителя обязаны пройти спас WIS или потерять атаку/заклинание. */
  sanctuary?: boolean;
  /** Лечение носителя берёт максимум костей (Beacon of Hope). */
  maximizeHealing?: boolean;
  /** Преимущество на спасброски от смерти (Beacon of Hope). */
  deathSaveAdvantage?: boolean;
  /** Успешный спасбросок полностью отменяет урон вместо половины (Circle of Power). */
  saveNoDamage?: boolean;
  /** Armor of Agathys: ответный урон атакующему в ближнем бою, пока есть врем. HP. */
  retaliate?: { damageType: string; amount?: number; dice?: string };
  /** Расходуемый счётчик эффекта (Flame Arrows: 12 боеприпасов). */
  charges?: { count: number; on: 'rangedWeaponAttack' };
  /** Spirit Shroud: носитель получает доп. урон от атак источника эффекта (аура-метка). */
  takesExtraDamage?: { dice: string; damageType: string };
  /** Booming Blade: добровольное перемещение на `feet`+ — урон `dice` и эффект гаснет. */
  onWillingMove?: { dice: string; damageType: string; feet: number };
  /** Zephyr Strike: одноразовая атака — 1d8 силовым и скорость до конца хода. */
  zephyrStrike?: { dice: string; damageType: string; speedFeet: number };
}

/**
 * Постоянный (до снятия) эффект с модификаторами — пассивные черты/фиты и баффы.
 */
export function permanentEffect(name: string, modifiers: Omit<Modifier, 'id'>[]): AutomationEffect {
  return { name, duration: { type: 'permanent' }, modifiers };
}

/**
 * Поля `AutomationEffect`, переносимые в `EffectInstance` без изменений (с копированием
 * объектов/массивов). Единый список для сервера (`applyEffectTo`) и нормализатора:
 * новое поле схемы добавляется сюда — иначе оно потеряется при перезагрузке комнаты.
 */
export function effectFieldsFromDef(def: AutomationEffect): Partial<EffectInstance> {
  return {
    concentration: def.concentration,
    conditions: def.conditions ? [...def.conditions] : undefined,
    escalate: def.escalate ? { ...def.escalate } : undefined,
    wakeOnDamage: def.wakeOnDamage,
    saveOnDamage: def.saveOnDamage ? { ...def.saveOnDamage } : undefined,
    restrictions: def.restrictions ? { ...def.restrictions } : undefined,
    misdirect: def.misdirect ? { ...def.misdirect } : undefined,
    bonusDie: def.bonusDie,
    bonusDieUses: def.bonusDieUses ? [...def.bonusDieUses] : undefined,
    hidden: def.hidden,
    senses: def.senses ? [...def.senses] : undefined,
    actions: def.actions,
    variant: def.variant,
    mark: def.mark,
    consumeOnAttackRoll: def.consumeOnAttackRoll,
    light: def.light ? { ...def.light } : undefined,
    deathWard: def.deathWard,
    conditionImmunities: def.conditionImmunities ? [...def.conditionImmunities] : undefined,
    conditionImmunitiesFrom: def.conditionImmunitiesFrom
      ? { conditions: [...def.conditionImmunitiesFrom.conditions], types: [...def.conditionImmunitiesFrom.types] }
      : undefined,
    triggers: def.triggers?.startOfTurn ? { startOfTurn: { ...def.triggers.startOfTurn } } : undefined,
    magicWeapon: def.magicWeapon,
    weaponOverride: def.weaponOverride
      ? { ...def.weaponOverride, weapons: [...def.weaponOverride.weapons] }
      : undefined,
    immuneToSpeedReduction: def.immuneToSpeedReduction,
    ignoresDifficultTerrain: def.ignoresDifficultTerrain,
    seesInvisible: def.seesInvisible,
    ward: def.ward ? [...def.ward] : undefined,
    damageReaction: def.damageReaction ? { ...def.damageReaction } : undefined,
    breakOn: def.breakOn ? [...def.breakOn] : undefined,
    maximizeHealing: def.maximizeHealing,
    deathSaveAdvantage: def.deathSaveAdvantage,
    saveNoDamage: def.saveNoDamage,
    retaliate: def.retaliate ? { ...def.retaliate } : undefined,
    charges: def.charges ? { remaining: def.charges.count, on: def.charges.on } : undefined,
    takesExtraDamage: def.takesExtraDamage ? { ...def.takesExtraDamage } : undefined,
    onWillingMove: def.onWillingMove ? { ...def.onWillingMove } : undefined,
    zephyrStrike: def.zephyrStrike ? { ...def.zephyrStrike } : undefined,
  };
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
   * Поднять цель до N HP, если её текущие HP ≤ 0 (Aura of Life: союзник на 0 HP
   * в начале хода получает 1 HP; у нас HP уходят в минус — поднимаем до N).
   * Мёртвых (`dead`) не оживляет.
   */
  healTo?: number;
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
  /** Лимит длительности «1 минута» = 10 раундов (см. `EffectInstance.maxRounds`). */
  maxRounds?: number;
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
    /** Scatter: до N целей, каждая — в свободную видимую точку в пределах `destinationFeet`. */
    | 'scatter'
    /** Помощь: разбудить цель — снять «сонные» эффекты (`wakeOnDamage`). */
    | 'wake'
    /** Revivify: вернуть мёртвую цель к жизни с 1 HP. */
    | 'revive'
    /** Spare the Dying: цель на 0 HP становится стабильной. */
    | 'stabilize'
    /** Lesser/Greater Restoration: снять одно состояние из `endConditions` (выбор при касте). */
    | 'endCondition';
  amount?: number;
  ability?: AbilityKey;
  /** Scatter: максимальное число целей (5). */
  targets?: number;
  /** Scatter: предел дистанции точки назначения от кастера, футы (120). */
  destinationFeet?: number;
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
  /** Использование действия завершает эффект-носитель (Holy Weapon: разряд). */
  endsEffect?: boolean;
}

export interface AutomationDef extends AutomationPayload {
  /** Ключ заклинания (`источник:имя`) или id действия (`class:barbarian:rage`). */
  key: string;
  name: string;
  resolution: AutomationResolution;
  concentration?: boolean;
  /** Лимит длительности «1 минута» = 10 раундов (см. `EffectInstance.maxRounds`). */
  maxRounds?: number;
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
  autoTargets?: { feet: number; side: 'hostile' | 'ally' | 'any'; includeSelf?: boolean };
  /** Стоимость/цель черты (для классовых действий). */
  costs?: ActionCost[];
  targeting?: ActionTargeting;
  zone?: ZoneDef;
  summon?: SummonDef;
  /** Трансформа цели (Polymorph): спасбросок + форма-зверь. */
  shape?: ShapeDef;
  /** Вынужденное перемещение попавших/проваливших сейв целей (Repelling Blast, Thunderwave). */
  force?: { kind: 'push' | 'pull'; feet: number; maxSize?: 'normal' | 'large' | 'huge' };
  /**
   * Райдер оружия/смайта: клинки-кантрипы (Green-Flame Blade) и ranged-смайты
   * (Hail of Thorns, Lightning Arrow): кости на попадании и вторичный урон.
   */
  weaponAttack?: {
    /** Доп. кости урона на попадании с типом (`1d8fire`); нет — без добавки. */
    riderDice?: string;
    /** Кости заменяют урон оружия, а не добавляются (Lightning Arrow). */
    replace?: boolean;
    /** Разрешено любое оружие правой руки, включая дальнее (True Strike); иначе — только ближний бой. */
    anyWeapon?: boolean;
    /** Броски атаки/урона — от заклинательной характеристики вместо Силы/Ловкости (True Strike). */
    spellAbility?: boolean;
    /**
     * Вторичная цель в `rangeFeet` от основной: урон = мод заклинательной + `dice`.
     * `save` — вторичный урон по спасброску всех в радиусе (Lightning); без него — GFB-режим.
     */
    secondary?: {
      rangeFeet: number;
      dice?: string;
      damageType: string;
      save?: { ability: AbilityKey; half?: boolean };
      /** Радиус бьёт и по основной цели (Hail of Thorns: «цель и существа вокруг»). */
      includePrimary?: boolean;
    };
    /** Эффект на цель при попадании (Booming Blade: гремящая энергия). */
    hitEffect?: AutomationEffect;
  };
  /** Фильтр целей по отношению к кастеру (Conjure Woodland Beings: только враги). */
  side?: 'hostile' | 'ally';
  /** Типы существ, на которых заклинание не действует (Command: нежить) — цели пропускаются. */
  excludeCreatureTypes?: string[];
  /** Лечение на половину фактически нанесённого урона (Vampiric Touch). */
  lifesteal?: boolean;
  /** Перенос метки эффекта на новую цель (Hex/Hunter's Mark): обновляет filter.targetId. */
  retarget?: boolean;
  /** Эффекты при успешном спасброске (Irresistible Dance: короткий танец до конца следующего хода). */
  saveSuccess?: AutomationEffect[];
  utility?: AutomationUtility;
}
