import type { DragEvent, RefObject } from 'react';
import { snapToGrid } from 'shared';
import { useGameStore } from '../store/useGameStore';
import { activeGridOf } from '../store/selectors';
import { canAddLibraryItem } from './control';

/** Перетаскивание предмета библиотеки на стол (drop из панели) с привязкой к сетке. */
export function useTokenDrop(containerRef: RefObject<HTMLDivElement | null>) {
  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData('application/x-vtt-token');
    if (!raw) return;
    let item: { id?: string; cells?: number; isPlayerToken?: boolean; owner?: string };
    try {
      item = JSON.parse(raw) as { id?: string; cells?: number; isPlayerToken?: boolean; owner?: string };
    } catch {
      return;
    }
    if (!item.id) return;
    if (
      !canAddLibraryItem({
        id: item.id,
        isPlayerToken: item.isPlayerToken === true,
        owner: item.owner ?? '',
      })
    ) {
      return;
    }
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const st = useGameStore.getState();
    const grid = activeGridOf(st);
    const { view } = st;
    let wx = (sx - view.x) / view.scale;
    let wy = (sy - view.y) / view.scale;
    if (grid.snap) {
      const cells = item.cells ?? 1;
      wx = snapToGrid(wx, grid.offsetX, grid.size, cells);
      wy = snapToGrid(wy, grid.offsetY, grid.size, cells);
    }
    st.addTokenAt(item.id, wx, wy);
  };

  return { onDragOver, onDrop };
}
