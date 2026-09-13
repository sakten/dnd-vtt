import type { DiceRollResult } from './dice';

export type Role = 'dm' | 'player';

export interface GridSettings {
  size: number;
  color: string;
  opacity: number;
  visible: boolean;
  offsetX: number;
  offsetY: number;
  snap: boolean;
}

export interface FogState {
  size: number;
  offsetX: number;
  offsetY: number;
  hidden: string[];
}

export const DEFAULT_GRID: GridSettings = {
  size: 50,
  color: '#ffffff',
  opacity: 0.35,
  visible: true,
  offsetX: 0,
  offsetY: 0,
  snap: true,
};

export function defaultFog(grid: GridSettings): FogState {
  return { size: grid.size, offsetX: grid.offsetX, offsetY: grid.offsetY, hidden: [] };
}

export function clampCells(n: number): number {
  return Math.min(4, Math.max(1, Math.round(n || 1)));
}

/** Числовой стат из строки: пусто/мусор → 0, иначе целое >= 0. */
export function statNumber(value: string | number | null | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}

/** AC и Макс. ХП задаются только парой: оба заполнены или оба пусты. */
export function statsPaired(ac: string, hpMax: string): boolean {
  return statNumber(ac) > 0 === statNumber(hpMax) > 0;
}

export interface MapInfo {
  id: string;
  name: string;
  url: string;
  width: number;
  height: number;
  tokens: Token[];
  fog: FogState;
  combat: CombatState;
}

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
  /** Сопротивления/иммунитеты/уязвимости к типам урона. */
  damageDefenses: DamageDefense[];
}

export interface LibraryItem extends TokenFields {
  id: string;
}

export interface Token extends TokenFields {
  id: string;
  libraryItemId: string;
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
  conditions: ConditionInstance[];
  effects: EffectInstance[];
  /** Статблок монстра; в библиотеку не протекает. */
  statblock?: TokenStatblock;
}

export interface InitiativeEntry {
  id: string;
  tokenId: string | null;
  name: string;
  imageUrl: string;
  initiative: number;
  bonus: string;
  roll?: DiceRollResult;
}

export type Faction = 'ally' | 'enemy' | 'neutral';

/** Состояние хода одного участника боя. */
export interface TurnState {
  actionUsed: boolean;
  bonusActionUsed: boolean;
  reactionUsed: boolean;
  /** Израсходовано передвижения, футы. */
  movementUsed: number;
  /** Диагональных шагов за ход (для чередования стоимости диагоналей 5/10 фт). */
  diagonalsUsed: number;
  /** Доступно передвижения в этом ходу, футы. */
  movementMax: number;
  /** Доп. действия/бонусные от эффектов (например, Haste). */
  extraActions: number;
  extraBonusActions: number;
  /** Остаток атак в текущем действии «Атака» (Extra Attack/мультиатака). */
  attacksRemaining: number;
  legendaryRemaining: number;
  legendaryMax: number;
  /** id активного эффекта концентрации. */
  concentrationId: string | null;
}

export function emptyTurnState(movementMax = DEFAULT_SPEED): TurnState {
  return {
    actionUsed: false,
    bonusActionUsed: false,
    reactionUsed: false,
    movementUsed: 0,
    diagonalsUsed: 0,
    movementMax,
    extraActions: 0,
    extraBonusActions: 0,
    attacksRemaining: 0,
    legendaryRemaining: 0,
    legendaryMax: 0,
    concentrationId: null,
  };
}

export interface CombatState {
  active: boolean;
  entries: InitiativeEntry[];
  /** Номер раунда, с 1; 0 — бой не начат. */
  round: number;
  /** Индекс активной записи в entries; -1 — ход не назначен. */
  currentIndex: number;
  /** Состояние хода по id записи инициативы. */
  turns: Record<string, TurnState>;
}

export function emptyCombatState(): CombatState {
  return { active: false, entries: [], round: 0, currentIndex: -1, turns: {} };
}

export type ConditionKey =
  | 'blinded'
  | 'charmed'
  | 'deafened'
  | 'exhaustion'
  | 'frightened'
  | 'grappled'
  | 'incapacitated'
  | 'invisible'
  | 'paralyzed'
  | 'petrified'
  | 'poisoned'
  | 'prone'
  | 'restrained'
  | 'stunned'
  | 'unconscious'
  | 'dead'
  | 'custom';

export interface ConditionInstance {
  key: ConditionKey;
  name: string;
  /** Осталось раундов; null — до снятия/бессрочно. */
  rounds?: number | null;
  /** Уровень истощения (для key='exhaustion'), 1..6. */
  level?: number;
  /** Повторный спасбросок для снятия. */
  save?: { ability: AbilityKey; dc: number; timing: 'start' | 'end' };
  /** Кто наложил состояние. */
  sourceId?: string;
  /** Ключ заклинания-источника (для иконки). */
  sourceKey?: string;
}

export type ModifierTarget =
  | 'attack'
  | 'damage'
  | 'ac'
  | 'save'
  | 'check'
  | 'speed'
  | 'initiative'
  | 'maxHp'
  | 'spellDc'
  | 'spellAttack';

