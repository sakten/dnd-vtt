import { describe, expect, it } from 'vitest';
import type { Faction } from '../domain/core';
import type { Token } from '../domain/token';
import type { Wall } from '../domain/scene';
import { isSurrounded } from './optional';

const SIZE = 50;
const grid = { size: SIZE, offsetX: 0, offsetY: 0 };

/** Токен 1×1 в клетке (cx, cy). */
function at(id: string, cx: number, cy: number, faction: Faction): Token {
  return {
    id,
    x: (cx + 0.5) * SIZE,
    y: (cy + 0.5) * SIZE,
    w: SIZE,
    h: SIZE,
    faction,
    conditions: [],
  } as unknown as Token;
}

const target = at('t', 2, 2, 'ally');
const enemy = (id: string, cx: number, cy: number) => at(id, cx, cy, 'enemy');

describe('isSurrounded (опциональное правило)', () => {
  it('один смежный враг не считается', () => {
    expect(isSurrounded({ target, tokens: [target, enemy('e1', 2, 1)], grid })).toBe(false);
  });

  it('два врага с севера и юга замыкают все клетки', () => {
    expect(isSurrounded({ target, tokens: [target, enemy('e1', 2, 1), enemy('e2', 2, 3)], grid })).toBe(true);
  });

  it('два врага по диагонали не замыкают (NE/SW свободны)', () => {
    expect(isSurrounded({ target, tokens: [target, enemy('e1', 1, 1), enemy('e2', 3, 3)], grid })).toBe(false);
  });

  it('союзник рядом ломает окружение', () => {
    const ally = at('a1', 3, 2, 'ally');
    expect(isSurrounded({ target, tokens: [target, enemy('e1', 2, 1), enemy('e2', 2, 3), ally], grid })).toBe(false);
  });

  it('нейтрал рядом тоже ломает окружение', () => {
    const neutral = at('n1', 1, 2, 'neutral');
    expect(isSurrounded({ target, tokens: [target, enemy('e1', 2, 1), enemy('e2', 2, 3), neutral], grid })).toBe(false);
  });

  it('стена в непокрытой клетке не учитывается', () => {
    // N и E покрывают всё, кроме SW: без стены — не окружён, со стеной — окружён.
    const tokens = [target, enemy('e1', 2, 1), enemy('e2', 3, 2)];
    expect(isSurrounded({ target, tokens, grid })).toBe(false);
    const walls: Wall[] = [{ id: 'w1', x1: 50, y1: 175, x2: 100, y2: 175, kind: 'wall' }];
    expect(isSurrounded({ target, tokens, grid, walls })).toBe(true);
  });

  it('работает в обе стороны: окружить можно и врага', () => {
    const enemyTarget = at('et', 2, 2, 'enemy');
    expect(
      isSurrounded({
        target: enemyTarget,
        tokens: [enemyTarget, at('a1', 2, 1, 'ally'), at('a2', 2, 3, 'ally')],
        grid,
      })
    ).toBe(true);
  });

  it('убитый и недееспособный враг не давят', () => {
    const stunned = at('e2', 2, 3, 'enemy');
    stunned.conditions = [{ key: 'stunned', name: 'Ошеломлён' }];
    expect(isSurrounded({ target, tokens: [target, enemy('e1', 2, 1), stunned], grid })).toBe(false);
    const dead = at('e3', 2, 3, 'enemy');
    dead.conditions = [{ key: 'dead', name: 'Мёртв' }];
    expect(isSurrounded({ target, tokens: [target, enemy('e1', 2, 1), dead], grid })).toBe(false);
  });
});
