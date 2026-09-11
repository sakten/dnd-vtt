import {
  isCriticalHit,
  parseDiceExpression,
} from 'shared';
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
            ? { id: message.id, author: message.author, label: message.label, total: message.roll.total }
            : s.critHit;
        return { chat: [...s.chat, message], critHit };
      }),

    onChatError: (message) => {
      set({ chatError: message });
      window.setTimeout(() => {
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
        get().socket?.emit('chat:send', t);
      }
    },

    rollDice: (expression, label, meta) => {
      get().socket?.emit('dice:roll', {
        expression,
        label,
        rollKind: meta?.rollKind,
        subject: meta?.subject,
      });
    },

    rollAttack: (payload) => {
      get().socket?.emit('dice:attack', payload);
    },

  };
};
