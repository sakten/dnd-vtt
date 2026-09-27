import type { ActionTargeting, AreaSpec } from '../../domain/actions';
import type {
  AutomationResolution,
  AutomationSave,
  AutomationUtility,
  LightSource,
  ZoneDef,
  ZoneWallDef,
} from '../../domain/automation';
import type { ConditionKey, EffectDuration, Modifier, ModifierFilter, Restrictions } from '../../domain/effects';
import type { Sense } from '../../domain/sense';
import type { WallDims } from '../spellCast';
import type { DamagePartRole } from '../spells';

/**
 * Выражение значения спека (R16): резолвится компилятором из данных заклинания,
 * опций каста или литерала. Возвращает строку/число; `undefined` — значения нет
 * (поле опускается). См. `AUTOMATION.md` §4.
 */
export type ValueExpr =
  | string
  | number
  | {
      ref:
        | 'cantrip'
        | 'damage'
        | 'part'
        | 'upcastDice'
        | 'upcastAttack'
        | 'upcastFlat'
        | 'spellDamage'
        | 'type0'
        | 'spellMod'
        | 'castLevel'
        | 'characterLevel'
        | 'choice';
      /** Роль части (`part`): main/repeat/success/trigger/choice. */
      part?: DamagePartRole;
      /** Индекс части с этой ролью (составной урон: две `main`). */
      index?: number;
      /** id выбора из `choices` (без id — единственный выбор спека). */
      choice?: string;
      /** Для `choice`: без явно переданного варианта значение не подставляется. */
      optional?: boolean;
      fallback?: ValueExpr;
    }
  /** Сложение костей одного вида: `1d8` + `1d8` → `2d8` (нет базы — берётся добавка). */
  | { add: [ValueExpr, ValueExpr] }
  /** Числовая сумма (нераскрытое слагаемое — 0): `5 + flat апкаста` (Armor of Agathys). */
  | { sum: ValueExpr[] }
  /** Конкатенация: `${кость}${тип}`; любое нерешённое слагаемое опускает всё выражение. */
  | { concat: ValueExpr[] }
  /** Склейка непустых слагаемых разделителем: `1d10 + 1d10` (Hail/Lightning: база + апкаст). */
  | { join: { parts: ValueExpr[]; sep: string } }
  /** `'1'`, если значение входит в список — гейт для `{ if, then }` (Command: halt/grovel). */
  | { includes: { of: ValueExpr; values: string[] } }
  /** Литеральные ступени значения по кругу (Magic Weapon: +1/+2/+3 с 1/3/6 круга). */
  | { tiers: { above: number; value: number }[] }
  /** `base + per × (круг − above)`; `above:'spell'` — базовый круг заклинания (Cordon). */
  | { perLevel: { base: number; per: number; above: number | 'spell' } }
  /** `max(min, base + round(spellMod))` (Healing Spirit: заряды 1 + мод, мин 2). */
  | { spellMod: { base: number; min?: number } }
  /** Кость с апкаст-скейлом: данные (`upcast`) или литеральная добавка за шаг (Ice: +2d6). */
  | { scale: { dice: ValueExpr; by: 'upcast' | { dice: string } } }
  /** Отображение значения по таблице (Fire Shield: warm → сопротивление холоду, ответ огнём). */
  | { mapped: { of: ValueExpr; values: Record<string, string>; fallback?: ValueExpr } };

/** Выбор, делаемый при касте (Dragon's Breath: тип урона; Elemental Weapon: тип и т.п.). */
export interface ChoiceSpec {
  id: string;
  param: 'damageType' | 'ability' | 'skill' | 'condition' | 'mode' | 'effect' | 'command';
  options: string[];
  default?: string;
}

