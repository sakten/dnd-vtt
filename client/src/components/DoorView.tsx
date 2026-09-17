import { useEffect, useRef } from 'react';
import { Circle, Group, Line, Rect } from 'react-konva';
import Konva from 'konva';
import type { Wall } from 'shared';
import { doorGeometry, doorLeaves, type DoorLeaf } from '../lib/doorRender';

const WOOD = '#8a5a2e';
const WOOD_DARK = '#4f3316';
const WOOD_SEAM = '#67431f';
const THRESHOLD = '#4ecb71';
const HOVER = '#7c9cff';

interface DoorViewProps {
  door: Wall;
  scale: number;
  hovered: boolean;
  cellPx: number;
}

interface DoorLeafViewProps {
  leaf: DoorLeaf;
  open: boolean;
  scale: number;
  stroke: string;
}

/** Створка: деревянное полотно с петлёй в начале локальной оси; открытие — поворот на 90°. */
function DoorLeafView({ leaf, open, scale, stroke }: DoorLeafViewProps) {
  const ref = useRef<Konva.Group>(null);
  const wasOpen = useRef(open);
  // Стартовый угол фиксируем на монтировании: дальше узел двигает Tween, а не проп.
  const initialRotation = useRef(open ? leaf.openAngleDeg : leaf.closedAngleDeg);

  useEffect(() => {
    if (wasOpen.current === open) return;
    wasOpen.current = open;
    ref.current?.to({
      rotation: open ? leaf.openAngleDeg : leaf.closedAngleDeg,
      duration: 0.2,
      easing: Konva.Easings.EaseOut,
    });
  }, [open, leaf.openAngleDeg, leaf.closedAngleDeg]);

  const thickness = 9 / scale;
  const seam = thickness / 6;
  const knobX = Math.max(thickness, leaf.length - thickness);

  return (
    <Group ref={ref} x={leaf.hinge.x} y={leaf.hinge.y} rotation={initialRotation.current} listening={false}>
      <Rect
        x={0}
        y={-thickness / 2}
        width={leaf.length}
        height={thickness}
        fill={WOOD}
        stroke={stroke}
        strokeWidth={1.5 / scale}
        cornerRadius={1.5 / scale}
        opacity={open ? 0.9 : 1}
      />
      <Line points={[0, -seam, leaf.length, -seam]} stroke={WOOD_SEAM} strokeWidth={1 / scale} opacity={0.8} />
      <Line points={[0, seam, leaf.length, seam]} stroke={WOOD_SEAM} strokeWidth={1 / scale} opacity={0.8} />
      <Circle x={knobX} y={0} radius={2.2 / scale} fill={WOOD_DARK} />
    </Group>
  );
}

/**
 * Дверь: рама-косяки на концах сегмента + створки на петлях.
 * Длиннее клетки — двустворчатая; открытие анимируется поворотом (200 мс).
 */
export default function DoorView({ door, scale, hovered, cellPx }: DoorViewProps) {
  const g = doorGeometry(door);
  const open = door.open === true;
  const leaves = doorLeaves(door, cellPx);

  const jamb = 7 / scale;
  const stroke = hovered ? HOVER : WOOD_DARK;

  const post = (x: number, y: number) => (
    <Line
      points={[x - g.rightNormal.x * jamb, y - g.rightNormal.y * jamb, x + g.rightNormal.x * jamb, y + g.rightNormal.y * jamb]}
      stroke={WOOD_DARK}
      strokeWidth={5 / scale}
      lineCap="round"
      opacity={0.95}
      listening={false}
    />
  );

  return (
    <>
      {open && (
        <Line
          points={[door.x1, door.y1, door.x2, door.y2]}
          stroke={hovered ? HOVER : THRESHOLD}
          strokeWidth={2 / scale}
          dash={[6 / scale, 6 / scale]}
          opacity={0.35}
          listening={false}
        />
      )}
      {post(door.x1, door.y1)}
      {post(door.x2, door.y2)}
      {leaves.map((leaf, i) => (
        <DoorLeafView key={i} leaf={leaf} open={open} scale={scale} stroke={stroke} />
      ))}
    </>
  );
}
