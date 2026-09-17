import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_GRID } from 'shared';
import { fakeSocket, makeScene, type EmittedEvent } from '../../test/fixtures';
import { clearThrottled } from '../helpers';
import { useGameStore } from '../useGameStore';

let emitted: EmittedEvent[] = [];

beforeEach(() => {
  const fake = fakeSocket();
  emitted = fake.emitted;
  clearThrottled('grid:m1');
  clearThrottled('grid:m2');
  useGameStore.setState({ socket: fake.socket, scene: makeScene(), viewMapId: 'm1' });
});

describe('maps slice: независимые сетки карт', () => {
  it('updateGrid меняет активную карту и шлёт grid:update с mapId', () => {
    useGameStore.getState().updateGrid({ size: 100 });

    const s = useGameStore.getState();
    expect(s.scene.maps[0]!.grid.size).toBe(100);
    expect(s.scene.maps[1]!.grid.size).toBe(DEFAULT_GRID.size);
    expect(s.scene.grid.size).toBe(100); // дефолт комнаты — последняя сетка

    expect(emitted.filter((e) => e.event === 'grid:update')).toEqual([
      { event: 'grid:update', payload: { mapId: 'm1', grid: { ...DEFAULT_GRID, size: 100 } } },
    ]);
  });

  it('updateGrid с mapId меняет указанную карту, не трогая вид и соседей', () => {
    useGameStore.getState().updateGrid({ size: 40 }, 'm2');
    const s = useGameStore.getState();
    expect(s.scene.maps[1]!.grid.size).toBe(40);
    expect(s.scene.maps[0]!.grid.size).toBe(DEFAULT_GRID.size);
    expect(emitted.at(-1)?.payload).toMatchObject({ mapId: 'm2', grid: { size: 40 } });
  });

  it('onGridUpdate применяет чужой патч только к своей карте', () => {
    useGameStore.getState().onGridUpdate({ mapId: 'm2', grid: { ...DEFAULT_GRID, size: 70 } });
    const s = useGameStore.getState();
    expect(s.scene.maps[1]!.grid.size).toBe(70);
    expect(s.scene.maps[1]!.fog.size).toBe(70);
    expect(s.scene.maps[0]!.grid.size).toBe(DEFAULT_GRID.size);
  });
});
