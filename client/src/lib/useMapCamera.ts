import { useEffect, useState, type RefObject } from 'react';
import type Konva from 'konva';
import { useGameStore } from '../store/useGameStore';
import type { WorldPoint } from './fog';

export interface ViewSize {
  w: number;
  h: number;
}

/** Камера стола: размер контейнера, зум колесом, панорамирование Stage, world-координаты. */
export function useMapCamera(containerRef: RefObject<HTMLDivElement | null>) {
  const setView = useGameStore((s) => s.setView);
  const setViewport = useGameStore((s) => s.setViewport);
  const [size, setSize] = useState<ViewSize>({ w: 0, h: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
      setViewport({ w: el.clientWidth, h: el.clientHeight });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [containerRef, setViewport]);

  const toWorld = (stage: Konva.Stage, p: WorldPoint): WorldPoint => ({
    x: (p.x - stage.x()) / stage.scaleX(),
    y: (p.y - stage.y()) / stage.scaleX(),
  });

  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    if (!stage) return;
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };
    const factor = e.evt.deltaY > 0 ? 1 / 1.1 : 1.1;
    const newScale = Math.min(8, Math.max(0.05, oldScale * factor));
    stage.scale({ x: newScale, y: newScale });
    stage.position({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    });
    setView({ x: stage.x(), y: stage.y(), scale: newScale });
  };

  /** Панорамирование Stage: держим view в сторе (только сам Stage, не дочерние узлы). */
  const handleStageDrag = (e: Konva.KonvaEventObject<DragEvent>) => {
    if (e.target !== e.currentTarget) return;
    setView({ x: e.currentTarget.x(), y: e.currentTarget.y(), scale: e.currentTarget.scaleX() });
  };

  return { size, toWorld, handleWheel, handleStageDrag };
}
