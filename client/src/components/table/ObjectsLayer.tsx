import { Line, Rect, Group } from 'react-konva';
import type { LightArea, MapInfo, Wall } from 'shared';
import DoorView from '../DoorView';
import type { CellRect, RectPreview } from '../../lib/fog';

const WALL_COLORS: Record<Wall['kind'], string> = {
  wall: '#e6e8ee',
  door: '#e0a458',
  window: '#7cc7e8',
};

const LIGHT_AREA_COLORS: Record<LightArea['kind'], string> = {
  darkness: '#3b4f8a',
  magical: '#9d5cf6',
  obscured: '#9aa0a6',
};

interface Props {
  map: MapInfo | null | undefined;
  isDm: boolean;
  viewScale: number;
  cellPx: number;
  doorHover: { id: string; state: 'open' | 'blocked' } | null;
  wallCandidates: Wall[] | null | undefined;
  wallStart: { x: number; y: number } | null;
  wallCursor: { x: number; y: number } | null;
  fogRects: CellRect[];
  rectPreview: RectPreview | null;
}

/** Стены, двери, области тьмы, туман и предпросмотр кистей — поверх карты, без событий. */
export default function ObjectsLayer({
  map,
  isDm,
  viewScale,
  cellPx,
  doorHover,
  wallCandidates,
  wallStart,
  wallCursor,
  fogRects,
  rectPreview,
}: Props) {
  return (
    <Group listening={false}>
      {isDm &&
        map?.lightAreas.map((a) => (
          <Rect
            key={`area-${a.id}`}
            x={a.x}
            y={a.y}
            width={a.w}
            height={a.h}
            fill={LIGHT_AREA_COLORS[a.kind]}
            opacity={0.16}
            stroke={LIGHT_AREA_COLORS[a.kind]}
            strokeWidth={2 / viewScale}
            dash={[8 / viewScale, 5 / viewScale]}
            listening={false}
          />
        ))}
      {map?.walls.map((w) => {
        // Игроки видят только двери (стены — инструмент DM); невидимые скроет вуаль.
        if (!isDm && w.kind !== 'door') return null;
        if (w.kind === 'door') {
          return (
            <DoorView
              key={w.id}
              door={w}
              scale={viewScale}
              hovered={doorHover?.id === w.id}
              cellPx={cellPx}
            />
          );
        }
        return (
          <Line
            key={w.id}
            points={[w.x1, w.y1, w.x2, w.y2]}
            stroke={WALL_COLORS[w.kind]}
            strokeWidth={5 / viewScale}
            lineCap="round"
            opacity={0.9}
            listening={false}
          />
        );
      })}
      {isDm &&
        wallCandidates?.map((w) => (
          <Line
            key={`cand-${w.id}`}
            points={[w.x1, w.y1, w.x2, w.y2]}
            stroke={w.kind === 'door' ? '#39d353' : '#ffd43b'}
            strokeWidth={4 / viewScale}
            dash={[10 / viewScale, 6 / viewScale]}
            opacity={0.85}
            listening={false}
          />
        ))}
      {wallStart && wallCursor && (
        <Line
          points={[wallStart.x, wallStart.y, wallCursor.x, wallCursor.y]}
          stroke="#7c9cff"
          strokeWidth={3 / viewScale}
          dash={[8 / viewScale, 5 / viewScale]}
          listening={false}
        />
      )}
      {wallStart && (
        <Rect
          x={wallStart.x - 4 / viewScale}
          y={wallStart.y - 4 / viewScale}
          width={8 / viewScale}
          height={8 / viewScale}
          fill="#7c9cff"
          listening={false}
        />
      )}
      {fogRects.map((r) => (
        <Rect
          key={`${r.x},${r.y}`}
          x={r.x}
          y={r.y}
          width={r.size}
          height={r.size}
          fill="#07090d"
          opacity={isDm ? 0.45 : 0.93}
        />
      ))}
      {rectPreview && (
        <Rect
          x={Math.min(rectPreview.x0, rectPreview.x1)}
          y={Math.min(rectPreview.y0, rectPreview.y1)}
          width={Math.abs(rectPreview.x1 - rectPreview.x0)}
          height={Math.abs(rectPreview.y1 - rectPreview.y0)}
          stroke="#7c9cff"
          strokeWidth={2 / viewScale}
          dash={[8 / viewScale, 4 / viewScale]}
        />
      )}
    </Group>
  );
}
