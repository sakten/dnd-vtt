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
}

/** Триггер, на который можно потратить реакцию. */
export type ReactionTriggerKind = 'attackRoll' | 'attackHit' | 'attackMiss' | 'damage' | 'leaveReach' | 'spellCast';

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
