import { beforeEach, describe, expect, it } from 'vitest';
import type { LibraryItem } from 'shared';
import { fakeSocket, makeMap, makeScene, makeToken } from '../test/fixtures';
import { useGameStore } from '../store/useGameStore';
import { canSeeLibraryItemWith } from './libraryVisibility';

const item = (over: Partial<LibraryItem> = {}): LibraryItem =>
  ({ ...makeToken('libX', { name: 'Иван', isPlayerToken: true }), ...over }) as unknown as LibraryItem;

beforeEach(() => {
  useGameStore.setState({
    socket: fakeSocket().socket,
    scene: makeScene([makeMap('m1', [makeToken('t1', { libraryItemId: 'lib1', name: 'Иван' })])], 'm1'),
    viewMapId: 'm1',
    selfId: 'p1',
    role: 'player',
    testMode: false,
    players: [{ id: 'p1', name: 'Игрок', role: 'player', isConnected: true }],
    currentCharacterId: 'lib1',
    library: [],
  });
});

describe('canSeeLibraryItemWith', () => {
  it('автор, свой персонаж и владелец видны', () => {
    expect(canSeeLibraryItemWith(useGameStore.getState(), item({ createdBy: 'p1' }))).toBe(true);
    expect(canSeeLibraryItemWith(useGameStore.getState(), item({ id: 'lib1' }))).toBe(true);
    expect(canSeeLibraryItemWith(useGameStore.getState(), item({ owner: 'Иван' }))).toBe(true);
    expect(canSeeLibraryItemWith(useGameStore.getState(), item({ owner: 'Игрок' }))).toBe(true);  });

  it('чужие токены и DM-токены скрыты', () => {
    expect(canSeeLibraryItemWith(useGameStore.getState(), item({ id: 'lib2', createdBy: 'p2' }))).toBe(false);
    expect(canSeeLibraryItemWith(useGameStore.getState(), item({ id: 'lib2', owner: 'Другой' }))).toBe(false);
  });

  it('DM и режим тестов видят всё', () => {
    useGameStore.setState({ role: 'dm' });
    expect(canSeeLibraryItemWith(useGameStore.getState(), item({ id: 'lib2', createdBy: 'p2' }))).toBe(true);
    useGameStore.setState({ role: 'player', testMode: true });
    expect(canSeeLibraryItemWith(useGameStore.getState(), item({ id: 'lib2', createdBy: 'p2' }))).toBe(true);
  });
});