import { create } from 'zustand';
import { DEFAULT_GRID } from 'shared';
import type { GameState } from './types';
import { createRoomSlice } from './slices/room';
import { createMapSlice } from './slices/maps';
import { createLibrarySlice } from './slices/library';
import { createCombatSlice } from './slices/combat';
import { createActionSlice } from './slices/actions';
import { createTokenSlice } from './slices/tokens';
import { createChatSlice } from './slices/chat';
import { createSheetSlice } from './slices/sheet';
import { createViewSlice } from './slices/view';
import { createReactionSlice } from './slices/reactions';

export const useGameStore = create<GameState>()((set, get) => ({
  ...createRoomSlice(set, get),
  ...createMapSlice(set, get),
  ...createLibrarySlice(set, get),
  ...createCombatSlice(set, get),
  ...createActionSlice(set, get),
  ...createTokenSlice(set, get),
  ...createChatSlice(set, get),
  ...createSheetSlice(set, get),
  ...createViewSlice(set, get),
  ...createReactionSlice(set, get),
    socket: null,
    connected: false,
    connectError: false,
    selfId: null,
    roomCode: null,
    roomName: null,
    role: 'player',
    testMode: false,
    players: [],
    scene: { maps: [], activeMapId: null, grid: { ...DEFAULT_GRID } },
    viewMapId: null,
    library: [],
    sheet: null,
    resources: null,
    currentCharacterId: null,
    chat: [],
    chatError: null,
    joinError: null,
    interaction: null,
    selectedTokenId: null,
    hoverTokenId: null,
    draggingTokenId: null,
    view: { x: 0, y: 0, scale: 1 },
    viewport: { w: 0, h: 0 },
    gridModalOpen: false,
    roomSettingsOpen: false,
    tokenMenuId: null,
    fogMode: { active: false, tool: 'brush', action: 'hide', brush: 2 },
    wallsMode: { active: false, tool: 'wall' },
    critHit: null,
    reactionOffers: [],
}));

if (typeof window !== 'undefined') {
  (window as unknown as { __vtt: typeof useGameStore }).__vtt = useGameStore;
}
