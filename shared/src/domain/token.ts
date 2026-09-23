import type { ActionDef } from './actions';
import type { AbilityKey, Faction } from './core';
import type { DamageDefense } from './damage';
import type { ConditionInstance, ConditionKey, EffectInstance } from './effects';
import type { Sense } from './sense';

export interface TokenFields {
  name: string;
  description: string;
  imageUrl: string;
  cells: number;
  round: boolean;
  initiativeBonus: string;
  isPlayerToken: boolean;
  owner: string;
  attacks: AttackEntry[];
  ac: string;
  hpMax: string;
  /** DM-галка: показывать AC/HP этого токена игрокам. */
  showStats: boolean;
  /** DM-галка: токен может взаимодействовать с объектами (двери и т.п.). */
  canInteract: boolean;
  /** Сопротивления/иммунитеты/уязвимости к типам урона. */
  damageDefenses: DamageDefense[];
  /** Статблок монстра: у токена и в библиотеке (раздаётся при выставлении). */
  statblock?: TokenStatblock;
  /** Метка призыва: с каким кастером связан срок жизни токена. */
  summon?: TokenSummon;
  /** Форма Wild Shape/Polymorph: подмена полей токена и свой пул HP. */
  shape?: TokenShape;
}

/** Призыв, созданный заклинанием: связь с кастером для снятия/концентрации. */
export interface TokenSummon {
  /** Токен-кастер, создавший призыв. */
  casterTokenId: string;
  /** Ключ заклинания (для сообщений и изгнания). */
  spellKey?: string;
  /** Особая форма Pact of the Chain: фамильяр может атаковать. */
  pact?: boolean;
}

/** Форма Wild Shape/Polymorph: подмена статов резолвером и свой пул HP. */
export interface TokenShape {
  /** Ключ формы в каталоге бестиария. */
  key: string;
  /** Имя зверя (для чипа формы и сообщений). */
  name: string;
  kind: 'wildShape' | 'polymorph';
  /** Остаток пула формы: урон идёт сюда, пул не смешивается с temp HP токена. */
  hp: number;
  maxHp: number;
  /** AC формы, зафиксированный при принятии (круг луны: 13+WIS). */
  ac?: number;
  /** Клетки «своей» формы до трансформации (для возврата). */
  ownCells?: number;
  /** Источник (Polymorph): токен-кастер, по чьей концентрации держится форма. */
  sourceTokenId?: string;
  /** Заклинание-источник (Polymorph). */
  spellKey?: string;
}

export interface LibraryItem extends TokenFields {
  id: string;
}

export interface Token extends TokenFields {
  id: string;
  libraryItemId: string;
  /** Токен персонажа (есть контролёр с листом): статы read-only, идут из листа/ресурсов. */
  character?: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
  scale: number;
  rotation: number;
  z: number;
  visible: boolean;
  ownerId: string;
  lockedBy: string | null;
  hpCurrent: number;
  /** Временные хиты. */
  hpTemp: number;
  /** Отношение к игрокам (для таргетинга союзник/враг). */
  faction: Faction;
  /** Скорость в футах; у персонажей зеркалится из листа. */
  speed: number;
  /** Восприятие (тёмное/слепое/дьявольское зрение); у персонажей зеркалится из листа. */
  senses: Sense[];
  conditions: ConditionInstance[];
  effects: EffectInstance[];
}

/** Данные монстра, которые DM вводит вручную (позже — бестиарий). */
export interface TokenStatblock {
  abilities: Record<AbilityKey, number>;
  /** Тип существа (бестиарий/редактор): aberration, fiend, undead… */
  creatureType?: string;
  /** Явные бонусы спасбросков; пусто — считаются из характеристик. */
  saves?: Partial<Record<AbilityKey, number>>;
  /** Иммунитеты к состояниям (бестиарий: конструкты и т.п.). */
  conditionImmunities?: ConditionKey[];
  spellcasting?: {
    ability: AbilityKey;
    dc?: number;
    attack?: number;
    /** Ячейки монстра: уровень 1–9, максимум и остаток; пусто — без учёта. */
    slots?: { level: number; max: number; current: number }[];
    /** Выбранные заклинания статблока (ключи); список ограничивает каст. */
    spells?: string[];
  };
  /** Бонус к попаданию атак монстра по умолчанию; пусто — +3. */
  attackBonus?: string;
  /** СЛ спасбросков монстра по умолчанию; пусто — 10. */
  saveDc?: number;
  /** Число атак за действие (мультиатака), по умолчанию 1. */
  multiattack?: number;
  /** CR монстра строкой каталога (`1/4`, `5`) — для лимита формы Polymorph. */
  cr?: string;
  legendary?: { max: number; actions: ActionDef[] };
  /** Особые действия/способности монстра. */
  actions?: ActionDef[];
}

export type AttackRangeType = 'melee' | 'ranged' | 'none';

/** Категория размера токена: 1×1 — normal (T/S/M), 2×2 — large, 3×3/4×4 — huge. */
export type CreatureSize = 'normal' | 'large' | 'huge';

export function creatureSizeOf(cells: number): CreatureSize {
  if (cells <= 1) return 'normal';
  return cells === 2 ? 'large' : 'huge';
}

/** Порядок размеров для сравнений «не больше чем». */
export function sizeRank(size: CreatureSize): number {
  return size === 'normal' ? 0 : size === 'large' ? 1 : 2;
}

/** Существо не крупнее указанной категории (Repelling Blast — large и меньше). */
export function sizeAtMost(cells: number, max: CreatureSize): boolean {
  return sizeRank(creatureSizeOf(cells)) <= sizeRank(max);
}

export interface AttackEntry {
  name: string;
  hit: string;
  damage: string;
  rangeType: AttackRangeType;
  /** Ближняя: досягаемость, футы. Дальняя: обычная дистанция, футы. */
  rangeNormal: number;
  /** Дальняя: максимальная (дальняя) дистанция, футы; 0 — без ограничения. */
  rangeLong: number;
  /** Тип урона (ключ: bludgeoning/piercing/fire/…). */
  damageType?: string;
  /** Особый вид атаки: `unarmed` — переопределяет расчётный безоружный удар. */
  kind?: 'unarmed';
  /** Ключ оружия из справочника: свойства и мастерство считаются по нему. */
  weaponKey?: string;
  /** Хват «Универсального» оружия: `2h` — двуручный (большая кость урона). */
  grip?: '1h' | '2h';
}
