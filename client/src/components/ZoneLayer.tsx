import { Circle, Group, Line, Rect, Shape, Text } from 'react-konva';
import type Konva from 'konva';
import {
  areaCellKey,
  areaCellsLit,
  areaCellsSpread,
  cellCenter,
  pointCell,
  zoneWallSectionMidpoint,
  zoneWallSegments,
  type GridSettings,
  type Wall,
  type ZoneInstance,
} from 'shared';
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

/** Цвета плит тонких стен по заклинанию: лёд / камень / силовое поле. */
const WALL_COLORS: Record<string, { edge: string; core: string; dash?: number[]; opacity?: number }> = {
  'XPHB:Wall of Ice': { edge: '#4f9fc4', core: '#d9f2fb' },
  'XPHB:Wall of Stone': { edge: '#6f6353', core: '#cfc6b4' },
  'XPHB:Wall of Force': {
    edge: 'rgba(150, 170, 255, 0.8)',
    core: 'rgba(228, 234, 255, 0.6)',
    dash: [10, 7],
    opacity: 0.75,
  },
};
const WALL_ICE = WALL_COLORS['XPHB:Wall of Ice']!;

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
          const fey = zone.flags.sprite === 'fey';
          const color = hammer || fey ? (hammer ? '#ffd43b' : '#c084fc') : zoneColor(zone.sourceKey);
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
              ) : fey ? (
                <>
                  <Circle x={x} y={y} radius={s * 0.17} fill={color} opacity={0.9} stroke="#000000" strokeWidth={1} listening={false} />
                  <Circle x={x + s * 0.22} y={y - s * 0.2} radius={s * 0.055} fill="#ffffff" opacity={0.9} listening={false} />
                  <Circle x={x - s * 0.2} y={y + s * 0.18} radius={s * 0.04} fill="#ffffff" opacity={0.7} listening={false} />
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
        // Тонкая стена-зона (Wall of Ice): плиты по границам клеток, пробитые — «лист».
        if (zone.wall) {
          const segments = zoneWallSegments(zone, { size: grid.size, offsetX: grid.offsetX, offsetY: grid.offsetY });
          const vis = mode === 'markings' ? visibleByZone?.get(zone.id) ?? visible : undefined;
          const shown = vis
            ? segments.filter((s) => {
                // Панель видна, если видна любая её опорная клетка (концы или середина).
                const samples = [
                  s.a,
                  { x: (s.a.x + s.b.x) / 2, y: (s.a.y + s.b.y) / 2 },
                  s.b,
                ];
                return samples.some((p) => {
                  const cell = pointCell(p, grid);
                  return vis.has(areaCellKey(cell.cx, cell.cy));
                });
              })
            : segments;
          if (!shown.length) return null;
          const sections = [...new Set(shown.map((s) => s.section))];
          const thickness = Math.max(4, grid.size * 0.28);
          const colors = WALL_COLORS[zone.sourceKey] ?? WALL_ICE;
          // Пробитая панель без «листа» (камень) исчезает — остаётся дыра.
          const drawn = shown.filter((s) => {
            const state = zone.sections?.[s.section];
            return !state?.broken || !!zone.wall?.breach;
          });
          if (!drawn.length) return null;
          const first = drawn[0]!;
          const nameAt = { x: (first.a.x + first.b.x) / 2, y: (first.a.y + first.b.y) / 2 };
          return (
            <Group key={zone.id} listening={false}>
              {drawn.map((s, i) => {
                const broken = !!zone.sections?.[s.section]?.broken;
                const points = [s.a.x, s.a.y, s.b.x, s.b.y];
                const opacity = broken ? 0.4 : colors.opacity ?? 0.95;
                return (
                  <Group key={`${s.section}:${i}`}>
                    <Line
                      points={points}
                      stroke={broken ? '#d9f2fb' : colors.edge}
                      strokeWidth={broken ? Math.max(3, thickness * 0.45) : thickness}
                      lineCap="round"
                      opacity={opacity}
                      dash={broken ? [8, 6] : colors.dash}
                    />
                    {!broken && (
                      <Line
                        points={points}
                        stroke={colors.core}
                        strokeWidth={thickness * 0.5}
                        lineCap="round"
                        opacity={colors.opacity ?? 0.95}
                        dash={colors.dash}
                      />
                    )}
                  </Group>
                );
              })}
              {mode !== 'fills' &&
                sections.map((section) => {
                  const state = zone.sections?.[section];
                  if (!state || state.broken || state.hp >= state.maxHp) return null;
                  const mid = zoneWallSectionMidpoint(segments, section);
                  if (!mid) return null;
                  return (
                    <Text
                      key={`hp-${section}`}
                      text={`${state.hp}/${state.maxHp}`}
                      x={mid.x}
                      y={mid.y - thickness}
                      fontSize={11}
                      fill="#ffffff"
                      stroke="#0d3b52"
                      strokeWidth={3}
                      fillAfterStrokeEnabled
                      offsetX={14}
                      listening={false}
                    />
                  );
                })}
              {mode !== 'fills' && (
                <Text
                  text={zone.name}
                  x={nameAt.x}
                  y={nameAt.y + thickness + 10}
                  fontSize={14}
                  fill="#2b6f8f"
                  opacity={0.95}
                  offsetX={zone.name.length * 3.5}
                  listening={false}
                  shadowColor="#ffffff"
                  shadowBlur={4}
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
