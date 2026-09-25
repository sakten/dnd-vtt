import { Group, Line, Rect, Shape, Text } from 'react-konva';
import type Konva from 'konva';
import { areaCellsLit, areaCellsSpread, cellCenter, pointCell, type GridSettings, type Wall, type ZoneInstance } from 'shared';
import { zoneColor, zoneStyle, type ZoneStyle } from '../lib/zoneRender';
import { drawZoneTexture } from '../lib/zoneTextures';

interface CellRect {
  key: string;
  x: number;
  y: number;
  size: number;
}

/** `full` — заливка и разметка, `fills` — только заливка, `markings` — только штриховка и имя. */
export type ZoneLayerMode = 'full' | 'fills' | 'markings';

/**
 * Заштрихованная заливка клеток зоны: диагональные штрихи поверх лёгкой заливки —
 * визуально не путается с ровной подсветкой доступного движения.
 */
function drawZone(ctx: Konva.Context, cells: CellRect[], style: ZoneStyle, mode: ZoneLayerMode): void {
  if (!cells.length) return;
  const minX = Math.min(...cells.map((c) => c.x));
  const minY = Math.min(...cells.map((c) => c.y));
  const maxX = Math.max(...cells.map((c) => c.x + c.size));
  const maxY = Math.max(...cells.map((c) => c.y + c.size));
  const height = maxY - minY;

  ctx.save();
  ctx.beginPath();
  for (const c of cells) ctx.rect(c.x, c.y, c.size, c.size);
  if (mode !== 'markings') {
    ctx.globalAlpha = style.fillAlpha;
    ctx.fillStyle = style.fill;
    ctx.fill();
    // Стены: процедурная текстура поверх заливки (огонь/шипы/клинки/песок).
    if (style.texture) drawZoneTexture(ctx, style.texture, cells);
  }
  if (mode !== 'fills' && style.stripe) {
    ctx.clip();
    ctx.globalAlpha = style.stripeAlpha;
    ctx.strokeStyle = style.stripe;
    ctx.lineWidth = 2;
    for (let d = minX - height; d <= maxX; d += 10) {
      ctx.beginPath();
      ctx.moveTo(d, minY);
      ctx.lineTo(d + height, maxY);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** Области-зоны карты (Web, Spirit Guardians…): заливка клеток, штриховка и имя. */
export default function ZoneLayer({
  zones,
  grid,
  mode = 'full',
  visible,
  visibleByZone,
  walls = [],
  subtleLabels = false,
}: {
  zones: ZoneInstance[];
  grid: GridSettings;
  mode?: ZoneLayerMode;
  /** Видимые зрителю клетки: в режиме `markings` разметка рисуется только на них. */
  visible?: Set<string>;
  /** Видимость без собственной тьмы/мглы конкретной зоны (иначе зона скрывает саму себя). */
  visibleByZone?: Map<string, Set<string>>;
  /** Стены карты: зона не показывается сквозь сплошную стену (огибает углы). */
  walls?: Wall[];
  /** Подписывать почти незаметные зоны (DM): имя рядом со значком. */
  subtleLabels?: boolean;
}) {
  return (
    <>
      {zones
        .filter((zone) => zone.origin && Number.isFinite(zone.origin.x) && Number.isFinite(zone.origin.y))
        .map((zone) => {
        // Почти незаметные зоны: молния Call Lightning или жёлтый молот силы (Spiritual Weapon).
        if (zone.flags?.subtle) {
          const cell = pointCell(zone.origin, grid);
          const center = cellCenter(cell.cx, cell.cy, grid);
          const x = center.x;
          const y = center.y;
          const hammer = zone.flags.sprite === 'hammer';
          const color = hammer ? '#ffd43b' : zoneColor(zone.sourceKey);
          const s = grid.size;
          return (
            <Group key={zone.id} listening={false}>
              {hammer ? (
                <>
                  <Rect
                    x={x - s * 0.33}
                    y={y - s * 0.36}
                    width={s * 0.66}
                    height={s * 0.24}
                    cornerRadius={s * 0.03}
                    fill={color}
                    stroke="#000000"
                    strokeWidth={1}
                    opacity={0.95}
                    listening={false}
                  />
                  <Rect
                    x={x - s * 0.055}
                    y={y - s * 0.12}
                    width={s * 0.11}
                    height={s * 0.5}
                    cornerRadius={s * 0.02}
                    fill={color}
                    stroke="#000000"
                    strokeWidth={1}
                    opacity={0.95}
                    listening={false}
                  />
                </>
              ) : (
                <Line
                  points={[x + 2, y - 13, x - 6, y + 1, x, y + 1, x - 3, y + 13, x + 7, y - 2, x + 1, y - 2, x + 5, y - 13]}
                  closed
                  fill={color}
                  stroke="#000000"
                  strokeWidth={1}
                  opacity={0.8}
                  listening={false}
                />
              )}
              {subtleLabels && (
                <Text
                  text={zone.name}
                  x={x}
                  y={y + s * 0.48}
                  fontSize={11}
                  fill={color}
                  opacity={0.5}
                  offsetX={zone.name.length * 3}
                  listening={false}
                  shadowColor="#000000"
                  shadowBlur={3}
                />
              )}
            </Group>
          );
        }
        const spread = zone.light
          ? areaCellsLit(zone.area, zone.origin, zone.direction ?? null, grid, walls)
          : areaCellsSpread(zone.area, zone.origin, zone.direction ?? null, grid, walls);
        const all: CellRect[] = [...spread].map((key) => {
          const [cx, cy] = key.split(',').map(Number);
          return {
            key,
            x: grid.offsetX + (cx ?? 0) * grid.size,
            y: grid.offsetY + (cy ?? 0) * grid.size,
            size: grid.size,
          };
        });
        const vis = mode === 'markings' ? visibleByZone?.get(zone.id) ?? visible : undefined;
        const cells = vis ? all.filter((c) => vis.has(c.key)) : all;
        if (!cells.length) return null;
        const style = zoneStyle(zone);
        const label = vis ? cells[0]! : null;
        return (
          <Group key={zone.id} listening={false}>
            <Shape sceneFunc={(ctx) => drawZone(ctx, cells, style, mode)} listening={false} />
            {mode !== 'fills' && (
              <Text
                text={zone.name}
                x={label ? label.x + label.size / 2 : zone.origin.x}
                y={label ? label.y + label.size / 2 : zone.origin.y}
                fontSize={16}
                fill={style.labelColor}
                opacity={0.95}
                offsetX={zone.name.length * 4}
                offsetY={8}
                listening={false}
                shadowColor="#000000"
                shadowBlur={4}
              />
            )}
          </Group>
        );
      })}
    </>
  );
}
