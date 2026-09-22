import { describe, expect, it } from 'vitest';
import { makeCombatRoom, makeToken } from '../test/fixtures';
import { makeConnCtx } from '../test/ctx';
import { executeTeleport, teleportIssue } from './teleport';

function setup() {
  const caster = makeToken('c', { x: 100, y: 100 });
  const room = makeCombatRoom([caster]);
  const map = room.scene.maps[0]!;
  map.width = 1000;
  map.height = 1000;
  map.grid = { size: 50, color: '#fff', opacity: 0.3, visible: true, offsetX: 0, offsetY: 0, snap: true };
  const f = makeConnCtx(room, { dm: true, all: true });
  return { caster, room, map, f };
}

describe('телепорт (Misty Step)', () => {
  it('свободная точка в 30 футах: проверка проходит, кастер переносится', () => {
    const { caster, room, f } = setup();
    expect(teleportIssue(room, 'm1', caster, { x: 200, y: 100 }, 30)).toBeUndefined();
    executeTeleport(f.ctx, room, 'm1', caster, { x: 200, y: 100 });
    expect(caster.x).toBe(225);
    expect(caster.y).toBe(125);
  });

  it('дальше 30 футов — outOfRange', () => {
    const { caster, room } = setup();
    expect(teleportIssue(room, 'm1', caster, { x: 500, y: 100 }, 30)?.code).toBe('outOfRange');
  });

  it('занятая клетка — teleportNoSpace', () => {
    const { caster, room } = setup();
    const blocker = makeToken('b', { x: 225, y: 125 });
    room.scene.maps[0]!.tokens.push(blocker);
    expect(teleportIssue(room, 'm1', caster, { x: 200, y: 100 }, 30)?.code).toBe('teleportNoSpace');
  });

  it('стена между кастером и точкой — noClearPath', () => {
    const { caster, room } = setup();
    room.scene.maps[0]!.walls = [{ id: 'w1', x1: 150, y1: 0, x2: 150, y2: 200, kind: 'wall', open: false }];
    expect(teleportIssue(room, 'm1', caster, { x: 200, y: 100 }, 30)?.code).toBe('noClearPath');
  });
});
