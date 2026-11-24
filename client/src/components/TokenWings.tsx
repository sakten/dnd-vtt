import { memo } from 'react';
import { Circle, Group, Line } from 'react-konva';
import type { Token } from 'shared';

type WingStyle = 'feather' | 'dragon' | 'arcane';

/** Стиль по источнику полёта: Aasimar — перья, Dragonborn — перепонки, остальное — эфир. */
function wingStyleOf(token: Token): WingStyle {
  const source = token.effects.find((effect) => effect.conditions?.includes('flying'))?.sourceKey ?? '';
  if (/Aasimar|celestialRevelation/i.test(source)) return 'feather';
  if (/Dragonborn|draconicFlight/i.test(source)) return 'dragon';
  return 'arcane';
}

/** Статические крылья позади круглого токена (без анимации). */
export default memo(function TokenWings({ token }: { token: Token }) {
  if (!token.round) return null;
  const R = token.w / 2;
  const style = wingStyleOf(token);

  if (style === 'feather') {
    const feathers = [
      { len: 1.55, lift: 0.62, tone: '#eef4ff', opacity: 0.95 },
      { len: 1.4, lift: 0.32, tone: '#dbe8fa', opacity: 0.9 },
      { len: 1.25, lift: 0.04, tone: '#c9dcf4', opacity: 0.85 },
    ];
    return (
      <Group listening={false}>
        {[-1, 1].map((side) =>
          feathers.map((feather, i) => (
            <Line
              key={`${side}:f${i}`}
              closed
              points={[
                side * R * 0.5,
                R * 0.06,
                side * R * (0.82 + i * 0.08),
                -R * (feather.lift * 0.35),
                side * R * feather.len,
                -R * feather.lift,
                side * R * (0.86 + i * 0.05),
                R * (0.18 + i * 0.07),
              ]}
              fill={feather.tone}
              stroke="#94a9cf"
              strokeWidth={1.4}
              opacity={feather.opacity}
            />
          ))
        )}
      </Group>
    );
  }

  if (style === 'dragon') {
    const membrane: [number, number][] = [
      [0.45, 0.05],
      [1.5, -0.7],
      [1.18, -0.04],
      [1.42, 0.56],
      [0.56, 0.36],
    ];
    return (
      <Group listening={false}>
        {[-1, 1].map((side) => (
          <Group key={side}>
            <Line
              closed
              points={membrane.flatMap(([x, y]) => [side * R * x, R * y])}
              fill="#4d2a63"
              stroke="#b78cff"
              strokeWidth={2}
              opacity={0.88}
            />
            <Line
              points={[
                side * R * 0.5,
                R * 0.05,
                side * R * 1.5,
                -R * 0.7,
                side * R * 1.18,
                -R * 0.04,
                side * R * 1.42,
                R * 0.56,
              ]}
              stroke="#c9a7ff"
              strokeWidth={1.3}
              opacity={0.85}
              lineJoin="round"
            />
          </Group>
        ))}
      </Group>
    );
  }

  return (
    <Group listening={false}>
      {[-1, 1].map((side) => (
        <Group key={side}>
          <Line
            closed
            points={[
              side * R * 0.45,
              0,
              side * R * 0.95,
              -R * 0.55,
              side * R * 1.55,
              -R * 0.75,
              side * R * 1.3,
              -R * 0.12,
              side * R * 1.45,
              R * 0.3,
              side * R * 0.9,
              R * 0.25,
              side * R * 0.56,
              R * 0.1,
            ]}
            fill="#5fd0ff"
            opacity={0.2}
            stroke="#9fe8ff"
            strokeWidth={2}
          />
          <Line
            closed
            points={[
              side * R * 0.5,
              0,
              side * R * 0.95,
              -R * 0.3,
              side * R * 1.2,
              -R * 0.45,
              side * R * 1.05,
              -R * 0.08,
              side * R * 0.8,
              R * 0.12,
            ]}
            fill="#b58bff"
            opacity={0.24}
            stroke="#d6c4ff"
            strokeWidth={1.2}
          />
          <Circle x={side * R * 1.35} y={-R * 0.5} radius={2.2} fill="#eaffff" opacity={0.9} />
          <Circle x={side * R * 1.12} y={-R * 0.66} radius={1.4} fill="#c9f6ff" opacity={0.8} />
        </Group>
      ))}
    </Group>
  );
});
