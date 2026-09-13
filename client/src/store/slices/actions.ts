import type { GameState, Slice } from '../types';

export const createActionSlice: Slice<
  Pick<
    GameState,
    | 'runAction'
    | 'castSpell'
    | 'startAim'
    | 'aimToCursor'
    | 'cancelAim'
    | 'confirmAim'
    | 'startMultiTarget'
    | 'addMultiTarget'
    | 'cancelMultiTarget'
    | 'adjustTokenHp'
  >
> = (_set, get) => ({
  runAction: (tokenId, actionId, extra) => {
    const mapId = get().viewMapId;
    if (!mapId) return;
    get().socket?.emit('action:use', { mapId, tokenId, actionId, ...extra });
  },

  castSpell: (payload) => {
    const mapId = get().viewMapId;
    if (!mapId) return;
    const targetIds =
      payload.targetIds ?? (payload.origin ? undefined : get().targetTokenId ? [get().targetTokenId as string] : undefined);
    get().socket?.emit('spell:cast', { mapId, ...payload, targetIds });
  },

  startAim: ({ tokenId, spellKey, slotLevel, advantage, spec, originKind, rangeFeet }) => {
    const { scene, viewMapId } = get();
    const token = scene.maps.find((m) => m.id === viewMapId)?.tokens.find((t) => t.id === tokenId);
    const origin = originKind === 'self' && token ? { x: token.x, y: token.y } : null;
    _set({
      aim: { tokenId, spellKey, slotLevel, advantage, spec, originKind, rangeFeet, origin, direction: null },
    });
  },

  aimToCursor: (cursor) => {
    const aim = get().aim;
    if (!aim) return;
    const { scene, viewMapId } = get();
    const token = scene.maps.find((m) => m.id === viewMapId)?.tokens.find((t) => t.id === aim.tokenId);
    if (!token) return;
    const size = scene.grid.size || 50;

    if (aim.originKind === 'self') {
      const needsDirection = aim.spec.shape === 'cone' || aim.spec.shape === 'line';
      _set({ aim: { ...aim, direction: needsDirection ? cursor : null } });
      return;
    }

    let origin = cursor;
    if (aim.rangeFeet !== null) {
      const dx = cursor.x - token.x;
      const dy = cursor.y - token.y;
      const dist = Math.hypot(dx, dy);
      const maxPx = (aim.rangeFeet / 5) * size;
      if (dist > maxPx && dist > 0) {
        origin = { x: token.x + (dx / dist) * maxPx, y: token.y + (dy / dist) * maxPx };
      }
    }
    _set({ aim: { ...aim, origin, direction: origin } });
  },

  cancelAim: () => _set({ aim: null }),

  confirmAim: () => {
    const aim = get().aim;
    if (!aim) return;
    get().castSpell({
      tokenId: aim.tokenId,
      spellKey: aim.spellKey,
      slotLevel: aim.slotLevel,
      advantage: aim.advantage,
      origin: aim.origin ?? undefined,
      direction: aim.direction ?? undefined,
    });
    _set({ aim: null });
  },

  adjustTokenHp: (tokenId, delta) => {
    const mapId = get().viewMapId;
    if (!mapId || !delta) return;
    get().socket?.emit('token:hp', { mapId, id: tokenId, delta: Math.round(delta) });
  },

  startMultiTarget: (payload) => _set({ multiTarget: { ...payload, targets: [] } }),

  addMultiTarget: (targetId) => {
    const mt = get().multiTarget;
    if (!mt) return;
    const targets = [...mt.targets, targetId];
    if (targets.length >= mt.count) {
      get().castSpell({
        tokenId: mt.tokenId,
        spellKey: mt.spellKey,
        slotLevel: mt.slotLevel,
        advantage: mt.advantage,
        targetIds: targets,
      });
      _set({ multiTarget: null });
      return;
    }
    _set({ multiTarget: { ...mt, targets } });
  },

  cancelMultiTarget: () => _set({ multiTarget: null }),
});
