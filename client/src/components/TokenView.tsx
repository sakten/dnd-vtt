import { memo, useEffect, useRef, useState } from 'react';
import { Group, Line, Rect, Text, Circle, Image as KonvaImage } from 'react-konva';
import Konva from 'konva';
import { hpBarHeight, hpBarLayout } from '../lib/hpBars';
import {
  canSee,
  cellCenter,
  movementBlocked,
  planWalk,
  sightContextOf,
  statNumber,
  tokenSenses,
  visionKindAt,
  visionRadiiCells,
  type FoundPath,
  type Token,
} from 'shared';
import { useGameStore } from '../store/useGameStore';
import { activeGridOf, activeMapOf } from '../store/selectors';
import { enterableCell } from '../lib/los';
import { useVisionViewers } from '../lib/useVision';
import { startWalkSession, walkFrame, walkedPoints } from '../lib/walk';
import { useImage } from '../lib/useImage';
import { useCanControl, useIsDm } from '../lib/control';

function TokenView({ token }: { token: Token }) {
  const image = useImage(token.imageUrl);
  const selfId = useGameStore((s) => s.selfId);
  const grid = useGameStore(activeGridOf);
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
  const wallsActive = useGameStore((s) => s.wallsMode.active);
  const isDm = useIsDm();
  const canMove = useCanControl(token);
  const lastClickRef = useRef(0);
  const lastRouteRef = useRef(0);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const [animPos, setAnimPos] = useState<{ x: number; y: number } | null>(null);
  const displayPos = animPos ?? (moving && moving.points.length > 0 ? moving.points[0]! : null);
  const visionViewersList = useVisionViewers();

  const lockedByOther = token.lockedBy !== null && token.lockedBy !== selfId;
  const hpMax = statNumber(token.hpMax);
  const dead = hpMax > 0 && token.hpCurrent <= 0;
  // Метка-прицел (Hex/Hunter's Mark): прицел поверх помеченного существа.
  const marked = token.effects.some((e) => e.mark === true && !e.hidden);

  /** Путь токена: видимость, стены, союзники (×2), полная слепота — 1 клетка. */
  const computeRoute = (world: { x: number; y: number }): FoundPath | null => {
    const st = useGameStore.getState();
    const map = activeMapOf(st);
    if (!map) return null;
    const pathGrid = { size: grid.size || 50, offsetX: grid.offsetX, offsetY: grid.offsetY };
    const entry =
      map.combat.active && map.combat.currentIndex >= 0 ? map.combat.entries[map.combat.currentIndex] : undefined;
    const turn = entry?.tokenId === token.id ? map.combat.turns[entry.id] : undefined;

    let visibleAt: ((cx: number, cy: number) => boolean) | null = null;
    let blind = false;
    if (!isDm && visionViewersList && visionViewersList.length > 0) {
      const viewers = visionViewersList;
      const sight = sightContextOf(map, pathGrid);
      const cache = new Map<string, boolean>();
      // Вход в клетку: видна зрителям или это тьма/мгла (входим вслепую); кэш на пересчёт маршрута.
      visibleAt = (cx, cy) => {
        const key = `${cx},${cy}`;
        let seen = cache.get(key);
        if (seen === undefined) {
          seen = enterableCell(sight, viewers, cellCenter(cx, cy, pathGrid));
          cache.set(key, seen);
        }
        return seen;
      };
      const kind = visionKindAt(sight, { x: token.x, y: token.y });
      const radii = visionRadiiCells(map.vision.darkness, tokenSenses(token), kind);
      blind = radii.length === 1 && radii[0] === 0;
    }

    return planWalk({
      from: { x: token.x, y: token.y },
      to: world,
      grid: pathGrid,
      mapWidth: map.width,
      mapHeight: map.height,
      walls: map.walls,
      tokens: map.tokens,
      moverId: token.id,
      cells: token.cells,
      zones: map.zones,
      visibleAt,
      blind,
      diagonalsBefore: turn?.diagonalsUsed ?? 0,
    });
  };

  const onDragStart = () => {
    setSelected(token.id);
    setDragging(token.id);
    lockToken(token.id, true);
    dragStartRef.current = { x: token.x, y: token.y };
    setDragGhost({ id: token.id, x: token.x, y: token.y });
    setDragPath(null);
  };

  /** Курсор в мировых координатах (для маршрута при «пришпиленном» токене). */
  const pointerWorld = (e: Konva.KonvaEventObject<DragEvent>) => {
    const stage = e.target.getStage();
    const pointer = stage?.getPointerPosition();
    if (!stage || !pointer) return null;
    return { x: (pointer.x - stage.x()) / stage.scaleX(), y: (pointer.y - stage.y()) / stage.scaleY() };
  };

  const onDragMove = (e: Konva.KonvaEventObject<DragEvent>) => {
    // Токен остаётся на старте: двигаем цель, а не фигурку (иначе на отпускании прыжок назад).
    const start = dragStartRef.current;
    if (start) e.target.position({ x: start.x, y: start.y });
    const now = performance.now();
    if (now - lastRouteRef.current < 60) return;
    const world = pointerWorld(e);
    if (!world) return;
    lastRouteRef.current = now;
    setDragPath(computeRoute(world));
  };

  const onDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    const world = pointerWorld(e);
    const route = world ? computeRoute(world) : null;
    setDragging(null);
    setDragGhost(null);
    setDragPath(null);
    if (route) {
      startTokenWalk(token.id, route);
      return;
    }
    lockToken(token.id, false);
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
    const session = startWalkSession(moving.points, performance.now());
    const finish = (walked: { x: number; y: number }[]) => {
      window.clearTimeout(timer);
      cancelAnimationFrame(raf);
      setAnimPos(null);
      finishTokenWalk(current.id, walked);
    };
    // Страховка: если кадры не идут (фоновая вкладка) — поход всё равно завершается.
    const timer = window.setTimeout(() => finish(moving.points), session.duration + 2000);
    const tick = (now: number) => {
      const frame = walkFrame(session, now);
      for (const i of frame.steps) {
        const point = moving.points[i]!;
        // Шаг по клетке: локально — вижн, на сервер — вход/выход зон.
        moveToken(current.id, point.x, point.y);
        if (moving.own) stepTokenWalk(current.id, point.x, point.y);
        if (baseline) {
          const seen = seenFrom(point);
          if ([...seen].some((id) => !baseline.has(id))) {
            // Увидел монстра — останавливаемся на этой клетке.
            finish(walkedPoints(session, i));
            return;
          }
        }
      }
      setAnimPos(frame.position);
      if (frame.settled) {
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
    // В режиме «Стены» клик по токену не мешает рисовать: событие уходит на сцену.
    if (st.wallsMode.active) return;
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
        !wallsActive &&
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
      {marked && (
        <Group listening={false}>
          {(() => {
            const s = Math.min(token.w, token.h);
            const inner = s * 0.13;
            const outer = s * 0.42;
            const width = 2.2 / token.scale;
            const tick = {
              stroke: '#ffd166',
              strokeWidth: width,
              lineCap: 'round' as const,
              shadowColor: '#000000',
              shadowBlur: 4 / token.scale,
              shadowOpacity: 0.65,
              opacity: 0.95,
            };
            return (
              <>
                <Line points={[0, -outer, 0, -inner]} {...tick} />
                <Line points={[0, inner, 0, outer]} {...tick} />
                <Line points={[-outer, 0, -inner, 0]} {...tick} />
                <Line points={[inner, 0, outer, 0]} {...tick} />
                <Circle
                  x={0}
                  y={0}
                  radius={1.8 / token.scale}
                  fill="#ffd166"
                  shadowColor="#000000"
                  shadowBlur={3 / token.scale}
                  shadowOpacity={0.65}
                  opacity={0.95}
                />
              </>
            );
          })()}
        </Group>
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
      {hpMax > 0 &&
        (() => {
          const scale = token.scale || 1;
          const barH = hpBarHeight(scale);
          const layout = hpBarLayout({
            w: token.w,
            h: token.h,
            scale,
            hpCurrent: token.hpCurrent,
            hpMax,
            tempValue: token.shape ? token.shape.hp : token.hpTemp ?? 0,
            tempMax: token.shape ? token.shape.maxHp : hpMax,
          });
          const sectorLines = (fractions: number[], y: number, key: string) =>
            fractions.map((f, i) => {
              const x = -token.w / 2 + f * token.w;
              return (
                <Line
                  key={`${key}:${i}`}
                  points={[x, y, x, y + barH]}
                  stroke="#000000"
                  strokeWidth={1 / scale}
                  listening={false}
                />
              );
            });
          return (
            <Group listening={false}>
              {layout.temp && (
                <>
                  <Rect
                    x={-token.w / 2}
                    y={layout.temp.y}
                    width={token.w}
                    height={barH}
                    fill="#2b3039"
                    stroke="#000000"
                    strokeWidth={1 / scale}
                    cornerRadius={2 / scale}
                  />
                  <Rect
                    x={-token.w / 2}
                    y={layout.temp.y}
                    width={layout.temp.width}
                    height={barH}
                    fill="#9aa4b2"
                    cornerRadius={2 / scale}
                  />
                  {sectorLines(layout.tempSectors, layout.temp.y, 'temp')}
                </>
              )}
              <Rect
                x={-token.w / 2}
                y={layout.hp.y}
                width={token.w}
                height={barH}
                fill="#2b3039"
                stroke="#000000"
                strokeWidth={1 / scale}
                cornerRadius={2 / scale}
              />
              <Rect
                x={-token.w / 2}
                y={layout.hp.y}
                width={layout.hp.width}
                height={barH}
                fill={
                  token.hpCurrent / hpMax > 0.5 ? '#4ecb71' : token.hpCurrent / hpMax > 0.25 ? '#ffd166' : '#ff6b6b'
                }
                cornerRadius={2 / scale}
              />
              {sectorLines(layout.hpSectors, layout.hp.y, 'hp')}
            </Group>
          );
        })()}
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
