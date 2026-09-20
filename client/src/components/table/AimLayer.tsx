import { Fragment } from 'react';
import { Line, Rect, Text } from 'react-konva';
import type { Token } from 'shared';
import type { CellRect, WorldPoint } from '../../lib/fog';

interface Props {
  movementCells: CellRect[];
  aim: { origin: WorldPoint | null; blocked?: boolean; summon?: boolean } | null;
  aimCells: CellRect[];
  multiTargetTokens: Pick<Token, 'id' | 'x' | 'y' | 'w' | 'h'>[];
  viewScale: number;
}

/** Подсветка движения, прицеливания области и выбранных целей мультиатаки. */
export default function AimLayer({ movementCells, aim, aimCells, multiTargetTokens, viewScale }: Props) {
  return (
    <>
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
      {aim?.origin && !aim.summon && (
        <Line
          points={[aim.origin.x - 8 / viewScale, aim.origin.y, aim.origin.x + 8 / viewScale, aim.origin.y]}
          stroke={aim.blocked ? '#ff6b6b' : '#ff9f43'}
          strokeWidth={3 / viewScale}
          listening={false}
        />
      )}
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
