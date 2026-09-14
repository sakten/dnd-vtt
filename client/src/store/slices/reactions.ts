import type { GameState, Slice } from '../types';

/** Окна реакций (R1): офферы от сервера и ответы. */
export const createReactionSlice: Slice<
  Pick<GameState, 'onReactionOffer' | 'onReactionClose' | 'respondReaction' | 'forceSkipReaction'>
> = (set, get) => ({
  onReactionOffer: (offer) =>
    set((s) => ({
      reactionOffers: [...s.reactionOffers.filter((o) => o.id !== offer.id), offer],
    })),

  onReactionClose: ({ id }) =>
    set((s) => ({ reactionOffers: s.reactionOffers.filter((o) => o.id !== id) })),

  respondReaction: (id, optionId) => {
    get().socket?.emit('reaction:respond', { id, optionId });
    set((s) => ({ reactionOffers: s.reactionOffers.filter((o) => o.id !== id) }));
  },

  forceSkipReaction: (id) => {
    get().socket?.emit('reaction:forceSkip', { id });
    set((s) => ({ reactionOffers: s.reactionOffers.filter((o) => o.id !== id) }));
  },
});
