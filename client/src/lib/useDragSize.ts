import { useCallback, useEffect, useRef, useState } from 'react';

type Axis = 'x' | 'y';

/**
 * Размер панели перетаскиванием её края: `x` — за левый край (ширина),
 * `y` — за верхний (высота). Значение хранится в localStorage; `null` — авторазмер
 * (до первого перетаскивания, стартовое значение берёт `measure`).
 */
export function useDragSize(
  key: string,
  axis: Axis,
  clamp: (value: number) => number,
  initial: number | null,
  measure: () => number
): {
  size: number | null;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
} {
  const [size, setSize] = useState<number | null>(() => {
    const raw = Number(localStorage.getItem(key));
    return Number.isFinite(raw) && raw > 0 ? clamp(raw) : initial;
  });
  const start = useRef({ pos: 0, size: 0 });

  useEffect(() => {
    if (size != null) localStorage.setItem(key, String(Math.round(size)));
  }, [key, size]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      const el = e.target as Element;
      el.setPointerCapture?.(e.pointerId);
      const current = clamp(size ?? measure());
      start.current = { pos: axis === 'x' ? e.clientX : e.clientY, size: current };
      setSize(current);
    },
    [axis, clamp, measure, size]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const el = e.target as Element;
      if (!el.hasPointerCapture?.(e.pointerId)) return;
      const cur = axis === 'x' ? e.clientX : e.clientY;
      setSize(clamp(start.current.size + start.current.pos - cur));
    },
    [axis, clamp]
  );

  return { size, onPointerDown, onPointerMove };
}
