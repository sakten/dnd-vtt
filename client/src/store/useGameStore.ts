import { create } from 'zustand';
import {
  clampCells,
  DEFAULT_GRID,
  parseDiceExpression,
  snapToGrid,
  type CharacterSheet,
  type ChatMessage,
  type CombatState,
  type FogState,
  type GridSettings,
  type LibraryItem,
  type Player,
  type Role,
  type Scene,
  type Token,
  type TokenFields,
} from 'shared';
import { createSocket, type AppSocket } from '../net/socket';

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

interface GameState {
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
  chat: ChatMessage[];
  chatError: string | null;
  joinError: string | null;
  selectedTokenId: string | null;
  hoverTokenId: string | null;
  draggingTokenId: string | null;
  view: ViewState;
  viewport: { w: number; h: number };
  gridModalOpen: boolean;
  tokenMenuId: string | null;
  fogMode: FogMode;

  init: () => void;
  joinRoom: (code: string, name: string) => void;
  sendChat: (text: string) => void;
  rollDice: (expression: string, label?: string) => void;
  rollAttack: (
    hit: { expression: string; label: string } | null,
    damage: { expression: string; label: string } | null
  ) => void;
  setSheet: (sheet: CharacterSheet) => void;
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
  setTokenFields: (id: string, patch: Partial<TokenFields>) => void;
  setView: (view: ViewState) => void;
  setViewport: (v: { w: number; h: number }) => void;
  setSelected: (id: string | null) => void;
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
}

const lastSent = new Map<string, number>();

function throttled(key: string, ms: number, fn: () => void) {
  const now = Date.now();
  const prev = lastSent.get(key) ?? -Infinity;
  if (now - prev >= ms) {
    lastSent.set(key, now);
    fn();
  }
}

