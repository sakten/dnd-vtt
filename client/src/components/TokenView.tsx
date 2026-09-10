import { useRef } from 'react';
import { Group, Rect, Text, Image as KonvaImage } from 'react-konva';
import Konva from 'konva';
import { snapToGrid, type Token } from 'shared';
import { useGameStore } from '../store/useGameStore';
import { useImage } from '../lib/useImage';

export default function TokenView({ token }: { token: Token }) {
  const image = useImage(token.imageUrl);
  const selfId = useGameStore((s) => s.selfId);
  const grid = useGameStore((s) => s.scene.grid);
  const selected = useGameStore((s) => s.selectedTokenId === token.id);
  const setSelected = useGameStore((s) => s.setSelected);
  const moveToken = useGameStore((s) => s.moveToken);
  const finalizeMove = useGameStore((s) => s.finalizeTokenMove);
  const lockToken = useGameStore((s) => s.lockToken);
  const setDragging = useGameStore((s) => s.setDragging);
  const setHoverToken = useGameStore((s) => s.setHoverToken);
  const hovered = useGameStore((s) => s.hoverTokenId === token.id);
  const fogActive = useGameStore((s) => s.fogMode.active);
  const lastClickRef = useRef(0);

  const lockedByOther = token.lockedBy !== null && token.lockedBy !== selfId;

  const snap = (v: number, offset: number) => {
    if (!grid.snap) return v;
    return snapToGrid(v, offset, grid.size, token.cells);
  };

  const onDragMove = (e: Konva.KonvaEventObject<DragEvent>) => {
    const nx = snap(e.target.x(), grid.offsetX);
    const ny = snap(e.target.y(), grid.offsetY);
    if (nx !== e.target.x()) e.target.x(nx);
    if (ny !== e.target.y()) e.target.y(ny);
    moveToken(token.id, e.target.x(), e.target.y());
  };

  const onDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    const nx = snap(e.target.x(), grid.offsetX);
    const ny = snap(e.target.y(), grid.offsetY);
    e.target.position({ x: nx, y: ny });
    finalizeMove(token.id, nx, ny);
    setDragging(null);
  };

  const circleClip = (ctx: Konva.Context) => {
    ctx.arc(0, 0, token.w / 2, 0, Math.PI * 2, false);
  };

  return (
    <Group
      x={token.x}
      y={token.y}
      scaleX={token.scale}
      scaleY={token.scale}
      rotation={token.rotation}
      opacity={lockedByOther ? 0.5 : 1}
      draggable={!lockedByOther && !fogActive}
      onClick={(e) => {
        e.cancelBubble = true;
        setSelected(token.id);
        const now = Date.now();
        if (now - lastClickRef.current < 350) {
          lastClickRef.current = 0;
          useGameStore.getState().setTokenMenu(token.id);
        } else {
          lastClickRef.current = now;
        }
      }}
      onTap={(e) => {
        e.cancelBubble = true;
        setSelected(token.id);
        const now = Date.now();
        if (now - lastClickRef.current < 350) {
          lastClickRef.current = 0;
          useGameStore.getState().setTokenMenu(token.id);
        } else {
          lastClickRef.current = now;
        }
      }}
      onDragStart={() => {
        setSelected(token.id);
        setDragging(token.id);
        lockToken(token.id, true);
      }}
      onMouseEnter={() => setHoverToken(token.id)}
      onMouseLeave={() => setHoverToken(null)}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
    >
      <Group clipFunc={token.round ? circleClip : undefined}>
        {image ? (
          <KonvaImage
            image={image}
            width={token.w}
            height={token.h}
            offsetX={token.w / 2}
            offsetY={token.h / 2}
          />
        ) : (
          <Rect x={-token.w / 2} y={-token.h / 2} width={token.w} height={token.h} fill="#3a4150" />
        )}
      </Group>
      {selected && (
        <Rect
          x={-token.w / 2 - 3}
          y={-token.h / 2 - 3}
          width={token.w + 6}
          height={token.h + 6}
          stroke="#7c9cff"
          strokeWidth={2 / token.scale}
          dash={[6 / token.scale, 4 / token.scale]}
          listening={false}
        />
      )}
      {hovered && !selected && (
        <Rect
          x={-token.w / 2 - 4}
          y={-token.h / 2 - 4}
          width={token.w + 8}
          height={token.h + 8}
          stroke="#ffd166"
          strokeWidth={3 / token.scale}
          cornerRadius={6}
          listening={false}
        />
      )}
      <Text
        text={token.name}
        fontSize={14 / token.scale}
        fontStyle="bold"
        fill="#ffffff"
        stroke="#000000"
        strokeWidth={3 / token.scale}
        fillAfterStrokeEnabled
        x={-token.w / 2}
        y={token.h / 2 + 4}
        width={token.w}
        align="center"
        listening={false}
      />
    </Group>
  );
}
