import { Group, Rect, Text } from 'react-konva';
import { areaCells, type GridSettings, type ZoneInstance } from 'shared';

/** Цвет зоны по её ключу-источнику (стабильный для всех клиентов). */
const COLORS = ['#8b5cf6', '#ef4444', '#22c55e', '#eab308', '#06b6d4', '#f97316'];

function zoneColor(sourceKey: string): string {
  let hash = 0;
  for (let i = 0; i < sourceKey.length; i++) hash = (hash * 31 + sourceKey.charCodeAt(i)) | 0;
  return COLORS[Math.abs(hash) % COLORS.length]!;
}

/** Области-зоны карты (Web, Spirit Guardians…): заливка клеток и имя. */
export default function ZoneLayer({ zones, grid }: { zones: ZoneInstance[]; grid: GridSettings }) {
  return (
    <>
      {zones.map((zone) => {
        const cells = areaCells(zone.area, zone.origin, zone.direction ?? null, grid);
        const color = zoneColor(zone.sourceKey);
        return (
          <Group key={zone.id} listening={false}>
            {cells.map((key) => {
              const [cx, cy] = key.split(',').map(Number);
              return (
                <Rect
                  key={key}
                  x={grid.offsetX + (cx ?? 0) * grid.size}
                  y={grid.offsetY + (cy ?? 0) * grid.size}
                  width={grid.size}
                  height={grid.size}
                  fill={color}
                  opacity={0.15}
                />
              );
            })}
            <Text
              text={zone.name}
              x={zone.origin.x}
              y={zone.origin.y}
              fontSize={16}
              fill={color}
              opacity={0.85}
              offsetX={zone.name.length * 4}
              offsetY={8}
              listening={false}
            />
          </Group>
        );
      })}
    </>
  );
}
