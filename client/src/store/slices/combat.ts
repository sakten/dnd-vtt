import { setCombat } from '../../domain/scene';
import { emitInMap } from '../helpers';
import type { GameState, Slice } from '../types';

export const createCombatSlice: Slice<Pick<GameState, 'onCombatUpdate' | 'startCombat' | 'endCombat' | 'addCombatant' | 'addMapCombatants' | 'removeCombatant' | 'updateCombatant' | 'moveCombatant' | 'rollInitiative' | 'clearCombat' | 'endTurn' | 'setTurn'>> = (set, get) => {
  return {
    onCombatUpdate: ({ mapId, combat }) => set((s) => ({ scene: setCombat(s.scene, mapId, combat) })),

    startCombat: () => emitInMap(get, 'combat:start', {}),

    endCombat: () => emitInMap(get, 'combat:end', {}),

    addCombatant: (tokenId) => emitInMap(get, 'combat:add', { tokenId }),

    addMapCombatants: () => emitInMap(get, 'combat:addMap', {}),

    removeCombatant: (id) => emitInMap(get, 'combat:remove', { id }),

    updateCombatant: (id, patch) => emitInMap(get, 'combat:update', { id, patch }),

    moveCombatant: (id, toIndex) => emitInMap(get, 'combat:move', { id, toIndex }),

    rollInitiative: (id) => emitInMap(get, 'combat:roll', id ? { id } : {}),

    clearCombat: () => emitInMap(get, 'combat:clear', {}),

    endTurn: () => emitInMap(get, 'combat:endTurn', {}),

    setTurn: (id) => emitInMap(get, 'combat:setTurn', { id }),
  };
};
