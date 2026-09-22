import type {
  ActionCost,
  CharacterSheet,
  ChatMessage,
  ErrorPayload,
  FogState,
  FoundPath,
  GridSettings,
  LibraryItem,
  LightArea,
  LightAreaKind,
  Player,
  PlayerResources,
  ReactionOffer,
  Role,
  RollAnimPayload,
  RollKind,
  Scene,
  ServerToClientEvents,
  SpellFxPayload,
  Token,
  TokenFields,
  VisionSettings,
  Wall,
} from 'shared';
import type { Lang } from '../i18n';
import type { AppSocket } from '../net/socket';
import type { DiceRollFace } from '../components/ThreeD20';
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
  /** Якорь текущей цепочки (последняя точка); null — цепочка завершена. */
  start: { x: number; y: number } | null;
}

export interface LightMode {
  active: boolean;
  kind: LightAreaKind;
}

export interface MovingToken {
  points: { x: number; y: number }[];
  duration: number;
  /** Свой поход: по завершении клиент фиксирует позицию на сервере. */
  own: boolean;
  /** Число диагоналей на начало похода (чередование 5-10-5). */
  diagonalsBefore: number;
}

export interface CritHit {
  id: string;
  author: string;
  label?: string;
  total: number;
}

/** Косметический эффект применения в очереди: не стартовать раньше `notBefore` (мс, performance.now). */
export interface FxCast extends SpellFxPayload {
  notBefore: number;
  /** Когда эффект поставлен в очередь (performance.now): старые в фоне пропускаем. */
  queuedAt: number;
}

export interface GameState {
  socket: AppSocket | null;
  /** Снятие моста сокета (слушатели + heartbeat) для `disposeSocket`. */
  socketDispose: (() => void) | null;
  connected: boolean;
  /** Последняя попытка подключения завершилась ошибкой (для экрана входа). */
  connectError: boolean;
  selfId: string | null;
  roomCode: string | null;
  roomName: string | null;
  role: Role;
  /** Язык интерфейса (i18n). */
  lang: Lang;
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
  bestiaryOpen: boolean;
  /** Открыта модалка настроек комнаты (только реальный DM). */
  roomSettingsOpen: boolean;
  tokenMenuId: string | null;
  /** Дверь, у которой открыт мини-UI (id стены). */
  doorMenuId: string | null;
  fogMode: FogMode;
  wallsMode: WallsMode;
  lightMode: LightMode;
  critHit: CritHit | null;
  /** Активные окна реакций (R1). */
  reactionOffers: ReactionOffer[];
  /** Анимация выпавших d20 (по личному шансу): взятые кубики подсвечены, отброшенные тускнеют. */
  rollAnim: { id: string; dice: DiceRollFace[]; startedAt: number } | null;
  /** Косметический эффект применения в очереди: не стартовать раньше `notBefore` (мс, performance.now). */
  fxQueue: FxCast[];
  /** Галка Adv/Dis над ROLL: применяется к следующему своему броску, включая чеки в игре. */
  rollMode: 'a' | 'd' | null;

