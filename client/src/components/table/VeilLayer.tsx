import { Line, Rect, Shape, Text } from 'react-konva';
import type { DeploymentArea, GridSettings, Wall, ZoneInstance } from 'shared';
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
  /** Превью выталкивания стеной: куда уйдут разрезанные существа (поверх токенов). */
  pushGhosts?: { x: number; y: number; w: number; h: number }[];
  /** Серая карта до расстановки: видны только зоны. */
  deploymentMask?: { width: number; height: number; areas: DeploymentArea[] } | null;
  /** Зоны расстановки для контуров (DM). */
  deploymentAreas?: DeploymentArea[];
  viewScale: number;
}

const DEPLOYMENT_FILL = '#4b5563';

/** Вуаль обзора, разметка вижн-зон, линейка измерения и значок преимущества атаки. */
export default function VeilLayer({ visionView, zones, grid, walls = [], measure, attackCursor, pushGhosts = [], deploymentMask, deploymentAreas = [], viewScale }: Props) {
  return (
    <>
      {deploymentMask && (
        <>
          {deploymentMask.areas.length === 0 ? (
            <Rect
              x={0}
              y={0}
              width={deploymentMask.width}
              height={deploymentMask.height}
              fill={DEPLOYMENT_FILL}
              listening={false}
            />
          ) : (
            <>
              <Rect
                x={0}
                y={0}
                width={deploymentMask.width}
                height={deploymentMask.height}
                fill={DEPLOYMENT_FILL}
                listening={false}
              />
              <Shape
                listening={false}
                globalCompositeOperation="destination-out"
                sceneFunc={(context) => {
                  context.beginPath();
                  for (const a of deploymentMask.areas) context.rect(a.x, a.y, a.w, a.h);
                  context.fillStyle = '#000000';
                  context.fill();
                }}
              />
            </>
          )}
          {deploymentMask.areas.map((a) => (
            <Rect
              key={`deployment-mask-${a.id}`}
              x={a.x}
              y={a.y}
              width={a.w}
              height={a.h}
              stroke="#7c9cff"
              strokeWidth={2 / viewScale}
              dash={[8 / viewScale, 4 / viewScale]}
              listening={false}
            />
          ))}
        </>
      )}
      {deploymentAreas.map((a) => (
        <Rect
          key={`deployment-area-${a.id}`}
          x={a.x}
          y={a.y}
          width={a.w}
          height={a.h}
          stroke="#7c9cff"
          strokeWidth={2 / viewScale}
          dash={[8 / viewScale, 4 / viewScale]}
          opacity={0.7}
          listening={false}
        />
      ))}
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
      {pushGhosts.map((g, i) => (
        <Rect
          key={`push-${i}`}
          x={g.x - g.w / 2}
          y={g.y - g.h / 2}
          width={g.w}
          height={g.h}
          fill="rgba(81, 207, 102, 0.18)"
          stroke="#51cf66"
          strokeWidth={2 / viewScale}
          dash={[6 / viewScale, 4 / viewScale]}
          listening={false}
        />
      ))}
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
