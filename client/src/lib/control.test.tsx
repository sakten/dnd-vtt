import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { emptyCombatState, emptyTurnState, type LibraryItem } from 'shared';
import { fakeSocket, makeMap, makeScene, makeToken } from '../test/fixtures';
import { useGameStore } from '../store/useGameStore';
import { useActionContext } from './useActionContext';
import { isCharacterTokenWith, useCanEndTurn, useIsRealDm } from './control';

const PLAYER = { id: 'p1', name: 'Игрок', role: 'player' as const, isConnected: true };

/** Комната: карта m1 с боем (активен t1 «Иван», lib1), t2 — токен по владельцу. */
function setupScene() {
  const t1 = makeToken('t1', { libraryItemId: 'lib1', name: 'Иван' });
  const t2 = makeToken('t2', { libraryItemId: 'lib2', owner: 'Иван' });
  const map = makeMap('m1', [t1, t2]);
  map.combat = {
    ...emptyCombatState(),
    active: true,
    round: 1,
    currentIndex: 0,
    entries: [{ id: 'e1', tokenId: 't1', name: 'Иван', imageUrl: '', initiative: 10, bonus: '' }],
    turns: { e1: { ...emptyTurnState(30), movementUsed: 0 } },
  };
  const lib1 = { ...makeToken('lib1', { name: 'Иван', isPlayerToken: true }) } as unknown as LibraryItem;
  return { map, lib1 };
}

/** Выключить/включить бой на карте (useActionContext вне боя смотрит на выбранный токен). */
function setCombatActive(active: boolean) {
  const s = useGameStore.getState();
  const map = s.scene.maps[0]!;
  useGameStore.setState({ scene: { ...s.scene, maps: [{ ...map, combat: { ...map.combat, active } }] } });
}

beforeEach(() => {
  const { map, lib1 } = setupScene();
  useGameStore.setState({
    socket: fakeSocket().socket,
    scene: makeScene([map], 'm1'),
    viewMapId: 'm1',
    selfId: 'p1',
    role: 'player',
    testMode: false,
    players: [PLAYER],
    library: [lib1],
    sheet: null,
    currentCharacterId: null,
    selectedTokenId: null,
  });
});

describe('useIsRealDm', () => {
  it('реальный DM — да, режим тестов у игрока — нет', () => {
    useGameStore.setState({ role: 'dm' });
    expect(renderHook(() => useIsRealDm()).result.current).toBe(true);

    useGameStore.setState({ role: 'player', testMode: true });
    expect(renderHook(() => useIsRealDm()).result.current).toBe(false);
  });
});

describe('useCanEndTurn', () => {
  it('контролёр активного токена — да, чужой игрок — нет, DM — да', () => {
    useGameStore.setState({ currentCharacterId: 'lib1' });
    expect(renderHook(() => useCanEndTurn()).result.current).toBe(true);

    useGameStore.setState({ currentCharacterId: 'lib2' });
    expect(renderHook(() => useCanEndTurn()).result.current).toBe(false);

    useGameStore.setState({ role: 'dm' });
    expect(renderHook(() => useCanEndTurn()).result.current).toBe(true);
  });
});

describe('useActionContext: контроль и лист персонажа', () => {
  it('токен по владельцу: панель открыта, но лист игрока не подключается', () => {
    setCombatActive(false);
    useGameStore.setState({ currentCharacterId: 'lib1', selectedTokenId: 't2' });
    const { result } = renderHook(() => useActionContext());

    expect(result.current?.controlled).toBe(true);
    expect(result.current?.isCharacter).toBe(false);
  });

  it('привязанный токен: isCharacter — лист игрока', () => {
    setCombatActive(false);
    useGameStore.setState({ currentCharacterId: 'lib1', selectedTokenId: 't1' });
    const { result } = renderHook(() => useActionContext());

    expect(result.current?.controlled).toBe(true);
    expect(result.current?.isCharacter).toBe(true);
  });

  it('чужой игрок без прав: панель заперта', () => {
    setCombatActive(false);
    useGameStore.setState({ currentCharacterId: 'lib2', selectedTokenId: 't1' });
    const { result } = renderHook(() => useActionContext());

    expect(result.current?.controlled).toBe(false);
  });

  it('isCharacterTokenWith строг к owner-токенам', () => {
    const state = useGameStore.getState();
    expect(isCharacterTokenWith(state, makeToken('x', { owner: 'Иван' }))).toBe(false);
  });
});
