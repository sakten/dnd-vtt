import type { GameState, Slice } from '../types';

export const createActionSlice: Slice<Pick<GameState, 'runAction'>> = (_set, get) => ({
  runAction: (tokenId, actionId, extra) => {
    const mapId = get().viewMapId;
    if (!mapId) return;
    get().socket?.emit('action:use', { mapId, tokenId, actionId, ...extra });
  },
});
