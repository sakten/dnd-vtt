import { memo, useEffect, useRef, useState } from 'react';
import { Group, Rect, Text, Image as KonvaImage } from 'react-konva';
import Konva from 'konva';
import {
  areaCells,
  canSee,
  cellCenter,
  findPath,
  movementBlocked,
  nearestFreeCell,
  pointCell,
  snapToGrid,
  statNumber,
  tokenCells,
  tokenSenses,
  type FoundPath,
  type Token,
} from 'shared';
import { useGameStore } from '../store/useGameStore';
import { activeMapOf } from '../store/selectors';
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
  const startTokenWalk = useGameStore((s) => s.startTokenWalk);
  const finishTokenWalk = useGameStore((s) => s.finishTokenWalk);
  const stepTokenWalk = useGameStore((s) => s.stepTokenWalk);
  const setDragGhost = useGameStore((s) => s.setDragGhost);
  const setDragPath = useGameStore((s) => s.setDragPath);
  const moving = useGameStore((s) => s.movingTokens[token.id]);
  const lockToken = useGameStore((s) => s.lockToken);
  const setDragging = useGameStore((s) => s.setDragging);
  const setHoverToken = useGameStore((s) => s.setHoverToken);
  const hovered = useGameStore((s) => s.hoverTokenId === token.id);
  const fogActive = useGameStore((s) => s.fogMode.active);
  const lightActive = useGameStore((s) => s.lightMode.active);
  const isDm = useIsDm();
  const canMove = useCanControl(token);
  const lastClickRef = useRef(0);
  const lastRouteRef = useRef(0);
  const stepRef = useRef(-1);
  const [animPos, setAnimPos] = useState<{ x: number; y: number } | null>(null);
  const displayPos = animPos ?? (moving && moving.points.length > 0 ? moving.points[0]! : null);

  const lockedByOther = token.lockedBy !== null && token.lockedBy !== selfId;
  const hpMax = statNumber(token.hpMax);
  const dead = hpMax > 0 && token.hpCurrent <= 0;

  const snap = (v: number, offset: number) => {
    if (!grid.snap) return v;
    return snapToGrid(v, offset, grid.size, token.cells);
  };

  /** Путь от стартовой точки токена до перетащенной: A* со стенами, союзниками и сложной местностью. */
  const computeRoute = (world: { x: number; y: number }): FoundPath | null => {
    const st = useGameStore.getState();
    const map = activeMapOf(st);
    if (!map) return null;
    const pathGrid = { size: grid.size || 50, offsetX: grid.offsetX, offsetY: grid.offsetY };
    const cols = Math.max(1, Math.ceil(map.width / pathGrid.size));
    const rows = Math.max(1, Math.ceil(map.height / pathGrid.size));
    const blocked = new Set<string>();
    const difficult = new Set<string>();
    for (const other of map.tokens) {
      if (other.id === token.id) continue;
      const friendly = other.faction === 'ally';
      for (const key of tokenCells(other, pathGrid)) {
        if (friendly) difficult.add(key);
        else blocked.add(key);
      }
    }
    for (const zone of map.zones) {
      if (!zone.flags?.difficultTerrain) continue;
      for (const key of areaCells(zone.area, zone.origin, zone.direction ?? null, pathGrid)) difficult.add(key);
    }
    const target = nearestFreeCell(pointCell(world, pathGrid), blocked, { cols, rows });
    if (!target) return null;
    const entry =
      map.combat.active && map.combat.currentIndex >= 0 ? map.combat.entries[map.combat.currentIndex] : undefined;
    const turn = entry?.tokenId === token.id ? map.combat.turns[entry.id] : undefined;
    const diagonalsBefore = turn?.diagonalsUsed ?? 0;
    const found = findPath({
      from: { x: token.x, y: token.y },
      to: cellCenter(target.cx, target.cy, pathGrid),
      grid: pathGrid,
      bounds: { cols, rows },
      walls: map.walls,
      blocked,
      difficult,
      diagonalsBefore,
    });
    if (!found) return null;
    const anchor = (x: number, y: number) => ({
      x: snapToGrid(x, pathGrid.offsetX, pathGrid.size, token.cells),
      y: snapToGrid(y, pathGrid.offsetY, pathGrid.size, token.cells),
    });
    const points: { x: number; y: number }[] = [];
    for (let i = 0; i < found.points.length; i++) {
      const point = found.points[i]!;
      const snapped = i === found.points.length - 1 ? anchor(world.x, world.y) : anchor(point.x, point.y);
      const last = points[points.length - 1];
      if (!last || last.x !== snapped.x || last.y !== snapped.y) points.push(snapped);
    }
    return { ...found, points };
  };

  const onDragStart = () => {
    setSelected(token.id);
    setDragging(token.id);
    lockToken(token.id, true);
    setDragGhost({ id: token.id, x: token.x, y: token.y });
    setDragPath(null);
  };

  const onDragMove = (e: Konva.KonvaEventObject<DragEvent>) => {
    const nx = snap(e.target.x(), grid.offsetX);
    const ny = snap(e.target.y(), grid.offsetY);
    if (nx !== e.target.x()) e.target.x(nx);
    if (ny !== e.target.y()) e.target.y(ny);
    // Позиция в игре не меняется, пока токен держат: только превью маршрута.
    const now = performance.now();
    if (now - lastRouteRef.current < 60) return;
    lastRouteRef.current = now;
    setDragPath(computeRoute({ x: e.target.x(), y: e.target.y() }));
  };

  const onDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    const st = useGameStore.getState();
    const route = computeRoute({ x: e.target.x(), y: e.target.y() });
    setDragging(null);
    if (route) {
      startTokenWalk(token.id, route);
      return;
    }
    const ghost = st.dragGhost;
    if (ghost && ghost.id === token.id) {
      e.target.position({ x: ghost.x, y: ghost.y });
      moveToken(token.id, ghost.x, ghost.y);
    }
    lockToken(token.id, false);
    setDragGhost(null);
    setDragPath(null);
  };

  const tokenRef = useRef(token);
  tokenRef.current = token;

  useEffect(() => {
    if (!moving || moving.points.length < 2) {
      setAnimPos(null);
      return;
    }
    const current = tokenRef.current;
    const st = useGameStore.getState();
    const map = activeMapOf(st);
    const sight = map
      ? {
          walls: map.walls,
          darkness: map.vision.darkness,
          cellSize: map.fog.size,
          offsetX: map.fog.offsetX,
          offsetY: map.fog.offsetY,
          areas: map.lightAreas,
          zones: map.zones,
        }
      : null;
    const enemies =
      moving.own && current.isPlayerToken && map
        ? map.tokens.filter((t) => t.id !== current.id && t.visible !== false && !t.isPlayerToken)
        : [];
    const senses = tokenSenses(current);
    const seenFrom = (point: { x: number; y: number }) =>
      new Set(enemies.filter((e) => sight && canSee(point, e, senses, sight)).map((e) => e.id));
    const baseline = moving.own ? seenFrom({ x: current.x, y: current.y }) : null;

    let raf = 0;
    const started = performance.now();
    const finish = (walked: { x: number; y: number }[]) => {
      setAnimPos(null);
      finishTokenWalk(current.id, walked);
    };
    // Страховка: даже если кадры не идут (фоновая вкладка), поход завершается.
    const timer = window.setTimeout(() => finish(moving.points), moving.duration + 400);
    stepRef.current = -1;
    const tick = (now: number) => {
      const t = moving.duration > 0 ? Math.min(1, (now - started) / moving.duration) : 1;
      const segments = moving.points.length - 1;
      const progress = t * segments;
      const idx = Math.min(segments - 1, Math.floor(progress));
      const local = progress - idx;
      const a = moving.points[idx]!;
      const b = moving.points[idx + 1]!;
      if (idx !== stepRef.current) {
        stepRef.current = idx;
        // Шаг по клетке: локально — вижн, на сервер — вход/выход зон.
        moveToken(current.id, a.x, a.y);
        if (moving.own) stepTokenWalk(current.id, a.x, a.y);
        if (baseline) {
          const seen = seenFrom(a);
          if ([...seen].some((id) => !baseline.has(id))) {
            // Увидел монстра — останавливаемся на этой клетке.
            window.clearTimeout(timer);
            finish(moving.points.slice(0, idx + 1));
            return;
          }
        }
      }
      setAnimPos({ x: a.x + (b.x - a.x) * local, y: a.y + (b.y - a.y) * local });
      if (t >= 1) {
        window.clearTimeout(timer);
        finish(moving.points);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
    };
  }, [moving, token.id, finishTokenWalk, moveToken, stepTokenWalk]);

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
      x={displayPos?.x ?? token.x}
      y={displayPos?.y ?? token.y}
      scaleX={token.scale}
      scaleY={token.scale}
      rotation={token.rotation}
      opacity={lockedByOther ? 0.5 : dead ? 0.55 : 1}
      draggable={
        !lockedByOther &&
        !moving &&
        !fogActive &&
        !lightActive &&
        !targeting &&
        !aim &&
        !multiTarget &&
        canMove &&
        (isDm || !movementBlocked(token.conditions))
      }
      onClick={activate}
      onTap={activate}
      onDragStart={onDragStart}
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
