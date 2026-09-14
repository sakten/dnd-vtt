import { memo, useRef } from 'react';
import { Group, Rect, Text, Image as KonvaImage } from 'react-konva';
import Konva from 'konva';
import { movementBlocked, snapToGrid, statNumber, type Token } from 'shared';
import { useGameStore } from '../store/useGameStore';
import { useImage } from '../lib/useImage';
import { useCanControl, useIsDm } from '../lib/control';

function TokenView({ token }: { token: Token }) {
  const image = useImage(token.imageUrl);
  const selfId = useGameStore((s) => s.selfId);
  const grid = useGameStore((s) => s.scene.grid);
  const selected = useGameStore((s) => s.selectedTokenId === token.id);
  const setSelected = useGameStore((s) => s.setSelected);
  const targeting = useGameStore((s) => s.interaction?.mode === 'target');
  const multiTarget = useGameStore((s) => s.interaction?.mode === 'multi');
  const aim = useGameStore((s) => s.interaction?.mode === 'aim');
  const moveToken = useGameStore((s) => s.moveToken);
  const finalizeMove = useGameStore((s) => s.finalizeTokenMove);
  const lockToken = useGameStore((s) => s.lockToken);
  const setDragging = useGameStore((s) => s.setDragging);
  const setHoverToken = useGameStore((s) => s.setHoverToken);
  const hovered = useGameStore((s) => s.hoverTokenId === token.id);
  const fogActive = useGameStore((s) => s.fogMode.active);
  const isDm = useIsDm();
  const canMove = useCanControl(token);
  const lastClickRef = useRef(0);

  const lockedByOther = token.lockedBy !== null && token.lockedBy !== selfId;
  const hpMax = statNumber(token.hpMax);
  const dead = hpMax > 0 && token.hpCurrent <= 0;

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

  /** Клик: в режиме выбора цели — применить по токену, иначе выбрать/открыть меню. */
  const activate = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const st = useGameStore.getState();
    const it = st.interaction;
    if (it?.mode === 'target') {
      e.cancelBubble = true;
      st.resolveTargeting(token.id);
      return;
    }
    if (it?.mode === 'multi') {
      e.cancelBubble = true;
      st.addMultiTarget(token.id);
      return;
    }
    if (it?.mode === 'aim') return; // клик по карте применяет область (обрабатывает Stage)
    e.cancelBubble = true;
    setSelected(token.id);
    const now = Date.now();
    if (now - lastClickRef.current < 350) {
      lastClickRef.current = 0;
      useGameStore.getState().setTokenMenu(token.id);
    } else {
      lastClickRef.current = now;
    }
  };

  return (
    <Group
      x={token.x}
      y={token.y}
      scaleX={token.scale}
      scaleY={token.scale}
      rotation={token.rotation}
      opacity={lockedByOther ? 0.5 : dead ? 0.55 : 1}
      draggable={
        !lockedByOther &&
        !fogActive &&
        !targeting &&
        !aim &&
        !multiTarget &&
        canMove &&
        (isDm || !movementBlocked(token.conditions))
      }
      onClick={activate}
      onTap={activate}
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
      {selected && (isDm || token.isPlayerToken) && (
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
      {hpMax > 0 && (
        <Group y={-token.h / 2 - 9 / token.scale} listening={false}>
          <Rect
            x={-token.w / 2}
            width={token.w}
            height={8 / token.scale}
            fill="#2b3039"
            stroke="#000000"
            strokeWidth={1 / token.scale}
            cornerRadius={2 / token.scale}
          />
          <Rect
            x={-token.w / 2}
            width={Math.max(0, Math.min(1, token.hpCurrent / hpMax)) * token.w}
            height={8 / token.scale}
            fill={token.hpCurrent / hpMax > 0.5 ? '#4ecb71' : token.hpCurrent / hpMax > 0.25 ? '#ffd166' : '#ff6b6b'}
            cornerRadius={2 / token.scale}
          />
        </Group>
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

export default memo(TokenView);
