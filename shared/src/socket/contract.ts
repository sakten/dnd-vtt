import type { ActionCost, ReactionOffer } from '../domain/actions';
import type { ChatMessage, RollKind } from '../domain/chat';
import type { CombatState } from '../domain/combat';
import type { Player, RoomState } from '../domain/room';
import type { FogState, GridSettings, MapInfo, Wall } from '../domain/scene';
import type { CharacterSheet, PlayerResources } from '../domain/sheet';
import type { LibraryItem, Token, TokenFields } from '../domain/token';

export interface ServerToClientEvents {
  'room:joined': (payload: {
    room: RoomState;
    selfId: string;
    sheet: CharacterSheet | null;
    resources: PlayerResources | null;
  }) => void;
  'room:renamed': (payload: { name: string }) => void;
  /** Настройки комнаты (режим тестов). */
  'room:settings': (payload: { testMode: boolean }) => void;
  'sheet:update': (payload: { sheet: CharacterSheet }) => void;
  'resources:update': (resources: PlayerResources) => void;
  'character:update': (payload: { playerId: string; libraryItemId: string | null }) => void;
  'maps:update': (payload: { maps: MapInfo[]; activeMapId: string | null }) => void;
  'map:bring': (payload: { activeMapId: string }) => void;
  'fog:update': (payload: { mapId: string; fog: FogState }) => void;
'walls:update': (payload: { mapId: string; walls: Wall[] }) => void;
  'library:update': (library: LibraryItem[]) => void;
  'combat:update': (payload: { mapId: string; combat: CombatState }) => void;
  'grid:update': (grid: GridSettings) => void;
  'token:add': (payload: { mapId: string; token: Token }) => void;
  'token:update': (payload: { mapId: string; token: Token }) => void;
  'token:remove': (payload: { mapId: string; id: string }) => void;
  'chat:message': (message: ChatMessage) => void;
  'chat:error': (message: string) => void;
  'players:update': (players: Player[]) => void;
  /** Окно реакции для контролёра токена (или DM для NPC). */
  'reaction:offer': (offer: ReactionOffer) => void;
  /** Окно закрыто (ответили/таймаут/скип). */
  'reaction:close': (payload: { id: string }) => void;
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
  /** Смена настроек комнаты (режим тестов); сервер проверяет реального DM. */
  'room:settings': (payload: { testMode: boolean }) => void;
  'map:add': (payload: { name: string; url: string; width: number; height: number }) => void;
  'map:remove': (id: string) => void;
  'map:rename': (payload: { id: string; name: string }) => void;
  'map:bring': (id: string) => void;
  'fog:update': (payload: { mapId: string; fog: FogState }) => void;
'walls:update': (payload: { mapId: string; walls: Wall[] }) => void;
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
  'combat:setMovement': (payload: {
    mapId: string;
    tokenId: string;
    used: number;
    diagonals?: number;
    /** Ломаная пути (мировые координаты) для проверки атак по возможности. */
    path?: { x: number; y: number }[];
  }) => void;
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
  /** Досрочно прекратить концентрацию заклинателя (снять его эффекты). */
  'spell:endConcentration': (payload: { mapId: string; tokenId: string }) => void;
  /** Ответ на окно реакции: optionId=null — пропустить. */
  'reaction:respond': (payload: { id: string; optionId: string | null }) => void;
  /** DM принудительно пропускает все оставшиеся окна (для монстров/зависших). */
  'reaction:forceSkip': (payload: { id: string }) => void;
  'sheet:update': (sheet: CharacterSheet) => void;
  'resources:update': (resources: PlayerResources) => void;
  'player:setCharacter': (
    payload: { libraryItemId: string | null },
    cb: (res: { ok: true } | { error: string }) => void
  ) => void;
  'resources:hitDie': (payload: { die?: number }) => void;
  'resources:deathSave': (payload?: { expression?: string }) => void;
  /** Отдых: сервер применяет восстановление; долгий снимает эффекты и концентрацию. */
  'resources:rest': (payload: { type: 'short' | 'long' }) => void;
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