export type ModifierMode =
  | 'add'
  | 'multiply'
  | 'set'
  | 'advantage'
  | 'disadvantage'
  | 'resistance'
  | 'immunity'
  | 'vulnerability';

export interface ModifierFilter {
  attackType?: 'melee' | 'ranged';
  ability?: AbilityKey;
  skill?: string;
  damageType?: string;
  rangeType?: AttackRangeType;
}

export interface Modifier {
  id: string;
  target: ModifierTarget;
  mode: ModifierMode;
  /** Число либо кость в виде строки (например '1d4'). */
  value: number | string;
  filter?: ModifierFilter;
}

export type EffectDuration =
  | { type: 'rounds'; rounds: number }
  | { type: 'untilSave'; ability: AbilityKey; dc: number; timing: 'start' | 'end' }
  | { type: 'endOfTurn'; of: 'source' | 'target' }
  | { type: 'concentration' }
  | { type: 'permanent' };

export interface EffectInstance {
  id: string;
  name: string;
  /** Ключ источника (заклинание/способность). */
  sourceKey?: string;
  /** id существа-источника. */
  sourceId?: string;
  concentration?: boolean;
  duration: EffectDuration;
  modifiers: Modifier[];
  /** Ключи накладываемых состояний. */
  conditions?: ConditionKey[];
}

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

/** Данные монстра, которые DM вводит вручную (позже — бестиарий). */
export interface TokenStatblock {
  abilities: Record<AbilityKey, number>;
  /** Явные бонусы спасбросков; пусто — считаются из характеристик. */
  saves?: Partial<Record<AbilityKey, number>>;
  spellcasting?: { ability: AbilityKey; dc?: number; attack?: number };
  /** Число атак за действие (мультиатака), по умолчанию 1. */
  multiattack?: number;
  legendary?: { max: number; actions: ActionDef[] };
  /** Особые действия/способности монстра. */
  actions?: ActionDef[];
}

export interface Player {
  id: string;
  name: string;
  role: Role;
  isConnected: boolean;
  hpCurrent?: number | null;
  hpMax?: number | null;
  classKey?: string | null;
}

export type AbilityKey = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';

export type SkillLevel = 0 | 1 | 2;

export type AttackRangeType = 'melee' | 'ranged' | 'none';

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
}

/** Список типов урона; первые три — физические (в таком порядке в выпадающих списках). */
export const DAMAGE_TYPES: { key: string; name: string }[] = [
  { key: 'slashing', name: 'Режущий' },
  { key: 'piercing', name: 'Колющий' },
  { key: 'bludgeoning', name: 'Дробящий' },
  { key: 'acid', name: 'Кислота' },
  { key: 'cold', name: 'Холод' },
  { key: 'fire', name: 'Огонь' },
  { key: 'force', name: 'Силовой' },
  { key: 'lightning', name: 'Молния' },
  { key: 'necrotic', name: 'Некротический' },
  { key: 'poison', name: 'Яд' },
  { key: 'psychic', name: 'Психический' },
  { key: 'radiant', name: 'Излучение' },
  { key: 'thunder', name: 'Гром' },
];

export function damageTypeName(key: string | undefined): string | undefined {
  if (!key) return undefined;
  return DAMAGE_TYPES.find((d) => d.key === key)?.name ?? key;
}

export type DamageDefenseType = 'resistance' | 'immunity' | 'vulnerability';

/** Защита юнита: сопротивление/иммунитет/уязвимость к типу урона. */
export interface DamageDefense {
  id: string;
  type: DamageDefenseType;
  damageType: string;
}

export const MAX_DEFENSES = 20;

export const DEFENSE_TYPE_NAMES: Record<DamageDefenseType, string> = {
  resistance: 'Сопротивление',
  immunity: 'Иммунитет',
  vulnerability: 'Уязвимость',
};

export interface DamageDefenseResult {
  amount: number;
  note?: DamageDefenseType;
}

/**
 * Применяет защиты цели к урону: иммунитет → 0; сопротивление/уязвимость
 * взаимно гасятся, иначе половина/двойной. Без типа урона — без изменений.
 */
export function applyDamageDefenses(
  amount: number,
  damageType: string | undefined,
  defenses: DamageDefense[] | undefined
): DamageDefenseResult {
  if (!damageType || amount <= 0 || !defenses?.length) return { amount };
  const matches = defenses.filter((d) => d.damageType === damageType);
  if (!matches.length) return { amount };
  if (matches.some((d) => d.type === 'immunity')) return { amount: 0, note: 'immunity' };
  const resistant = matches.some((d) => d.type === 'resistance');
  const vulnerable = matches.some((d) => d.type === 'vulnerability');
  if (resistant && vulnerable) return { amount };
  if (resistant) return { amount: Math.floor(amount / 2), note: 'resistance' };
  if (vulnerable) return { amount: amount * 2, note: 'vulnerability' };
  return { amount };
}

export interface ClassLevel {
  className: string;
  level: number;
  subclass?: string;
}

export type RestType = 'short' | 'long' | 'never';

export interface ResourceItem {
  id: string;
  key?: string;
  name: string;
  current: number;
  max: number;
  reset: RestType;
  auto?: boolean;
}

