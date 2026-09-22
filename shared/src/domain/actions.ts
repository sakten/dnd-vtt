import type { AbilityKey } from './core';
import type { ConditionKey, EffectDuration } from './effects';

export type ActionCost =
  | 'action'
  | 'bonus'
  | 'reaction'
  | 'free'
  | 'movement'
  | 'legendary'
  | 'lair'
  | 'special';

export interface AreaSpec {
  shape: 'sphere' | 'cone' | 'cube' | 'line' | 'cylinder';
  /** Размер в футах. */
  size: number;
  /** Ширина линии, футы. */
  width?: number;
}

export interface ActionTargeting {
  kind: 'self' | 'creature' | 'point' | 'area';
  /** Дистанция, футы. */
  range?: number;
  /** Максимум целей. */
  targets?: number;
  area?: AreaSpec;
}
export interface MonsterAbilityAttack {
  rangeType: 'melee' | 'ranged';
  /** Бонус к попаданию; пусто — из статблока, затем +3. */
  bonus?: string;
  /** Урон; пусто — без урона. */
  damage?: string;
  /** Типы урона. */
  types?: string[];
}

export interface MonsterAbilityEffect {
  condition: ConditionKey;
  duration: EffectDuration;
}

/** Механика способности монстра: исполняется через AutomationDef. */
export interface MonsterAbilityDef {
  attack?: MonsterAbilityAttack;
  /** Спасбросок цели; пусто — без сейва. */
  save?: { ability: AbilityKey };
  /** СЛ сейва; пусто — из статблока, затем 10. */
  dc?: number;
  /** Урон: без сейва — сразу, с сейвом — при провале; при атаке — при попадании. */
  damage?: { dice: string; types?: string[] };
  effects?: MonsterAbilityEffect[];
}

/** Единый каталог действий (базовые/классовые/заклинания/монстровые). */
export interface ActionDef {
  id: string;
  name: string;
  source: 'basic' | 'class' | 'subclass' | 'spell' | 'monster';
  /** Допустимые слоты (по приоритету): действие, бонусное и т.д. */
  costs: ActionCost[];
  /** Минимальный уровень/CR для появления в панели. */
  levelReq?: number;
  /** Ключ ресурса в PlayerResources для списания. */
  resourceKey?: string;
  resourceAmount?: number;
  targeting?: ActionTargeting;
  description?: string;
  /** Стоимость в легендарных действиях (1–3); пусто — не легендарная. */
  legendaryCost?: number;
  /** Перезарядка в ходах монстра; пусто/0 — без. */
  recharge?: number;
  /** Заклинание-способность (ключ каталога): только с легендарной стоимостью, без ячейки. */
  spellKey?: string;
  /** Механика способности монстра. */
  ability?: MonsterAbilityDef;
  /** Ключ записи библиотеки, из которой добавлена способность. */
  libraryId?: string;
  /** id зоны-источника (действия, выданные зоной: перемещение). */
  zoneId?: string;
  /** Ключ иконки действия (`<ключ заклинания-источника>:<id действия>`); пусто — общий глиф. */
  iconKey?: string;
}

/** Триггер, на который можно потратить реакцию. */
export type ReactionTriggerKind = 'attackRoll' | 'attackHit' | 'attackMiss' | 'damage' | 'leaveReach' | 'spellCast' | 'saveFail';

/** Вариант реакции, предложенный сервером в окне. */
export interface ReactionOption {
  id: string;
  name: string;
  kind: 'spell' | 'feature' | 'opportunity';
  spellKey?: string;
  actionId?: string;
  resourceKey?: string;
  resourceAmount?: number;
}

/** Окно реакции: одному токену предлагается выбрать вариант или пропустить. */
export interface ReactionOffer {
  id: string;
  mapId: string;
  trigger: ReactionTriggerKind;
  tokenId: string;
  tokenName: string;
  /** Имя спровоцировавшего (атакующий/движущийся). */
  sourceName?: string;
  options: ReactionOption[];
  expiresAt: number;
}

/** Таргетинг действия — единственная точка чтения канона `action.targeting`. */
export function actionTargeting(action: Pick<ActionDef, 'targeting'>): ActionTargeting | undefined {
  return action.targeting;
}
