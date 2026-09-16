import { Group, Shape, Text } from 'react-konva';
import type Konva from 'konva';
import { areaCells, type GridSettings, type ZoneInstance } from 'shared';

/** Цвет зоны по её ключу-источнику (стабильный для всех клиентов). */
const COLORS = ['#8b5cf6', '#ef4444', '#22c55e', '#eab308', '#06b6d4', '#f97316'];

function zoneColor(sourceKey: string): string {
  let hash = 0;
  for (let i = 0; i < sourceKey.length; i++) hash = (hash * 31 + sourceKey.charCodeAt(i)) | 0;
  return COLORS[Math.abs(hash) % COLORS.length]!;
}

interface CellRect {
  x: number;
  y: number;
  size: number;
}

/**
 * Заштрихованная заливка клеток зоны: диагональные штрихи поверх лёгкой заливки —
 * визуально не путается с ровной подсветкой доступного движения.
 */
function drawZone(ctx: Konva.Context, cells: CellRect[], color: string): void {
  if (!cells.length) return;
  const minX = Math.min(...cells.map((c) => c.x));
  const minY = Math.min(...cells.map((c) => c.y));
  const maxX = Math.max(...cells.map((c) => c.x + c.size));
  const maxY = Math.max(...cells.map((c) => c.y + c.size));
  const height = maxY - minY;

  ctx.save();
  ctx.beginPath();
  for (const c of cells) ctx.rect(c.x, c.y, c.size, c.size);
  ctx.globalAlpha = 0.1;
  ctx.fillStyle = color;
  ctx.fill();
  ctx.clip();
  ctx.globalAlpha = 0.4;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  for (let d = minX - height; d <= maxX; d += 10) {
    ctx.beginPath();
    ctx.moveTo(d, minY);
    ctx.lineTo(d + height, maxY);
    ctx.stroke();
  }
  ctx.restore();
}

/** Области-зоны карты (Web, Spirit Guardians…): штриховка клеток и имя. */
export default function ZoneLayer({ zones, grid }: { zones: ZoneInstance[]; grid: GridSettings }) {
  return (
    <>
      {zones
        .filter((zone) => zone.origin && Number.isFinite(zone.origin.x) && Number.isFinite(zone.origin.y))
        .map((zone) => {
        const cells: CellRect[] = areaCells(zone.area, zone.origin, zone.direction ?? null, grid).map((key) => {
          const [cx, cy] = key.split(',').map(Number);
          return {
            x: grid.offsetX + (cx ?? 0) * grid.size,
            y: grid.offsetY + (cy ?? 0) * grid.size,
            size: grid.size,
          };
        });
        const color = zoneColor(zone.sourceKey);
        return (
          <Group key={zone.id} listening={false}>
            <Shape sceneFunc={(ctx) => drawZone(ctx, cells, color)} listening={false} />
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
