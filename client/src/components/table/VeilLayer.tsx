import { Line, Shape, Text } from 'react-konva';
import type { GridSettings, Wall, ZoneInstance } from 'shared';
import ZoneLayer from '../ZoneLayer';
import type { CellRect, WorldPoint } from '../../lib/fog';
import { t } from '../../i18n';

interface VisionView {
  rects: CellRect[];
  base: Set<string>;
  byZone: Map<string, Set<string>>;
}

interface Props {
  visionView: VisionView | null;
  zones: ZoneInstance[];
  grid: GridSettings;
  walls?: Wall[];
  measure: { from: WorldPoint; to: WorldPoint; feet: number; attackMode: 'a' | 'd' | null | undefined } | null;
  attackCursor: WorldPoint | null;
  viewScale: number;
}

/** Вуаль обзора, разметка вижн-зон, линейка измерения и значок преимущества атаки. */
export default function VeilLayer({ visionView, zones, grid, walls = [], measure, attackCursor, viewScale }: Props) {
  return (
    <>
      {visionView && visionView.rects.length > 0 && (
        <Shape
          listening={false}
          sceneFunc={(context) => {
            context.beginPath();
            for (const r of visionView.rects) context.rect(r.x, r.y, r.size, r.size);
            context.fillStyle = '#07090d';
            context.fill();
          }}
        />
      )}
      {visionView && (
        <ZoneLayer
          zones={zones}
          grid={grid}
          walls={walls}
          mode="markings"
          visible={visionView.base}
          visibleByZone={visionView.byZone}
        />
      )}
      {measure && (
        <>
          <Line
            points={[measure.from.x, measure.from.y, measure.to.x, measure.to.y]}
            stroke="#ff5a5a"
            strokeWidth={2 / viewScale}
            dash={[10 / viewScale, 6 / viewScale]}
          />
          <Text
            text={t('ui.common.feet', { n: measure.feet })}
            x={(measure.from.x + measure.to.x) / 2}
            y={(measure.from.y + measure.to.y) / 2 - 16 / viewScale}
            fontSize={14 / viewScale}
            fill="#ff8a8a"
            stroke="#000000"
            strokeWidth={3 / viewScale}
            fillAfterStrokeEnabled
          />
          {measure.attackMode !== undefined && attackCursor && (
            <Text
              text="⚔"
              x={attackCursor.x}
              y={attackCursor.y}
              fontSize={22 / viewScale}
              fill={measure.attackMode === 'a' ? '#4ecb71' : measure.attackMode === 'd' ? '#ff6b6b' : '#c9ced6'}
              stroke="#000000"
              strokeWidth={3 / viewScale}
              fillAfterStrokeEnabled
              listening={false}
            />
          )}
        </>
      )}
    </>
  );
}
