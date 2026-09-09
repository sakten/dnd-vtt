import { create } from 'zustand';
import {
  parseDiceExpression,
  snapToGrid,
  type CharacterSheet,
  type ChatMessage,
  type FogState,
  type GridSettings,
  type LibraryItem,
  type Player,
  type Role,
  type Scene,
  type Token,
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

const DEFAULT_GRID: GridSettings = {
  size: 50,
  color: '#ffffff',
  opacity: 0.35,
  visible: true,
  offsetX: 0,
  offsetY: 0,
  snap: true,
};

interface GameState {
  socket: AppSocket | null;
  connected: boolean;
  selfId: string | null;
  roomCode: string | null;
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
  draggingTokenId: string | null;
  view: ViewState;
  viewport: { w: number; h: number };
  gridModalOpen: boolean;
  tokenMenuId: string | null;
  fogMode: FogMode;

  init: () => void;
  createRoom: (name: string, adminToken?: string) => void;
  joinRoom: (code: string, name: string) => void;
  sendChat: (text: string) => void;
  rollDice: (expression: string, label?: string) => void;
  setSheet: (sheet: CharacterSheet) => void;
  addMap: (name: string, url: string, width: number, height: number) => void;
  removeMap: (id: string) => void;
  renameMap: (id: string, name: string) => void;
  switchMap: (id: string) => void;
  bringMap: (id: string) => void;
  addLibraryItem: (name: string, url: string, cells: number, round: boolean, description: string) => void;
  updateLibraryItem: (id: string, patch: Partial<LibraryItem>) => void;
  removeLibraryItem: (id: string) => void;
  updateGrid: (patch: Partial<GridSettings>) => void;
  addTokenAt: (
    name: string,
    imageUrl: string,
    x: number,
    y: number,
    cells: number,
    round: boolean,
    description: string
  ) => void;
  removeToken: (id: string) => void;
  moveToken: (id: string, x: number, y: number) => void;
  finalizeTokenMove: (id: string, x: number, y: number) => void;
  lockToken: (id: string, lock: boolean) => void;
  setTokenCells: (id: string, cells: number) => void;
  setTokenName: (id: string, name: string) => void;
  setTokenDescription: (id: string, description: string) => void;
  setTokenRound: (id: string, round: boolean) => void;
  setView: (view: ViewState) => void;
  setViewport: (v: { w: number; h: number }) => void;
  setSelected: (id: string | null) => void;
  setDragging: (id: string | null) => void;
  setGridModalOpen: (open: boolean) => void;
  setTokenMenu: (id: string | null) => void;
  setFogMode: (patch: Partial<FogMode>) => void;
  updateFog: (mapId: string, fog: FogState) => void;
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

  const clearTokenUi = () => set({ selectedTokenId: null, tokenMenuId: null, draggingTokenId: null });

  return {
    socket: null,
    connected: false,
    selfId: null,
    roomCode: null,
    role: 'player',
    players: [],
    scene: { maps: [], activeMapId: null, grid: DEFAULT_GRID },
    viewMapId: null,
    library: [],
    sheet: null,
    chat: [],
    chatError: null,
    joinError: null,
    selectedTokenId: null,
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
        set((s) => ({ viewMapId: activeMapId, selectedTokenId: null, tokenMenuId: null, draggingTokenId: null }));
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
          joinError: 'Комната удалена ведущим',
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

    createRoom: (name, adminToken) => {
      const socket = get().socket;
      if (!socket) return;
      const playerId = localStorage.getItem('vtt-player') ?? crypto.randomUUID();
      localStorage.setItem('vtt-player', playerId);
      socket.emit('room:create', { name, clientId: playerId, adminToken }, (res) => {
        if ('error' in res) set({ joinError: res.error });
        else if (adminToken) localStorage.setItem('vtt-admin', adminToken);
      });
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

    addLibraryItem: (name, url, cells, round, description) => {
      get().socket?.emit('library:add', { name, url, cells, round, description });
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

    addTokenAt: (name, imageUrl, x, y, cells, round, description) => {
      const mapId = viewMapId();
      if (!mapId) return;
      get().socket?.emit('token:add', { mapId, name, imageUrl, x, y, cells, round, description });
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

    setTokenCells: (id, cells) => {
      const socket = get().socket;
      const mapId = viewMapId();
      if (!socket || !mapId) return;
      const clamped = Math.min(4, Math.max(1, Math.round(cells)));
      const size = get().scene.grid.size;
      patchTokenInMap(mapId, id, { cells: clamped, w: clamped * size, h: clamped * size });
      socket.emit('token:update', { mapId, id, patch: { cells: clamped } });
    },

    setTokenName: (id, name) => {
      const socket = get().socket;
      const mapId = viewMapId();
      if (!socket || !mapId) return;
      patchTokenInMap(mapId, id, { name });
      socket.emit('token:update', { mapId, id, patch: { name } });
    },

    setTokenDescription: (id, description) => {
      const socket = get().socket;
      const mapId = viewMapId();
      if (!socket || !mapId) return;
      patchTokenInMap(mapId, id, { description });
      socket.emit('token:update', { mapId, id, patch: { description } });
    },

    setTokenRound: (id, round) => {
      const socket = get().socket;
      const mapId = viewMapId();
      if (!socket || !mapId) return;
      patchTokenInMap(mapId, id, { round });
      socket.emit('token:update', { mapId, id, patch: { round } });
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
