import { useState } from 'react';
import { snapToGrid, type MapInfo } from 'shared';
import { useGameStore } from '../store/useGameStore';
import { newId } from './id';
import type { RectPreview, WorldPoint } from './fog';

/** Кисть областей тьмы/магли DM: прямоугольник по драгу, привязка к сетке. */
export function useAreaBrush(map: MapInfo | null | undefined) {
  const lightMode = useGameStore((s) => s.lightMode);
  const updateAreas = useGameStore((s) => s.updateAreas);
  const [rectPreview, setRectPreview] = useState<RectPreview | null>(null);

  const snap = (p: WorldPoint): WorldPoint => ({
    x: snapToGrid(p.x, map?.grid.offsetX ?? 0, map?.grid.size ?? 50, 0),
    y: snapToGrid(p.y, map?.grid.offsetY ?? 0, map?.grid.size ?? 50, 0),
  });

  const begin = (w: WorldPoint) => {
    setRectPreview({ x0: w.x, y0: w.y, x1: w.x, y1: w.y });
  };

  const move = (w: WorldPoint) => {
    setRectPreview((prev) => (prev ? { ...prev, x1: w.x, y1: w.y } : prev));
  };

  const end = () => {
    if (!map || !rectPreview) {
      cancel();
      return;
    }
    const size = map.grid.size || 50;
    const s1 = snap({ x: rectPreview.x0, y: rectPreview.y0 });
    const s2 = snap({ x: rectPreview.x1, y: rectPreview.y1 });
    const x = Math.min(s1.x, s2.x);
    const y = Math.min(s1.y, s2.y);
    const w = Math.max(s1.x, s2.x) - x;
    const h = Math.max(s1.y, s2.y) - y;
    if (w >= size && h >= size) {
      updateAreas(map.id, [...map.lightAreas, { id: newId(), kind: lightMode.kind, x, y, w, h }]);
    }
    cancel();
  };

  const cancel = () => setRectPreview(null);

  return { rectPreview, begin, move, end, cancel };
}
