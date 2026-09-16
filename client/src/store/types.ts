import type {
  ActionCost,
  CharacterSheet,
  ChatMessage,
  FogState,
  GridSettings,
  LibraryItem,
  LightArea,
  LightAreaKind,
  Player,
  PlayerResources,
  ReactionOffer,
  Role,
  RollKind,
  Scene,
  ServerToClientEvents,
  Token,
  TokenFields,
  VisionSettings,
  Wall,
} from 'shared';
import type { AppSocket } from '../net/socket';
import type {
  Interaction,
  MultiTargetState,
  SpellCastPayload,
  StartAimPayload,
  TargetingState,
} from '../domain/interaction';

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

export interface WallsMode {
  active: boolean;
  tool: 'wall' | 'door';
}

export interface LightMode {
  active: boolean;
  kind: LightAreaKind;
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
  /** Последняя попытка подключения завершилась ошибкой (для экрана входа). */
  connectError: boolean;
  selfId: string | null;
  roomCode: string | null;
  roomName: string | null;
  role: Role;
  /** Режим тестов комнаты: у всех игроков права ведущего. */
  testMode: boolean;
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
  /** Активное взаимодействие с картой (цель/область/мульти-цели), не более одного. */
  interaction: Interaction | null;
  selectedTokenId: string | null;
  hoverTokenId: string | null;
  draggingTokenId: string | null;
  view: ViewState;
  viewport: { w: number; h: number };
  gridModalOpen: boolean;
  visionModalOpen: boolean;
  /** Открыта модалка настроек комнаты (только реальный DM). */
  roomSettingsOpen: boolean;
  tokenMenuId: string | null;
  fogMode: FogMode;
  wallsMode: WallsMode;
  lightMode: LightMode;
  critHit: CritHit | null;
  /** Активные окна реакций (R1). */
  reactionOffers: ReactionOffer[];

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
  /** Отдых: восстановление и (для долгого) чистку эффектов считает сервер. */
  rest: (type: 'short' | 'long') => void;
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
  /** Войти в режим выбора цели для способности/заклинания/атаки. */
  startTargeting: (targeting: TargetingState) => void;
  cancelTargeting: () => void;
  /** Сбросить любой активный режим взаимодействия (Esc/отмена). */
  cancelInteraction: () => void;
  /** Клик по цели: применяет способность по выбранному токену. */
  resolveTargeting: (targetId: string) => void;
  setDragging: (id: string | null) => void;
  setGridModalOpen: (open: boolean) => void;
  setVisionModalOpen: (open: boolean) => void;
  setRoomSettingsOpen: (open: boolean) => void;
  /** Сменить режим тестов (сервер применяет только от реального DM). */
  setRoomSettings: (testMode: boolean) => void;
  setTokenMenu: (id: string | null) => void;
  setFogMode: (patch: Partial<FogMode>) => void;
  updateFog: (mapId: string, fog: FogState) => void;
  setWallsMode: (patch: Partial<WallsMode>) => void;
  updateWalls: (mapId: string, walls: Wall[]) => void;
  updateVision: (mapId: string, vision: VisionSettings) => void;
  setLightMode: (patch: Partial<LightMode>) => void;
  updateAreas: (mapId: string, areas: LightArea[]) => void;
  /** Кандидаты авто-поиска стен (превью до применения). */
  wallCandidates: Wall[] | null;
  setWallCandidates: (walls: Wall[] | null) => void;
  startCombat: () => void;
  endCombat: () => void;
  addCombatant: (tokenId: string) => void;
  addMapCombatants: () => void;
  removeCombatant: (id: string) => void;
  updateCombatant: (id: string, patch: { name?: string; initiative?: number; bonus?: string }) => void;
  moveCombatant: (id: string, toIndex: number) => void;
  rollInitiative: (id?: string) => void;
  clearCombat: () => void;
  endTurn: () => void;
  setTurn: (id: string) => void;
  runAction: (
    tokenId: string,
    actionId: string,
    extra?: { targetIds?: string[]; attackIndex?: number; advantage?: 'a' | 'd'; slot?: ActionCost }
  ) => void;
  castSpell: (payload: SpellCastPayload) => void;
  startAim: (payload: StartAimPayload) => void;
  /** Ведение области за курсором (с клампом по дистанции). */
  aimToCursor: (cursor: { x: number; y: number }) => void;
  cancelAim: () => void;
  confirmAim: () => void;
  /** Досрочно прекратить концентрацию персонажа. */
  endConcentration: (tokenId: string) => void;
  /** Быстрое изменение HP токена (DM): delta>0 — лечение, <0 — урон. */
  adjustTokenHp: (tokenId: string, delta: number) => void;
  /** Выбор цели на каждый снаряд; когда все выбраны — каст. */
  startMultiTarget: (payload: Omit<MultiTargetState, 'targets'>) => void;
  addMultiTarget: (targetId: string) => void;
  /** Применить выбранных целей меньше максимума. */
  finishMultiTarget: () => void;
  cancelMultiTarget: () => void;
  setHoverToken: (id: string | null) => void;
  fitView: () => void;
  onConnected: () => void;
  onConnectError: () => void;
  onDisconnected: () => void;
  onJoinError: (message: string) => void;
  onRoomJoined: (payload: Parameters<ServerToClientEvents['room:joined']>[0]) => void;
  onRoomRenamed: (payload: Parameters<ServerToClientEvents['room:renamed']>[0]) => void;
  onRoomSettings: (payload: Parameters<ServerToClientEvents['room:settings']>[0]) => void;
  onRoomClosed: (message: string) => void;
  onPlayersUpdate: (players: Player[]) => void;
  onMapsUpdate: (payload: Parameters<ServerToClientEvents['maps:update']>[0]) => void;
  onMapBring: (payload: Parameters<ServerToClientEvents['map:bring']>[0]) => void;
  onFogUpdate: (payload: Parameters<ServerToClientEvents['fog:update']>[0]) => void;
  onWallsUpdate: (payload: Parameters<ServerToClientEvents['walls:update']>[0]) => void;
  onVisionUpdate: (payload: Parameters<ServerToClientEvents['vision:update']>[0]) => void;
  onAreasUpdate: (payload: Parameters<ServerToClientEvents['areas:update']>[0]) => void;
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
  onReactionOffer: (offer: ReactionOffer) => void;
  onReactionClose: (payload: { id: string }) => void;
  respondReaction: (id: string, optionId: string | null) => void;
  forceSkipReaction: (id: string) => void;
}

export type StoreSet = (partial: Partial<GameState> | ((state: GameState) => Partial<GameState>)) => void;
export type StoreGet = () => GameState;
export type Slice<T> = (set: StoreSet, get: StoreGet) => T;