/** Действие, выдаваемое эффектом (компилируется в `GrantedAction`). */
export interface ActionSpec {
  id: string;
  name: string;
  cost: 'action' | 'bonus' | 'free';
  /** Имя внутреннего `def`, если отличается от имени действия (Flame Blade: «Огненный клинок»). */
  defName?: string;
  /** Явный ключ `def` (действия зон: `zone:move`); иначе ключ спека (+`subKey`). */
  defKey?: string;
  /** Суффикс ключа `def`: `${spec.key}:${subKey}` (Shadow Blade: return). */
  subKey?: string;
  /** Перенос метки (Hex/Hunter's Mark): доступен только после смерти текущей цели. */
  retarget?: boolean;
  primary: AutomationResolution;
  attack?: { rangeType: 'melee' | 'ranged'; advantageInZone?: boolean };
  count?: number;
  /** Сокращение зоны после использования действия (Wall of Light: луч −10 фт). */
  shrinkFeet?: number;
  /** Использование действия завершает эффект-носитель (Holy Weapon: разряд). */
  endsEffect?: boolean;
  /** Область действия: литерал или `spell.areaSpec` с fallback (Dragon's Breath). */
  area?: AreaSpec | { from: 'spell'; fallback: AreaSpec };
  /** Прицеливание: литерал или область из `area` (range = max(5, size)). */
  targeting?: ActionTargeting | { kind: 'area'; fromArea: true };
  /** Действие зоны (Dragon's Breath): спас и урон (кость/типы — ссылки). */
  save?: AutomationSave;
  damage?: { dice: ValueExpr; types?: ValueExpr[]; abilityMod?: boolean };
  /** Эффекты действия (Eyebite: сон/паника/тошнота при провале спасброска). */
  effects?: EffectSpec[];
  utility?: UtilitySpec;
}

/** Стратегия `augment`: бонусы к существующему оружию (Magic/Elemental Weapon, Flame Arrows). */
export interface LoadoutAugment {
  kind: 'augment';
  attack?: ValueExpr;
  damage?: ValueExpr;
  /** Фильтр только по дальнобойным атакам (Flame Arrows). */
  ranged?: boolean;
  /** Атаки считаются магическими (`magicWeapon`). */
  magic?: boolean;
}

/** Стратегия `weaponOverride`: подмена кости/типа/характеристики оружия (Shillelagh). */
export interface LoadoutWeaponOverride {
  kind: 'weaponOverride';
  weapons: string[];
  dice: ValueExpr;
  damageType: ValueExpr;
  abilityMod: ValueExpr;
}

/** Стратегия `inject`: синтетическое оружие в лоадауте (Shadow Blade). */
export interface LoadoutShadowBlade {
  kind: 'shadowBlade';
  dice: ValueExpr;
  inHand: boolean;
}

export type LoadoutSpec = LoadoutAugment | LoadoutWeaponOverride | LoadoutShadowBlade;

/**
 * Блок `uses` (R16, `AUTOMATION.md` §3.3): заряды и счётчики. Компилируется в
 * существующие поля эффекта (`charges`/`consumeOnAttackRoll`/`misdirect`), пока
 * серверные потребители не унифицированы.
 */
export type UsesSpec =
  /** Расходуемые заряды: Flame Arrows (12), Magic Stone (3), Resistance (1 за ход). */
  | { kind: 'charges'; count: ValueExpr; on?: 'rangedWeaponAttack' }
  /** Одноразовый эффект: сгорает после ближайшего броска атаки носителя (Zephyr Strike). */
  | { kind: 'consumeOnAttack' }
  /** Подмена попадания образами (Mirror Image): заряды, кость, порог. */
  | { kind: 'misdirect'; charges: number; die: string; threshold: number };

/** Payload спека (триггеры зон/эффектов): кости и эффекты — ссылки `ValueExpr`. */
export interface PayloadSpec {
  save?: AutomationSave;
  damage?: DamageSpec;
  heal?: { dice: ValueExpr };
  successDamage?: { dice: ValueExpr; types?: string[] };
  effects?: EffectSpec[];
  endConditions?: ConditionKey[];
  healTo?: number;
  containment?: 'anyCell' | 'fullyWithin';
}

