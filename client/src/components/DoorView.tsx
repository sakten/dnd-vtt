import { useEffect, useRef } from 'react';
import { Line } from 'react-konva';
import Konva from 'konva';
import type { Wall } from 'shared';
import { doorGeometry } from '../lib/doorRender';

const LEAF_CLOSED = '#e0a458';
const LEAF_OPEN = '#4ecb71';
const LEAF_HOVER = '#7c9cff';
const JAMB = '#e6e8ee';

interface DoorViewProps {
  door: Wall;
  scale: number;
  hovered: boolean;
}

/**
 * Дверь: косяки на концах сегмента + створка на петле (x1,y1).
 * Открытие анимируется поворотом на 90° (200 мс); при первом рендере — без анимации.
 */
export default function DoorView({ door, scale, hovered }: DoorViewProps) {
  const g = doorGeometry(door);
  const open = door.open === true;
  const leafRef = useRef<Konva.Line>(null);
  const wasOpen = useRef(open);
  // Стартовый угол фиксируем на монтировании: дальше узел двигает Tween, а не проп.
  const initialRotation = useRef(open ? g.openAngleDeg : g.closedAngleDeg);

  useEffect(() => {
    if (wasOpen.current === open) return;
    wasOpen.current = open;
    leafRef.current?.to({
      rotation: open ? g.openAngleDeg : g.closedAngleDeg,
      duration: 0.2,
      easing: Konva.Easings.EaseOut,
    });
  }, [open, g.openAngleDeg, g.closedAngleDeg]);

  const leafColor = hovered ? LEAF_HOVER : open ? LEAF_OPEN : LEAF_CLOSED;
  const jamb = 6 / scale;

  return (
    <>
      {open && (
        <Line
          points={[door.x1, door.y1, door.x2, door.y2]}
          stroke={hovered ? LEAF_HOVER : LEAF_OPEN}
          strokeWidth={2 / scale}
          dash={[6 / scale, 6 / scale]}
          opacity={0.35}
          listening={false}
        />
      )}
      <Line
        points={[
          door.x1 - g.rightNormal.x * jamb,
          door.y1 - g.rightNormal.y * jamb,
          door.x1 + g.rightNormal.x * jamb,
          door.y1 + g.rightNormal.y * jamb,
        ]}
        stroke={JAMB}
        strokeWidth={4 / scale}
        lineCap="round"
        opacity={0.9}
        listening={false}
      />
      <Line
        points={[
          door.x2 - g.rightNormal.x * jamb,
          door.y2 - g.rightNormal.y * jamb,
          door.x2 + g.rightNormal.x * jamb,
          door.y2 + g.rightNormal.y * jamb,
        ]}
        stroke={JAMB}
        strokeWidth={4 / scale}
        lineCap="round"
        opacity={0.9}
        listening={false}
      />
      <Line
        ref={leafRef}
        x={g.hinge.x}
        y={g.hinge.y}
        points={[0, 0, g.length, 0]}
        rotation={initialRotation.current}
        stroke={leafColor}
        strokeWidth={(hovered ? 7 : 5) / scale}
        lineCap="round"
        opacity={open ? 0.8 : 0.95}
        listening={false}
      />
    </>
  );
}