export const useGameStore = create<GameState>()((set, get) => {
  const patchTokenInMap = (mapId: string, id: string, patch: Partial<Token>) =>
    set((s) => {
      const idx = s.scene.maps.findIndex((m) => m.id === mapId);
      if (idx < 0) return s;
      const maps = [...s.scene.maps];
      maps[idx] = { ...maps[idx], tokens: maps[idx].tokens.map((t) => (t.id === id ? { ...t, ...patch } : t)) };
      return { scene: { ...s.scene, maps } };
    });

  const viewMapId = () => get().viewMapId;

  const patchMapCombat = (mapId: string, combat: CombatState) =>
    set((s) => {
      const idx = s.scene.maps.findIndex((m) => m.id === mapId);
      if (idx < 0) return s;
      const maps = [...s.scene.maps];
      maps[idx] = { ...maps[idx], combat };
      return { scene: { ...s.scene, maps } };
    });

  const clearTokenUi = () => set({ selectedTokenId: null, tokenMenuId: null, draggingTokenId: null });

  return {
    socket: null,
    connected: false,
    selfId: null,
    roomCode: null,
    roomName: null,
    role: 'player',
    players: [],
    scene: { maps: [], activeMapId: null, grid: { ...DEFAULT_GRID } },
    viewMapId: null,
    library: [],
    sheet: null,
    chat: [],
    chatError: null,
    joinError: null,
    selectedTokenId: null,
    hoverTokenId: null,
    draggingTokenId: null,
    view: { x: 0, y: 0, scale: 1 },
    viewport: { w: 0, h: 0 },
    gridModalOpen: false,
    tokenMenuId: null,
    fogMode: { active: false, tool: 'brush', action: 'hide', brush: 2 },

    init: () => {
      if (get().socket) return;
      const socket = createSocket();
      set({ socket });

      let lastPong = Date.now();
      socket.onAny(() => {
        lastPong = Date.now();
      });
      socket.on('pong', () => {
        lastPong = Date.now();
      });
      window.setInterval(() => {
        if (!socket.connected) return;
        if (Date.now() - lastPong > 60000) {
          socket.disconnect();
          socket.connect();
        } else {
          socket.emit('ping');
        }
      }, 30000);

      socket.on('connect', () => {
        set({ connected: true });
        const s = get();
        if (s.roomCode && s.selfId) {
          const name = localStorage.getItem('vtt-name') ?? '';
          socket.emit('room:join', { code: s.roomCode, name, clientId: s.selfId }, (res) => {
            if ('error' in res) set({ joinError: res.error });
          });
        }
      });
      socket.on('disconnect', () => set({ connected: false }));

      socket.on('room:joined', ({ room, selfId, sheet }) => {
        const player = room.players.find((p) => p.id === selfId);
        const url = new URL(window.location.href);
        if (url.searchParams.get('room') !== room.code) {
          url.searchParams.set('room', room.code);
          url.searchParams.delete('admin');
          window.history.replaceState(null, '', url.toString());
        }
        set({
          roomCode: room.code,
          roomName: room.name,
          selfId,
          role: player?.role ?? 'player',
          players: room.players,
          scene: room.scene,
          viewMapId: room.scene.activeMapId,
          library: room.library ?? [],
          sheet: sheet ?? null,
          chat: room.chat,
          joinError: null,
        });
      });

      socket.on('sheet:update', ({ sheet }) => set({ sheet }));

      socket.on('room:renamed', ({ name }) => set({ roomName: name }));

      socket.on('maps:update', ({ maps, activeMapId }) => {
        set((s) => {
          const current = s.viewMapId;
          const valid = current !== null && maps.some((m) => m.id === current);
          const nextView = valid ? current : activeMapId ?? maps[0]?.id ?? null;
          return {
            scene: { ...s.scene, maps, activeMapId },
            viewMapId: nextView,
            selectedTokenId: null,
            tokenMenuId: null,
            draggingTokenId: null,
          };
        });
        window.setTimeout(() => get().fitView(), 30);
      });

      socket.on('map:bring', ({ activeMapId }) => {
        set({ viewMapId: activeMapId, selectedTokenId: null, tokenMenuId: null, draggingTokenId: null });
        window.setTimeout(() => get().fitView(), 30);
      });

      socket.on('fog:update', ({ mapId, fog }) =>
        set((s) => {
          const idx = s.scene.maps.findIndex((m) => m.id === mapId);
          if (idx < 0) return s;
          const maps = [...s.scene.maps];
          maps[idx] = { ...maps[idx], fog };
          return { scene: { ...s.scene, maps } };
        })
      );

      socket.on('library:update', (library) => set({ library }));
      socket.on('combat:update', ({ mapId, combat }) => patchMapCombat(mapId, combat));
      socket.on('grid:update', (grid) => set((s) => ({ scene: { ...s.scene, grid } })));
      socket.on('token:add', ({ mapId, token }) =>
        set((s) => {
          const idx = s.scene.maps.findIndex((m) => m.id === mapId);
          if (idx < 0) return s;
          if (s.scene.maps[idx].tokens.some((t) => t.id === token.id)) return s;
          const maps = [...s.scene.maps];
          maps[idx] = { ...maps[idx], tokens: [...maps[idx].tokens, token] };
          return { scene: { ...s.scene, maps } };
        })
      );
      socket.on('token:update', ({ mapId, token }) =>
        set((s) => {
          if (s.draggingTokenId === token.id) return s;
          const idx = s.scene.maps.findIndex((m) => m.id === mapId);
          if (idx < 0) return s;
          const maps = [...s.scene.maps];
          maps[idx] = {
            ...maps[idx],
            tokens: maps[idx].tokens.map((t) => (t.id === token.id ? token : t)),
          };
          return { scene: { ...s.scene, maps } };
        })
      );
      socket.on('token:remove', ({ mapId, id }) =>
        set((s) => {
          const idx = s.scene.maps.findIndex((m) => m.id === mapId);
          if (idx < 0) return s;
          const maps = [...s.scene.maps];
          maps[idx] = { ...maps[idx], tokens: maps[idx].tokens.filter((t) => t.id !== id) };
          return {
            selectedTokenId: s.selectedTokenId === id ? null : s.selectedTokenId,
            scene: { ...s.scene, maps },
          };
        })
      );
      socket.on('chat:message', (message) =>
        set((s) => (s.chat.some((m) => m.id === message.id) ? s : { chat: [...s.chat, message] }))
      );
      socket.on('chat:error', (message) => {
        set({ chatError: message });
        window.setTimeout(() => {
          set((s) => (s.chatError === message ? { chatError: null } : s));
        }, 5000);
      });
      socket.on('players:update', (players) => set({ players }));

      socket.on('room:deleted', () => {
        set({
          roomCode: null,
          roomName: null,
          joinError: 'Комната удалена ведущим',
          hoverTokenId: null,
          selectedTokenId: null,
          tokenMenuId: null,
          draggingTokenId: null,
        });
        const url = new URL(window.location.href);
        url.searchParams.delete('room');
        window.history.replaceState(null, '', url.toString());
      });

      const getPlayerId = () => {
        const id = localStorage.getItem('vtt-player') ?? crypto.randomUUID();
        localStorage.setItem('vtt-player', id);
        return id;
      };

      const inviteCode = new URLSearchParams(window.location.search).get('room')?.toUpperCase();
      if (inviteCode) {
        const name = localStorage.getItem('vtt-name') ?? '';
        if (name) {
          socket.emit('room:join', { code: inviteCode, name, clientId: getPlayerId() }, (res) => {
            if ('error' in res) set({ joinError: res.error });
          });
        }
      }
    },

    joinRoom: (code, name) => {
      const socket = get().socket;
      if (!socket) return;
      const playerId = localStorage.getItem('vtt-player') ?? crypto.randomUUID();
      localStorage.setItem('vtt-player', playerId);
      socket.emit('room:join', { code: code.trim().toUpperCase(), name, clientId: playerId }, (res) => {
        if ('error' in res) set({ joinError: res.error });
      });
    },

    sendChat: (text) => {
      const t = text.trim();
      if (!t) return;
      try {
        parseDiceExpression(t);
        get().rollDice(t);
      } catch {
        get().socket?.emit('chat:send', t);
      }
    },

    rollDice: (expression, label) => {
      get().socket?.emit('dice:roll', { expression, label });
    },

    rollAttack: (hit, damage) => {
      const socket = get().socket;
      if (!socket) return;
      if (hit) socket.emit('dice:attack', { hit, damage: damage ?? undefined });
      else if (damage) socket.emit('dice:roll', { expression: damage.expression, label: damage.label });
    },

    setSheet: (sheet) => {
      get().socket?.emit('sheet:update', sheet);
    },

    addMap: (name, url, width, height) => {
      get().socket?.emit('map:add', { name, url, width, height });
    },

    removeMap: (id) => {
      get().socket?.emit('map:remove', id);
    },

    renameMap: (id, name) => {
      get().socket?.emit('map:rename', { id, name });
    },

    switchMap: (id) => {
      set({ viewMapId: id });
      clearTokenUi();
      get().fitView();
    },

    bringMap: (id) => {
      get().socket?.emit('map:bring', id);
    },

    addLibraryItem: (fields) => {
      get().socket?.emit('library:add', fields);
    },

    updateLibraryItem: (id, patch) => {
      const socket = get().socket;
      if (!socket) return;
      set((s) => ({
        library: s.library.map((i) => (i.id === id ? { ...i, ...patch } : i)),
      }));
      throttled(`lib:${id}`, 200, () => socket.emit('library:update', { id, patch }));
    },

    removeLibraryItem: (id) => {
      get().socket?.emit('library:remove', id);
    },

    updateGrid: (patch) => {
      const socket = get().socket;
      if (!socket) return;
      set((s) => {
        const size = patch.size ?? s.scene.grid.size;
        const grid = { ...s.scene.grid, ...patch };
        return {
          scene: {
            ...s.scene,
            grid,
            maps: s.scene.maps.map((m) => ({
              ...m,
              tokens: m.tokens.map((t) => {
                const resized = { ...t, w: t.cells * size, h: t.cells * size };
                if (grid.snap) {
                  resized.x = snapToGrid(t.x, grid.offsetX, size, t.cells);
                  resized.y = snapToGrid(t.y, grid.offsetY, size, t.cells);
                }
                return resized;
              }),
            })),
          },
        };
      });
      throttled('grid', 150, () => socket.emit('grid:update', get().scene.grid));
    },

    addTokenAt: (libraryItemId, x, y) => {
      const mapId = viewMapId();
      if (!mapId) return;
      get().socket?.emit('token:add', { mapId, libraryItemId, x, y });
    },

    removeToken: (id) => {
      const mapId = viewMapId();
      if (!mapId) return;
      get().socket?.emit('token:remove', { mapId, id });
    },

    moveToken: (id, x, y) => {
      const socket = get().socket;
      const mapId = viewMapId();
      if (!socket || !mapId) return;
      patchTokenInMap(mapId, id, { x, y });
      throttled(`move:${id}`, 66, () => socket.emit('token:move', { mapId, id, x, y }));
    },

    finalizeTokenMove: (id, x, y) => {
      const socket = get().socket;
      const mapId = viewMapId();
      if (!socket || !mapId) return;
      patchTokenInMap(mapId, id, { x, y });
      socket.emit('token:move', { mapId, id, x, y });
      socket.emit('token:lock', { mapId, id, lock: false });
    },

    lockToken: (id, lock) => {
      const mapId = viewMapId();
      if (!mapId) return;
      get().socket?.emit('token:lock', { mapId, id, lock });
    },

    setTokenFields: (id, patch) => {
      const socket = get().socket;
      const mapId = viewMapId();
      if (!socket || !mapId) return;
      const local: Partial<Token> = { ...patch };
      if (typeof patch.cells === 'number') {
        const clamped = clampCells(patch.cells);
        const size = get().scene.grid.size;
        local.cells = clamped;
        local.w = clamped * size;
        local.h = clamped * size;
      }
      patchTokenInMap(mapId, id, local);
      socket.emit('token:update', { mapId, id, patch: local });
    },

    setView: (view) => set({ view }),
    setViewport: (viewport) => set({ viewport }),
    setSelected: (selectedTokenId) => set({ selectedTokenId }),
    setDragging: (draggingTokenId) => set({ draggingTokenId }),
    setGridModalOpen: (gridModalOpen) => set({ gridModalOpen }),
    setTokenMenu: (tokenMenuId) => set({ tokenMenuId }),

    setFogMode: (patch) => set((s) => ({ fogMode: { ...s.fogMode, ...patch } })),

    updateFog: (mapId, fog) => {
      const socket = get().socket;
      if (!socket) return;
      set((s) => {
        const idx = s.scene.maps.findIndex((m) => m.id === mapId);
        if (idx < 0) return s;
        const maps = [...s.scene.maps];
        maps[idx] = { ...maps[idx], fog };
        return { scene: { ...s.scene, maps } };
      });
      throttled(`fog:${mapId}`, 120, () => {
        const latest = get().scene.maps.find((m) => m.id === mapId)?.fog;
        if (latest) socket.emit('fog:update', { mapId, fog: latest });
      });
    },

    startCombat: () => {
      const mapId = get().viewMapId;
      if (!mapId) return;
      get().socket?.emit('combat:start', { mapId });
    },

    endCombat: () => {
      const mapId = get().viewMapId;
      if (!mapId) return;
      get().socket?.emit('combat:end', { mapId });
    },

    addCombatant: (tokenId) => {
      const mapId = get().viewMapId;
      if (!mapId) return;
      get().socket?.emit('combat:add', { mapId, tokenId });
    },

    addMapCombatants: () => {
      const mapId = get().viewMapId;
      if (!mapId) return;
      get().socket?.emit('combat:addMap', { mapId });
    },

    removeCombatant: (id) => {
      const mapId = get().viewMapId;
      if (!mapId) return;
      get().socket?.emit('combat:remove', { mapId, id });
    },

    updateCombatant: (id, patch) => {
      const mapId = get().viewMapId;
      if (!mapId) return;
      get().socket?.emit('combat:update', { mapId, id, patch });
    },

    moveCombatant: (id, toIndex) => {
      const mapId = get().viewMapId;
      if (!mapId) return;
      get().socket?.emit('combat:move', { mapId, id, toIndex });
    },

    rollInitiative: (id) => {
      const mapId = get().viewMapId;
      if (!mapId) return;
      get().socket?.emit('combat:roll', id ? { mapId, id } : { mapId });
    },

    clearCombat: () => {
      const mapId = get().viewMapId;
      if (!mapId) return;
      get().socket?.emit('combat:clear', { mapId });
    },

    setHoverToken: (hoverTokenId) => set({ hoverTokenId }),

    fitView: () => {
      const { scene, viewport } = get();
      const map = scene.maps.find((m) => m.id === get().viewMapId);
      if (!map || viewport.w === 0 || viewport.h === 0) return;
      const scale = Math.min(
        8,
        Math.max(0.05, Math.min(viewport.w / map.width, viewport.h / map.height) * 0.95)
      );
      const x = (viewport.w - map.width * scale) / 2;
      const y = (viewport.h - map.height * scale) / 2;
      set({ view: { x, y, scale } });
    },
  };
});

if (typeof window !== 'undefined') {
  (window as unknown as { __vtt: typeof useGameStore }).__vtt = useGameStore;
}