/** Урон: одиночная часть или составной (`5d6thunder + 5d6radiant`, защиты по частям). */
export type DamageSpec =
  | { dice: ValueExpr; types?: ValueExpr[]; abilityMod?: boolean }
  | { parts: { dice: ValueExpr; type: ValueExpr }[] };

/** Габариты стены в спеке: явные или из данных заклинания (`WALL_DIMS`). */
export type WallDimsSpec = WallDims | { from: 'spell' };

/** Блок `zone` (R16): pass-through полей `ZoneDef` + `ValueExpr` в зарядах и триггерах. */
export interface ZoneSpec
  extends Omit<Partial<ZoneDef>, 'area' | 'charges' | 'triggers' | 'onCreate' | 'aura' | 'wall' | 'actions'> {
  /** Область: литерал или стена из габаритов (`wallAreaOf`). */
  area?: AreaSpec | { wall: WallDimsSpec };
  /** Секции тонкой стены (Ice/Force/Stone); `breach` — payload пробоя. */
  wall?: Omit<ZoneWallDef, 'breach'> & { breach?: PayloadSpec };
  charges?: ValueExpr;
  onCreate?: PayloadSpec;
  aura?: PayloadSpec;
  /** Действия владельца зоны (перемещение, луч) — спеки действий. */
  actions?: ActionSpec[];
  triggers?: {
    enter?: PayloadSpec;
    exit?: PayloadSpec;
    startOfTurn?: PayloadSpec;
    endOfTurn?: PayloadSpec;
  };
}

/** Элемент списка под условием: `if` непусто/истинно — `then` попадает в результат. */
export type Gated<T> = T | { if: ValueExpr; then: T };

/** Значение, зависящее от круга каста: ближайшая ступень `above` (включительно) или `fallback`. */
export type Leveled<T> = T | { levels: { above: number; value: T }[]; fallback?: T };

/** Модификатор спека: `value`/`filter.*` — `ValueExpr` (выбор при касте). */
export interface ModifierSpec extends Omit<Modifier, 'id' | 'value' | 'filter'> {
  value?: ValueExpr;
  filter?: Omit<ModifierFilter, 'damageType' | 'ability' | 'skill'> & {
    damageType?: ValueExpr;
    ability?: ValueExpr;
    skill?: ValueExpr;
  };
}

/**
 * Блок `hooks` (AUTOMATION.md §3.2): реактивные перехваты урона/падения и поток HP.
 * Компилируется в существующие поля эффекта, пока серверный диспетчер (R14) не выделен.
 */
export interface HookSpec {
  /** Ответный урон атакующему в ближнем бою (Armor of Agathys, Fire Shield, Shadow of Moil). */
  retaliate?: Gated<{ damageType: ValueExpr; dice?: string; amount?: ValueExpr }>;
  /** Уменьшение получаемого урона типов на кость, заряд раз в ход (Resistance). */
  damageReduce?: { dice: ValueExpr; types: ValueExpr[] };
  /** Elemental Bane: потеря сопротивления и доп. урон первого попадания за ход. */
  elementalBane?: { damageType: ValueExpr; dice: ValueExpr };
  /** Spirit Shroud/CME: доп. урон атак источника по носителю (аура-метка). */
  takesExtraDamage?: Gated<{ dice: ValueExpr; damageType: ValueExpr }>;
  /** Урон/встряска снимает эффект (Sleep, Eyebite: сон). */
  wakeOnDamage?: Gated<boolean>;
  /** Повторный спасбросок при получении урона; успех снимает эффект (Hideous Laughter). */
  saveOnDamage?: Gated<{ advantage?: boolean }>;
  /** Досрочный обрыв: носитель атаковал, применил заклинание или нанёс урон (Invisibility). */
  breakOn?: ('attack' | 'spell' | 'damage')[];
  /** Sanctuary: атакующие носителя обязаны пройти спас WIS или потерять атаку/заклинание. */
  sanctuary?: boolean;
  /** Death Ward: первое падение до 0 HP от урона — 1 HP вместо этого, эффект гаснет. */
  deathWard?: boolean;
  /** Warding Bond: переносить получаемый урон на источник эффекта. */
  damageLink?: boolean;
  /** Временные HP при наложении (Armor of Agathys, Heroism-подобные). */
  tempHp?: ValueExpr;
  /** Chill Touch: носитель не может восстанавливать HP, пока эффект жив. */
  noHeal?: boolean;
  /** Лечение носителя берёт максимум костей (Beacon of Hope). */
  maximizeHealing?: boolean;
  /** Преимущество на спасброски от смерти (Beacon of Hope). */
  deathSaveAdvantage?: boolean;
  /** Успешный спасбросок полностью отменяет урон вместо половины (Circle of Power). */
  saveNoDamage?: boolean;
  /** Dominate: носитель под контролем источника, пока эффект жив. */
  dominates?: boolean;
  /** Primordial Ward: типы, по которым реакцией можно получить иммунитет. */
  ward?: string[];
  /** Fount of Moonlight: реакция носителя на урон от видимого существа. */
  damageReaction?: { ability: ValueExpr; feet: number; condition: ConditionKey };
}