export interface PlayerResources {
  hp: {
    current: number;
    max: number;
    temp: number;
    deathSuccesses: number;
    deathFailures: number;
  };
  hitDice: { die: number; current: number; max: number }[];
  spellSlots: { level: number; current: number; max: number }[];
  pact: { current: number; max: number; level: number };
  resources: ResourceItem[];
  notes: string;
}

export const MAX_CLASSES = 2;
/** Верхняя граница числа атак/оружия (список динамический, не фиксированный). */
export const MAX_ATTACKS = 10;
/** Верхняя граница числа выбранных заклинаний в листе. */
export const MAX_SHEET_SPELLS = 200;
export const MAX_CONDITIONS = 20;
export const MAX_EFFECTS = 20;
export const MAX_MODIFIERS = 20;
/** Базовая скорость существа, футы. */
export const DEFAULT_SPEED = 30;

export const DEFAULT_ABILITIES: Record<AbilityKey, number> = {
  str: 10,
  dex: 10,
  con: 10,
  int: 10,
  wis: 10,
  cha: 10,
};

export interface CharacterSheet {
  name: string;
  abilities: Record<AbilityKey, number>;
  proficiencyBonus: string;
  saves: Partial<Record<AbilityKey, boolean>>;
  skills: Partial<Record<string, SkillLevel>>;
  attacks: AttackEntry[];
  classes: ClassLevel[];
  /** Выбранные заклинания: ключ `источник:имя` и класс, из чьего списка взято. */
  spells: SheetSpell[];
  hpMax: string;
  ac: string;
  /** Базовая скорость, футы. */
  speed: number;
  /** Сопротивления/иммунитеты/уязвимости к типам урона. */
  damageDefenses: DamageDefense[];
}

export interface SheetSpell {
  key: string;
  className: string;
}

export function emptyAttack(): AttackEntry {
  return { name: '', hit: '', damage: '', rangeType: 'melee', rangeNormal: 5, rangeLong: 0 };
}

export function emptyAttacks(): AttackEntry[] {
  return [emptyAttack()];
}

function coerceAttack(raw: Partial<AttackEntry> | null | undefined): AttackEntry {
  const rangeNormal = Number(raw?.rangeNormal);
  const rangeLong = Number(raw?.rangeLong);
  return {
    name: typeof raw?.name === 'string' ? raw.name : '',
    hit: typeof raw?.hit === 'string' ? raw.hit : '',
    damage: typeof raw?.damage === 'string' ? raw.damage : '',
    rangeType: raw?.rangeType === 'ranged' || raw?.rangeType === 'none' ? raw.rangeType : 'melee',
    rangeNormal: Number.isFinite(rangeNormal) ? Math.max(0, Math.round(rangeNormal)) : 5,
    rangeLong: Number.isFinite(rangeLong) ? Math.max(0, Math.round(rangeLong)) : 0,
    damageType: typeof raw?.damageType === 'string' && raw.damageType ? raw.damageType.slice(0, 20) : undefined,
  };
}

export function attackIsEmpty(a: AttackEntry): boolean {
  return !a.name.trim() && !a.hit.trim() && !a.damage.trim();
}

export function attackIsActive(a: AttackEntry): boolean {
  return !!a.hit.trim() || !!a.damage.trim();
}

/**
 * Приводит список атак к валидному виду: динамическая длина (до `MAX_ATTACKS`),
 * обрезка пустых строк в конце, минимум одна строка. Legacy-одиночная атака
 * подставляется, если в списке нет ничего содержательного.
 */
export function normalizeAttacks(
  attacks: unknown,
  legacy?: Partial<AttackEntry> | null
): AttackEntry[] {
  const list = Array.isArray(attacks) ? attacks : [];
  let result = list.slice(0, MAX_ATTACKS).map((a) => coerceAttack(a as Partial<AttackEntry> | undefined));
  if (result.every(attackIsEmpty) && legacy) {
    result = [coerceAttack(legacy)];
  } else {
    while (result.length > 1 && attackIsEmpty(result[result.length - 1])) result.pop();
  }
  if (result.length === 0) result = [emptyAttack()];
  return result;
}

export function normalizeClasses(raw: unknown): ClassLevel[] {
  if (!Array.isArray(raw)) return [];
  const out: ClassLevel[] = [];
  for (const item of raw.slice(0, MAX_CLASSES)) {
    if (!item || typeof item !== 'object') continue;
    const c = item as Partial<ClassLevel>;
    if (typeof c.className !== 'string' || !c.className) continue;
    const n = Number(c.level);
    out.push({
      className: c.className,
      level: Number.isFinite(n) ? Math.min(20, Math.max(1, Math.round(n))) : 1,
      subclass: typeof c.subclass === 'string' && c.subclass ? c.subclass : undefined,
    });
  }
  return out;
}

let fallbackIdCounter = 0;
/** id с fallback для небезопасного контекста (http-LAN), где нет crypto.randomUUID. */
function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    fallbackIdCounter += 1;
    return `id-${Date.now().toString(36)}-${fallbackIdCounter.toString(36)}`;
  }
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function isAbilityKey(value: unknown): value is AbilityKey {
  return typeof value === 'string' && value in DEFAULT_ABILITIES;
}

