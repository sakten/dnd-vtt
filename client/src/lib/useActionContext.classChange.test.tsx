import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { emptyResources, normalizeSheet } from 'shared';
import { fakeSocket, makeMap, makeScene, makeToken } from '../test/fixtures';
import { useGameStore } from '../store/useGameStore';
import { useActionContext } from './useActionContext';

function sheet(className: string, level: number) {
  return normalizeSheet({
    name: 'Иван',
    abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 10 },
    classes: [{ className, level }],
  });
}

beforeEach(() => {
  const token = makeToken('t1', { libraryItemId: 'lib1', name: 'Иван', isPlayerToken: true });
  const map = makeMap('m1', [token]);
  useGameStore.setState({
    socket: fakeSocket().socket,
    selfId: 'p1',
    role: 'player',
    testMode: false,
    scene: makeScene([map], 'm1'),
    viewMapId: 'm1',
    selectedTokenId: 't1',
    currentCharacterId: 'lib1',
    sheet: sheet('fighter', 5),
    resources: emptyResources(),
  });
});

describe('useActionContext: смена класса', () => {
  it('пересобирает классовые способности из нового sheet', () => {
    const { result } = renderHook(() => useActionContext());
    expect(result.current?.features.some((f) => f.id.includes('fighter'))).toBe(true);
    expect(result.current?.features.some((f) => f.id.includes('barbarian'))).toBe(false);

    act(() => {
      useGameStore.setState({ sheet: sheet('barbarian', 5) });
    });

    expect(result.current?.features.some((f) => f.id.includes('fighter'))).toBe(false);
    expect(result.current?.features.some((f) => f.id.includes('barbarian'))).toBe(true);
  });

  it('убирает из панели заклинания старого класса', async () => {
    useGameStore.setState({
      sheet: normalizeSheet({
        name: 'Иван',
        abilities: { str: 10, dex: 10, con: 10, int: 16, wis: 10, cha: 10 },
        classes: [{ className: 'wizard', level: 5 }],
        spells: [{ key: 'XPHB:Fire Bolt', className: 'wizard' }],
      }),
    });
    const { result } = renderHook(() => useActionContext());
    await waitFor(() =>
      expect(result.current?.panelSpells.some((s) => s.key === 'XPHB:Fire Bolt')).toBe(true)
    );

    act(() => {
      useGameStore.setState({ sheet: sheet('barbarian', 5) });
    });

    await waitFor(() =>
      expect(result.current?.panelSpells.some((s) => s.key === 'XPHB:Fire Bolt')).toBe(false)
    );
  });
});