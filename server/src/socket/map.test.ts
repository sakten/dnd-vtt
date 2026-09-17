import { describe, expect, it } from 'vitest';
import { DEFAULT_GRID, emptyCombatState } from 'shared';
import { makeConnCtx } from '../test/ctx';
import { makeRoom, makeToken } from '../test/fixtures';
import { registerMapHandlers } from './map';

/** Комната с двумя картами: своя сетка, туман и токен у каждой. */
function makeTwoMapRoom() {
  const room = makeRoom();
  room.scene.maps[0]!.tokens.push(makeToken('t1', { x: 13, y: 17 }));
  room.scene.maps.push({
    ...room.scene.maps[0]!,
    id: 'm2',
    name: 'M2',
    tokens: [makeToken('t2', { x: 13, y: 17, w: 30, h: 30 })],
    grid: { ...DEFAULT_GRID, size: 30 },
    fog: { size: 30, offsetX: 0, offsetY: 0, hidden: [] },
    combat: emptyCombatState(),
  });
  return room;
}

describe('grid:update (независимые сетки карт)', () => {
  it('DM меняет сетку только выбранной карты, соседняя не тронута', () => {
    const room = makeTwoMapRoom();
    const dm = makeConnCtx(room, { dm: true });
    registerMapHandlers(dm.ctx);

    dm.invoke('grid:update', { mapId: 'm1', grid: { ...DEFAULT_GRID, size: 70 } });

    const m1 = room.scene.maps[0]!;
    expect(m1.grid.size).toBe(70);
    expect(m1.fog.size).toBe(70);
    expect(m1.tokens[0]!.w).toBe(70);
    expect(m1.tokens[0]!.x).toBe(35); // снап по новой сетке (клетка 1, чётная привязка)

    const m2 = room.scene.maps[1]!;
    expect(m2.grid.size).toBe(30);
    expect(m2.fog.size).toBe(30);
    expect(m2.tokens[0]!.w).toBe(30);
    expect(m2.tokens[0]!.x).toBe(13);

    // Дефолт комнаты — последняя настроенная сетка (для новых карт).
    expect(room.scene.grid.size).toBe(70);
    const sent = dm.emitted.filter((e) => e.event === 'grid:update');
    expect(sent[0]!.payload).toMatchObject({ mapId: 'm1', grid: { size: 70 } });
  });

  it('игрок не может менять сетку', () => {
    const room = makeTwoMapRoom();
    const player = makeConnCtx(room, { playerId: 'p1' });
    registerMapHandlers(player.ctx);

    player.invoke('grid:update', { mapId: 'm1', grid: { ...DEFAULT_GRID, size: 70 } });
    expect(room.scene.maps[0]!.grid.size).toBe(DEFAULT_GRID.size);
    expect(room.scene.maps[0]!.tokens[0]!.w).toBe(50);
  });

  it('map:add принимает сетку новой карты (авто-выравнивание)', () => {
    const room = makeTwoMapRoom();
    const dm = makeConnCtx(room, { dm: true });
    registerMapHandlers(dm.ctx);

    dm.invoke('map:add', {
      name: 'Новая',
      url: '/uploads/new.png',
      width: 800,
      height: 600,
      grid: { ...DEFAULT_GRID, size: 25 },
    });

    const added = room.scene.maps[2]!;
    expect(added.grid.size).toBe(25);
    expect(added.fog.size).toBe(25);
    // Существующие карты не изменились.
    expect(room.scene.maps[0]!.grid.size).toBe(50);
    expect(room.scene.maps[1]!.grid.size).toBe(30);
  });
});
