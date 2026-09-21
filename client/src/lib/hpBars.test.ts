import { describe, expect, it } from 'vitest';
import { hpBarHeight, hpBarLayout } from './hpBars';

const base = {
  w: 50,
  h: 50,
  scale: 1,
  hpCurrent: 20,
  hpMax: 20,
  tempValue: 0,
  tempMax: 0,
};

describe('hpBarLayout', () => {
  it('без временных HP: только полоса HP, серая отсутствует', () => {
    const layout = hpBarLayout(base);
    expect(layout.temp).toBeNull();
    expect(layout.hp.y).toBe(-50 / 2 - 9);
    expect(layout.hp.width).toBe(50);
    expect(layout.tempSectors).toEqual([]);
  });

  it('серая полоса строго над полосой HP и не перекрывает её', () => {
    const layout = hpBarLayout({ ...base, tempValue: 6, tempMax: 6 });
    expect(layout.temp).not.toBeNull();
    const barH = hpBarHeight(1);
    expect(layout.temp!.y + barH).toBeLessThan(layout.hp.y);
    expect(layout.hp.y).toBe(-50 / 2 - 9);
  });

  it('ширина серой полосы — от максимума пула формы', () => {
    const layout = hpBarLayout({ ...base, tempValue: 3, tempMax: 6 });
    expect(layout.temp!.width).toBe(25);
    expect(hpBarLayout({ ...base, tempValue: 6, tempMax: 6 }).temp!.width).toBe(50);
  });

  it('сектора каждые 10 HP: 25 HP — отметки на 10 и 20', () => {
    const layout = hpBarLayout({ ...base, hpCurrent: 25, hpMax: 25 });
    expect(layout.hpSectors).toEqual([10 / 25, 20 / 25]);
  });

  it('до 10 HP секторов нет; 100 HP — девять отметок', () => {
    expect(hpBarLayout({ ...base, hpCurrent: 8, hpMax: 8 }).hpSectors).toEqual([]);
    const hundred = hpBarLayout({ ...base, hpCurrent: 100, hpMax: 100 });
    expect(hundred.hpSectors).toHaveLength(9);
    expect(hundred.hpSectors[0]).toBe(0.1);
  });

  it('значения вне диапазона зажимаются', () => {
    const layout = hpBarLayout({ ...base, hpCurrent: 30, tempValue: 99, tempMax: 6 });
    expect(layout.hp.width).toBe(50);
    expect(layout.temp!.width).toBe(50);
  });
});
