import { emit } from '../helpers';
import type { GameState, Slice } from '../types';

/** Окно реакций: приходит по одному офферу (очередь сервера), зрителям — с `active: false`. */
export const createReactionSlice: Slice<
  Pick<GameState, 'onReactionOffer' | 'onReactionClose' | 'respondReaction' | 'forceSkipReaction'>
> = (set, get) => ({
  onReactionOffer: (offer) => set({ reactionOffer: offer }),

  onReactionClose: ({ id }) =>
    set((s) => (s.reactionOffer?.id === id ? { reactionOffer: null } : {})),

  respondReaction: (id, optionId) => {
    emit(get, 'reaction:respond', { id, optionId });
    set((s) => (s.reactionOffer?.id === id ? { reactionOffer: null } : {}));
  },

  forceSkipReaction: (id) => {
    emit(get, 'reaction:forceSkip', { id });
    set((s) => (s.reactionOffer?.id === id ? { reactionOffer: null } : {}));
  },
});