const SPELL_KEY_RE = /^[A-Za-z][A-Za-z0-9]{1,9}:/;

/** Чистит список выбранных заклинаний: формат ключа, класс, дедуп, лимит. */
export function normalizeSheetSpells(raw: unknown): SheetSpell[] {
  if (!Array.isArray(raw)) return [];
  const out: SheetSpell[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (out.length >= MAX_SHEET_SPELLS) break;
    if (!item || typeof item !== 'object') continue;
    const s = item as Partial<SheetSpell>;
    if (typeof s.key !== 'string' || !SPELL_KEY_RE.test(s.key)) continue;
    if (typeof s.className !== 'string' || !s.className) continue;
    const dedupe = `${s.className}:${s.key}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    out.push({ key: s.key.slice(0, 80), className: s.className.slice(0, 30) });
  }
  return out;
}

export function normalizeSheet(
  raw: Partial<CharacterSheet> & { attack?: Partial<AttackEntry> | null }
): CharacterSheet {
  const abilities = { ...DEFAULT_ABILITIES };
  if (raw.abilities && typeof raw.abilities === 'object') {
    const source = raw.abilities as Record<string, unknown>;
    for (const key of Object.keys(DEFAULT_ABILITIES) as AbilityKey[]) {
      const n = Number(source[key]);
      if (Number.isFinite(n)) abilities[key] = Math.min(30, Math.max(0, Math.round(n)));
    }
  }
  return {
    name: typeof raw.name === 'string' ? raw.name.slice(0, 40) : '',
    abilities,
    proficiencyBonus: typeof raw.proficiencyBonus === 'string' ? raw.proficiencyBonus.slice(0, 10) : '2',
    saves: raw.saves ?? {},
    skills: raw.skills ?? {},
    attacks: normalizeAttacks(raw.attacks, raw.attack),
    classes: normalizeClasses(raw.classes),
    spells: normalizeSheetSpells((raw as { spells?: unknown }).spells),
    hpMax: typeof raw.hpMax === 'string' ? raw.hpMax.slice(0, 10) : '',
    ac: typeof raw.ac === 'string' ? raw.ac.slice(0, 10) : '',
    speed: clampInt((raw as { speed?: unknown }).speed, 0, 1000, DEFAULT_SPEED),
    damageDefenses: normalizeDamageDefenses((raw as { damageDefenses?: unknown }).damageDefenses),
  };
}

/** Чистит список защит (тип + тип урона), дедуп по паре, лимит. */
export function normalizeDamageDefenses(raw: unknown): DamageDefense[] {
  if (!Array.isArray(raw)) return [];
  const out: DamageDefense[] = [];
  const seen = new Set<string>();
  for (const item of raw.slice(0, MAX_DEFENSES)) {
    if (!item || typeof item !== 'object') continue;
    const d = item as Partial<DamageDefense>;
    if (d.type !== 'resistance' && d.type !== 'immunity' && d.type !== 'vulnerability') continue;
    if (typeof d.damageType !== 'string' || !d.damageType) continue;
    const damageType = d.damageType.slice(0, 20);
    const dedupe = `${d.type}:${damageType}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    out.push({ id: typeof d.id === 'string' && d.id ? d.id : newId(), type: d.type, damageType });
  }
  return out;
}

export function activeAttacks(sheet: CharacterSheet): AttackEntry[] {
  return sheet.attacks.filter(attackIsActive);
}

const MODIFIER_TARGETS: ModifierTarget[] = [
  'attack',
  'damage',
  'ac',
  'save',
  'check',
  'speed',
  'initiative',
  'maxHp',
  'spellDc',
  'spellAttack',
];
const MODIFIER_MODES: ModifierMode[] = [
  'add',
  'multiply',
  'set',
  'advantage',
  'disadvantage',
  'resistance',
  'immunity',
  'vulnerability',
];
const ACTION_COSTS: ActionCost[] = ['action', 'bonus', 'reaction', 'free', 'movement', 'legendary', 'lair', 'special'];
const ACTION_SOURCES: ActionDef['source'][] = ['basic', 'class', 'subclass', 'spell', 'monster'];

function normalizeModifierFilter(raw: unknown): ModifierFilter | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const f = raw as Record<string, unknown>;
  const out: ModifierFilter = {};
  if (f.attackType === 'melee' || f.attackType === 'ranged') out.attackType = f.attackType;
  if (isAbilityKey(f.ability)) out.ability = f.ability;
  if (typeof f.skill === 'string') out.skill = f.skill.slice(0, 40);
  if (typeof f.damageType === 'string') out.damageType = f.damageType.slice(0, 40);
  if (f.rangeType === 'melee' || f.rangeType === 'ranged' || f.rangeType === 'none') out.rangeType = f.rangeType;
  return Object.keys(out).length ? out : undefined;
}

