import type { GameState, Slice } from '../types';

export const createSheetSlice: Slice<Pick<GameState, 'onSheetUpdate' | 'onResourcesUpdate' | 'onCharacterUpdate' | 'setSheet' | 'updateResources' | 'setCurrentCharacter' | 'rollHitDie' | 'rollDeathSave'>> = (set, get) => {
  return {
    onSheetUpdate: ({ sheet }) => set({ sheet }),
    onResourcesUpdate: (resources) => set({ resources }),

    onCharacterUpdate: ({ playerId, libraryItemId }) => {
      if (playerId === get().selfId) set({ currentCharacterId: libraryItemId });
    },

    setSheet: (sheet) => {
      get().socket?.emit('sheet:update', sheet);
    },

    updateResources: (resources) => {
      set({ resources });
      get().socket?.emit('resources:update', resources);
    },

    setCurrentCharacter: (libraryItemId) => {
      const socket = get().socket;
      if (!socket) return;
      socket.emit('player:setCharacter', { libraryItemId }, (res) => {
        if ('error' in res) window.alert(res.error);
      });
    },

    rollHitDie: (die) => {
      get().socket?.emit('resources:hitDie', { die });
    },

    rollDeathSave: (expression) => {
      get().socket?.emit('resources:deathSave', { expression });
    },

  };
};
