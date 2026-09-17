import { t } from '../../i18n';
import { emit } from '../helpers';
import { beginOptimistic, settleOptimistic } from '../optimistic';
import type { GameState, Slice } from '../types';

export const createSheetSlice: Slice<Pick<GameState, 'onSheetUpdate' | 'onResourcesUpdate' | 'onCharacterUpdate' | 'setSheet' | 'updateResources' | 'rest' | 'setCurrentCharacter' | 'rollHitDie' | 'rollDeathSave'>> = (set, get) => {
  return {
    onSheetUpdate: ({ sheet }) => set({ sheet }),
    onResourcesUpdate: (resources) => {
      settleOptimistic('resources:update');
      set({ resources });
    },

    onCharacterUpdate: ({ playerId, libraryItemId }) => {
      if (playerId === get().selfId) set({ currentCharacterId: libraryItemId });
    },

    setSheet: (sheet) => {
      emit(get, 'sheet:update', sheet);
    },

    updateResources: (resources) => {
      const prev = get().resources;
      set({ resources });
      if (prev) {
        beginOptimistic(
          get,
          'resources:update',
          () => set({ resources: prev }),
          t('ui.store.resourcesRevert')
        );
      }
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
