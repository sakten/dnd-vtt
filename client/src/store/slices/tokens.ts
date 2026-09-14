import {
  clampCells,
  movementCost,
  type Token,
} from 'shared';
import { patchCombatTurn, patchToken, removeTokenById, replaceToken, upsertToken } from '../../domain/scene';
import { clearThrottled, throttled } from '../helpers';
import type { GameState, Slice } from '../types';

const clearTokenRefs = (s: GameState, id: string) => ({
  selectedTokenId: s.selectedTokenId === id ? null : s.selectedTokenId,
  targeting: s.targeting?.tokenId === id ? null : s.targeting,
  aim: s.aim?.tokenId === id ? null : s.aim,
  multiTarget: s.multiTarget?.tokenId === id ? null : s.multiTarget,
  hoverTokenId: s.hoverTokenId === id ? null : s.hoverTokenId,
  draggingTokenId: s.draggingTokenId === id ? null : s.draggingTokenId,
  tokenMenuId: s.tokenMenuId === id ? null : s.tokenMenuId,
});

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
      const token = get().scene.maps.find((m) => m.id === mapId)?.tokens.find((t) => t.id === id);
      if (token) {
        const list = movePaths.get(id) ?? [{ x: token.x, y: token.y }];
        const last = list[list.length - 1];
        if (!last || last.x !== x || last.y !== y) list.push({ x, y });
        movePaths.set(id, list.slice(0, 400));
      }
      accountMovement(mapId, id, x, y);
      patchTokenInMap(mapId, id, { x, y });
      throttled(`move:${id}`, 66, () => socket.emit('token:move', { mapId, id, x, y }));
    },

    finalizeTokenMove: (id, x, y) => {
      const socket = get().socket;
      const mapId = viewMapId();
      if (!socket || !mapId) return;
      clearThrottled(`move:${id}`);
      const token = get().scene.maps.find((m) => m.id === mapId)?.tokens.find((t) => t.id === id);
      if (token) {
        const list = movePaths.get(id) ?? [{ x: token.x, y: token.y }];
        const last = list[list.length - 1];
        if (!last || last.x !== x || last.y !== y) list.push({ x, y });
        movePaths.set(id, list.slice(0, 400));
      }
      accountMovement(mapId, id, x, y);
      patchTokenInMap(mapId, id, { x, y });
      socket.emit('token:move', { mapId, id, x, y });
      socket.emit('token:lock', { mapId, id, lock: false });
      const moved = reportMovement(mapId, id);
      if (moved) {
        const path = movePaths.get(id);
        socket.emit('combat:setMovement', {
          mapId,
          tokenId: id,
          used: moved.used,
          diagonals: moved.diagonals,
          path: path && path.length > 1 ? path : undefined,
        });
      }
      movePaths.delete(id);
    },

    lockToken: (id, lock) => {
      const mapId = viewMapId();
      if (!mapId) return;
      if (lock) movePaths.delete(id);
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
    setDragging: (draggingTokenId) => set({ draggingTokenId }),

    setTokenMenu: (tokenMenuId) => set({ tokenMenuId }),

    setHoverToken: (hoverTokenId) => set({ hoverTokenId }),
  };
};