/**
 * Блок `utility` спека (R16): как `AutomationUtility`, но кости провала/вспышки —
 * ссылки (`DamageSpec`). Компилируется в поля `AutomationDef.utility`.
 */
export interface UtilitySpec extends Omit<AutomationUtility, 'blockedDamage' | 'fromBurst'> {
  /** Урон провала телепорта (Dimension Door: 4к6 силовым). */
  blockedDamage?: DamageSpec;
  /** Вспышка в покинутой точке (Thunder Step: спас CON, 3к10 звуком). */
  fromBurst?: { feet: number; save: AutomationSave; damage?: DamageSpec };
}

/** Блок `movement` спека: телепорт после атаки (Steel Wind Strike). */
export interface MovementSpec {
  teleportAfter?: { feet: number };
}

/** Блок `movement` эффекта: одноразовая атака Zephyr Strike (расход — через `uses`). */
export interface EffectMovementSpec {
  zephyrStrike?: { dice: string; damageType: string; speedFeet: number };
}

/** Эффект спека: длительность/цель + блоки (loadout/uses/actions/vision). */
export interface EffectSpec {
  id: string;
  name: string;
  duration: Leveled<EffectDuration>;
  concentration?: Leveled<boolean>;
  to?: 'self' | 'targets';
  /** Модификаторы (id присваивает сервер); значения/фильтры — ссылки; гейт по выбору. */
  modifiers?: Gated<ModifierSpec>[];
  conditions?: Gated<ValueExpr>[];
  /** Иммунитеты к состояниям (Shining Smite: невидимость); значения — ссылки/гейты. */
  conditionImmunities?: Gated<ValueExpr>[];
  /** Banishing Smite: провал спасброска изгоняет существо (конец каста — возврат). */
  banish?: boolean;
  light?: LightSource;
  /** Восприятие, выдаваемое эффектом (Darkvision); гейт по выбору. */
  senses?: Gated<Sense[]>;
  /** Носитель видит невидимых (See Invisibility); гейт по выбору. */
  seesInvisible?: Gated<boolean>;
  /** Подпись выбранного варианта (`variant`), если он виден в чипе. */
  variant?: ValueExpr;
  /** Привязка модификаторов к цели каста (метка Hex/Hunter's Mark на кастере). */
  markTarget?: boolean;
  /** Метка-прицел на цели (второй эффект Hex/Hunter's Mark). */
  mark?: boolean;
  /** Максимум целей эффекта (Bless — 3, Elemental Bane — 1). */
  targets?: ValueExpr;
  /** Блок `uses`: заряды/счётчики эффекта. */
  uses?: UsesSpec;
  /** Блок `hooks`: реактивные перехваты урона/HP (`HookSpec`). */
  hooks?: HookSpec;
  /** Bestow Curse («Уклонение»): спас в начале хода, при провале — принудительное Уклонение. */
  turnDodge?: Gated<{ ability: ValueExpr }>;
  /** Eyebite: метка спасшейся цели — повторно не выбрать до конца каста. */
  markSaved?: boolean;
  /** Ограничения экономики (Zephyr Strike: перемещение не провоцирует OA). */
  restrictions?: Restrictions;
  /** Блок `movement` эффекта: Zephyr Strike (расход через `uses.consumeOnAttack`). */
  movement?: EffectMovementSpec;
  actions?: ActionSpec[];
  loadout?: LoadoutSpec;
}

