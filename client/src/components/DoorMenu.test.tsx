import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Wall } from 'shared';
import { fakeSocket, makeMap, makeScene, makeToken, type EmittedEvent } from '../test/fixtures';
import { useGameStore } from '../store/useGameStore';
import DoorMenu from './DoorMenu';

const DOOR: Wall = { id: 'd1', kind: 'door', x1: 100, y1: 0, x2: 100, y2: 50 };

let emitted: EmittedEvent[] = [];

beforeEach(() => {
  const fake = fakeSocket();
  emitted = fake.emitted;
  const map = makeMap('m1', [makeToken('t1', { libraryItemId: 'lib1', isPlayerToken: true, x: 50, y: 25 })]);
  map.walls = [{ ...DOOR }];
  useGameStore.setState({
    socket: fake.socket,
    scene: makeScene([map], 'm1'),
    viewMapId: 'm1',
    view: { x: 0, y: 0, scale: 1 },
    viewport: { w: 1200, h: 800 },
    doorMenuId: 'd1',
    role: 'player',
    testMode: false,
    selfId: 'p1',
    currentCharacterId: null,
  });
});

describe('DoorMenu', () => {
  it('игрок видит состояние и Сл взлома, «Открыть» шлёт door:toggle', () => {
    useGameStore.getState().scene.maps[0]!.walls[0]!.pickDc = 15;
    render(<DoorMenu />);

    expect(screen.getByText('Дверь: закрыта')).toBeInTheDocument();
    expect(screen.getByText('Взлом: Сл 15')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Открыть' }));
    expect(emitted).toEqual([{ event: 'door:toggle', payload: { mapId: 'm1', wallId: 'd1' } }]);
  });

  it('dmOnly-дверь игроку не показывается', () => {
    useGameStore.getState().scene.maps[0]!.walls[0]!.dmOnly = true;
    render(<DoorMenu />);
    expect(screen.queryByTestId('object-menu')).toBeNull();
  });

  it('DM: настройки двери и удаление', () => {
    useGameStore.setState({ role: 'dm' });
    render(<DoorMenu />);

    fireEvent.click(screen.getByLabelText('Только для ведущего'));
    expect(emitted.at(-1)).toEqual({
      event: 'door:update',
      payload: { mapId: 'm1', wallId: 'd1', patch: { dmOnly: true } },
    });

    const dc = screen.getByLabelText('Сл взлома');
    fireEvent.change(dc, { target: { value: '20' } });
    fireEvent.blur(dc);
    expect(emitted.at(-1)).toEqual({
      event: 'door:update',
      payload: { mapId: 'm1', wallId: 'd1', patch: { pickDc: 20 } },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Удалить дверь' }));
    expect(emitted.at(-1)?.event).toBe('walls:update');
    expect(useGameStore.getState().doorMenuId).toBeNull();
  });
});
