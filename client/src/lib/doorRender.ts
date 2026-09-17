import type { Wall } from 'shared';

export interface DoorGeometry {
  /** Петля — первая точка сегмента (x1,y1). */
  hinge: { x: number; y: number };
  /** Вторая точка сегмента (косяк с другой стороны). */
  tip: { x: number; y: number };
  length: number;
  /** Угол створки в закрытом состоянии (Konva: градусы, по часовой стрелке). */
  closedAngleDeg: number;
  /** Угол открытой створки — поворот на 90° вправо от направления x1→x2. */
  openAngleDeg: number;
  /** Единичная нормаль вправо от направления x1→x2 (для косяков). */
  rightNormal: { x: number; y: number };
}

export function doorGeometry(door: Wall): DoorGeometry {
  const dx = door.x2 - door.x1;
  const dy = door.y2 - door.y1;
  const length = Math.hypot(dx, dy);
  const closedAngleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
  return {
    hinge: { x: door.x1, y: door.y1 },
    tip: { x: door.x2, y: door.y2 },
    length,
    closedAngleDeg,
    openAngleDeg: closedAngleDeg + 90,
    rightNormal: length > 0 ? { x: -dy / length, y: dx / length } : { x: 0, y: 0 },
  };
}

/** Конец створки в заданном состоянии — для тестов и подписей. */
export function doorLeafEnd(door: Wall, open: boolean): { x: number; y: number } {
  const g = doorGeometry(door);
  const rad = ((open ? g.openAngleDeg : g.closedAngleDeg) * Math.PI) / 180;
  return { x: g.hinge.x + Math.cos(rad) * g.length, y: g.hinge.y + Math.sin(rad) * g.length };
}
