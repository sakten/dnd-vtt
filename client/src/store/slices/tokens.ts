import { clampCells, movementCost, type Token } from 'shared';
import { patchCombatTurn, patchToken, removeTokenById, replaceToken, upsertToken } from '../../domain/scene';
import { emitInMap } from '../helpers';
import { newId } from '../../lib/id';
import { activeMapOf, tokenById } from '../selectors';
import { clearTokenUiFor } from '../uiReset';
import type { GameState, MovingToken, Slice } from '../types';

export const createTokenSlice: Slice<Pick<GameState, 'onTokenAdd' | 'onTokenUpdate' | 'onTokenRemove' | 'onTokenWalk' | 'addTokenAt' | 'removeToken' | 'moveToken' | 'startTokenWalk' | 'finishTokenWalk' | 'stepTokenWalk' | 'clearMoving' | 'setDragGhost' | 'setDragPath' | 'lockToken' | 'setTokenFields' | 'setSelected' | 'setDragging' | 'setTokenMenu' | 'setHoverToken'>> = (set, get) => {
  const viewMapId = () => get().viewMapId;

  const patchTokenInMap = (mapId: string, id: string, patch: Partial<Token>) =>
    set((s) => ({ scene: patchToken(s.scene, mapId, id, patch) }));

  /** Свои начатые походы: по moveId игнорируем собственное эхо token:walk. */
  const ownWalks = new Map<string, number>();

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

    startTokenWalk: (id, path) => {
      const state = get();
      const mapId = state.viewMapId;
      const map = activeMapOf(state);
      if (!state.socket || !mapId || !map || path.points.length === 0) return;
      const token = tokenById(map, id);
      if (!token) return;
      if (path.points.length < 2) {
        const only = path.points[0]!;
        set((s) => ({
          scene: patchToken(s.scene, mapId, id, { x: only.x, y: only.y }),
          dragGhost: null,
          dragPath: null,
        }));
        emitInMap(get, 'token:move', { id, x: only.x, y: only.y });
        emitInMap(get, 'token:lock', { id, lock: false });
        return;
      }
      const entry =
        map.combat.active && map.combat.currentIndex >= 0 ? map.combat.entries[map.combat.currentIndex] : undefined;
      const turn = entry?.tokenId === id ? map.combat.turns[entry.id] : undefined;
      const moving: MovingToken = {
        points: path.points,
        duration: Math.min(1500, Math.max(150, (path.points.length - 1) * 150)),
        own: true,
        diagonalsBefore: turn?.diagonalsUsed ?? 0,
      };
      set((s) => ({
        movingTokens: { ...s.movingTokens, [id]: moving },
        dragGhost: null,
        dragPath: null,
      }));
      const moveId = newId();
      ownWalks.set(moveId, Date.now());
      emitInMap(get, 'token:walk', { id, path: path.points, moveId });
    },

    finishTokenWalk: (id, walked) => {
      const state = get();
      const moving = state.movingTokens[id];
      if (!moving) return;
      const mapId = state.viewMapId;
      const map = activeMapOf(state);
      const points = walked.length > 0 ? walked : moving.points;
      const last = points[points.length - 1] ?? moving.points[moving.points.length - 1]!;
      if (!mapId || !map || !moving.own) {
        set((s) => {
          const movingTokens = { ...s.movingTokens };
          delete movingTokens[id];
          return { movingTokens };
        });
        return;
      }
      const size = state.scene.grid.size || 50;
      let feet = 0;
      let diagonals = moving.diagonalsBefore;
      for (let i = 1; i < points.length; i++) {
        const step = movementCost(points[i - 1]!, points[i]!, size, diagonals);
        feet += step.feet;
        diagonals = step.diagonals;
      }
      const entry =
        map.combat.active && map.combat.currentIndex >= 0 ? map.combat.entries[map.combat.currentIndex] : undefined;
      const turn = entry ? map.combat.turns[entry.id] : undefined;
      const used = entry?.tokenId === id && turn ? turn.movementUsed + feet : undefined;
      set((s) => {
        const movingTokens = { ...s.movingTokens };
        delete movingTokens[id];
        let scene = patchToken(s.scene, mapId, id, { x: last.x, y: last.y });
        if (entry?.tokenId === id && turn) {
          scene = patchCombatTurn(scene, mapId, entry.id, { movementUsed: used!, diagonalsUsed: diagonals });
        }
        return { scene, movingTokens };
      });
      emitInMap(get, 'token:move', { id, x: last.x, y: last.y });
      emitInMap(get, 'token:lock', { id, lock: false });
      if (used !== undefined) {
        emitInMap(get, 'combat:setMovement', { tokenId: id, used, diagonals, path: points });
      }
    },

    stepTokenWalk: (id, x, y) => {
      const state = get();
      if (!state.socket || !state.viewMapId) return;
      emitInMap(get, 'token:step', { id, x, y });
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

    onTokenWalk: ({ id, path, moveId }) => {
      if (moveId && ownWalks.delete(moveId)) return;
      if (!Array.isArray(path) || path.length < 2) return;
      // Новый поход того же токена заменяет текущий (иначе наблюдатели разъедутся).
      set((s) => ({
        movingTokens: {
          ...s.movingTokens,
          [id]: {
            points: path,
            duration: Math.min(1500, Math.max(150, (path.length - 1) * 150)),
            own: false,
            diagonalsBefore: 0,
          },
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