function normalizeModifier(raw: unknown): Modifier | null {
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as Partial<Modifier>;
  if (!MODIFIER_TARGETS.includes(m.target as ModifierTarget)) return null;
  if (!MODIFIER_MODES.includes(m.mode as ModifierMode)) return null;
  const value = typeof m.value === 'string' ? m.value.slice(0, 40) : clampInt(m.value, -9999, 9999, 0);
  return {
    id: typeof m.id === 'string' && m.id ? m.id : newId(),
    target: m.target as ModifierTarget,
    mode: m.mode as ModifierMode,
    value,
    filter: normalizeModifierFilter(m.filter),
  };
}

function normalizeEffectDuration(raw: unknown): EffectDuration | null {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Record<string, unknown>;
  if (d.type === 'rounds') return { type: 'rounds', rounds: clampInt(d.rounds, 0, 9999, 0) };
  if (d.type === 'untilSave') {
    if (!isAbilityKey(d.ability)) return null;
    return { type: 'untilSave', ability: d.ability, dc: clampInt(d.dc, 0, 40, 0), timing: d.timing === 'start' ? 'start' : 'end' };
  }
  if (d.type === 'endOfTurn') return { type: 'endOfTurn', of: d.of === 'target' ? 'target' : 'source' };
  if (d.type === 'concentration') return { type: 'concentration' };
  if (d.type === 'permanent') return { type: 'permanent' };
  return null;
}

export function normalizeConditions(raw: unknown): ConditionInstance[] {
  if (!Array.isArray(raw)) return [];
  const out: ConditionInstance[] = [];
  for (const item of raw.slice(0, MAX_CONDITIONS)) {
    if (!item || typeof item !== 'object') continue;
    const c = item as Partial<ConditionInstance>;
    const key = typeof c.key === 'string' && c.key ? c.key : 'custom';
    const condition: ConditionInstance = {
      key: key as ConditionKey,
      name: typeof c.name === 'string' && c.name.trim() ? c.name.trim().slice(0, 40) : key,
      rounds: c.rounds === undefined || c.rounds === null ? null : clampInt(c.rounds, 0, 9999, 0),
    };
    if (c.key === 'exhaustion') condition.level = clampInt(c.level, 1, 6, 1);
    if (typeof c.sourceId === 'string' && c.sourceId) condition.sourceId = c.sourceId;
    if (typeof c.sourceKey === 'string' && c.sourceKey) condition.sourceKey = c.sourceKey.slice(0, 80);
    if (c.save && typeof c.save === 'object' && isAbilityKey(c.save.ability)) {
      condition.save = {
        ability: c.save.ability,
        dc: clampInt(c.save.dc, 0, 40, 0),
        timing: c.save.timing === 'start' ? 'start' : 'end',
      };
    }
    out.push(condition);
  }
  return out;
}

export function normalizeEffects(raw: unknown): EffectInstance[] {
  if (!Array.isArray(raw)) return [];
  const out: EffectInstance[] = [];
  for (const item of raw.slice(0, MAX_EFFECTS)) {
    if (!item || typeof item !== 'object') continue;
    const e = item as Partial<EffectInstance>;
    const duration = normalizeEffectDuration(e.duration);
    if (!duration) continue;
    const modifiers = (Array.isArray(e.modifiers) ? e.modifiers : [])
      .map(normalizeModifier)
      .filter((m): m is Modifier => m !== null)
      .slice(0, MAX_MODIFIERS);
    const effect: EffectInstance = {
      id: typeof e.id === 'string' && e.id ? e.id : newId(),
      name: typeof e.name === 'string' && e.name.trim() ? e.name.trim().slice(0, 60) : 'Эффект',
      duration,
      modifiers,
    };
    if (typeof e.sourceKey === 'string' && e.sourceKey) effect.sourceKey = e.sourceKey;
    if (typeof e.sourceId === 'string' && e.sourceId) effect.sourceId = e.sourceId;
    if (e.concentration === true) effect.concentration = true;
    if (Array.isArray(e.conditions)) {
      const conditions = e.conditions.filter((c): c is ConditionKey => typeof c === 'string');
      if (conditions.length) effect.conditions = conditions.slice(0, MAX_CONDITIONS);
    }
    out.push(effect);
  }
  return out;
}

function normalizeTargeting(raw: unknown): ActionTargeting | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const t = raw as Partial<ActionTargeting>;
  if (t.kind !== 'self' && t.kind !== 'creature' && t.kind !== 'point' && t.kind !== 'area') return undefined;
  const out: ActionTargeting = { kind: t.kind };
  if (typeof t.range === 'number') out.range = clampInt(t.range, 0, 10000, 0);
  if (typeof t.targets === 'number') out.targets = clampInt(t.targets, 1, 50, 1);
  if (t.area && typeof t.area === 'object') {
    const shape = t.area.shape;
    if (shape === 'sphere' || shape === 'cone' || shape === 'cube' || shape === 'line' || shape === 'cylinder') {
      out.area = { shape, size: clampInt(t.area.size, 0, 10000, 0) };
      if (typeof t.area.width === 'number') out.area.width = clampInt(t.area.width, 0, 1000, 0);
    }
  }
  return out;
}

