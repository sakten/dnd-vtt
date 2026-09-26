import { Line } from 'react-konva';
import { zoneWallSegments, type GridSettings, type ZoneInstance } from 'shared';

interface Props {
  zones: ZoneInstance[];
  grid: GridSettings;
  /** Клик по непробитой секции: id цели `zone:<zoneId>#<секция>`. */
  onPick: (zoneId: string, section: number) => void;
}

/** Кликабельные секции тонких стен (режим выбора цели): подсветка и попадание по секции. */
export default function ZoneTargetLayer({ zones, grid, onPick }: Props) {
  const area = { size: grid.size || 50, offsetX: grid.offsetX, offsetY: grid.offsetY };
  return (
    <>
      {zones.flatMap((zone) => {
        if (!zone.wall || !zone.sections) return [];
        return zoneWallSegments(zone, area)
          .filter((s) => !zone.sections?.[s.section]?.broken)
          .map((s, i) => (
            <Line
              key={`zt-${zone.id}-${i}`}
              points={[s.a.x, s.a.y, s.b.x, s.b.y]}
              stroke="#9ad8f0"
              strokeWidth={Math.max(10, area.size * 0.4)}
              opacity={0.18}
              lineCap="round"
              hitStrokeWidth={Math.max(16, area.size * 0.5)}
              onMouseEnter={(e) => {
                const stage = e.target.getStage();
                if (stage) stage.container().style.cursor = 'crosshair';
              }}
              onMouseLeave={(e) => {
                const stage = e.target.getStage();
                if (stage) stage.container().style.cursor = '';
              }}
              onClick={() => onPick(zone.id, s.section)}
              onTap={() => onPick(zone.id, s.section)}
            />
          ));
      })}
    </>
  );
}
