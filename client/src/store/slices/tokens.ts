import {
  clampCells,
  movementCost,
  type Token,
} from 'shared';
import { patchCombatTurn, patchToken, removeTokenById, replaceToken, upsertToken } from '../../domain/scene';
import { clearThrottled, emitInMap, emitThrottledInMap } from '../helpers';
import { activeMapOf, tokenById } from '../selectors';
import { clearTokenUiFor } from '../uiReset';
import type { GameState, Slice } from '../types';

export const createTokenSlice: Slice<Pick<GameState, 'onTokenAdd' | 'onTokenUpdate' | 'onTokenRemove' | 'addTokenAt' | 'removeToken' | 'moveToken' | 'finalizeTokenMove' | 'lockToken' | 'setTokenFields' | 'setSelected' | 'setDragging' | 'setTokenMenu' | 'setHoverToken'>> = (set, get) => {
  const viewMapId = () => get().viewMapId;

  // Ломаная пути текущего перетаскивания — для атак по возможности.
  const movePaths = new Map<string, { x: number; y: number }[]>();

  const patchTokenInMap = (mapId: string, id: string, patch: Partial<Token>) =>
    set((s) => ({ scene: patchToken(s.scene, mapId, id, patch) }));

  // Учёт передвижения активного бойца при drag (сумма сегментов по сетке).
  const accountMovement = (mapId: string, id: string, x: number, y: number) => {
    const map = get().scene.maps.find((m) => m.id === mapId);
    if (!map || !map.combat.active || map.combat.currentIndex < 0) return;
    const token = map.tokens.find((t) => t.id === id);
    const entry = map.combat.entries[map.combat.currentIndex];
    const turn = entry ? map.combat.turns[entry.id] : undefined;
    if (!token || entry?.tokenId !== id || !turn) return;
    const { feet, diagonals } = movementCost(
      { x: token.x, y: token.y },
      { x, y },
      get().scene.grid.size || 50,
      turn.diagonalsUsed
    );
    if (feet <= 0) return;
    set((s) => ({
      scene: patchCombatTurn(s.scene, mapId, entry.id, {
        movementUsed: turn.movementUsed + feet,
        diagonalsUsed: diagonals,
      }),
    }));
  };

  const reportMovement = (mapId: string, id: string) => {
    const map = get().scene.maps.find((m) => m.id === mapId);
    if (!map || !map.combat.active || map.combat.currentIndex < 0) return undefined;
    const entry = map.combat.entries[map.combat.currentIndex];
    const turn = entry ? map.combat.turns[entry.id] : undefined;
    if (entry?.tokenId !== id || !turn) return undefined;
    return { used: turn.movementUsed, diagonals: turn.diagonalsUsed };
  };

  return {
    onTokenAdd: ({ mapId, token }) => set((s) => ({ scene: upsertToken(s.scene, mapId, token) })),

    onTokenUpdate: ({ mapId, token }) =>
      set((s) => (s.draggingTokenId === token.id ? s : { scene: replaceToken(s.scene, mapId, token) })),

    onTokenRemove: ({ mapId, id }) => {
      clearThrottled(`move:${id}`);
      movePaths.delete(id);
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
      const token = tokenById(activeMapOf(state), id);
      if (token) {
        const list = movePaths.get(id) ?? [{ x: token.x, y: token.y }];
        const last = list[list.length - 1];
        if (!last || last.x !== x || last.y !== y) list.push({ x, y });
        movePaths.set(id, list.slice(0, 400));
      }
      accountMovement(mapId, id, x, y);
      patchTokenInMap(mapId, id, { x, y });
      emitThrottledInMap(get, `move:${id}`, 66, 'token:move', () => ({ id, x, y }));
    },

    finalizeTokenMove: (id, x, y) => {
      const state = get();
      const mapId = state.viewMapId;
      if (!state.socket || !mapId) return;
      clearThrottled(`move:${id}`);
      const token = tokenById(activeMapOf(state), id);
      if (token) {
        const list = movePaths.get(id) ?? [{ x: token.x, y: token.y }];
        const last = list[list.length - 1];
        if (!last || last.x !== x || last.y !== y) list.push({ x, y });
        movePaths.set(id, list.slice(0, 400));
      }
      accountMovement(mapId, id, x, y);
      patchTokenInMap(mapId, id, { x, y });
      emitInMap(get, 'token:move', { id, x, y });
      emitInMap(get, 'token:lock', { id, lock: false });
      const moved = reportMovement(mapId, id);
      if (moved) {
        const path = movePaths.get(id);
        emitInMap(get, 'combat:setMovement', {
          tokenId: id,
          used: moved.used,
          diagonals: moved.diagonals,
          path: path && path.length > 1 ? path : undefined,
        });
      }
      movePaths.delete(id);
    },

    lockToken: (id, lock) => {
      if (lock) movePaths.delete(id);
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
