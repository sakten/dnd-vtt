import { describe, expect, it } from 'vitest';
import { makeCombatRoom, makeToken } from '../test/fixtures';
import { makeConnCtx } from '../test/ctx';
import { applyForcedMovement } from './force';
import { syncSurrounded } from './surrounded';

function setup() {
  const source = makeToken('a', { x: 100, y: 100 });
  const target = makeToken('b', { x: 200, y: 100 });
  const room = makeCombatRoom([source, target]);
  const map = room.scene.maps[0]!;
  map.width = 1000;
  map.height = 1000;
  const f = makeConnCtx(room, { dm: true });
  return { room, map, source, target, f };
}

describe('вынужденное перемещение (push/pull)', () => {
  it('толчок на 10 фт сдвигает на две клетки от источника', () => {
    const { room, map, source, target, f } = setup();
    applyForcedMovement(f.ctx, room, 'm1', source, target, { kind: 'push', feet: 10 });
    expect(target.x).toBe(300);
    expect(f.emitted.some((e) => e.event === 'token:update')).toBe(true);
    expect(map.tokens).toHaveLength(2);
  });

  it('сплошная стена останавливает перемещение', () => {
    const { room, source, target, f } = setup();
    room.scene.maps[0]!.walls = [{ id: 'w', x1: 240, y1: 50, x2: 240, y2: 150, kind: 'wall' }];
    applyForcedMovement(f.ctx, room, 'm1', source, target, { kind: 'push', feet: 10 });
    expect(target.x).toBe(200);
  });

  it('pull тянет к источнику, чужой токен на пути стопорит', () => {
    const { room, source, target, f } = setup();
    const blocker = makeToken('c', { x: 150, y: 100 });
    room.scene.maps[0]!.tokens.push(blocker);
    applyForcedMovement(f.ctx, room, 'm1', source, target, { kind: 'pull', feet: 10 });
    expect(target.x).toBe(200);
  });

  it('Repelling: Large двигается, Huge — нет (maxSize)', () => {
    const { room, source, f } = setup();
    const large = makeToken('l', { x: 200, y: 200, cells: 2, w: 100, h: 100 });
    const huge = makeToken('h', { x: 200, y: 400, cells: 3, w: 150, h: 150 });
    room.scene.maps[0]!.tokens.push(large, huge);

    applyForcedMovement(f.ctx, room, 'm1', source, large, { kind: 'push', feet: 10, maxSize: 'large' });
    applyForcedMovement(f.ctx, room, 'm1', source, huge, { kind: 'push', feet: 10, maxSize: 'large' });

    expect(large.x).toBeCloseTo(200 + 50 * Math.SQRT2, 3);
    expect(huge.x).toBe(200);
  });

  it('толчок разрывает окружение: авто-состояние снимается', () => {
    const victim = makeToken('v', { x: 125, y: 125, faction: 'ally' });
    const west = makeToken('e1', { x: 75, y: 125, faction: 'enemy' });
    const east = makeToken('e2', { x: 175, y: 125, faction: 'enemy' });
    const room = makeCombatRoom([victim, west, east]);
    room.scene.maps[0]!.width = 1000;
    room.scene.maps[0]!.height = 1000;
    room.optionalRules.surrounded = true;
    const f = makeConnCtx(room, { dm: true });

    syncSurrounded(f.ctx, room, 'm1');
    expect(victim.conditions.some((c) => c.key === 'surrounded')).toBe(true);

    applyForcedMovement(f.ctx, room, 'm1', victim, west, { kind: 'push', feet: 10 });
    expect(west.x).toBe(25);
    expect(victim.conditions.some((c) => c.key === 'surrounded')).toBe(false);
    expect(east.conditions.some((c) => c.key === 'surrounded')).toBe(false);
  });
});
