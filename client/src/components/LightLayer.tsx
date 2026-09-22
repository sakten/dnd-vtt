import { Circle, Group } from 'react-konva';
import type { GridSettings, Token, ZoneInstance } from 'shared';
import { mapLights } from '../lib/light';

/** Мягкое свечение источников света: яркое ядро + сумеречное кольцо (мир. координаты). */
export default function LightLayer({
  tokens,
  zones,
  grid,
  dimmed = false,
}: {
  tokens: Token[];
  zones: ZoneInstance[];
  grid: GridSettings;
  /** Режим обзора: свет приглушается, чтобы не спорить с вуалью. */
  dimmed?: boolean;
}) {
  const px = (grid.size || 50) / 5;
  const alpha = dimmed ? 0.55 : 1;
  return (
    <>
      {mapLights(tokens, zones).map((l) => {
        const brightR = l.light.bright * px;
        const outerR = (l.light.bright + l.light.dim) * px;
        const warm = l.light.sunlight ? '255, 248, 214' : '255, 236, 179';
        return (
          <Group key={l.key} listening={false} opacity={alpha}>
            {outerR > brightR && (
              <Circle
                x={l.x}
                y={l.y}
                radius={outerR}
                fillRadialGradientStartPoint={{ x: 0, y: 0 }}
                fillRadialGradientStartRadius={brightR}
                fillRadialGradientEndPoint={{ x: 0, y: 0 }}
                fillRadialGradientEndRadius={outerR}
                fillRadialGradientColorStops={[0, `rgba(${warm}, 0.10)`, 1, `rgba(${warm}, 0)`]}
              />
            )}
            {brightR > 0 && (
              <Circle
                x={l.x}
                y={l.y}
                radius={brightR}
                fillRadialGradientStartPoint={{ x: 0, y: 0 }}
                fillRadialGradientStartRadius={0}
                fillRadialGradientEndPoint={{ x: 0, y: 0 }}
                fillRadialGradientEndRadius={brightR}
                fillRadialGradientColorStops={[
                  0,
                  `rgba(${warm}, 0.22)`,
                  0.75,
                  `rgba(${warm}, 0.12)`,
                  1,
                  `rgba(${warm}, 0)`,
                ]}
              />
            )}
          </Group>
        );
      })}
    </>
  );
}