export function normalizeActions(raw: unknown): ActionDef[] {
  if (!Array.isArray(raw)) return [];
  const out: ActionDef[] = [];
  for (const item of raw.slice(0, 50)) {
    if (!item || typeof item !== 'object') continue;
    const a = item as Partial<ActionDef> & { cost?: unknown };
    if (typeof a.name !== 'string' || !a.name.trim()) continue;
    const rawCosts = Array.isArray(a.costs) ? a.costs : a.cost !== undefined ? [a.cost] : [];
    const costs = [...new Set(rawCosts.filter((c): c is ActionCost => ACTION_COSTS.includes(c as ActionCost)))];
    if (costs.length === 0) costs.push('action');
    const action: ActionDef = {
      id: typeof a.id === 'string' && a.id ? a.id : newId(),
      name: a.name.trim().slice(0, 60),
      source: ACTION_SOURCES.includes(a.source as ActionDef['source']) ? (a.source as ActionDef['source']) : 'monster',
      costs,
    };
    if (typeof a.levelReq === 'number') action.levelReq = clampInt(a.levelReq, 0, 30, 0);
    if (typeof a.resourceKey === 'string' && a.resourceKey) action.resourceKey = a.resourceKey;
    if (typeof a.resourceAmount === 'number') action.resourceAmount = clampInt(a.resourceAmount, 0, 99, 0);
    if (typeof a.description === 'string') action.description = a.description.slice(0, 400);
    const targeting = normalizeTargeting(a.targeting);
    if (targeting) action.targeting = targeting;
    out.push(action);
  }
  return out;
}

export function normalizeStatblock(raw: unknown): TokenStatblock | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const s = raw as Partial<TokenStatblock>;
  const abilities = { ...DEFAULT_ABILITIES };
  if (s.abilities && typeof s.abilities === 'object') {
    const source = s.abilities as Record<string, unknown>;
    for (const key of Object.keys(DEFAULT_ABILITIES) as AbilityKey[]) {
      const n = Number(source[key]);
      if (Number.isFinite(n)) abilities[key] = Math.min(30, Math.max(0, Math.round(n)));
    }
  }
  const saves: Partial<Record<AbilityKey, number>> = {};
  if (s.saves && typeof s.saves === 'object') {
    const source = s.saves as Record<string, unknown>;
    for (const key of Object.keys(DEFAULT_ABILITIES) as AbilityKey[]) {
      const n = Number(source[key]);
      if (Number.isFinite(n)) saves[key] = Math.round(n);
    }
  }
  const statblock: TokenStatblock = { abilities };
  if (Object.keys(saves).length) statblock.saves = saves;
  if (s.spellcasting && typeof s.spellcasting === 'object' && isAbilityKey(s.spellcasting.ability)) {
    const sc: NonNullable<TokenStatblock['spellcasting']> = { ability: s.spellcasting.ability };
    if (typeof s.spellcasting.dc === 'number') sc.dc = clampInt(s.spellcasting.dc, 0, 40, 0);
    if (typeof s.spellcasting.attack === 'number') sc.attack = clampInt(s.spellcasting.attack, 0, 40, 0);
    statblock.spellcasting = sc;
  }
  const actions = normalizeActions(s.actions);
  if (actions.length) statblock.actions = actions;
  if (typeof s.multiattack === 'number') statblock.multiattack = clampInt(s.multiattack, 1, 10, 1);
  if (s.legendary && typeof s.legendary === 'object') {
    const legendaryActions = normalizeActions(s.legendary.actions);
    const max = clampInt(s.legendary.max, 0, 9, 0);
    if (max > 0 || legendaryActions.length) statblock.legendary = { max, actions: legendaryActions };
  }
  return statblock;
}

export function normalizeTurnState(raw: unknown, movementMax = DEFAULT_SPEED): TurnState {
  const base = emptyTurnState(movementMax);
  if (!raw || typeof raw !== 'object') return base;
  const t = raw as Partial<TurnState>;
  return {
    actionUsed: t.actionUsed === true,
    bonusActionUsed: t.bonusActionUsed === true,
    reactionUsed: t.reactionUsed === true,
    movementUsed: clampInt(t.movementUsed, 0, 100000, 0),
    diagonalsUsed: clampInt(t.diagonalsUsed, 0, 100000, 0),
    movementMax: clampInt(t.movementMax, 0, 100000, movementMax),
    extraActions: clampInt(t.extraActions, 0, 99, 0),
    extraBonusActions: clampInt(t.extraBonusActions, 0, 99, 0),
    attacksRemaining: clampInt(t.attacksRemaining, 0, 99, 0),
    legendaryRemaining: clampInt(t.legendaryRemaining, 0, 99, 0),
    legendaryMax: clampInt(t.legendaryMax, 0, 99, 0),
    concentrationId: typeof t.concentrationId === 'string' && t.concentrationId ? t.concentrationId : null,
  };
}

export function normalizeCombatState(raw: unknown): CombatState {
  if (!raw || typeof raw !== 'object') return emptyCombatState();
  const c = raw as Partial<CombatState>;
  const entries = Array.isArray(c.entries) ? (c.entries as InitiativeEntry[]) : [];
  const turns: Record<string, TurnState> = {};
  if (c.turns && typeof c.turns === 'object') {
    for (const [id, turn] of Object.entries(c.turns)) turns[id] = normalizeTurnState(turn);
  }
  return {
    active: c.active === true,
    entries,
    round: clampInt(c.round, 0, 100000, 0),
    currentIndex: entries.length ? clampInt(c.currentIndex, -1, entries.length - 1, -1) : -1,
    turns,
  };
}

