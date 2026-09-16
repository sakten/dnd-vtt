import {
  clampCells,
  type Token,
} from 'shared';
import { patchCombatTurn, patchToken, removeTokenById, replaceToken, upsertToken } from '../../domain/scene';
import { emitInMap } from '../helpers';
import { activeMapOf, tokenById } from '../selectors';
import { clearTokenUiFor } from '../uiReset';
import type { GameState, Slice } from '../types';

export const createTokenSlice: Slice<Pick<GameState, 'onTokenAdd' | 'onTokenUpdate' | 'onTokenRemove' | 'onTokenMove' | 'addTokenAt' | 'removeToken' | 'moveToken' | 'moveTokenAlongPath' | 'clearMoving' | 'setDragGhost' | 'setDragPath' | 'lockToken' | 'setTokenFields' | 'setSelected' | 'setDragging' | 'setTokenMenu' | 'setHoverToken'>> = (set, get) => {
  const viewMapId = () => get().viewMapId;

  const patchTokenInMap = (mapId: string, id: string, patch: Partial<Token>) =>
    set((s) => ({ scene: patchToken(s.scene, mapId, id, patch) }));

  return {
    onTokenAdd: ({ mapId, token }) => set((s) => ({ scene: upsertToken(s.scene, mapId, token) })),

    onTokenUpdate: ({ mapId, token }) =>
      set((s) => (s.draggingTokenId === token.id ? s : { scene: replaceToken(s.scene, mapId, token) })),

    onTokenRemove: ({ mapId, id }) => {
      set((s) => ({
        ...clearTokenUiFor(s, id),
        scene: removeTokenById(s.scene, mapId, id),
      }));
    },

    addTokenAt: (libraryItemId, x, y) => {
      emitInMap(get, 'token:add', { libraryItemId, x, y });
    },

    removeToken: (id) => {
      emitInMap(get, 'token:remove', { id });
    },

    moveToken: (id, x, y) => {
      const state = get();
      const mapId = state.viewMapId;
      if (!state.socket || !mapId) return;
      patchTokenInMap(mapId, id, { x, y });
    },

    moveTokenAlongPath: (id, path) => {
      const state = get();
      const mapId = state.viewMapId;
      const map = activeMapOf(state);
      if (!state.socket || !mapId || !map || path.points.length === 0) return;
      const token = tokenById(map, id);
      if (!token) return;
      const final = path.points[path.points.length - 1]!;
      const moving = { points: path.points, duration: Math.min(1500, (path.points.length - 1) * 150) };

      const entry =
        map.combat.active && map.combat.currentIndex >= 0 ? map.combat.entries[map.combat.currentIndex] : undefined;
      const turn = entry ? map.combat.turns[entry.id] : undefined;
      let used: number | undefined;
      if (entry?.tokenId === id && turn) {
        used = turn.movementUsed + path.feet;
        set((s) => ({
          scene: patchCombatTurn(s.scene, mapId, entry.id, { movementUsed: used!, diagonalsUsed: path.diagonals }),
        }));
      }

      set((s) => ({
        scene: patchToken(s.scene, mapId, id, { x: final.x, y: final.y }),
        ...(path.points.length > 1 ? { movingTokens: { ...s.movingTokens, [id]: moving } } : {}),
        dragGhost: null,
        dragPath: null,
      }));
      emitInMap(get, 'token:move', { id, x: final.x, y: final.y, path: path.points });
      emitInMap(get, 'token:lock', { id, lock: false });
      if (used !== undefined) {
        emitInMap(get, 'combat:setMovement', {
          tokenId: id,
          used,
          diagonals: path.diagonals,
          path: path.points,
        });
      }
    },

    clearMoving: (id) =>
      set((s) => {
        if (!s.movingTokens[id]) return s;
        const movingTokens = { ...s.movingTokens };
        delete movingTokens[id];
        return { movingTokens };
      }),

    setDragGhost: (dragGhost) => set({ dragGhost }),

    setDragPath: (dragPath) => set({ dragPath }),

    onTokenMove: ({ id, path }) => {
      if (get().movingTokens[id]) return;
      if (!Array.isArray(path) || path.length < 2) return;
      set((s) => ({
        movingTokens: {
          ...s.movingTokens,
          [id]: { points: path, duration: Math.min(1500, (path.length - 1) * 150) },
        },
      }));
    },

    lockToken: (id, lock) => {
      emitInMap(get, 'token:lock', { id, lock });
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
      emitInMap(get, 'token:update', { id, patch: local });
    },

    setSelected: (selectedTokenId) => set({ selectedTokenId }),
    setDragging: (draggingTokenId) => set({ draggingTokenId }),

    setTokenMenu: (tokenMenuId) => set({ tokenMenuId }),

    setHoverToken: (hoverTokenId) => set({ hoverTokenId }),
  };
};
