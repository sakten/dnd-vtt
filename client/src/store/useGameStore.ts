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
import { createRollAnimSlice } from './slices/rollAnim';
import { createRollModeSlice } from './slices/rollMode';
import { createFxSlice } from './slices/fx';
import { createSettingsSlice } from './slices/settings';

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
  ...createRollAnimSlice(set, get),
  ...createRollModeSlice(set, get),
  ...createFxSlice(set, get),
  ...createSettingsSlice(set, get),
    socket: null,
    socketDispose: null,
    connected: false,
    connectError: false,
    selfId: null,
    roomCode: null,
    roomName: null,
    role: 'player',
    testMode: false,
    optionalRules: { surrounded: false },
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
    visionModalOpen: false,
    bestiaryOpen: false,
    sheetOpen: false,
    roomSettingsOpen: false,
    optionalRulesOpen: false,
    tokenMenuId: null,
    doorMenuId: null,
    fogMode: { active: false, tool: 'brush', action: 'hide', brush: 2 },
    wallsMode: { active: false, tool: 'wall', start: null },
    lightMode: { active: false, kind: 'darkness' },
    wallCandidates: null,
    movingTokens: {},
    dragGhost: null,
    dragPath: null,
    critHit: null,
    reactionOffer: null,
    rollAnim: null,
    rollMode: null,
    fxQueue: [],
}));

if (typeof window !== 'undefined') {
  (window as unknown as { __vtt: typeof useGameStore }).__vtt = useGameStore;
}
