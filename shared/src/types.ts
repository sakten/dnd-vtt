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
}

export interface LibraryItem extends TokenFields {
  id: string;
}

export interface Token extends TokenFields {
  id: string;
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

export interface CombatState {
  active: boolean;
  entries: InitiativeEntry[];
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

export interface AttackEntry {
  name: string;
  hit: string;
  damage: string;
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
export const MAX_ATTACKS = 3;

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
  hpMax: string;
  ac: string;
}

export function emptyAttack(): AttackEntry {
  return { name: '', hit: '', damage: '' };
}

function coerceAttack(raw: Partial<AttackEntry> | null | undefined): AttackEntry {
  return {
    name: typeof raw?.name === 'string' ? raw.name : '',
    hit: typeof raw?.hit === 'string' ? raw.hit : '',
    damage: typeof raw?.damage === 'string' ? raw.damage : '',
  };
}

export function attackIsEmpty(a: AttackEntry): boolean {
  return !a.name.trim() && !a.hit.trim() && !a.damage.trim();
}

export function attackIsActive(a: AttackEntry): boolean {
  return !!a.hit.trim() || !!a.damage.trim();
}

export function normalizeAttacks(
  attacks: unknown,
  legacy?: Partial<AttackEntry> | null
): AttackEntry[] {
  const list = Array.isArray(attacks) ? attacks : [];
  const result: AttackEntry[] = [];
  for (let i = 0; i < MAX_ATTACKS; i++) {
    result.push(coerceAttack(list[i] as Partial<AttackEntry> | undefined));
  }
  if (result.every(attackIsEmpty) && legacy) {
    result[0] = coerceAttack(legacy);
  }
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
    hpMax: typeof raw.hpMax === 'string' ? raw.hpMax.slice(0, 10) : '',
    ac: typeof raw.ac === 'string' ? raw.ac.slice(0, 10) : '',
  };
}

export function activeAttacks(sheet: CharacterSheet): AttackEntry[] {
  return sheet.attacks.filter(attackIsActive);
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

export interface RollMessage {
  id: string;
  kind: 'roll';
  author: string;
  roll: DiceRollResult;
  label?: string;
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
  'grid:update': (grid: GridSettings) => void;
  'token:add': (payload: { mapId: string; libraryItemId: string; x: number; y: number }) => void;
  'token:move': (payload: { mapId: string; id: string; x: number; y: number }) => void;
  'token:lock': (payload: { mapId: string; id: string; lock: boolean }) => void;
  'token:update': (payload: { mapId: string; id: string; patch: Partial<Token> }) => void;
  'token:remove': (payload: { mapId: string; id: string }) => void;
  'chat:send': (text: string) => void;
  'dice:roll': (payload: { expression: string; label?: string }) => void;
  'dice:attack': (payload: {
    hit: { expression: string; label?: string };
    damage?: { expression: string; label?: string };
  }) => void;
  'sheet:update': (sheet: CharacterSheet) => void;
  'resources:update': (resources: PlayerResources) => void;
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
