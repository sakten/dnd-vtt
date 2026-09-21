/**
 * Раскладка полосок HP и временных HP (пула формы) над токеном.
 * Чистая функция: позиции/ширины и доли разделителей секций по 10 HP.
 * Серая полоса временных HP всегда строго над полосой HP.
 */
export interface HpBarLayout {
  hp: { y: number; width: number };
  temp: { y: number; width: number } | null;
  /** Доли ширины (0..1), где проходят разделители секций (по 10 HP). */
  hpSectors: number[];
  tempSectors: number[];
}

export interface HpBarInput {
  /** Ширина/высота подошвы токена в мировых единицах. */
  w: number;
  h: number;
  scale: number;
  hpCurrent: number;
  hpMax: number;
  tempValue: number;
  tempMax: number;
}

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0);

const sectors = (max: number): number[] => {
  if (!Number.isFinite(max) || max <= 10) return [];
  const out: number[] = [];
  for (let hp = 10; hp < max; hp += 10) out.push(hp / max);
  return out;
};

export function hpBarLayout(input: HpBarInput): HpBarLayout {
  const scale = input.scale || 1;
  const barH = 8 / scale;
  const gap = 3 / scale;
  const hpY = -input.h / 2 - 9 / scale;
  const tempY = hpY - barH - gap;
  const hasTemp = input.tempValue > 0 && input.tempMax > 0;
  return {
    hp: { y: hpY, width: clamp01(input.hpCurrent / input.hpMax) * input.w },
    temp: hasTemp ? { y: tempY, width: clamp01(input.tempValue / input.tempMax) * input.w } : null,
    hpSectors: sectors(input.hpMax),
    tempSectors: hasTemp ? sectors(input.tempMax) : [],
  };
}

/** Высота полоски в мировых единицах при данном масштабе. */
export const hpBarHeight = (scale: number): number => 8 / (scale || 1);
