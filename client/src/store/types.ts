import type {
  CharacterSheet,
  ChatMessage,
  FogState,
  GridSettings,
  LibraryItem,
  Player,
  PlayerResources,
  Role,
  RollKind,
  Scene,
  ServerToClientEvents,
  Token,
  TokenFields,
} from 'shared';
import type { AppSocket } from '../net/socket';

export interface ViewState {
  x: number;
  y: number;
  scale: number;
}

export interface FogMode {
  active: boolean;
  tool: 'brush' | 'rect';
  action: 'hide' | 'reveal';
  brush: number;
}

export interface CritHit {
  id: string;
  author: string;
  label?: string;
  total: number;
}

export interface GameState {
  socket: AppSocket | null;
  connected: boolean;
  selfId: string | null;
  roomCode: string | null;
  roomName: string | null;
  role: Role;
  players: Player[];
  scene: Scene;
  viewMapId: string | null;
  library: LibraryItem[];
  sheet: CharacterSheet | null;
  resources: PlayerResources | null;
  currentCharacterId: string | null;
  chat: ChatMessage[];
  chatError: string | null;
  joinError: string | null;
  selectedTokenId: string | null;
  targetTokenId: string | null;
  measureFromId: string | null;
  hoverTokenId: string | null;
  draggingTokenId: string | null;
  view: ViewState;
  viewport: { w: number; h: number };
  gridModalOpen: boolean;
  tokenMenuId: string | null;
  fogMode: FogMode;
  critHit: CritHit | null;

  init: () => void;
  joinRoom: (code: string, name: string) => void;
  sendChat: (text: string) => void;
  rollDice: (expression: string, label?: string, meta?: { rollKind?: RollKind; subject?: string }) => void;
  rollAttack: (payload: {
    tokenId?: string;
    targetId?: string;
    attackIndex: number;
    advantage?: 'a' | 'd';
  }) => void;
  setSheet: (sheet: CharacterSheet) => void;
  updateResources: (resources: PlayerResources) => void;
  setCurrentCharacter: (libraryItemId: string | null) => void;
  rollHitDie: (die: number) => void;
  rollDeathSave: (expression: string) => void;
  removePlayer: (id: string) => void;
  addMap: (name: string, url: string, width: number, height: number) => void;
  removeMap: (id: string) => void;
  renameMap: (id: string, name: string) => void;
  switchMap: (id: string) => void;
  bringMap: (id: string) => void;
  addLibraryItem: (fields: TokenFields) => void;
  updateLibraryItem: (id: string, patch: Partial<LibraryItem>) => void;
  removeLibraryItem: (id: string) => void;
  updateGrid: (patch: Partial<GridSettings>) => void;
  addTokenAt: (libraryItemId: string, x: number, y: number) => void;
  removeToken: (id: string) => void;
  moveToken: (id: string, x: number, y: number) => void;
  finalizeTokenMove: (id: string, x: number, y: number) => void;
  lockToken: (id: string, lock: boolean) => void;
  setTokenFields: (id: string, patch: Partial<Token>) => void;
  setView: (view: ViewState) => void;
  setViewport: (v: { w: number; h: number }) => void;
  setSelected: (id: string | null) => void;
  setTargetToken: (id: string | null) => void;
  setMeasureFrom: (id: string | null) => void;
  setDragging: (id: string | null) => void;
  setGridModalOpen: (open: boolean) => void;
  setTokenMenu: (id: string | null) => void;
  setFogMode: (patch: Partial<FogMode>) => void;
  updateFog: (mapId: string, fog: FogState) => void;
  startCombat: () => void;
  endCombat: () => void;
  addCombatant: (tokenId: string) => void;
  addMapCombatants: () => void;
  removeCombatant: (id: string) => void;
  updateCombatant: (id: string, patch: { name?: string; initiative?: number; bonus?: string }) => void;
  moveCombatant: (id: string, toIndex: number) => void;
  rollInitiative: (id?: string) => void;
  clearCombat: () => void;
  setHoverToken: (id: string | null) => void;
  fitView: () => void;
  onConnected: () => void;
  onDisconnected: () => void;
  onJoinError: (message: string) => void;
  onRoomJoined: (payload: Parameters<ServerToClientEvents['room:joined']>[0]) => void;
  onRoomRenamed: (payload: Parameters<ServerToClientEvents['room:renamed']>[0]) => void;
  onRoomClosed: (message: string) => void;
  onPlayersUpdate: (players: Player[]) => void;
  onMapsUpdate: (payload: Parameters<ServerToClientEvents['maps:update']>[0]) => void;
  onMapBring: (payload: Parameters<ServerToClientEvents['map:bring']>[0]) => void;
  onFogUpdate: (payload: Parameters<ServerToClientEvents['fog:update']>[0]) => void;
  onGridUpdate: (grid: GridSettings) => void;
  onLibraryUpdate: (library: LibraryItem[]) => void;
  onCombatUpdate: (payload: Parameters<ServerToClientEvents['combat:update']>[0]) => void;
  onTokenAdd: (payload: Parameters<ServerToClientEvents['token:add']>[0]) => void;
  onTokenUpdate: (payload: Parameters<ServerToClientEvents['token:update']>[0]) => void;
  onTokenRemove: (payload: Parameters<ServerToClientEvents['token:remove']>[0]) => void;
  onChatMessage: (message: ChatMessage) => void;
  onChatError: (message: string) => void;
  onSheetUpdate: (payload: Parameters<ServerToClientEvents['sheet:update']>[0]) => void;
  onResourcesUpdate: (resources: PlayerResources) => void;
  onCharacterUpdate: (payload: Parameters<ServerToClientEvents['character:update']>[0]) => void;
}

export type StoreSet = (partial: Partial<GameState> | ((state: GameState) => Partial<GameState>)) => void;
export type StoreGet = () => GameState;
export type Slice<T> = (set: StoreSet, get: StoreGet) => T;