/** Стратегия `rider`: атака оружием при касте (True Strike, клинки-кантрипы, смайты). */
export interface WeaponAttackSpec {
  riderDice?: ValueExpr;
  replace?: boolean;
  anyWeapon?: boolean;
  spellAbility?: boolean;
  secondary?: {
    rangeFeet: number;
    dice?: ValueExpr;
    damageType: string;
    save?: { ability: import('../../domain/core').AbilityKey; half?: boolean };
    includePrimary?: boolean;
  };
  hitEffect?: {
    name: string;
    duration: EffectDuration;
    to?: 'self' | 'targets';
    modifiers?: Omit<Modifier, 'id'>[];
    conditions?: ConditionKey[];
    onWillingMove?: { dice: ValueExpr; damageType: string; feet: number };
  };
}

/** Декларативный спек заклинания (R16, пилот `loadout`): компилируется в `AutomationDef`. */
export interface AutomationSpec {
  key: string;
  name: string;
  /** Ведущая ветка диспетчера (см. `AUTOMATION.md` §2). */
  primary: AutomationResolution;
  concentration?: Leveled<boolean>;
  maxRounds?: Leveled<number | null>;
  save?: AutomationSave;
  /** Вынужденное перемещение проваливших спас (Thunderous Smite: толчок 10 фт). */
  force?: { kind: 'push' | 'pull'; feet: number; maxSize?: 'normal' | 'large' | 'huge' };
  damage?: DamageSpec;
  attack?: { rangeType: 'melee' | 'ranged'; advantageInZone?: boolean };
  count?: number;
  /** Массовая цель без области: до N существ (Steel Wind Strike — 5). */
  targets?: number;
  /** Chain Lightning: первая цель выбирается, `jumps` существ в `feet` — авто. */
  chain?: { jumps: ValueExpr; feet: number };
  /** Всплеск вокруг цели (Ice Knife — независимо от попадания). */
  burst?: {
    rangeFeet: number;
    dice?: ValueExpr;
    damageType: ValueExpr;
    save?: AutomationSave;
    includePrimary?: boolean;
  };
  targeting?: ActionTargeting;
  /** Утилита спека (телепорт, scatter, tempHp): кости провала/вспышки — ссылки. */
  utility?: UtilitySpec;
  /** Блок `movement` спека: телепорт после атаки (Steel Wind Strike). */
  movement?: MovementSpec;
  /** Типы существ, на которых не действует (Command: нежить). */
  excludeCreatureTypes?: string[];
  effects?: EffectSpec[];
  zone?: ZoneSpec;
  weaponAttack?: WeaponAttackSpec;
  choices?: ChoiceSpec[];
}

/**
 * Копия спека (`CUSTOM:`, R16 шаг 4): база + патч по именованным путям.
 * Патч адресует массивы по `id` элементов (`effects.<id>`, `choices.<id>`,
 * `zone.actions.<id>`); присваивание массива заменяет его целиком; неизвестный
 * путь — ошибка (`resolveSpec`), а не молчаливый no-op.
 */
export interface AutomationSpecCopy {
  key: string;
  name: string;
  extends: string;
  patch?: Record<string, unknown>;
  remove?: string[];
}
