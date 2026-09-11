import { throttled } from '../helpers';
import type { GameState, Slice } from '../types';

export const createLibrarySlice: Slice<Pick<GameState, 'onLibraryUpdate' | 'addLibraryItem' | 'updateLibraryItem' | 'removeLibraryItem'>> = (set, get) => {
  return {
    onLibraryUpdate: (library) => set({ library }),

    addLibraryItem: (fields) => {
      get().socket?.emit('library:add', fields);
    },

    updateLibraryItem: (id, patch) => {
      const socket = get().socket;
      if (!socket) return;
      set((s) => ({
        library: s.library.map((i) => (i.id === id ? { ...i, ...patch } : i)),
      }));
      throttled(`lib:${id}`, 200, () => socket.emit('library:update', { id, patch }));
    },

    removeLibraryItem: (id) => {
      get().socket?.emit('library:remove', id);
    },
  };
};
