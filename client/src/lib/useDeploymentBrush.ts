import { useState } from 'react';
import { snapToGrid, type MapInfo } from 'shared';
import { useGameStore } from '../store/useGameStore';
import { newId } from './id';
import type { RectPreview, WorldPoint } from './fog';

export function useDeploymentBrush(map: MapInfo | null | undefined) {
  const updateDeployment = useGameStore((s) => s.updateDeployment);
  const setDeploymentMode = useGameStore((s) => s.setDeploymentMode);
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
      setRectPreview(null);
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
      const deployment = map.deployment ?? { enabled: false, areas: [] };
      updateDeployment(map.id, {
        ...deployment,
        areas: [...deployment.areas, { id: newId(), x, y, w, h }],
      });
    }
    setRectPreview(null);
    setDeploymentMode({ draw: false });
  };

  const cancel = () => setRectPreview(null);

  return { rectPreview, begin, move, end, cancel };
}
