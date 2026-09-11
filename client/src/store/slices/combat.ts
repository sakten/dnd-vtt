import { setCombat } from '../../domain/scene';
import type { GameState, Slice } from '../types';

export const createCombatSlice: Slice<Pick<GameState, 'onCombatUpdate' | 'startCombat' | 'endCombat' | 'addCombatant' | 'addMapCombatants' | 'removeCombatant' | 'updateCombatant' | 'moveCombatant' | 'rollInitiative' | 'clearCombat'>> = (set, get) => {
  return {
    onCombatUpdate: ({ mapId, combat }) => set((s) => ({ scene: setCombat(s.scene, mapId, combat) })),

    startCombat: () => {
      const mapId = get().viewMapId;
      if (!mapId) return;
      get().socket?.emit('combat:start', { mapId });
    },

    endCombat: () => {
      const mapId = get().viewMapId;
      if (!mapId) return;
      get().socket?.emit('combat:end', { mapId });
    },

    addCombatant: (tokenId) => {
      const mapId = get().viewMapId;
      if (!mapId) return;
      get().socket?.emit('combat:add', { mapId, tokenId });
    },

    addMapCombatants: () => {
      const mapId = get().viewMapId;
      if (!mapId) return;
      get().socket?.emit('combat:addMap', { mapId });
    },

    removeCombatant: (id) => {
      const mapId = get().viewMapId;
      if (!mapId) return;
      get().socket?.emit('combat:remove', { mapId, id });
    },

    updateCombatant: (id, patch) => {
      const mapId = get().viewMapId;
      if (!mapId) return;
      get().socket?.emit('combat:update', { mapId, id, patch });
    },

    moveCombatant: (id, toIndex) => {
      const mapId = get().viewMapId;
      if (!mapId) return;
      get().socket?.emit('combat:move', { mapId, id, toIndex });
    },

    rollInitiative: (id) => {
      const mapId = get().viewMapId;
      if (!mapId) return;
      get().socket?.emit('combat:roll', id ? { mapId, id } : { mapId });
    },

    clearCombat: () => {
      const mapId = get().viewMapId;
      if (!mapId) return;
      get().socket?.emit('combat:clear', { mapId });
    },
  };
};
