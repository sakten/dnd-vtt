import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TextMessage } from 'shared';
import { fakeSocket, type EmittedEvent } from '../../test/fixtures';
import { useGameStore } from '../useGameStore';

let emitted: EmittedEvent[] = [];

beforeEach(() => {
  vi.useFakeTimers();
  const { socket, emitted: out } = fakeSocket();
  emitted = out;
  useGameStore.setState({ socket, chat: [], chatError: null, critHit: null });
});

afterEach(() => {
  vi.useRealTimers();
});

const last = (event: string) => emitted.filter((e) => e.event === event).at(-1)?.payload;

const message = (id: string, text: string): TextMessage => ({
  id,
  kind: 'text',
  author: 'DM',
  text,
  ts: 1,
});

describe('chat slice', () => {
  it('добавляет сообщение и игнорирует повтор с тем же id', () => {
    const first = message('m1', 'Привет');
    useGameStore.getState().onChatMessage(first);
    useGameStore.getState().onChatMessage(first);
    expect(useGameStore.getState().chat).toEqual([first]);
  });

  it('показывает ошибку чата и снимает её через 5 секунд', () => {
    useGameStore.getState().onChatError({ code: 'error.noActions' });
    expect(useGameStore.getState().chatError).toBeTruthy();
    vi.advanceTimersByTime(4999);
    expect(useGameStore.getState().chatError).toBeTruthy();
    vi.advanceTimersByTime(1);
    expect(useGameStore.getState().chatError).toBeNull();
  });

  it('sendChat различает формулу и обычный текст', () => {
    useGameStore.getState().sendChat('d20+3');
    expect(last('dice:roll')).toEqual({ expression: 'd20+3', label: undefined, rollKind: undefined, subject: undefined });

    useGameStore.getState().sendChat('  привет  ');
    expect(last('chat:send')).toBe('привет');

    emitted = [];
    useGameStore.getState().sendChat('   ');
    expect(emitted).toEqual([]);
  });

  it('rollDice и rollAttack передают метаданные', () => {
    useGameStore.getState().rollDice('2d6', 'Урон', { rollKind: 'damage', subject: 'Меч' });
    expect(last('dice:roll')).toEqual({ expression: '2d6', label: 'Урон', rollKind: 'damage', subject: 'Меч' });

    useGameStore.getState().rollAttack({ attackIndex: 2, targetId: 't2' });
    expect(last('dice:attack')).toEqual({ attackIndex: 2, targetId: 't2' });
  });
});
