import { describe, expect, it } from 'vitest';
import { DEFAULT_GRID } from 'shared';
import { makeCombatRoom, makeToken } from '../test/fixtures';
import { gridOfToken, gridSizeOfMap, gridSizeOfToken } from './helpers';

describe('резолвер сетки', () => {
  it('gridSizeOfMap: размер карты, дефолт 50', () => {
    const room = makeCombatRoom([]);
    expect(gridSizeOfMap(room.scene.maps[0]!)).toBe(50);
    room.scene.maps[0]!.grid = { ...DEFAULT_GRID, size: 100 };
    expect(gridSizeOfMap(room.scene.maps[0]!)).toBe(100);
  });

  it('gridOfToken: сетка карты токена, иначе дефолт комнаты', () => {
    const onMap = makeToken('t1');
    const room = makeCombatRoom([onMap]);
    expect(gridSizeOfToken(room, onMap)).toBe(50);

    room.scene.maps[0]!.grid = { ...DEFAULT_GRID, size: 70 };
    expect(gridSizeOfToken(room, onMap)).toBe(70);

    room.scene.grid = { ...DEFAULT_GRID, size: 30 };
    expect(gridSizeOfToken(room, makeToken('ghost'))).toBe(30);
    expect(gridOfToken(room, onMap).offsetX).toBe(0);
  });
});
