import { describe, expect, it } from 'vitest';
import { canDragToken, screenToWorld, tokenClickMode, type TokenDragState } from './tokenInteraction';

describe('screenToWorld', () => {
  it('учитывает pan и масштаб сцены', () => {
    expect(screenToWorld({ x: 300, y: 200 }, { x: 100, y: 50, scaleX: 2, scaleY: 4 })).toEqual({ x: 100, y: 37.5 });
  });
});

describe('tokenClickMode', () => {
  const base = { wallsMode: { active: false }, lightMode: { active: false }, interaction: null };

  it('инструменты стен/света игнорируют клик по токену', () => {
    expect(tokenClickMode({ ...base, wallsMode: { active: true } })).toBe('ignore');
    expect(tokenClickMode({ ...base, lightMode: { active: true } })).toBe('ignore');
  });

  it('различает режимы прицеливания', () => {
    expect(tokenClickMode({ ...base, interaction: { mode: 'target' } })).toBe('target');
    expect(tokenClickMode({ ...base, interaction: { mode: 'multi' } })).toBe('multi');
    expect(tokenClickMode({ ...base, interaction: { mode: 'scatter', scatter: { phase: 'targets' } } })).toBe('scatter');
    expect(tokenClickMode({ ...base, interaction: { mode: 'aim' } })).toBe('aim');
  });

  it('без прицеливания — обычный выбор', () => {
    expect(tokenClickMode(base)).toBe('select');
  });
});

describe('canDragToken', () => {
  const free: TokenDragState = {
    lockedByOther: false,
    moving: false,
    fogActive: false,
    lightActive: false,
    wallsActive: false,
    targeting: false,
    aim: false,
    multiTarget: false,
    scatter: false,
    canMove: true,
    isDm: false,
    movementBlocked: false,
  };

  it('разрешает свободный токен', () => {
    expect(canDragToken(free)).toBe(true);
  });

  it('блокирует лок, движение, инструменты и прицеливание', () => {
    expect(canDragToken({ ...free, lockedByOther: true })).toBe(false);
    expect(canDragToken({ ...free, moving: true })).toBe(false);
    expect(canDragToken({ ...free, fogActive: true })).toBe(false);
    expect(canDragToken({ ...free, lightActive: true })).toBe(false);
    expect(canDragToken({ ...free, wallsActive: true })).toBe(false);
    expect(canDragToken({ ...free, targeting: true })).toBe(false);
    expect(canDragToken({ ...free, aim: true })).toBe(false);
    expect(canDragToken({ ...free, multiTarget: true })).toBe(false);
    expect(canDragToken({ ...free, scatter: true })).toBe(false);
  });

  it('учитывает права и состояние движения', () => {
    expect(canDragToken({ ...free, canMove: false })).toBe(false);
    expect(canDragToken({ ...free, movementBlocked: true })).toBe(false);
    expect(canDragToken({ ...free, movementBlocked: true, isDm: true })).toBe(true);
  });
});
