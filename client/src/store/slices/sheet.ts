import { emit } from '../helpers';
import type { GameState, Slice } from '../types';

export const createSheetSlice: Slice<Pick<GameState, 'onSheetUpdate' | 'onResourcesUpdate' | 'onCharacterUpdate' | 'setSheet' | 'updateResources' | 'rest' | 'setCurrentCharacter' | 'rollHitDie' | 'rollDeathSave'>> = (set, get) => {
  return {
    onSheetUpdate: ({ sheet }) => set({ sheet }),
    onResourcesUpdate: (resources) => set({ resources }),

    onCharacterUpdate: ({ playerId, libraryItemId }) => {
      if (playerId === get().selfId) set({ currentCharacterId: libraryItemId });
    },

    setSheet: (sheet) => {
      emit(get, 'sheet:update', sheet);
    },

    updateResources: (resources) => {
      set({ resources });
      emit(get, 'resources:update', resources);
    },

    rest: (type) => {
      emit(get, 'resources:rest', { type });
    },

    setCurrentCharacter: (libraryItemId) => {
      const socket = get().socket;
      if (!socket) return;
      socket.emit('player:setCharacter', { libraryItemId }, (res) => {
        if ('error' in res) window.alert(res.error);
      });
    },

    rollHitDie: (die) => {
      emit(get, 'resources:hitDie', { die });
    },

    rollDeathSave: (expression) => {
      emit(get, 'resources:deathSave', { expression });
    },

  };
};
