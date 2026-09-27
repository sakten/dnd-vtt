import type { ActionCost, ActionTargeting, AreaSpec } from './actions';
import type { Sense } from './sense';
import type { AbilityKey } from './core';
import type {
  ConditionKey,
  DirectionKey,
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
  /** Атака действия зоны (Storm Sphere): цель внутри зоны-источника — преимущество. */
  advantageInZone?: boolean;
}

export interface AutomationSave {
  ability: AbilityKey;
  /** Успешный спасбросок — половина урона (иначе 0). */
  half?: boolean;
}

/** Всплеск вокруг цели: спас и урон по всем существам в радиусе (Ice Knife, Hail of Thorns). */
export interface AttackBurst {
  /** Радиус от центра, футы. */
  rangeFeet: number;
  /** Кости урона (со скейлом); нет — без урона. */
  dice?: string;
  damageType: string;
  save?: { ability: AbilityKey; half?: boolean };
  /** Радиус бьёт и по основной цели (Ice Knife: «цель и существа вокруг»). */
  includePrimary?: boolean;
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
  /** Enervation: self-эффект (повтор) накладывается только при провале спасброска цели. */
  selfOnFail?: boolean;
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
  /**
   * Heroes' Feast: бонус `dice` к максимуму HP (и текущим HP) — кости бросаются
   * один раз при наложении эффекта; откат при снятии идёт по тому же числу.
   */
  maxHpBonus?: { dice: string };
  /** Кость бонуса к d20-тесту, тратится при использовании (Бардовское вдохновение). */
  bonusDie?: string;
  /** Доп. способы траты кости (Боевое вдохновение): урон/AC. */
  bonusDieUses?: ('damage' | 'ac')[];
  /** Подмена попадания дубликатами (Mirror Image): бросок die ≥ threshold уничтожает заряд. */
  misdirect?: { charges: number; die: string; threshold: number };
  /** Ограничения экономики/действий, пока эффект активен. */
  restrictions?: Restrictions;
  /**
   * Bestow Curse (режим «Уклонение»): в начале каждого хода носителя — спас
   * `ability` (СЛ каста), при провале цель вынуждена уклоняться этот ход.
   */
  turnDodge?: { ability: AbilityKey };
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
  /**
   * Срабатывание в начале/конце хода носителя (Heroism: temp HP; смайты:
   * повторный урон; Vitriolic Sphere: отложенный урон в конце хода).
   */
  triggers?: { startOfTurn?: EffectTurnPayload; endOfTurn?: EffectTurnPayload };
  /** Оружейные атаки носителя считаются магическими (Magic Weapon). */
  magicWeapon?: boolean;
  /** Shillelagh: дубинка/посох в руке бьёт новой костью, типом и характеристикой. */
  weaponOverride?: WeaponOverride;
  /**
   * Shadow Blade: синтетический клинок тени в руке — кость со скейлом круга
   * (2d8…5d8), психический, ловкость/сила; брошенный клинок возвращается
   * бонусным действием (`inHand: false`, пока не возвращён).
   */
  shadowBlade?: { dice: string; inHand: boolean };
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
  /** Dominate Beast/Person: носитель под контролем источника (команды), пока эффект жив. */
  dominates?: boolean;
  /** Досрочный обрыв эффекта: носитель совершил бросок атаки, применил заклинание или нанёс урон. */
  breakOn?: ('attack' | 'spell' | 'damage')[];
  /** Sanctuary: атакующие носителя обязаны пройти спас WIS или потерять атаку/заклинание. */
  sanctuary?: boolean;
  /** Лечение носителя берёт максимум костей (Beacon of Hope). */
  maximizeHealing?: boolean;
  /** Chill Touch: носитель не может восстанавливать HP, пока эффект жив. */
  noHeal?: boolean;
  /** Преимущество на спасброски от смерти (Beacon of Hope). */
  deathSaveAdvantage?: boolean;
  /** Успешный спасбросок полностью отменяет урон вместо половины (Circle of Power). */
  saveNoDamage?: boolean;
  /** Armor of Agathys: ответный урон атакующему в ближнем бою, пока есть врем. HP. */
  retaliate?: { damageType: string; amount?: number; dice?: string };
  /**
   * Resistance (XPHB 2024): носитель уменьшает получаемый урон выбранного типа на
   * `dice`; расходуется заряд (`charges`), который обновляется в начале его хода.
   */
  damageReduce?: { dice: string; types: string[] };
  /**
   * Elemental Bane (XGE): носитель теряет сопротивление выбранному типу; первый раз
   * за ход, получая урон этого типа, дополнительно получает `dice` того же типа.
   */
  elementalBane?: { damageType: string; dice: string };
  /**
   * Расходуемый счётчик эффекта: Flame Arrows (12 боеприпасов, `on` — триггер
   * траты) и Magic Stone (3 камня — тратится при использовании выданного действия).
   */
  charges?: { count: number; on?: 'rangedWeaponAttack' };
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
    triggers: def.triggers
      ? {
          ...(def.triggers.startOfTurn ? { startOfTurn: { ...def.triggers.startOfTurn } } : {}),
          ...(def.triggers.endOfTurn ? { endOfTurn: { ...def.triggers.endOfTurn } } : {}),
        }
      : undefined,
    magicWeapon: def.magicWeapon,
    weaponOverride: def.weaponOverride
      ? { ...def.weaponOverride, weapons: [...def.weaponOverride.weapons] }
      : undefined,
    shadowBlade: def.shadowBlade ? { ...def.shadowBlade } : undefined,
    immuneToSpeedReduction: def.immuneToSpeedReduction,
    ignoresDifficultTerrain: def.ignoresDifficultTerrain,
    seesInvisible: def.seesInvisible,
    ward: def.ward ? [...def.ward] : undefined,
    damageReaction: def.damageReaction ? { ...def.damageReaction } : undefined,
    breakOn: def.breakOn ? [...def.breakOn] : undefined,
    maximizeHealing: def.maximizeHealing,
    noHeal: def.noHeal,
    deathSaveAdvantage: def.deathSaveAdvantage,
    saveNoDamage: def.saveNoDamage,
    dominates: def.dominates,
    retaliate: def.retaliate ? { ...def.retaliate } : undefined,
    damageReduce: def.damageReduce ? { ...def.damageReduce, types: [...def.damageReduce.types] } : undefined,
    elementalBane: def.elementalBane ? { ...def.elementalBane } : undefined,
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
  /**
   * Enervation: урон при успешном спасброске — отдельный бросок вместо половины
   * `damage` (спас с `half: true` при этом не ставится). Нет — успех даёт 0
   * (или половину `damage` при `save.half`).
   */
  successDamage?: AutomationDice;
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

/**
 * Тонкая стена-зона (Wall of Ice и подобные): сегменты по границам клеток,
 * секции с HP. Непробитые секции блокируют переход и обзор (движок стен),
 * пробитые — «лист» с payload `breach` при проходе.
 */
export interface ZoneWallDef {
  /** Длина секции вдоль геометрии (футы; RAW — 10). */
  sectionFeet: number;
  /** HP секции (нет — стена неуязвима, Wall of Force). */
  hp?: number;
  ac?: number;
  immunities?: string[];
  resistances?: string[];
  vulnerabilities?: string[];
  /** Урон/эффект прохода сквозь пробитую секцию («лист холода»). */
  breach?: AutomationPayload;
  /** Полный иммунитет к урону (Wall of Force): секции не создаются, атаки отклоняются. */
  immune?: boolean;
  /** Блокирует обзор; `false` — прозрачная стена (Wall of Force). */
  blocksLineOfSight?: boolean;
}

/** Состояние секции стены (индекс — вдоль геометрии: длина/дуга). */
export interface ZoneSection {
  hp: number;
  maxHp: number;
  /** Разрушена: сегменты больше не блокируют, проход бьёт `breach`. */
  broken?: boolean;
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
  /**
   * Одноразовый payload при появлении зоны (Storm Sphere: «существа в сфере,
   * когда она появляется»): применяется сразу после создания, вход позже — нет.
   */
  onCreate?: AutomationPayload;
  /** Заряды зоны (Cordon of Arrows — стрелы; Healing Spirit — лимит лечений). */
  charges?: number;
  /**
   * Суммарный урон, после которого зона исчезает (Guardian of Faith: 60).
   * Считается по фактически нанесённому урону от триггеров зоны.
   */
  dealtLimit?: number;
  /** Типы существ, на которых не действуют аура и триггеры (Healing Spirit: конструкты/нежить). */
  excludeCreatureTypes?: string[];
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
    /** Стоимость перемещения, футов за 1 фут (Wall of Thorns: 4); иначе сложная местность = ×2. */
    movementCost?: number;
    obscured?: 'light' | 'heavy';
    blocksLight?: boolean;
    blocksMovement?: boolean;
    blocksLineOfSight?: boolean;
    /** Почти незаметный визуал зоны (туча Call Lightning): только тонкий контур. */
    subtle?: boolean;
    /** Спрайт-маркер зоны (Spiritual Weapon — молот силы; Conjure Fey — огонёк; Guardian — страж). */
    sprite?: 'hammer' | 'fey' | 'guardian';
    /** Зона молчания (Silence, Jallarzi): внутри нельзя кастовать с вербальным компонентом. */
    silence?: boolean;
  };
  /** Тонкая стена: секции с HP вместо клеточной блокировки (Wall of Ice). */
  wall?: ZoneWallDef;
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
  /** Типы существ, на которых не действуют аура и триггеры (Healing Spirit). */
  excludeCreatureTypes?: string[];
  /** Оставшиеся заряды зоны (Cordon of Arrows, Healing Spirit); 0 — зона исчезает. */
  charges?: number;
  /** Суммарно нанесённый урон и порог исчезновения (Guardian of Faith: 60). */
  dealtLimit?: number;
  dealtTotal?: number;
  /** Действия владельца зоны, пока она на карте (перемещение). */
  actions?: GrantedAction[];
  /**
   * Заряжена на бесплатный удар (Spiritual Weapon): выдаётся при создании и
   * «Переносом» за бонусное действие, сбрасывается ударом и в конце хода источника.
   */
  readyStrike?: boolean;
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
  /** Тонкая стена: секции с HP (Wall of Ice). */
  wall?: ZoneWallDef;
  /** Цепочка панелей тонкой стены (узлы, панели — между соседними): задаётся при касте. */
  wallPath?: { x: number; y: number }[];
  /** Состояние секций стены (`wall`); индекс — вдоль геометрии. */
  sections?: ZoneSection[];
  /** Кто проходил сквозь пробитую секцию в этом ходу: `tokenId -> turnKey`. */
  sheetsThisTurn?: Record<string, string>;
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
    /** Shadow Blade: вернуть брошенный клинок тени в руку (бонусным действием). */
    | 'recallWeapon'
    /** Spare the Dying: цель на 0 HP становится стабильной. */
    | 'stabilize'
    /** Lesser/Greater Restoration: снять одно состояние из `endConditions` (выбор при касте). */
    | 'endCondition'
    /** Compulsion: отметить направление над целями источника (механику ведёт мастер). */
    | 'direction'
    /**
     * Telekinesis: выбранное существо на провале STR-спасброска перемещается в точку
     * (`placements`, ≤ `amount` фт от него) и получает `restrained` до начала вашего
     * следующего хода; предметы не двигаем (решение владельца).
     */
    | 'telekinesis';
  amount?: number;
  ability?: AbilityKey;
  /** Телекинез: максимальный размер двигаемого существа (`huge` — Huge и меньше). */
  maxSize?: 'normal' | 'large' | 'huge';
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
  /** Направление для `direction` (Compulsion). */
  direction?: DirectionKey;
  /**
   * Телепорт: взять одно согласное существо (`feet` — дистанция от кастера при
   * касте, `destFeet` — от точки прибытия; `maxSize` — не крупнее кастера).
   */
  passenger?: { feet: number; destFeet: number; maxSize?: boolean };
  /** Телепорт: вспышка в покинутой точке (Thunder Step) — спас и урон вокруг. */
  fromBurst?: { feet: number; save: AutomationSave; damage?: AutomationDice };
  /** Dimension Door: чистый путь/видимость точки не требуются (сквозь стены). */
  ignoreSight?: boolean;
  /**
   * Dimension Door: если точка прибытия занята/непроходима — каст исполняется
   * (ячейка тратится), телепорт не происходит, путешественники получают урон.
   */
  blockedDamage?: AutomationDice;
}