export const ABILITIES: { key: AbilityKey; name: string }[] = [
  { key: 'str', name: 'Сила' },
  { key: 'dex', name: 'Ловкость' },
  { key: 'con', name: 'Телосложение' },
  { key: 'int', name: 'Интеллект' },
  { key: 'wis', name: 'Мудрость' },
  { key: 'cha', name: 'Харизма' },
];

export const SKILLS: { key: string; name: string; ability: AbilityKey }[] = [
  { key: 'athletics', name: 'Атлетика', ability: 'str' },
  { key: 'acrobatics', name: 'Акробатика', ability: 'dex' },
  { key: 'sleightOfHand', name: 'Ловкость рук', ability: 'dex' },
  { key: 'stealth', name: 'Скрытность', ability: 'dex' },
  { key: 'arcana', name: 'Магия', ability: 'int' },
  { key: 'history', name: 'История', ability: 'int' },
  { key: 'investigation', name: 'Анализ', ability: 'int' },
  { key: 'nature', name: 'Природа', ability: 'int' },
  { key: 'religion', name: 'Религия', ability: 'int' },
  { key: 'animalHandling', name: 'Уход за животными', ability: 'wis' },
  { key: 'insight', name: 'Проницательность', ability: 'wis' },
  { key: 'medicine', name: 'Медицина', ability: 'wis' },
  { key: 'perception', name: 'Восприятие', ability: 'wis' },
  { key: 'survival', name: 'Выживание', ability: 'wis' },
  { key: 'deception', name: 'Обман', ability: 'cha' },
  { key: 'intimidation', name: 'Запугивание', ability: 'cha' },
  { key: 'performance', name: 'Выступление', ability: 'cha' },
  { key: 'persuasion', name: 'Убеждение', ability: 'cha' },
];

export function abilityMod(value: number): number {
  return Math.floor((value - 10) / 2);
}

export function snapToGrid(v: number, offset: number, size: number, cells: number): number {
  if (cells % 2 === 1) {
    return Math.round((v - offset - size / 2) / size) * size + offset + size / 2;
  }
  return Math.round((v - offset) / size) * size + offset;
}

export interface TextMessage {
  id: string;
  kind: 'text';
  author: string;
  text: string;
  ts: number;
}

export type RollKind = 'attack' | 'damage' | 'heal' | 'save' | 'check' | 'death' | 'plain';

export interface RollLabelParams {
  /** Название атаки/спасброска/проверки (для атак — с префиксом источника). */
  subject?: string;
  distanceFeet?: number;
  hit?: 'hit' | 'miss';
  disadvantage?: 'adjacent' | 'long';
  /** Спасбросок от смерти. */
  outcome?: 'critSuccess' | 'critFail' | 'success' | 'fail';
  successes?: number;
  failures?: number;
  /** Исход обычного спасброска. */
  saveOutcome?: 'success' | 'fail';
  /** Тип урона (ключ) для отображения. */
  damageType?: string;
  /** Учёт защиты цели (сопротивление/иммунитет/уязвимость). */
  damageNote?: DamageDefenseType;
  /** Штраф к броску (например, истощение), для отображения. */
  penalty?: number;
}

export interface RollMessage {
  id: string;
  kind: 'roll';
  author: string;
  roll: DiceRollResult;
  /** Готовый текст метки; legacy/fallback, генерируется из `rollKind`+`labelParams`. */
  label?: string;
  rollKind?: RollKind;
  labelParams?: RollLabelParams;
  crit?: boolean;
  ts: number;
}

export type ChatMessage = TextMessage | RollMessage;

export interface Scene {
  maps: MapInfo[];
  activeMapId: string | null;
  grid: GridSettings;
}

export interface RoomState {
  code: string;
  name: string;
  scene: Scene;
  library: LibraryItem[];
  players: Player[];
  chat: ChatMessage[];
  controllers: Record<string, string>;
}

export interface ServerToClientEvents {
  'room:joined': (payload: {
    room: RoomState;
    selfId: string;
    sheet: CharacterSheet | null;
    resources: PlayerResources | null;
  }) => void;
  'room:renamed': (payload: { name: string }) => void;
  'sheet:update': (payload: { sheet: CharacterSheet }) => void;
  'resources:update': (resources: PlayerResources) => void;
  'character:update': (payload: { playerId: string; libraryItemId: string | null }) => void;
  'maps:update': (payload: { maps: MapInfo[]; activeMapId: string | null }) => void;
  'map:bring': (payload: { activeMapId: string }) => void;
  'fog:update': (payload: { mapId: string; fog: FogState }) => void;
  'library:update': (library: LibraryItem[]) => void;
  'combat:update': (payload: { mapId: string; combat: CombatState }) => void;
  'grid:update': (grid: GridSettings) => void;
  'token:add': (payload: { mapId: string; token: Token }) => void;
  'token:update': (payload: { mapId: string; token: Token }) => void;
  'token:remove': (payload: { mapId: string; id: string }) => void;
  'chat:message': (message: ChatMessage) => void;
  'chat:error': (message: string) => void;
  'players:update': (players: Player[]) => void;
  'player:kicked': () => void;
  'room:deleted': () => void;
  'pong': () => void;
}

