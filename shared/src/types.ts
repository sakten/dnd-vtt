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

export interface MapInfo {
  id: string;
  name: string;
  url: string;
  width: number;
  height: number;
  tokens: Token[];
  fog: FogState;
}

export interface LibraryItem {
  id: string;
  name: string;
  url: string;
  cells: number;
  round: boolean;
  description: string;
}

export interface Token {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  x: number;
  y: number;
  w: number;
  h: number;
  cells: number;
  round: boolean;
  scale: number;
  rotation: number;
  z: number;
  visible: boolean;
  ownerId: string;
  lockedBy: string | null;
}

export interface Player {
  id: string;
  name: string;
  role: Role;
  isConnected: boolean;
}

export type AbilityKey = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';

export type SkillLevel = 0 | 1 | 2;

export interface AttackEntry {
  name: string;
  hit: string;
  damage: string;
}

export interface CharacterSheet {
  name: string;
  abilities: Record<AbilityKey, number>;
  proficiencyBonus: string;
  saves: Partial<Record<AbilityKey, boolean>>;
  skills: Partial<Record<string, SkillLevel>>;
  attack: AttackEntry;
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
  scene: Scene;
  library: LibraryItem[];
  players: Player[];
  chat: ChatMessage[];
}

export interface ServerToClientEvents {
  'room:joined': (payload: { room: RoomState; selfId: string; sheet: CharacterSheet | null }) => void;
  'sheet:update': (payload: { sheet: CharacterSheet }) => void;
  'maps:update': (payload: { maps: MapInfo[]; activeMapId: string | null }) => void;
  'map:bring': (payload: { activeMapId: string }) => void;
  'fog:update': (payload: { mapId: string; fog: FogState }) => void;
  'library:update': (library: LibraryItem[]) => void;
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
    payload: { name: string; clientId: string; adminToken?: string },
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
  'library:add': (payload: { name: string; url: string; cells: number; round: boolean; description: string }) => void;
  'library:update': (payload: { id: string; patch: Partial<LibraryItem> }) => void;
  'library:remove': (id: string) => void;
  'grid:update': (grid: GridSettings) => void;
  'token:add': (payload: {
    mapId: string;
    name: string;
    imageUrl: string;
    x: number;
    y: number;
    cells?: number;
    round?: boolean;
    description?: string;
  }) => void;
  'token:move': (payload: { mapId: string; id: string; x: number; y: number }) => void;
  'token:lock': (payload: { mapId: string; id: string; lock: boolean }) => void;
  'token:update': (payload: { mapId: string; id: string; patch: Partial<Token> }) => void;
  'token:remove': (payload: { mapId: string; id: string }) => void;
  'chat:send': (text: string) => void;
  'dice:roll': (payload: { expression: string; label?: string }) => void;
  'sheet:update': (sheet: CharacterSheet) => void;
  'admin:list': (
    payload: { adminToken: string },
    cb: (res: { rooms: { code: string; players: number; maps: number }[] } | { error: string }) => void
  ) => void;
  'admin:create': (
    payload: { adminToken: string; name: string; clientId: string },
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
  'ping': () => void;
}