/** Действие, выдаваемое эффектом (Expeditious Retreat: Рывок бонусным действием). */
export interface GrantedAction {
  id: string;
  name: string;
  /** `free` — не тратит ресурсов хода (Spiritual Weapon: удар после бонусного действия). */
  cost: 'action' | 'bonus' | 'free';
  /** Механика базового действия каталога (`dash`) — payload не дублируется. */
  baseActionId?: string;
  /** Своя механика, если действие не ссылается на базовое (Dragon's Breath). */
  def?: AutomationDef;
  /** Использование действия завершает эффект-носитель (Holy Weapon: разряд). */
  endsEffect?: boolean;
  /** Использование действия сокращает зону на N футов (Wall of Light: луч −10 фт). */
  shrinkFeet?: number;
}

export interface AutomationDef extends AutomationPayload {
  /** Ключ заклинания (`источник:имя`) или id действия (`class:barbarian:rage`). */
  key: string;
  name: string;
  resolution: AutomationResolution;
  /**
   * Ручная механика по решению владельца (Charm Monster/Compulsion): каст вешает
   * только плашку состояния `chip`, остальное ведёт мастер; красный маркер не рисуется.
   */
  byDesign?: boolean;
  /** Плашка состояния, накладываемая кастом при `byDesign` (без спасброска — ведёт мастер). */
  chip?: ConditionKey;
  /** Выданные мастеру действия ручного спелла (Compulsion: 4 направления) — эффект на кастере. */
  chipActions?: GrantedAction[];
  /**
   * Negative Energy Flood: нежить спас не бросает — вместо урона получает
   * половину броска временными хитами.
   */
  undeadTempHp?: boolean;
  /**
   * Промах атаки наносит половину урона (Melf's Acid Arrow: брызги кислоты).
   * Крит не применяется, эффекты на промахе не накладываются.
   */
  halfOnMiss?: boolean;
  concentration?: boolean;
  /** Лимит длительности «1 минута» = 10 раундов; `null` — без лимита (апкаст Dominate). */
  maxRounds?: number | null;
  attack?: AutomationAttack;
  /** Число атак/снарядов/повторов; скейл (апкаст/уровень персонажа) уже учтён. */
  count?: number;
  /** Область заклинания (для зон/фич; цели обычного каста собирает вызывающий). */
  area?: AreaSpec;
  /** Массовая цель без области: до N существ (Mass Healing Word — 6). */
  targets?: number;
  /** Максимум целей = модификатор способности (Мантия вдохновения: Харизма, min 1). */
  targetsAbility?: AbilityKey;
  /**
   * Chain Lightning: игрок выбирает только первую цель, до `jumps` враждебных
   * существ в `feet` от неё добавляются автоматически (по дистанции, без повторов).
   */
  chain?: { jumps: number; feet: number };
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
   * Dispel Evil and Good: провал спасброска отправляет существо на родной план —
   * токен удаляется навсегда (без возврата).
   */
  banishOnFail?: boolean;
  /**
   * Всплеск вокруг цели: спас и урон по всем существам в `rangeFeet`
   * (Ice Knife — независимо от попадания; Hail of Thorns/Lightning Arrow — райдер).
   */
  burst?: AttackBurst;
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
    secondary?: AttackBurst;
    /** Эффект на цель при попадании (Booming Blade: гремящая энергия). */
    hitEffect?: AutomationEffect;
  };
  /** Фильтр целей по отношению к кастеру (Conjure Woodland Beings: только враги). */
  side?: 'hostile' | 'ally';
  /** Типы существ, на которых заклинание не действует (Command: нежить) — цели пропускаются. */
  excludeCreatureTypes?: string[];
  /** Только эти типы существ (Dominate Beast/Person) — иначе каст отклоняется. */
  requiresCreatureTypes?: string[];
  /** Первый спасбросок с преимуществом, пока в комнате активен бой (Dominate). */
  saveAdvantageInCombat?: boolean;
  /** Лечение на половину фактически нанесённого урона (Vampiric Touch). */
  lifesteal?: boolean;
  /**
   * Life Transference: кастер получает урон (`damage`) неуменьшаемым, цель лечится
   * на `factor` × фактически полученный урон.
   */
  lifeTransfer?: { factor: number };
  /**
   * Harm: при провале спасброска максимум HP цели снижается на фактически полученный
   * урон (не ниже 1). Снятие — долгий отдых (эффект-штраф висит до снятия).
   */
  maxHpFromDamage?: boolean;
  /**
   * Steel Wind Strike: после резолва атак кастер телепортируется в точку в `feet`
   * от любой из выбранных целей (точка приходит в `origin` того же каста).
   */
  teleportAfter?: { feet: number };
  /** Перенос метки эффекта на новую цель (Hex/Hunter's Mark): обновляет filter.targetId. */
  retarget?: boolean;
  /** Эффекты при успешном спасброске (Irresistible Dance: короткий танец до конца следующего хода). */
  saveSuccess?: AutomationEffect[];
  utility?: AutomationUtility;
}
