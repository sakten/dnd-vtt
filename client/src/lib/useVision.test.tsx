import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useGameStore } from '../store/useGameStore';
import { makeMap, makeScene, makeToken } from '../test/fixtures';
import { useVisionViewers } from './useVision';

const own = makeToken('own', { isPlayerToken: true, libraryItemId: 'char1', x: 100, y: 100 });
const ally = makeToken('ally', { isPlayerToken: true, libraryItemId: 'char2', x: 300, y: 300 });

function setState(tokens = [own, ally], role: 'player' | 'dm' = 'player') {
  useGameStore.setState({
    role,
    selfId: 'p1',
    currentCharacterId: 'char1',
    testMode: false,
    viewMapId: 'm1',
    scene: makeScene([makeMap('m1', tokens)]),
    library: [
      { id: 'char1', name: 'Мой', isPlayerToken: true, imageUrl: '', description: '', cells: 1, round: false, initiativeBonus: '', owner: '', attacks: [], ac: '', hpMax: '', showStats: false, canInteract: false, damageDefenses: [] },
      { id: 'char2', name: 'Союзник', isPlayerToken: true, imageUrl: '', description: '', cells: 1, round: false, initiativeBonus: '', owner: '', attacks: [], ac: '', hpMax: '', showStats: false, canInteract: false, damageDefenses: [] },
    ],
  });
}

beforeEach(() => setState());

describe('useVisionViewers', () => {
  it('DM не получает зрителей', () => {
    setState([own, ally], 'dm');
    const { result } = renderHook(() => useVisionViewers());
    expect(result.current).toBeNull();
  });

  it('игрок видит только своих персонажей, пока есть свой токен', () => {
    const { result } = renderHook(() => useVisionViewers());
    expect(result.current).toHaveLength(1);
    expect(result.current?.[0]).toMatchObject({ x: 100, y: 100 });
  });

  it('без своего токена берёт всю партию и стабилен без изменений', () => {
    setState([ally]);
    const { result, rerender } = renderHook(() => useVisionViewers());
    expect(result.current).toHaveLength(1);
    expect(result.current?.[0]).toMatchObject({ x: 300, y: 300 });

    const first = result.current;
    rerender();
    expect(result.current).toBe(first);

    act(() => {
      useGameStore.setState({ scene: makeScene([makeMap('m1', [makeToken('ally', { isPlayerToken: true, libraryItemId: 'char2', x: 400, y: 300 })])]) });
    });
    expect(result.current).not.toBe(first);
    expect(result.current?.[0]).toMatchObject({ x: 400 });
  });
});
