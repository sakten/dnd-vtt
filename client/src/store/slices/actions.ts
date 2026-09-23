import {
  aimToCursor,
  confirmArea,
  finishMulti,
  pickCondition,
  pickMultiTarget,
  pickTarget,
  placeScatterPoint,
  scatterBack,
  scatterToPlaces,
  startAim,
  startMulti,
  startScatter,
  startTargeting,
  toggleScatterTarget,
  type InteractionCommand,
} from '../../domain/interaction';
import { crossesWalls } from 'shared';
import { emitInMap } from '../helpers';
import { activeGridOf, activeMapOf, tokenById } from '../selectors';
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
    | 'chooseCondition'
    | 'cancelCondition'
    | 'startAim'
    | 'aimToCursor'
    | 'cancelAim'
    | 'confirmAim'
    | 'endConcentration'
    | 'startMultiTarget'
    | 'addMultiTarget'
    | 'finishMultiTarget'
    | 'cancelMultiTarget'
    | 'startScatter'
    | 'toggleScatterTarget'
    | 'scatterToPlaces'
    | 'scatterBack'
    | 'placeScatterPoint'
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
      const it = get().interaction;
      // Lesser/Greater Restoration: после клика по цели показываем выбор состояния
      // (2+ подходящих); с одним кастуем сразу, с нулём — сервер вернёт ошибку.
      if (it?.mode === 'target' && it.target.kind === 'spell' && it.target.endConditionKeys?.length) {
        const t = it.target;
        const keys = t.endConditionKeys ?? [];
        const token = tokenById(activeMapOf(get()), targetId);
        const options = keys.filter((key) => token?.conditions.some((c) => c.key === key));
        if (options.length > 1) {
          _set({
            interaction: {
              mode: 'condition',
              condition: {
                tokenId: t.tokenId,
                targetId,
                spellKey: t.spellKey,
                slotLevel: t.slotLevel,
                advantage: t.advantage,
                options,
                label: t.label,
              },
            },
          });
          return;
        }
        emitInMap(get, 'spell:cast', {
          tokenId: t.tokenId,
          spellKey: t.spellKey,
          slotLevel: t.slotLevel,
          advantage: t.advantage,
          targetIds: [targetId],
          ...(options[0] ? { condition: options[0] } : {}),
        });
        _set({ interaction: null });
        return;
      }
      const { next, command } = pickTarget(get().interaction, targetId);
      _set({ interaction: next });
      runCommand(command);
    },

    chooseCondition: (key) => {
      const { next, command } = pickCondition(get().interaction, key);
      _set({ interaction: next });
      runCommand(command);
    },

    cancelCondition: () => _set({ interaction: null }),

    startAim: (payload) => {
      const token = tokenById(activeMapOf(get()), payload.tokenId);
      _set({ interaction: startAim(payload, token) });
    },

    aimToCursor: (cursor) => {
      const state = get();
      const it = state.interaction;
      if (it?.mode !== 'aim') return;
      const map = activeMapOf(state);
      const token = tokenById(map, it.aim.tokenId);
      const next = aimToCursor(it, cursor, token, activeGridOf(state).size || 50);
      if (!next || next.mode !== 'aim' || !next.aim.origin) {
        _set({ interaction: next });
        return;
      }
      // Подсветка: путь до точки перекрыт стеной/закрытой дверью — применять нельзя.
      const blocked = !!map && !!token && crossesWalls(token, next.aim.origin, map.walls, 'sight');
      _set({ interaction: { mode: 'aim', aim: { ...next.aim, blocked } } });
    },

    cancelAim: () => _set({ interaction: null }),

    confirmAim: () => {
      const it = get().interaction;
      if (it?.mode === 'aim' && it.aim.blocked) return;
      const { next, command } = confirmArea(it);
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

    finishMultiTarget: () => {
      const { next, command } = finishMulti(get().interaction);
      _set({ interaction: next });
      runCommand(command);
    },

    cancelMultiTarget: () => _set({ interaction: null }),

    startScatter: (payload) => _set({ interaction: startScatter(payload) }),

    toggleScatterTarget: (targetId) => {
      _set({ interaction: toggleScatterTarget(get().interaction, targetId) });
    },

    scatterToPlaces: () => {
      _set({ interaction: scatterToPlaces(get().interaction) });
    },

    scatterBack: () => {
      _set({ interaction: scatterBack(get().interaction) });
    },

    placeScatterPoint: (point) => {
      const { next, command } = placeScatterPoint(get().interaction, point);
      _set({ interaction: next });
      runCommand(command);
    },
  };
};
