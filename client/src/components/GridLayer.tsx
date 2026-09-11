import { useMemo } from 'react';
import { Layer, Line } from 'react-konva';
import type { GridSettings } from 'shared';
import type { ViewState } from '../store/types';

interface Props {
  grid: GridSettings;
  view: ViewState;
  viewport: { w: number; h: number };
}

export default function GridLayer({ grid, view, viewport }: Props) {
  const lines = useMemo(() => {
    if (!grid.visible || viewport.w === 0 || viewport.h === 0) return [];
    const worldLeft = -view.x / view.scale;
    const worldTop = -view.y / view.scale;
    const worldRight = (viewport.w - view.x) / view.scale;
    const worldBottom = (viewport.h - view.y) / view.scale;
    const s = grid.size;

    const result: number[][] = [];
    const startK = Math.floor((worldLeft - grid.offsetX) / s);
    const endK = Math.ceil((worldRight - grid.offsetX) / s);
    for (let k = startK; k <= endK; k++) {
      const px = grid.offsetX + k * s;
      result.push([px, worldTop, px, worldBottom]);
    }
    const startJ = Math.floor((worldTop - grid.offsetY) / s);
    const endJ = Math.ceil((worldBottom - grid.offsetY) / s);
    for (let j = startJ; j <= endJ; j++) {
      const py = grid.offsetY + j * s;
      result.push([worldLeft, py, worldRight, py]);
    }
    return result;
  }, [grid, view, viewport]);

  if (lines.length === 0) return null;

  return (
    <Layer listening={false}>
      {lines.map((pts, i) => (
        <Line key={i} points={pts} stroke={grid.color} strokeWidth={1} opacity={grid.opacity} />
      ))}
    </Layer>
  );
}
