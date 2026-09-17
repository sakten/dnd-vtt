import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_GRID, MAX_FOG_CELLS, MAX_LIGHT_AREAS, MAX_WALL_SEGMENTS } from 'shared';
import { fakeSocket, makeScene, type EmittedEvent } from '../../test/fixtures';
import { clearThrottled } from '../helpers';
import { useGameStore } from '../useGameStore';

let emitted: EmittedEvent[] = [];

beforeEach(() => {
  const fake = fakeSocket();
  emitted = fake.emitted;
  for (const key of ['grid:m1', 'grid:m2', 'fog:m1', 'walls:m1', 'areas:m1']) clearThrottled(key);
  useGameStore.setState({
    socket: fake.socket,
    scene: makeScene(),
    viewMapId: 'm1',
    chatError: null,
  });
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

describe('maps slice: лимиты патчей (как на сервере)', () => {  it('updateFog обрезает клетки тумана и сообщает', () => {
    const hidden = Array.from({ length: MAX_FOG_CELLS + 3 }, (_, i) => `${i},0`);
    const fog = { ...useGameStore.getState().scene.maps[0]!.fog, hidden };
    useGameStore.getState().updateFog('m1', fog);

    const s = useGameStore.getState();
    expect(s.scene.maps[0]!.fog.hidden.length).toBe(MAX_FOG_CELLS);
    expect(s.chatError).toContain('лимит');
    const sent = emitted.find((e) => e.event === 'fog:update');
    expect((sent!.payload as { fog: { hidden: string[] } }).fog.hidden.length).toBe(MAX_FOG_CELLS);
  });

  it('updateWalls обрезает сегменты стен', () => {
    const walls = Array.from({ length: MAX_WALL_SEGMENTS + 1 }, (_, i) => ({
      id: `w${i}`,
      kind: 'wall' as const,
      x1: 0,
      y1: 0,
      x2: 50,
      y2: 0,
    }));
    useGameStore.getState().updateWalls('m1', walls);

    const s = useGameStore.getState();
    expect(s.scene.maps[0]!.walls.length).toBe(MAX_WALL_SEGMENTS);
    expect(s.chatError).toContain('лимит');
    const sent = emitted.find((e) => e.event === 'walls:update');
    expect((sent!.payload as { walls: unknown[] }).walls.length).toBe(MAX_WALL_SEGMENTS);
  });

  it('updateAreas обрезает области тьмы', () => {
    const areas = Array.from({ length: MAX_LIGHT_AREAS + 1 }, (_, i) => ({
      id: `a${i}`,
      kind: 'darkness' as const,
      x: 0,
      y: 0,
      w: 50,
      h: 50,
    }));
    useGameStore.getState().updateAreas('m1', areas);

    const s = useGameStore.getState();
    expect(s.scene.maps[0]!.lightAreas.length).toBe(MAX_LIGHT_AREAS);
    expect(s.chatError).toContain('лимит');
  });

  it('toggleDoor шлёт door:toggle с mapId активной карты', () => {
    useGameStore.getState().toggleDoor('d1');
    expect(emitted).toEqual([{ event: 'door:toggle', payload: { mapId: 'm1', wallId: 'd1' } }]);
  });
});
