import type { ActionTargeting } from '../../domain/actions';
import type {
  AutomationResolution,
  AutomationUtility,
  LightSource,
} from '../../domain/automation';
import type { ConditionKey, EffectDuration, Modifier } from '../../domain/effects';
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
  | { add: [ValueExpr, string] }
  /** Конкатенация: `${кость}${тип}`; любое нерешённое слагаемое опускает всё выражение. */
  | { concat: ValueExpr[] }
  /** Литеральные ступени значения по кругу (Magic Weapon: +1/+2/+3 с 1/3/6 круга). */
  | { tiers: { above: number; value: number }[] };

/** Выбор, делаемый при касте (Dragon's Breath: тип урона; Elemental Weapon: тип и т.п.). */
export interface ChoiceSpec {
  id: string;
  param: 'damageType' | 'ability' | 'skill' | 'condition' | 'mode' | 'effect';
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
  targeting?: ActionTargeting;
  damage?: { dice: ValueExpr; types?: string[]; abilityMod?: boolean };
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

/** Эффект спека: длительность/цель + блоки (loadout/uses/actions/vision). */
export interface EffectSpec {
  id: string;
  name: string;
  duration: EffectDuration;
  concentration?: boolean;
  to?: 'self' | 'targets';
  /** Модификаторы, заданные литералом (id присваивает сервер). */
  modifiers?: Omit<Modifier, 'id'>[];
  conditions?: ConditionKey[];
  light?: LightSource;
  /** Подпись выбранного варианта (`variant`), если он виден в чипе. */
  variant?: ValueExpr;
  /** `uses`: заряды эффекта и событие траты. */
  charges?: { count: number; on?: 'rangedWeaponAttack' };
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
  attack?: { rangeType: 'melee' | 'ranged'; advantageInZone?: boolean };
  count?: number;
  targeting?: ActionTargeting;
  effects?: EffectSpec[];
  weaponAttack?: WeaponAttackSpec;
  choices?: ChoiceSpec[];
}
