import {
  aimToCursor,
  confirmArea,
  pickMultiTarget,
  pickTarget,
  startAim,
  startMulti,
  startTargeting,
  type InteractionCommand,
} from '../../domain/interaction';
import { emitInMap } from '../helpers';
import { activeMapOf, tokenById } from '../selectors';
import type { GameState, Slice } from '../types';

export const createActionSlice: Slice<
  Pick<
    GameState,
    | 'runAction'
    | 'castSpell'
    | 'startTargeting'
    | 'cancelTargeting'
    | 'cancelInteraction'
    | 'resolveTargeting'
    | 'startAim'
    | 'aimToCursor'
    | 'cancelAim'
    | 'confirmAim'
    | 'endConcentration'
    | 'startMultiTarget'
    | 'addMultiTarget'
    | 'cancelMultiTarget'
    | 'adjustTokenHp'
  >
> = (_set, get) => {
  /** Исполняет команду машины взаимодействия (после сброса режима). */
  const runCommand = (command: InteractionCommand | undefined) => {
    if (!command) return;
    if (command.type === 'runAction') get().runAction(command.tokenId, command.actionId, command.extra);
    else if (command.type === 'castSpell') get().castSpell(command.payload);
    else get().rollAttack(command.payload);
  };

  return {
    runAction: (tokenId, actionId, extra) => {
      emitInMap(get, 'action:use', { tokenId, actionId, ...extra });
    },

    castSpell: (payload) => {
      emitInMap(get, 'spell:cast', payload);
    },

    startTargeting: (targeting) => _set({ interaction: startTargeting(targeting) }),

    cancelTargeting: () => _set({ interaction: null }),

    cancelInteraction: () => _set({ interaction: null }),

    resolveTargeting: (targetId) => {
      const { next, command } = pickTarget(get().interaction, targetId);
      _set({ interaction: next });
      runCommand(command);
    },

    startAim: (payload) => {
      const token = tokenById(activeMapOf(get()), payload.tokenId);
      _set({ interaction: startAim(payload, token) });
    },

    aimToCursor: (cursor) => {
      const state = get();
      const it = state.interaction;
      if (it?.mode !== 'aim') return;
      const token = tokenById(activeMapOf(state), it.aim.tokenId);
      _set({ interaction: aimToCursor(it, cursor, token, state.scene.grid.size || 50) });
    },

    cancelAim: () => _set({ interaction: null }),

    confirmAim: () => {
      const { next, command } = confirmArea(get().interaction);
      _set({ interaction: next });
      runCommand(command);
    },

    endConcentration: (tokenId) => {
      emitInMap(get, 'spell:endConcentration', { tokenId });
    },

    adjustTokenHp: (tokenId, delta) => {
      if (!delta) return;
      emitInMap(get, 'token:hp', { id: tokenId, delta: Math.round(delta) });
    },

    startMultiTarget: (payload) => _set({ interaction: startMulti(payload) }),

    addMultiTarget: (targetId) => {
      const { next, command } = pickMultiTarget(get().interaction, targetId);
      _set({ interaction: next });
      runCommand(command);
    },

    cancelMultiTarget: () => _set({ interaction: null }),
  };
};
