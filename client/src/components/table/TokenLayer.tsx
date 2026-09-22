import { Group, Image as KonvaImage, Line, Rect, Text } from 'react-konva';
import type { MapInfo, Token } from 'shared';
import TokenView from '../TokenView';
import { useImage } from '../../lib/useImage';
import { tokenImageUrl } from '../../lib/imageVariants';
import { isCellHidden, type WorldPoint } from '../../lib/fog';
import { t } from '../../i18n';

/** Бледная копия токена на месте начала перетаскивания. */
function TokenGhost({ token, x, y }: { token: Token; x: number; y: number }) {
  const image = useImage(tokenImageUrl(token.imageUrl), token.imageUrl);
  return (
    <Group
      x={x}
      y={y}
      scaleX={token.scale}
      scaleY={token.scale}
      rotation={token.rotation}
      opacity={0.35}
      listening={false}
    >
      {image ? (
        <KonvaImage image={image} width={token.w} height={token.h} offsetX={token.w / 2} offsetY={token.h / 2} />
      ) : (
        <Rect x={-token.w / 2} y={-token.h / 2} width={token.w} height={token.h} fill="#3a4150" />
      )}
    </Group>
  );
}

interface Props {
  map: MapInfo | null | undefined;
  isDm: boolean;
  hidden: Set<string>;
  dragGhost: { id: string; x: number; y: number } | null;
  dragPath: { points: WorldPoint[]; feet: number } | null;
  viewScale: number;
  gridSize: number;
}

/** Токены (с учётом тумана), призрак перетаскивания и маршрут ходьбы с крестиком цели. */
export default function TokenLayer({
  map,
  isDm,
  hidden,
  dragGhost,
  dragPath,
  viewScale,
  gridSize,
}: Props) {
  const fog = map?.fog;
  return (
    <>
      {dragGhost &&
        map &&
        (() => {
          const ghost = map.tokens.find((tok) => tok.id === dragGhost.id);
          if (!ghost) return null;
          return <TokenGhost token={ghost} x={dragGhost.x} y={dragGhost.y} />;
        })()}
      {map?.tokens
        .filter((tok) => isDm || !isCellHidden(fog, hidden, tok.x, tok.y))
        .map((tok) => (
          <TokenView key={tok.id} token={tok} />
        ))}
      {dragPath && dragPath.points.length > 1 && (
        <>
          <Line
            points={dragPath.points.flatMap((p) => [p.x, p.y])}
            stroke="#4ecb71"
            strokeWidth={4 / viewScale}
            dash={[10 / viewScale, 6 / viewScale]}
            opacity={0.9}
            listening={false}
          />
          <Text
            text={t('ui.common.feet', { n: dragPath.feet })}
            x={dragPath.points[dragPath.points.length - 1]!.x + 10 / viewScale}
            y={dragPath.points[dragPath.points.length - 1]!.y - 26 / viewScale}
            fontSize={16 / viewScale}
            fill="#cfe1ff"
            stroke="#000000"
            strokeWidth={3 / viewScale}
            fillAfterStrokeEnabled
            listening={false}
          />
          {(() => {
            const target = dragPath.points[dragPath.points.length - 1]!;
            const dragged = map?.tokens.find((tok) => tok.id === dragGhost?.id);
            const size = gridSize || 50;
            const hw = (dragged?.w ?? size) / 2;
            const hh = (dragged?.h ?? size) / 2;
            return (
              <>
                <Line
                  points={[target.x - hw, target.y - hh, target.x + hw, target.y + hh]}
                  stroke="#4ecb71"
                  strokeWidth={3 / viewScale}
                  listening={false}
                />
                <Line
                  points={[target.x - hw, target.y + hh, target.x + hw, target.y - hh]}
                  stroke="#4ecb71"
                  strokeWidth={3 / viewScale}
                  listening={false}
                />
              </>
            );
          })()}
        </>
      )}
    </>
  );
}