  init: () => void;
  /** Снять мост и отключить сокет (HMR/тесты/выход из комнаты в будущем). */
  disposeSocket: () => void;
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
  /** Добавить карту; grid — сразу задать её сетку (авто-выравнивание). */
  addMap: (name: string, url: string, width: number, height: number, grid?: GridSettings) => void;
  removeMap: (id: string) => void;
  renameMap: (id: string, name: string) => void;
  switchMap: (id: string) => void;
  bringMap: (id: string) => void;
  addLibraryItem: (fields: TokenFields) => void;
  updateLibraryItem: (id: string, patch: Partial<LibraryItem>) => void;
  removeLibraryItem: (id: string) => void;
  /** Патч сетки карты (по умолчанию — активной); без карт — дефолт комнаты. */
  updateGrid: (patch: Partial<GridSettings>, mapId?: string) => void;
  /** Открыть/закрыть дверь на активной карте (права проверит сервер). */
  toggleDoor: (wallId: string) => void;
  /** Настройки двери (только DM): «только для ведущего» и Сл взлома. */
  updateDoor: (mapId: string, wallId: string, patch: { dmOnly?: boolean; pickDc?: number }) => void;
  addTokenAt: (libraryItemId: string, x: number, y: number) => void;
  removeToken: (id: string) => void;
  moveToken: (id: string, x: number, y: number) => void;
  /** Начать поход по пути: анимация у всех, позиция фиксируется по завершении. */
  startTokenWalk: (id: string, path: FoundPath) => void;
  /** Завершить поход: свой клиент фиксирует позицию/учёт на сервере. */
  finishTokenWalk: (id: string, walked: { x: number; y: number }[]) => void;
  /** Шаг похода: сервер обрабатывает вход/выход зон. */
  stepTokenWalk: (id: string, x: number, y: number) => void;
  clearMoving: (id: string) => void;
  /** Анимируемые перемещения токенов (у всех клиентов). */
  movingTokens: Record<string, MovingToken>;
  /** Прозрачная копия на старте перетаскивания (локально у тянущего). */
  dragGhost: { id: string; x: number; y: number } | null;
  setDragGhost: (ghost: { id: string; x: number; y: number } | null) => void;
  /** Маршрут текущего перетаскивания (превью, локально у тянущего). */
  dragPath: FoundPath | null;
  setDragPath: (path: FoundPath | null) => void;
  lockToken: (id: string, lock: boolean) => void;
  setTokenFields: (id: string, patch: Partial<Token>) => void;
  /** Принять форму Wild Shape по ключу известной формы (сервер проверит права и ресурс). */
  shapeToken: (id: string, formKey: string) => void;
  /** Вернуться в свою форму (Wild Shape/Polymorph). */
  revertShape: (id: string) => void;
  setView: (view: ViewState) => void;
  setViewport: (v: { w: number; h: number }) => void;
  /** Сменить язык интерфейса (RU/EN); выбор сохраняется в localStorage. */
  setLang: (lang: Lang) => void;
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
  setBestiaryOpen: (open: boolean) => void;
  setRoomSettingsOpen: (open: boolean) => void;
  /** Сменить режим тестов (сервер применяет только от реального DM). */
  setRoomSettings: (testMode: boolean) => void;
  setTokenMenu: (id: string | null) => void;
  setDoorMenu: (id: string | null) => void;
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
    extra?: { targetIds?: string[]; attackIndex?: number; advantage?: 'a' | 'd'; slot?: ActionCost; offhand?: boolean; cleave?: boolean }
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
  onZonesUpdate: (payload: Parameters<ServerToClientEvents['zones:update']>[0]) => void;
  onGridUpdate: (payload: { mapId: string; grid: GridSettings }) => void;
  onLibraryUpdate: (library: LibraryItem[]) => void;
  onCombatUpdate: (payload: Parameters<ServerToClientEvents['combat:update']>[0]) => void;
  onTokenAdd: (payload: Parameters<ServerToClientEvents['token:add']>[0]) => void;
  onTokenUpdate: (payload: Parameters<ServerToClientEvents['token:update']>[0]) => void;
  onTokenRemove: (payload: Parameters<ServerToClientEvents['token:remove']>[0]) => void;
  onTokenWalk: (payload: Parameters<ServerToClientEvents['token:walk']>[0]) => void;
  onChatMessage: (message: ChatMessage) => void;
  onChatError: (payload: ErrorPayload | string) => void;
  onSheetUpdate: (payload: Parameters<ServerToClientEvents['sheet:update']>[0]) => void;
  onResourcesUpdate: (resources: PlayerResources) => void;
  onCharacterUpdate: (payload: Parameters<ServerToClientEvents['character:update']>[0]) => void;
  onReactionOffer: (offer: ReactionOffer) => void;
  onReactionClose: (payload: { id: string }) => void;
  respondReaction: (id: string, optionId: string | null) => void;
  forceSkipReaction: (id: string) => void;
  /** Показ анимации d20 (значение уже брошено сервером). */
  onRollAnim: (payload: RollAnimPayload) => void;
  /** Личная настройка: шанс 0–100 показать анимацию d20. */
  setRollAnimChance: (value: number) => void;
  clearRollAnim: () => void;
  /** Установить/сбросить режим преимущества для следующего броска. */
  setRollMode: (mode: 'a' | 'd' | null) => void;
  /** Получен косметический эффект применения (fx:play). */
  onFxPlay: (payload: SpellFxPayload) => void;
  /** Эффект проигран — убрать из очереди. */
  dequeueFx: (id: string) => void;
  /** Очистить очередь (вкладка ушла в фон — копить нечего). */
  clearFxQueue: () => void;
}

export type StoreSet = (partial: Partial<GameState> | ((state: GameState) => Partial<GameState>)) => void;
export type StoreGet = () => GameState;
export type Slice<T> = (set: StoreSet, get: StoreGet) => T;
