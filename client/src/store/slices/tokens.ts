import {
  clampCells,
  type Token,
} from 'shared';
import { patchToken, removeTokenById, replaceToken, upsertToken } from '../../domain/scene';
import { clearThrottled, throttled } from '../helpers';
import type { GameState, Slice } from '../types';

const clearTokenRefs = (s: GameState, id: string) => ({
  selectedTokenId: s.selectedTokenId === id ? null : s.selectedTokenId,
  targetTokenId: s.targetTokenId === id ? null : s.targetTokenId,
  measureFromId: s.measureFromId === id ? null : s.measureFromId,
  hoverTokenId: s.hoverTokenId === id ? null : s.hoverTokenId,
  draggingTokenId: s.draggingTokenId === id ? null : s.draggingTokenId,
  tokenMenuId: s.tokenMenuId === id ? null : s.tokenMenuId,
});

export const createTokenSlice: Slice<Pick<GameState, 'onTokenAdd' | 'onTokenUpdate' | 'onTokenRemove' | 'addTokenAt' | 'removeToken' | 'moveToken' | 'finalizeTokenMove' | 'lockToken' | 'setTokenFields' | 'setSelected' | 'setTargetToken' | 'setMeasureFrom' | 'setDragging' | 'setTokenMenu' | 'setHoverToken'>> = (set, get) => {
  const viewMapId = () => get().viewMapId;

  const patchTokenInMap = (mapId: string, id: string, patch: Partial<Token>) =>
    set((s) => ({ scene: patchToken(s.scene, mapId, id, patch) }));

  return {
    onTokenAdd: ({ mapId, token }) => set((s) => ({ scene: upsertToken(s.scene, mapId, token) })),

    onTokenUpdate: ({ mapId, token }) =>
      set((s) => (s.draggingTokenId === token.id ? s : { scene: replaceToken(s.scene, mapId, token) })),

    onTokenRemove: ({ mapId, id }) => {
      clearThrottled(`move:${id}`);
      set((s) => ({
        ...clearTokenRefs(s, id),
        scene: removeTokenById(s.scene, mapId, id),
      }));
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
      clearThrottled(`move:${id}`);
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

    setSelected: (selectedTokenId) => set({ selectedTokenId }),
    setTargetToken: (targetTokenId) => set({ targetTokenId }),
    setMeasureFrom: (measureFromId) => set({ measureFromId }),
    setDragging: (draggingTokenId) => set({ draggingTokenId }),

    setTokenMenu: (tokenMenuId) => set({ tokenMenuId }),

    setHoverToken: (hoverTokenId) => set({ hoverTokenId }),
  };
};
