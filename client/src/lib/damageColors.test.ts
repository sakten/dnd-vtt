import { describe, expect, it } from 'vitest';
import { ARCANE_COLOR, damageTypeColor } from './damageColors';

describe('damageTypeColor', () => {
  it('знает канонические типы', () => {
    expect(damageTypeColor('fire')).toBe('#ff8a2b');
    expect(damageTypeColor('cold')).toBe('#7fd4ff');
    expect(damageTypeColor('necrotic')).toBe('#a06bff');
  });

  it('без типа и для неизвестного — undefined', () => {
    expect(damageTypeColor(undefined)).toBeUndefined();
    expect(damageTypeColor('unknown')).toBeUndefined();
  });

  it('нейтральный цвет объявлен', () => {
    expect(ARCANE_COLOR).toBe('#8fb7ff');
  });
});
