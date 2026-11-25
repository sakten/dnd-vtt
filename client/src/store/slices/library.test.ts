import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { LibraryItem } from 'shared';
import { fakeSocket, type EmittedEvent } from '../../test/fixtures';
import { clearOptimistic } from '../optimistic';
import { useGameStore } from '../useGameStore';

let emitted: EmittedEvent[] = [];

function item(id: string, overrides: Partial<LibraryItem> = {}): LibraryItem {
  return {
    id,
    name: id,
    description: '',
    imageUrl: '',
    cells: 1,
    round: false,
    initiativeBonus: '',
    isPlayerToken: false,
    owner: '',
    attacks: [],
    ac: '',
    hpMax: '',
    showStats: false,
    canInteract: false,
    damageDefenses: [],
    ...overrides,
  };
}

beforeEach(() => {
  const { socket, emitted: out } = fakeSocket();
  emitted = out;
  useGameStore.setState({ socket, library: [item('l1'), item('l2')] });
});

afterEach(() => {
  clearOptimistic();
});

const last = (event: string) => emitted.filter((e) => e.event === event).at(-1)?.payload;

describe('library slice', () => {
  it('onLibraryUpdate заменяет список', () => {
    const items = [item('next')];
    useGameStore.getState().onLibraryUpdate(items);
    expect(useGameStore.getState().library).toEqual(items);
  });

  it('add/remove шлют события с id и полями', () => {
    const fields = item('new');
    useGameStore.getState().addLibraryItem(fields);
    expect(last('library:add')).toMatchObject({ id: 'new', name: 'new' });

    useGameStore.getState().removeLibraryItem('l1');
    expect(last('library:remove')).toBe('l1');
  });

  it('updateLibraryItem сразу применяет патч и отправляет актуальную запись', () => {
    useGameStore.getState().updateLibraryItem('l1', { name: 'Изменён' });
    expect(useGameStore.getState().library.find((i) => i.id === 'l1')?.name).toBe('Изменён');
    expect(last('library:update')).toEqual({
      id: 'l1',
      patch: expect.objectContaining({ id: 'l1', name: 'Изменён' }),
    });
  });

  it('updateLibraryItem без сокета не меняет состояние', () => {
    useGameStore.setState({ socket: null });
    useGameStore.getState().updateLibraryItem('l1', { name: 'Нет' });
    expect(useGameStore.getState().library.find((i) => i.id === 'l1')?.name).toBe('l1');
    expect(emitted).toEqual([]);
  });
});
