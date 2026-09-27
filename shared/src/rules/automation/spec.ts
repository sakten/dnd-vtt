import type { ActionTargeting, AreaSpec } from '../../domain/actions';
import type {
  AutomationResolution,
  AutomationSave,
  AutomationUtility,
  LightSource,
  ZoneDef,
} from '../../domain/automation';
import type { ConditionKey, EffectDuration, Modifier, ModifierFilter, Restrictions } from '../../domain/effects';
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
        | 'spellDamage'
        | 'upcastAttack'
        | 'type0'
        | 'spellMod'
        | 'castLevel'
        | 'characterLevel'
        | 'choice';
      /** Роль части (`part`): main/repeat/success/trigger/choice. */
      part?: DamagePartRole;
      /** id выбора из `choices` (без id — единственный выбор спека). */
      choice?: string;
      fallback?: ValueExpr;
    }
  /** Сложение костей одного вида: `1d8` + `1d8` → `2d8` (нет базы — берётся добавка). */
  | { add: [ValueExpr, ValueExpr] }
  /** Конкатенация: `${кость}${тип}`; любое нерешённое слагаемое опускает всё выражение. */
  | { concat: ValueExpr[] }
  /** `'1'`, если значение входит в список — гейт для `{ if, then }` (Command: halt/grovel). */
  | { includes: { of: ValueExpr; values: string[] } }
  /** Литеральные ступени значения по кругу (Magic Weapon: +1/+2/+3 с 1/3/6 круга). */
  | { tiers: { above: number; value: number }[] }
  /** `base + per × (круг − above)`; `above:'spell'` — базовый круг заклинания (Cordon). */
  | { perLevel: { base: number; per: number; above: number | 'spell' } }
  /** `max(min, base + round(spellMod))` (Healing Spirit: заряды 1 + мод, мин 2). */
  | { spellMod: { base: number; min?: number } }
  /** Кость с апкаст-скейлом (Healing Spirit: 1к6 + 1к6 за круг). */
  | { scale: { dice: ValueExpr; by: 'upcast' } }
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
  /** Суффикс ключа `def`: `${spec.key}:${subKey}` (Shadow Blade: return). */
  subKey?: string;
  primary: AutomationResolution;
  attack?: { rangeType: 'melee' | 'ranged'; advantageInZone?: boolean };
  /** Область действия: литерал или `spell.areaSpec` с fallback (Dragon's Breath). */
  area?: AreaSpec | { from: 'spell'; fallback: AreaSpec };
  /** Прицеливание: литерал или область из `area` (range = max(5, size)). */
  targeting?: ActionTargeting | { kind: 'area'; fromArea: true };
  /** Действие зоны (Dragon's Breath): спас и урон (кость/типы — ссылки). */
  save?: AutomationSave;
  damage?: { dice: ValueExpr; types?: ValueExpr[]; abilityMod?: boolean };
  utility?: AutomationUtility;
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
  damage?: { dice: ValueExpr; types?: string[]; abilityMod?: boolean };
  heal?: { dice: ValueExpr };
  successDamage?: { dice: ValueExpr; types?: string[] };
  effects?: EffectSpec[];
  endConditions?: ConditionKey[];
  healTo?: number;
  containment?: 'anyCell' | 'fullyWithin';
}

/** Блок `zone` (R16): pass-through полей `ZoneDef` + `ValueExpr` в зарядах и триггерах. */
export interface ZoneSpec extends Omit<Partial<ZoneDef>, 'charges' | 'triggers' | 'onCreate' | 'aura' | 'wall'> {
  charges?: ValueExpr;
  onCreate?: PayloadSpec;
  aura?: PayloadSpec;
  triggers?: {
    enter?: PayloadSpec;
    exit?: PayloadSpec;
    startOfTurn?: PayloadSpec;
    endOfTurn?: PayloadSpec;
  };
}

/** Элемент списка под условием: `if` непусто/истинно — `then` попадает в результат. */
export type Gated<T> = T | { if: ValueExpr; then: T };

/** Модификатор спека: `value`/`filter.*` — `ValueExpr` (выбор при касте). */
export interface ModifierSpec extends Omit<Modifier, 'id' | 'value' | 'filter'> {
  value?: ValueExpr;
  filter?: Omit<ModifierFilter, 'damageType' | 'ability' | 'skill'> & {
    damageType?: ValueExpr;
    ability?: ValueExpr;
    skill?: ValueExpr;
  };
}

/** Эффект спека: длительность/цель + блоки (loadout/uses/actions/vision). */
export interface EffectSpec {
  id: string;
  name: string;
  duration: EffectDuration;
  concentration?: boolean;
  to?: 'self' | 'targets';
  /** Модификаторы (id присваивает сервер); значения/фильтры — ссылки; гейт по выбору. */
  modifiers?: Gated<ModifierSpec>[];
  conditions?: Gated<ValueExpr>[];
  light?: LightSource;
  /** Подпись выбранного варианта (`variant`), если он виден в чипе. */
  variant?: ValueExpr;
  /** Максимум целей эффекта (Bless — 3, Elemental Bane — 1). */
  targets?: ValueExpr;
  /** Блок `uses`: заряды/счётчики эффекта. */
  uses?: UsesSpec;
  /** Resistance: уменьшение получаемого урона типов на кость. */
  damageReduce?: { dice: ValueExpr; types: ValueExpr[] };
  /** Elemental Bane: потеря сопротивления и доп. урон первого попадания за ход. */
  elementalBane?: { damageType: ValueExpr; dice: ValueExpr };
  /** Spirit Shroud/CME: доп. урон атак источника по носителю (аура-метка). */
  takesExtraDamage?: { dice: ValueExpr; damageType: ValueExpr };
  /** Ограничения экономики (Zephyr Strike: перемещение не провоцирует OA). */
  restrictions?: Restrictions;
  /** Ответный урон (Armor of Agathys, Fire Shield); тип — ссылка. */
  retaliate?: { damageType: ValueExpr; dice?: string; amount?: number };
  /** Zephyr Strike: одноразовая атака — кости, тип и скорость (расход через `uses`). */
  zephyrStrike?: { dice: string; damageType: string; speedFeet: number };
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
  concentration?: boolean;
  maxRounds?: number | null;
  save?: AutomationSave;
  attack?: { rangeType: 'melee' | 'ranged'; advantageInZone?: boolean };
  count?: number;
  targeting?: ActionTargeting;
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
