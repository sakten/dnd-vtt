import { useRef, useState } from 'react';
import type { MapInfo } from 'shared';
import { useGameStore } from '../store/useGameStore';
import { fogCellsAround, fogCellsBetween, withFogCells, type RectPreview, type WorldPoint } from './fog';

/** Кисть тумана DM: мгновенная роспись или прямоугольник по драгу. */
export function useFogBrush(map: MapInfo | null | undefined) {
  const fogMode = useGameStore((s) => s.fogMode);
  const updateFog = useGameStore((s) => s.updateFog);
  const paintRef = useRef<{ pressed: boolean; start: WorldPoint | null }>({ pressed: false, start: null });
  const [rectPreview, setRectPreview] = useState<RectPreview | null>(null);

  const apply = (keys: string[]) => {
    if (!map || keys.length === 0) return;
    updateFog(map.id, withFogCells(map.fog, keys, fogMode.action));
  };

  const begin = (w: WorldPoint) => {
    if (!map) return;
    paintRef.current.pressed = true;
    if (fogMode.tool === 'rect') {
      paintRef.current.start = w;
      setRectPreview({ x0: w.x, y0: w.y, x1: w.x, y1: w.y });
    } else {
      apply(fogCellsAround(w, fogMode.brush, map.fog));
    }
  };

  const move = (w: WorldPoint) => {
    if (!map || !paintRef.current.pressed) return;
    if (fogMode.tool === 'rect' && paintRef.current.start) {
      setRectPreview({ x0: paintRef.current.start.x, y0: paintRef.current.start.y, x1: w.x, y1: w.y });
    } else if (fogMode.tool === 'brush') {
      apply(fogCellsAround(w, fogMode.brush, map.fog));
    }
  };

  const end = () => {
    if (!map) return;
    const start = paintRef.current.start;
    if (fogMode.tool === 'rect' && start && rectPreview) {
      apply(fogCellsBetween(start, { x: rectPreview.x1, y: rectPreview.y1 }, map.fog));
    }
    cancel();
  };

  const cancel = () => {
    paintRef.current = { pressed: false, start: null };
    setRectPreview(null);
  };

  return { rectPreview, begin, move, end, cancel };
}
