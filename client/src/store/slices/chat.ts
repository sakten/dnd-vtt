import {
  isCriticalHit,
  parseDiceExpression,
} from 'shared';
import { emit } from '../helpers';
import { errorText } from '../../i18n/errors';
import { rollMessageLabel } from '../../i18n/rolls';
import type { GameState, Slice } from '../types';

export const createChatSlice: Slice<Pick<GameState, 'onChatMessage' | 'onChatError' | 'sendChat' | 'rollDice' | 'rollAttack'>> = (set, get) => {
  return {
    onChatMessage: (message) =>
      set((s) => {
        if (s.chat.some((m) => m.id === message.id)) return s;
        const isAttack =
          message.kind === 'roll' &&
          (message.rollKind === 'attack' || (!message.rollKind && !!message.label?.startsWith('Атака')));
        const critHit =
          message.kind === 'roll' && isAttack && isCriticalHit(message.roll)
            ? { id: message.id, author: message.author, label: rollMessageLabel(message), total: message.roll.total }
            : s.critHit;
        return { chat: [...s.chat, message], critHit };
      }),

    onChatError: (payload) => {
      const message = errorText(payload);
      set({ chatError: message });
      setTimeout(() => {
        set((s) => (s.chatError === message ? { chatError: null } : s));
      }, 5000);
    },


    sendChat: (text) => {
      const t = text.trim();
      if (!t) return;
      try {
        parseDiceExpression(t);
        get().rollDice(t);
      } catch {
        emit(get, 'chat:send', t);
      }
    },

    rollDice: (expression, label, meta) => {
      emit(get, 'dice:roll', {
        expression,
        label,
        rollKind: meta?.rollKind,
        subject: meta?.subject,
      });
    },

    rollAttack: (payload) => {
      emit(get, 'dice:attack', payload);
    },

  };
};
