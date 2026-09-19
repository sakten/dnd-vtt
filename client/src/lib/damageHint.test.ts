import { describe, expect, it } from 'vitest';
import { applyDamageHint, damageTypeHint } from './damageHint';

describe('damageTypeHint', () => {
  it('подсказывает типы после кубика', () => {
    expect(damageTypeHint('1d6fi')).toMatchObject({ start: 3, caret: 5, partial: 'fi', options: ['fire'] });
    expect(damageTypeHint('2d4f')?.options).toEqual(['fire', 'force']);
    expect(damageTypeHint('1d6+2d4ne')?.options).toEqual(['necrotic']);
    expect(damageTypeHint('1d6 + 2d4fi')).toMatchObject({ start: 9, caret: 11 });
  });

  it('подсказывает после числового модификатора', () => {
    expect(damageTypeHint('1d8+3fo')?.options).toEqual(['force']);
  });

  it('полный тип не подсказывает', () => {
    expect(damageTypeHint('1d6fire')).toBeUndefined();
    expect(damageTypeHint('1d6firex')).toBeUndefined();
  });

  it('обычный текст и числа без терма не трогает', () => {
    expect(damageTypeHint('привет')).toBeUndefined();
    expect(damageTypeHint('2 фляги')).toBeUndefined();
    expect(damageTypeHint('')).toBeUndefined();
    expect(damageTypeHint('d20+st')).toBeUndefined();
  });

  it('учитывает позицию каретки', () => {
    expect(damageTypeHint('1d6fi + 3', 5)?.options).toEqual(['fire']);
    expect(damageTypeHint('1d6fi + 3', 9)).toBeUndefined();
  });

  it('дописывает тип, не удаляя кубик и модификатор', () => {
    expect(applyDamageHint('d20fi', damageTypeHint('d20fi')!, 'fire')).toEqual({ text: 'd20fire', caret: 7 });
    expect(applyDamageHint('1d8+3fo', damageTypeHint('1d8+3fo')!, 'force')).toEqual({ text: '1d8+3force', caret: 10 });
    expect(applyDamageHint('1d6+2d4ne', damageTypeHint('1d6+2d4ne')!, 'necrotic')).toEqual({
      text: '1d6+2d4necrotic',
      caret: 15,
    });
    expect(applyDamageHint('1d6 + 2d4fi', damageTypeHint('1d6 + 2d4fi')!, 'fire')).toEqual({
      text: '1d6 + 2d4fire',
      caret: 13,
    });
  });
});
