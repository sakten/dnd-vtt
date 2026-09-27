import { Line, Rect } from 'react-konva';
import { areaCellsSpread, zoneWallSegments, type GridSettings, type Wall, type ZoneInstance } from 'shared';

interface Props {
  zones: ZoneInstance[];
  grid: GridSettings;
  /** Стены карты: зона-площадь не хит-тестится сквозь них. */
  walls?: Wall[];
  /** Режим выбора зоны целиком (Dispel Magic): хит-ареа по клеткам/сегментам. */
  whole?: boolean;
  /** Клик по непробитой секции: id цели `zone:<zoneId>#<секция>`. */
  onPick: (zoneId: string, section: number) => void;
  /** Клик по зоне целиком: `zone:<zoneId>#0`. */
  onPickZone?: (zoneId: string) => void;
}

/** Кликабельные зоны (режим выбора цели): секции тонких стен или зона целиком. */
export default function ZoneTargetLayer({
  zones,
  grid,
  walls = [],
  whole = false,
  onPick,
  onPickZone,
}: Props) {
  const area = { size: grid.size || 50, offsetX: grid.offsetX, offsetY: grid.offsetY };
  if (whole) {
    return (
      <>
        {zones.flatMap((zone) => {
          // Тонкая стена: хит-ареа — её непробитые сегменты.
          if (zone.wall) {
            return zoneWallSegments(zone, area)
              .filter((s) => !zone.sections?.[s.section]?.broken)
              .map((s, i) => (
                <Line
                  key={`zw-${zone.id}-${i}`}
                  points={[s.a.x, s.a.y, s.b.x, s.b.y]}
                  stroke="#9ad8f0"
                  strokeWidth={Math.max(10, area.size * 0.4)}
                  opacity={0.22}
                  lineCap="round"
                  hitStrokeWidth={Math.max(16, area.size * 0.5)}
                  onClick={() => onPickZone?.(zone.id)}
                  onTap={() => onPickZone?.(zone.id)}
                />
              ));
          }
          const cells = areaCellsSpread(zone.area, zone.origin, zone.direction ?? null, area, walls);
          return [...cells].map((key) => {
            const [cx, cy] = key.split(',').map(Number);
            return (
              <Rect
                key={`zc-${zone.id}-${key}`}
                x={area.offsetX + (cx ?? 0) * area.size}
                y={area.offsetY + (cy ?? 0) * area.size}
                width={area.size}
                height={area.size}
                fill="#9ad8f0"
                opacity={0.16}
                onClick={() => onPickZone?.(zone.id)}
                onTap={() => onPickZone?.(zone.id)}
              />
            );
          });
        })}
      </>
    );
  }
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
