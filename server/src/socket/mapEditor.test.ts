import { describe, expect, it } from 'vitest';
import { makeCombatRoom, makeToken } from '../test/fixtures';
import { makeConnCtx } from '../test/ctx';

function setup() {
  const room = makeCombatRoom([makeToken('t1')]);
  return { room, f: makeConnCtx(room, { all: true, dm: true }) };
}

describe('map editor handlers', () => {
  it('fog:update нормализует клетки и рассылает туман', () => {
    const { room, f } = setup();
    f.invoke('fog:update', {
      mapId: 'm1',
      fog: { size: 50, offsetX: 0, offsetY: 0, hidden: ['0,0', 'bad', '1,-2'] },
    });

    expect(room.scene.maps[0]!.fog).toMatchObject({ size: 50, hidden: ['0,0', '1,-2'] });
    expect(f.emitted.some((e) => e.event === 'fog:update')).toBe(true);
  });

  it('fog:update отклоняет невалидный размер и не-DM', () => {
    const { room, f } = setup();
    const before = room.scene.maps[0]!.fog;
    f.invoke('fog:update', { mapId: 'm1', fog: { size: 1, offsetX: 0, offsetY: 0, hidden: [] } });
    expect(room.scene.maps[0]!.fog).toEqual(before);

    const player = makeConnCtx(room, { all: true });
    player.invoke('fog:update', { mapId: 'm1', fog: { size: 50, offsetX: 0, offsetY: 0, hidden: ['9,9'] } });
    expect(room.scene.maps[0]!.fog).toEqual(before);
  });

  it('walls:update фильтрует неизвестные типы и настройки не-дверей', () => {
    const { room, f } = setup();
    f.invoke('walls:update', {
      mapId: 'm1',
      walls: [
        { id: 'w1', kind: 'wall', x1: 0, y1: 0, x2: 50, y2: 0, dmOnly: true, pickDc: 15 },
        { id: 'd1', kind: 'door', x1: 0, y1: 0, x2: 50, y2: 0, open: true, dmOnly: true, pickDc: 99 },
        { id: 'bad', kind: 'lava', x1: 0, y1: 0, x2: 1, y2: 1 },
        { id: 'bad2', kind: 'wall', x1: 'x', y1: 0, x2: 1, y2: 1 },
      ],
    } as never);

    expect(room.scene.maps[0]!.walls).toEqual([
      { id: 'w1', kind: 'wall', x1: 0, y1: 0, x2: 50, y2: 0 },
      { id: 'd1', kind: 'door', x1: 0, y1: 0, x2: 50, y2: 0, open: true, dmOnly: true, pickDc: 40 },
    ]);
  });

  it('vision:update и map add/rename/remove меняют сцену', () => {
    const { room, f } = setup();
    f.invoke('vision:update', { mapId: 'm1', vision: { los: true, darkness: true } });
    expect(room.scene.maps[0]!.vision).toEqual({ los: true, darkness: true });

    f.invoke('map:add', { name: 'Новая', url: '/uploads/x.png', width: 800, height: 600 });
    const added = room.scene.maps.find((m) => m.name === 'Новая');
    expect(added).toBeTruthy();

    f.invoke('map:rename', { id: added!.id, name: 'Переименована' });
    expect(room.scene.maps.find((m) => m.id === added!.id)?.name).toBe('Переименована');

    f.invoke('map:remove', added!.id);
    expect(room.scene.maps.some((m) => m.id === added!.id)).toBe(false);
  });
});
