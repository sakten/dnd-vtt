import { emit, emitThrottled } from '../helpers';
import type { GameState, Slice } from '../types';

export const createLibrarySlice: Slice<Pick<GameState, 'onLibraryUpdate' | 'addLibraryItem' | 'updateLibraryItem' | 'removeLibraryItem'>> = (set, get) => {
  return {
    onLibraryUpdate: (library) => set({ library }),

    addLibraryItem: (fields) => {
      emit(get, 'library:add', fields);
    },

    updateLibraryItem: (id, patch) => {
      if (!get().socket) return;
      set((s) => ({
        library: s.library.map((i) => (i.id === id ? { ...i, ...patch } : i)),
      }));
      emitThrottled(get, `lib:${id}`, 200, 'library:update', () => {
        const item = get().library.find((i) => i.id === id);
        return item ? { id, patch: item } : undefined;
      });
    },

    removeLibraryItem: (id) => {
      emit(get, 'library:remove', id);
    },
  };
};