export interface ClientToServerEvents {
  'room:create': (
    payload: { name: string; clientId: string; adminToken?: string; roomName?: string },
    cb: (res: { ok: true } | { error: string }) => void
  ) => void;
  'room:join': (
    payload: { code: string; name: string; clientId: string },
    cb: (res: { ok: true } | { error: string }) => void
  ) => void;
  'map:add': (payload: { name: string; url: string; width: number; height: number }) => void;
  'map:remove': (id: string) => void;
  'map:rename': (payload: { id: string; name: string }) => void;
  'map:bring': (id: string) => void;
  'fog:update': (payload: { mapId: string; fog: FogState }) => void;
  'library:add': (payload: TokenFields) => void;
  'library:update': (payload: { id: string; patch: Partial<LibraryItem> }) => void;
  'library:remove': (id: string) => void;
  'combat:start': (payload: { mapId: string }) => void;
  'combat:end': (payload: { mapId: string }) => void;
  'combat:add': (payload: { mapId: string; tokenId: string }) => void;
  'combat:addMap': (payload: { mapId: string }) => void;
  'combat:remove': (payload: { mapId: string; id: string }) => void;
  'combat:update': (payload: {
    mapId: string;
    id: string;
    patch: { name?: string; initiative?: number; bonus?: string };
  }) => void;
  'combat:move': (payload: { mapId: string; id: string; toIndex: number }) => void;
  'combat:roll': (payload: { mapId: string; id?: string }) => void;
  'combat:clear': (payload: { mapId: string }) => void;
  'combat:endTurn': (payload: { mapId: string }) => void;
  'combat:setTurn': (payload: { mapId: string; id?: string; index?: number }) => void;
  'combat:setMovement': (payload: { mapId: string; tokenId: string; used: number; diagonals?: number }) => void;
  'grid:update': (grid: GridSettings) => void;
  'player:remove': (payload: { id: string }) => void;
  'token:add': (payload: { mapId: string; libraryItemId: string; x: number; y: number }) => void;
  'token:move': (payload: { mapId: string; id: string; x: number; y: number }) => void;
  'token:lock': (payload: { mapId: string; id: string; lock: boolean }) => void;
  'token:update': (payload: { mapId: string; id: string; patch: Partial<Token> }) => void;
  /** Быстрое изменение HP токена (только DM): delta>0 — лечение, <0 — урон. */
  'token:hp': (payload: { mapId: string; id: string; delta: number }) => void;
  'token:remove': (payload: { mapId: string; id: string }) => void;
  'chat:send': (text: string) => void;
  'dice:roll': (payload: {
    expression: string;
    label?: string;
    rollKind?: RollKind;
    subject?: string;
  }) => void;
  'dice:attack': (payload: {
    tokenId?: string;
    targetId?: string;
    attackIndex: number;
    advantage?: 'a' | 'd';
  }) => void;
  'action:use': (payload: {
    mapId: string;
    tokenId: string;
    actionId: string;
    targetIds?: string[];
    attackIndex?: number;
    advantage?: 'a' | 'd';
    slot?: ActionCost;
  }) => void;
  'spell:cast': (payload: {
    mapId: string;
    tokenId: string;
    spellKey: string;
    /** Круг ячейки (апкаст); для кантрипа не нужен. */
    slotLevel?: number;
    targetIds?: string[];
    advantage?: 'a' | 'd';
    /** Точка привязки области (мировые координаты) для spellHasArea. */
    origin?: { x: number; y: number };
    /** Направление конуса/линии (мировая точка). */
    direction?: { x: number; y: number };
  }) => void;
  'sheet:update': (sheet: CharacterSheet) => void;
  'resources:update': (resources: PlayerResources) => void;
  'player:setCharacter': (
    payload: { libraryItemId: string | null },
    cb: (res: { ok: true } | { error: string }) => void
  ) => void;
  'resources:hitDie': (payload: { die?: number }) => void;
  'resources:deathSave': (payload?: { expression?: string }) => void;
  'admin:list': (
    payload: { adminToken: string },
    cb: (res: { rooms: { code: string; name: string; players: number; maps: number }[] } | { error: string }) => void
  ) => void;
  'admin:create': (
    payload: { adminToken: string; name: string; clientId: string; roomName?: string },
    cb: (res: { code: string } | { error: string }) => void
  ) => void;
  'admin:join': (
    payload: { adminToken: string; code: string; clientId: string; name: string },
    cb: (res: { ok: true } | { error: string }) => void
  ) => void;
  'admin:delete': (
    payload: { adminToken: string; code: string },
    cb: (res: { ok: true } | { error: string }) => void
  ) => void;
  'admin:rename': (
    payload: { adminToken: string; code: string; name: string },
    cb: (res: { ok: true } | { error: string }) => void
  ) => void;
  'ping': () => void;
}
