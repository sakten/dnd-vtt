import { Fragment } from 'react';
import { Circle, Line, Rect, Text } from 'react-konva';
import type { Token } from 'shared';
import type { CellRect, WorldPoint } from '../../lib/fog';

interface Props {
  movementCells: CellRect[];
  aim: { origin: WorldPoint | null; blocked?: boolean; summon?: boolean } | null;
  aimCells: CellRect[];
  /** Тонкая стена (Wall of Ice): предпросмотр плиты по границам клеток. */
  wallSegments?: { a: WorldPoint; b: WorldPoint }[];
  /** Радиус досягаемости действия зоны (якорь + лимит): подсказка при прицеле. */
  rangeCircle?: { x: number; y: number; radius: number } | null;
  multiTargetTokens: Pick<Token, 'id' | 'x' | 'y' | 'w' | 'h'>[];
  /** Кандидаты мульти-цели: подсветка доступных для выбора существ. */
  eligibleTokens?: Pick<Token, 'id' | 'x' | 'y' | 'w' | 'h'>[];
  /** Steel Wind Strike: клетки, куда можно телепортироваться после атак. */
  teleportCells?: CellRect[];
  /** Scatter: уже поставленные точки назначения (номер = порядок целей). */
  scatterPins?: { x: number; y: number }[];
  viewScale: number;
}

/** Подсветка движения, прицеливания области и выбранных целей мультиатаки. */
export default function AimLayer({ movementCells, aim, aimCells, wallSegments = [], rangeCircle, multiTargetTokens, eligibleTokens = [], teleportCells = [], scatterPins = [], viewScale }: Props) {
  return (
    <>
      {rangeCircle && (
        <Circle
          x={rangeCircle.x}
          y={rangeCircle.y}
          radius={rangeCircle.radius}
          stroke="#ffd166"
          strokeWidth={1.5 / viewScale}
          dash={[8 / viewScale, 8 / viewScale]}
          opacity={0.35}
          listening={false}
        />
      )}
      {movementCells.map((c) => (
        <Rect
          key={`mv-${c.x},${c.y}`}
          x={c.x}
          y={c.y}
          width={c.size}
          height={c.size}
          fill="#7c9cff"
          opacity={0.18}
          listening={false}
        />
      ))}
      {teleportCells.map((c) => (
        <Rect
          key={`tp-${c.x},${c.y}`}
          x={c.x}
          y={c.y}
          width={c.size}
          height={c.size}
          fill="#51cf66"
          opacity={0.28}
          listening={false}
        />
      ))}
      {aimCells.map((c) => (
        <Rect
          key={`aim-${c.x},${c.y}`}
          x={c.x}
          y={c.y}
          width={c.size}
          height={c.size}
          fill={aim?.blocked ? '#ff6b6b' : '#ff9f43'}
          opacity={0.34}
          listening={false}
        />
      ))}
      {wallSegments.map((s, i) => (
        <Line
          key={`wall-${i}`}
          points={[s.a.x, s.a.y, s.b.x, s.b.y]}
          stroke={aim?.blocked ? '#ff6b6b' : '#ff9f43'}
          strokeWidth={Math.max(4, 14 / viewScale)}
          opacity={0.5}
          lineCap="round"
          listening={false}
        />
      ))}
      {aim?.origin && !aim.summon && (
        <Line
          points={[aim.origin.x - 8 / viewScale, aim.origin.y, aim.origin.x + 8 / viewScale, aim.origin.y]}
          stroke={aim.blocked ? '#ff6b6b' : '#ff9f43'}
          strokeWidth={3 / viewScale}
          listening={false}
        />
      )}
      {scatterPins.map((p, i) => (
        <Fragment key={`pin-${i}-${p.x},${p.y}`}>
          <Circle
            x={p.x}
            y={p.y}
            radius={14 / viewScale}
            fill="#4dabf7"
            opacity={0.85}
            listening={false}
          />
          <Text
            text={`${i + 1}`}
            x={p.x - 4 / viewScale}
            y={p.y - 8 / viewScale}
            fontSize={18 / viewScale}
            fill="#ffffff"
            listening={false}
          />
        </Fragment>
      ))}
      {eligibleTokens.map((t) => (
        <Rect
          key={`el-${t.id}`}
          x={t.x - t.w / 2}
          y={t.y - t.h / 2}
          width={t.w}
          height={t.h}
          stroke="#4dabf7"
          strokeWidth={2 / viewScale}
          dash={[6 / viewScale, 6 / viewScale]}
          opacity={0.75}
          listening={false}
        />
      ))}
      {multiTargetTokens.map((t, i) => (
        <Fragment key={`mt-${i}-${t.id}`}>
          <Rect
            x={t.x - t.w / 2}
            y={t.y - t.h / 2}
            width={t.w}
            height={t.h}
            stroke="#ffd43b"
            strokeWidth={3 / viewScale}
            listening={false}
          />
          <Text
            text={`${i + 1}`}
            x={t.x - 6 / viewScale}
            y={t.y - 8 / viewScale}
            fontSize={18 / viewScale}
            fill="#ffd43b"
            stroke="#000000"
            strokeWidth={3 / viewScale}
            fillAfterStrokeEnabled
            listening={false}
          />
        </Fragment>
      ))}
    </>
  );
}
