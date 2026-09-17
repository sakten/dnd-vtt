import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Stage, Layer, Rect, Group, Image as KonvaImage, Line, Shape, Text } from 'react-konva';
import Konva from 'konva';
import type { LightArea, MapInfo, Token, Wall } from 'shared';
import { areaCells, gridDistanceFeet, reachableCells, segmentRectDistance, sightContextOf, snapToGrid } from 'shared';
import { useGameStore } from '../store/useGameStore';
import { useActiveMap } from '../store/hooks';
import { activeGridOf, activeMapOf, tokenById } from '../store/selectors';
import { useImage } from '../lib/useImage';
import { visibleCells } from '../lib/los';
import { useVisionViewers } from '../lib/useVision';
import { canAddLibraryItem, canControlWith, useIsDm } from '../lib/control';
import { newId } from '../lib/id';
import GridLayer from './GridLayer';
import ZoneLayer from './ZoneLayer';
import ConditionsOverlay from './ConditionsOverlay';
import TokenView from './TokenView';

function MapSprite({ map }: { map: MapInfo }) {
  const image = useImage(map.url);
  if (!image) return null;
  return <KonvaImage image={image} width={map.width} height={map.height} listening={false} />;
}

interface WorldPoint {
  x: number;
  y: number;
}

/** Бледная копия токена на месте начала перетаскивания. */
function TokenGhost({ token, x, y }: { token: Token; x: number; y: number }) {
  const image = useImage(token.imageUrl);
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

const cellIndex = (v: number, offset: number, size: number) => Math.floor((v - offset) / size);
const cellKey = (cx: number, cy: number) => `${cx},${cy}`;

const WALL_COLORS: Record<Wall['kind'], string> = {
  wall: '#e6e8ee',
  door: '#e0a458',
  window: '#7cc7e8',
};

const LIGHT_AREA_COLORS: Record<LightArea['kind'], string> = {
  darkness: '#3b4f8a',
  magical: '#9d5cf6',
  obscured: '#9aa0a6',
};

/** Расстояние от точки до отрезка стены (для удаления правым кликом). */
function distToSegment(p: { x: number; y: number }, w: Wall): number {
  const dx = w.x2 - w.x1;
  const dy = w.y2 - w.y1;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((p.x - w.x1) * dx + (p.y - w.y1) * dy) / len2)) : 0;
  return Math.hypot(p.x - (w.x1 + t * dx), p.y - (w.y1 + t * dy));
}

export default function TableTop() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const paintRef = useRef<{ pressed: boolean; start: WorldPoint | null }>({ pressed: false, start: null });
  const [rectPreview, setRectPreview] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [wallCursor, setWallCursor] = useState<{ x: number; y: number } | null>(null);
  const [doorHover, setDoorHover] = useState<{ id: string; state: 'open' | 'blocked' } | null>(null);
  const wallPressRef = useRef<{ x: number; y: number } | null>(null);

  const view = useGameStore((s) => s.view);
  const setView = useGameStore((s) => s.setView);
  const setViewport = useGameStore((s) => s.setViewport);
  const grid = useGameStore(activeGridOf);
  const setSelected = useGameStore((s) => s.setSelected);
  const isDm = useIsDm();
  const interaction = useGameStore((s) => s.interaction);
  const cancelInteraction = useGameStore((s) => s.cancelInteraction);
  const hoverTokenId = useGameStore((s) => s.hoverTokenId);
  const fogMode = useGameStore((s) => s.fogMode);
  const updateFog = useGameStore((s) => s.updateFog);
  const wallsMode = useGameStore((s) => s.wallsMode);
  const setWallsMode = useGameStore((s) => s.setWallsMode);
  const wallStart = wallsMode.start;
  const updateWalls = useGameStore((s) => s.updateWalls);
  const lightMode = useGameStore((s) => s.lightMode);
  const updateAreas = useGameStore((s) => s.updateAreas);
  const dragGhost = useGameStore((s) => s.dragGhost);
  const dragPath = useGameStore((s) => s.dragPath);
  const wallCandidates = useGameStore((s) => s.wallCandidates);
  const aimToCursor = useGameStore((s) => s.aimToCursor);
  const confirmAim = useGameStore((s) => s.confirmAim);
  const aim = interaction?.mode === 'aim' ? interaction.aim : null;
  const targeting = interaction?.mode === 'target' ? interaction.target : null;
  const multiTarget = interaction?.mode === 'multi' ? interaction.multi : null;
  const activeMap = useActiveMap();
  const hiddenSet = useMemo(() => new Set(activeMap?.fog.hidden ?? []), [activeMap?.fog.hidden]);
  // Границы расчёта вижна: вьюпорт ∩ карта, с запасом 2 клетки и квантованием по 2 клетки.
  const cellBounds = useMemo(() => {
    const map = activeMap;
    if (!map || size.w === 0) return null;
    const cell = map.fog.size || 50;
    const quant = (v: number) => Math.floor(v / 2) * 2;
    const left = (-view.x / view.scale - map.fog.offsetX) / cell - 2;
    const top = (-view.y / view.scale - map.fog.offsetY) / cell - 2;
    const right = ((size.w - view.x) / view.scale - map.fog.offsetX) / cell + 2;
    const bottom = ((size.h - view.y) / view.scale - map.fog.offsetY) / cell + 2;
    return { cx0: quant(left), cy0: quant(top), cx1: quant(right), cy1: quant(bottom) };
  }, [activeMap, view, size]);
  const viewers = useVisionViewers();

  useEffect(() => {
    if (!wallsMode.active) {
      setWallCursor(null);
    }
  }, [wallsMode.active]);

  // id активной записи инициативы, которой управляет текущий пользователь (для подсветки хода).
  const activeControlId = useGameStore((s) => {
    const map = activeMapOf(s);
    if (!map || !map.combat.active || map.combat.currentIndex < 0) return null;
    const entry = map.combat.entries[map.combat.currentIndex];
    if (!entry?.tokenId) return null;
    const token = tokenById(map, entry.tokenId);
    if (!token || !canControlWith(s, token)) return null;
    return entry.id;
  });

  const movementCells = useMemo(() => {
    if (!activeMap || !activeControlId) return [];
    const combat = activeMap.combat;
    const entry = combat.entries.find((e) => e.id === activeControlId);
    const token = entry?.tokenId ? tokenById(activeMap, entry.tokenId) : undefined;
    const turn = combat.turns[activeControlId];
    if (!entry || !token || !turn) return [];
    const remaining = Math.max(0, turn.movementMax - turn.movementUsed);
    const size = grid.size || 50;
    const ccx = cellIndex(token.x, grid.offsetX, size);
    const ccy = cellIndex(token.y, grid.offsetY, size);
    const maxCx = Math.ceil(activeMap.width / size);
    const maxCy = Math.ceil(activeMap.height / size);
    const cells: { x: number; y: number; size: number }[] = [];
    for (const { cx: gx, cy: gy } of reachableCells(ccx, ccy, remaining, turn.diagonalsUsed)) {
      if (gx < 0 || gy < 0 || gx >= maxCx || gy >= maxCy) continue;
      if (!isDm && hiddenSet.has(cellKey(gx, gy))) continue;
      cells.push({ x: grid.offsetX + gx * size, y: grid.offsetY + gy * size, size });
    }
    return cells;
  }, [activeMap, activeControlId, grid, isDm, hiddenSet]);

  const aimCells = useMemo(() => {
    if (!aim || !aim.origin) return [];
    const size = grid.size || 50;
    const g = { size, offsetX: grid.offsetX, offsetY: grid.offsetY };
    const keys = areaCells(aim.spec, aim.origin, aim.direction, g);
    const maxCx = Math.ceil((activeMap?.width ?? 0) / size);
    const maxCy = Math.ceil((activeMap?.height ?? 0) / size);
    const out: { x: number; y: number; size: number }[] = [];
    for (const key of keys) {
      const [cx, cy] = key.split(',').map(Number);
      if (cx === undefined || cy === undefined || cx < 0 || cy < 0) continue;
      if (activeMap && (cx >= maxCx || cy >= maxCy)) continue;
      if (!isDm && hiddenSet.has(key)) continue;
      out.push({ x: g.offsetX + cx * size, y: g.offsetY + cy * size, size });
    }
    return out;
  }, [aim, grid, activeMap, isDm, hiddenSet]);

  const multiTargetTokens = useMemo(() => {
    if (!multiTarget || !activeMap) return [];
    return multiTarget.targets
      .map((id) => tokenById(activeMap, id))
      .filter((t): t is NonNullable<typeof t> => !!t);
  }, [multiTarget, activeMap]);

  const measure = useMemo(() => {
    if (!activeMap || !targeting || !hoverTokenId) return null;
    const from = targeting.tokenId ? tokenById(activeMap, targeting.tokenId) : null;
    const to = tokenById(activeMap, hoverTokenId);
    if (!from || !to || from.id === to.id) return null;
    const feet = gridDistanceFeet(from, to, grid.size || 50);
    return { from, to, feet };
  }, [activeMap, targeting, hoverTokenId, grid.size]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
      setViewport({ w: el.clientWidth, h: el.clientHeight });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [setViewport]);

  const fog = activeMap?.fog;
  const fogRects = useMemo(() => {
    if (!fog) return [];
    return fog.hidden
      .map((key) => {
        const [cx, cy] = key.split(',').map(Number);
        return cx === undefined || cy === undefined
          ? null
          : { x: fog.offsetX + cx * fog.size, y: fog.offsetY + cy * fog.size, size: fog.size };
      })
      .filter((r): r is { x: number; y: number; size: number } => r !== null);
  }, [fog]);

  // Вуаль зависит от стен/тьмы/областей/зон/размера карты и зрителей — не от любых
  // патчей токенов (HP, состояния, имя), иначе пересчёт на каждое изменение.
  const veilActive = !!activeMap;
  const veilWalls = activeMap?.walls;
  const veilVision = activeMap?.vision;
  const veilAreas = activeMap?.lightAreas;
  const veilZones = activeMap?.zones;
  const veilWidth = activeMap?.width ?? 0;
  const veilHeight = activeMap?.height ?? 0;

  const veilRects = useMemo(() => {
    if (!veilActive || isDm) return null;
    const cell = grid.size || 50;
    const visible = visibleCells({
      ...sightContextOf(
        { walls: veilWalls ?? [], vision: veilVision!, lightAreas: veilAreas ?? [], zones: veilZones ?? [] },
        { size: cell, offsetX: grid.offsetX, offsetY: grid.offsetY }
      ),
      width: veilWidth,
      height: veilHeight,
      bounds: cellBounds,
      viewers: viewers ?? [],
    });
    if (visible === null) return null;
    const cols = Math.ceil(veilWidth / cell);
    const rows = Math.ceil(veilHeight / cell);
    const cx0 = Math.max(0, cellBounds?.cx0 ?? 0);
    const cy0 = Math.max(0, cellBounds?.cy0 ?? 0);
    const cx1 = Math.min(cols - 1, cellBounds?.cx1 ?? cols - 1);
    const cy1 = Math.min(rows - 1, cellBounds?.cy1 ?? rows - 1);
    const rects: { x: number; y: number; size: number }[] = [];
    for (let cx = cx0; cx <= cx1; cx++) {
      for (let cy = cy0; cy <= cy1; cy++) {
        const key = cellKey(cx, cy);
        if (visible.has(key) || hiddenSet.has(key)) continue;
        rects.push({
          x: grid.offsetX + cx * cell,
          y: grid.offsetY + cy * cell,
          size: cell,
        });
      }
    }
    return rects;
  }, [
    veilActive,
    veilWalls,
    veilVision,
    veilAreas,
    veilZones,
    veilWidth,
    veilHeight,
    isDm,
    hiddenSet,
    viewers,
    cellBounds,
    grid,
  ]);

  const isCellHidden = (x: number, y: number): boolean => {
    const f = activeMap?.fog;
    if (!f) return false;
    return hiddenSet.has(cellKey(cellIndex(x, f.offsetX, f.size), cellIndex(y, f.offsetY, f.size)));
  };

  const cellKeysBetween = (a: WorldPoint, b: WorldPoint): string[] => {
    const f = activeMap?.fog;
    if (!f) return [];
    const minX = Math.min(a.x, b.x);
    const maxX = Math.max(a.x, b.x);
    const minY = Math.min(a.y, b.y);
    const maxY = Math.max(a.y, b.y);
    const keys: string[] = [];
    const cx0 = cellIndex(minX, f.offsetX, f.size);
    const cx1 = cellIndex(maxX, f.offsetX, f.size);
    const cy0 = cellIndex(minY, f.offsetY, f.size);
    const cy1 = cellIndex(maxY, f.offsetY, f.size);
    for (let cx = cx0; cx <= cx1; cx++) {
      for (let cy = cy0; cy <= cy1; cy++) {
        keys.push(cellKey(cx, cy));
      }
    }
    return keys;
  };

  const cellKeysAround = (w: WorldPoint, radius: number): string[] => {
    const f = activeMap?.fog;
    if (!f) return [];
    const ccx = cellIndex(w.x, f.offsetX, f.size);
    const ccy = cellIndex(w.y, f.offsetY, f.size);
    const keys: string[] = [];
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        if (dx * dx + dy * dy <= radius * radius) {
          keys.push(cellKey(ccx + dx, ccy + dy));
        }
      }
    }
    return keys;
  };

  const applyCells = (keys: string[], action: 'hide' | 'reveal') => {
    if (!activeMap) return;
    const fog = activeMap.fog;
    const set = new Set(fog.hidden);
    if (action === 'hide') keys.forEach((k) => set.add(k));
    else keys.forEach((k) => set.delete(k));
    updateFog(activeMap.id, { ...fog, hidden: [...set] });
  };

  const toWorld = (stage: Konva.Stage, p: { x: number; y: number }): WorldPoint => ({
    x: (p.x - stage.x()) / stage.scaleX(),
    y: (p.y - stage.y()) / stage.scaleX(),
  });

  const snapWall = (p: { x: number; y: number }) => ({
    x: snapToGrid(p.x, grid.offsetX, grid.size, 0),
    y: snapToGrid(p.y, grid.offsetY, grid.size, 0),
  });

  const createLightArea = (a: WorldPoint, b: WorldPoint) => {
    if (!activeMap) return;
    const s1 = snapWall(a);
    const s2 = snapWall(b);
    const x = Math.min(s1.x, s2.x);
    const y = Math.min(s1.y, s2.y);
    const w = Math.max(s1.x, s2.x) - x;
    const h = Math.max(s1.y, s2.y) - y;
    if (w < grid.size || h < grid.size) return;
    updateAreas(activeMap.id, [
      ...activeMap.lightAreas,
      { id: newId(), kind: lightMode.kind, x, y, w, h },
    ]);
  };

  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    if (!stage) return;
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };
    const factor = e.evt.deltaY > 0 ? 1 / 1.1 : 1.1;
    const newScale = Math.min(8, Math.max(0.05, oldScale * factor));
    stage.scale({ x: newScale, y: newScale });
    stage.position({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    });
    setView({ x: stage.x(), y: stage.y(), scale: newScale });
  };

  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (wallsMode.active) {
      // Запоминаем точку нажатия левой кнопкой: короткий клик ставит узел, драг — панорамирует карту.
      const pointer = e.evt.button === 0 ? e.target.getStage()?.getPointerPosition() : null;
      wallPressRef.current = pointer ? { x: pointer.x, y: pointer.y } : null;
      return;
    }
    if (lightMode.active) {
      if (!isDm) return;
      e.evt.preventDefault();
      const stage = e.target.getStage();
      const pointer = stage?.getPointerPosition();
      if (!stage || !pointer) return;
      const w = toWorld(stage, pointer);
      paintRef.current.pressed = true;
      paintRef.current.start = w;
      setRectPreview({ x0: w.x, y0: w.y, x1: w.x, y1: w.y });
      return;
    }
    if (!fogMode.active) {
      if (aim || targeting) return;
      if (e.target === e.target.getStage()) {
        setSelected(null);
      }
      return;
    }
    e.evt.preventDefault();
    const stage = e.target.getStage();
    const pointer = stage?.getPointerPosition();
    if (!stage || !pointer) return;
    paintRef.current.pressed = true;
    const w = toWorld(stage, pointer);
    if (fogMode.tool === 'rect') {
      paintRef.current.start = w;
      setRectPreview({ x0: w.x, y0: w.y, x1: w.x, y1: w.y });
    } else {
      applyCells(cellKeysAround(w, fogMode.brush), fogMode.action);
    }
  };

  const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (wallsMode.active) {
      const stage = e.target.getStage();
      const pointer = stage?.getPointerPosition();
      if (stage && pointer) setWallCursor(snapWall(toWorld(stage, pointer)));
      return;
    }
    if (lightMode.active) {
      if (!paintRef.current.pressed || !paintRef.current.start) return;
      const stage = e.target.getStage();
      const pointer = stage?.getPointerPosition();
      if (!stage || !pointer) return;
      const w = toWorld(stage, pointer);
      setRectPreview({ x0: paintRef.current.start.x, y0: paintRef.current.start.y, x1: w.x, y1: w.y });
      return;
    }
    if (aim) {
      const stage = e.target.getStage();
      const pointer = stage?.getPointerPosition();
      if (stage && pointer) aimToCursor(toWorld(stage, pointer));
      return;
    }
    // Игрок: курсор-замочек над дверью (открытый — можно, закрытый — только DM).
    if (!isDm) {
      const stage = e.target.getStage();
      const pointer = stage?.getPointerPosition();
      if (!stage || !pointer) return;
      const door = doorAt(toWorld(stage, pointer));
      if (!door) setDoorHover(null);
      else {
        const state: 'open' | 'blocked' = !door.dmOnly && playerDoorReach(door) ? 'open' : 'blocked';
        setDoorHover({ id: door.id, state });
      }
      return;
    }
    if (!fogMode.active || !paintRef.current.pressed) return;
    const stage = e.target.getStage();
    const pointer = stage?.getPointerPosition();
    if (!stage || !pointer) return;
    const w = toWorld(stage, pointer);
    if (fogMode.tool === 'rect' && paintRef.current.start) {
      setRectPreview({ x0: paintRef.current.start.x, y0: paintRef.current.start.y, x1: w.x, y1: w.y });
    } else if (fogMode.tool === 'brush') {
      applyCells(cellKeysAround(w, fogMode.brush), fogMode.action);
    }
  };

  const handleMouseUp = () => {
    if (lightMode.active) {
      if (rectPreview) createLightArea({ x: rectPreview.x0, y: rectPreview.y0 }, { x: rectPreview.x1, y: rectPreview.y1 });
      paintRef.current.pressed = false;
      paintRef.current.start = null;
      setRectPreview(null);
      return;
    }
    if (!fogMode.active) return;
    if (fogMode.tool === 'rect' && paintRef.current.start && rectPreview) {
      applyCells(cellKeysBetween(paintRef.current.start, { x: rectPreview.x1, y: rectPreview.y1 }), fogMode.action);
    }
    paintRef.current.pressed = false;
    paintRef.current.start = null;
    setRectPreview(null);
  };

  /** Дверь под курсором (в пределах 10px экранных). */
  const doorAt = (world: { x: number; y: number }): Wall | null =>
    activeMap?.walls.find((w) => w.kind === 'door' && distToSegment(world, w) <= 10 / view.scale) ?? null;

  /** Есть ли у игрока подходящий токен в 5 фт от двери (как на сервере). */
  const playerDoorReach = (door: Wall): boolean => {
    const st = useGameStore.getState();
    const map = activeMapOf(st);
    if (!map) return false;
    const cell = map.grid.size || 50;
    return map.tokens.some(
      (t) =>
        (t.isPlayerToken || t.canInteract) &&
        canControlWith(st, t) &&
        segmentRectDistance(
          { x: door.x1, y: door.y1 },
          { x: door.x2, y: door.y2 },
          { x: t.x - t.w / 2, y: t.y - t.h / 2, w: t.w, h: t.h }
        ) <=
          cell + 1e-6
    );
  };

  const handleClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (wallsMode.active) {
      if (!isDm || e.evt.button !== 0) return;
      const stage = e.target.getStage();
      const pointer = stage?.getPointerPosition();
      const press = wallPressRef.current;
      wallPressRef.current = null;
      if (!stage || !pointer || !activeMap) return;
      if (press && (pointer.x - press.x) ** 2 + (pointer.y - press.y) ** 2 > 25) return;
      const raw = toWorld(stage, pointer);
      const door = activeMap.walls.find(
        (w) => w.kind === 'door' && distToSegment(raw, w) <= 10 / view.scale
      );
      if (door) {
        // В режиме «Стены» клик по двери — тоггл (как раньше).
        updateWalls(
          activeMap.id,
          activeMap.walls.map((w) => (w.id === door.id ? { ...w, open: !w.open } : w))
        );
        return;
      }
      const p = snapWall(raw);
      if (!wallStart) {
        setWallsMode({ start: p });
        return;
      }
      if (p.x === wallStart.x && p.y === wallStart.y) return;
      updateWalls(activeMap.id, [
        ...activeMap.walls,
        { id: newId(), kind: wallsMode.tool, x1: wallStart.x, y1: wallStart.y, x2: p.x, y2: p.y },
      ]);
      setWallsMode({ start: p });
      return;
    }
    if (!isDm && activeMap && e.evt.button === 0 && !aim && !targeting && !wallsMode.active && !fogMode.active && !lightMode.active) {
      const st = useGameStore.getState();
      const stage = e.target.getStage();
      const pointer = stage?.getPointerPosition();
      const door = stage && pointer ? doorAt(toWorld(stage, pointer)) : null;
      st.setDoorMenu(door && !door.dmOnly && playerDoorReach(door) ? door.id : null);
      return;
    }
    if (isDm && activeMap && e.evt.button === 0 && !fogMode.active) {
      // Мини-UI двери: DM открывает/закрывает и настраивает (в режиме «Стены» — как раньше).
      const st = useGameStore.getState();
      const stage = e.target.getStage();
      const pointer = stage?.getPointerPosition();
      if (stage && pointer) {
        const door = doorAt(toWorld(stage, pointer));
        st.setDoorMenu(door ? door.id : null);
        if (door) return;
      }
    }
    if (aim) {
      e.evt.preventDefault();
      const stage = e.target.getStage();
      const pointer = stage?.getPointerPosition();
      if (stage && pointer) {
        aimToCursor(toWorld(stage, pointer));
        confirmAim();
      }
      return;
    }
    if (targeting && !fogMode.active) cancelInteraction();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData('application/x-vtt-token');
    if (!raw) return;
    let item: { id?: string; cells?: number; isPlayerToken?: boolean; owner?: string };
    try {
      item = JSON.parse(raw) as { id?: string; cells?: number; isPlayerToken?: boolean; owner?: string };
    } catch {
      return;
    }
    if (!item.id) return;
    if (
      !canAddLibraryItem({
        id: item.id,
        isPlayerToken: item.isPlayerToken === true,
        owner: item.owner ?? '',
      })
    ) {
      return;
    }
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const st = useGameStore.getState();
    const grid = activeGridOf(st);
    const { view: v } = st;
    let wx = (sx - v.x) / v.scale;
    let wy = (sy - v.y) / v.scale;
    if (grid.snap) {
      const cells = item.cells ?? 1;
      wx = snapToGrid(wx, grid.offsetX, grid.size, cells);
      wy = snapToGrid(wy, grid.offsetY, grid.size, cells);
    }
    useGameStore.getState().addTokenAt(item.id, wx, wy);
  };

  return (
    <div
      ref={containerRef}
      className={`table-top${aim || targeting || multiTarget ? ' targeting' : ''}${doorHover ? ` door-${doorHover.state}` : ''}`}
      data-testid="table-top"
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }}
      onDrop={handleDrop}
    >
      {size.w > 0 && size.h > 0 && (
        <Stage
          width={size.w}
          height={size.h}
          x={view.x}
          y={view.y}
          scaleX={view.scale}
          scaleY={view.scale}
          draggable={!fogMode.active && !lightMode.active && !aim && !multiTarget && !targeting}
          onWheel={handleWheel}
          onDragMove={(e) => {
            if (e.target !== e.currentTarget) return;
            setView({ x: e.currentTarget.x(), y: e.currentTarget.y(), scale: view.scale });
          }}
          onDragEnd={(e) => {
            if (e.target !== e.currentTarget) return;
            setView({ x: e.currentTarget.x(), y: e.currentTarget.y(), scale: view.scale });
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setDoorHover(null)}
          onMouseUp={handleMouseUp}
          onClick={handleClick}
          onContextMenu={(e) => {
            if (!isDm || !activeMap) return;
            const stage = e.target.getStage();
            const pointer = stage?.getPointerPosition();
            if (!stage || !pointer) return;
            const p = toWorld(stage, pointer);
            if (lightMode.active) {
              e.evt.preventDefault();
              const hit = activeMap.lightAreas.find(
                (a) => p.x >= a.x && p.x <= a.x + a.w && p.y >= a.y && p.y <= a.y + a.h
              );
              if (hit) updateAreas(activeMap.id, activeMap.lightAreas.filter((a) => a.id !== hit.id));
              return;
            }
            if (!wallsMode.active) return;
            e.evt.preventDefault();
            const hit = activeMap.walls.find((w) => distToSegment(p, w) <= 10 / view.scale);
            if (hit) updateWalls(activeMap.id, activeMap.walls.filter((w) => w.id !== hit.id));
            // ПКМ по пустому месту — завершаем цепочку, нарисованное остаётся.
            else setWallsMode({ start: null });
          }}
          onTouchStart={(e) => {
            if (!fogMode.active && e.target === e.target.getStage()) {
              setSelected(null);
            }
          }}
        >
          <Layer>{activeMap && <MapSprite map={activeMap} />}</Layer>
          <Layer listening={false}>
            {isDm &&
              activeMap?.lightAreas.map((a) => (
                <Rect
                  key={`area-${a.id}`}
                  x={a.x}
                  y={a.y}
                  width={a.w}
                  height={a.h}
                  fill={LIGHT_AREA_COLORS[a.kind]}
                  opacity={0.16}
                  stroke={LIGHT_AREA_COLORS[a.kind]}
                  strokeWidth={2 / view.scale}
                  dash={[8 / view.scale, 5 / view.scale]}
                  listening={false}
                />
              ))}
            {activeMap?.walls.map((w) => {
              // Игроки видят только двери (стены — инструмент DM); невидимые скроет вуаль.
              if (!isDm && w.kind !== 'door') return null;
              const openDoor = w.kind === 'door' && w.open === true;
              const hovered = doorHover?.id === w.id;
              return (
                <Line
                  key={w.id}
                  points={[w.x1, w.y1, w.x2, w.y2]}
                  stroke={hovered ? '#7c9cff' : openDoor ? '#4ecb71' : WALL_COLORS[w.kind]}
                  strokeWidth={(hovered ? 7 : 5) / view.scale}
                  lineCap="round"
                  opacity={openDoor ? 0.55 : 0.9}
                  dash={openDoor ? [10 / view.scale, 7 / view.scale] : undefined}
                  listening={false}
                />
              );
            })}
            {isDm &&
              wallCandidates?.map((w) => (
                <Line
                  key={`cand-${w.id}`}
                  points={[w.x1, w.y1, w.x2, w.y2]}
                  stroke={w.kind === 'door' ? '#39d353' : '#ffd43b'}
                  strokeWidth={4 / view.scale}
                  dash={[10 / view.scale, 6 / view.scale]}
                  opacity={0.85}
                  listening={false}
                />
              ))}
            {wallStart && wallCursor && (
              <Line
                points={[wallStart.x, wallStart.y, wallCursor.x, wallCursor.y]}
                stroke="#7c9cff"
                strokeWidth={3 / view.scale}
                dash={[8 / view.scale, 5 / view.scale]}
                listening={false}
              />
            )}
            {wallStart && (
              <Rect
                x={wallStart.x - 4 / view.scale}
                y={wallStart.y - 4 / view.scale}
                width={8 / view.scale}
                height={8 / view.scale}
                fill="#7c9cff"
                listening={false}
              />
            )}
            {fogRects.map((r) => (
              <Rect
                key={`${r.x},${r.y}`}
                x={r.x}
                y={r.y}
                width={r.size}
                height={r.size}
                fill="#07090d"
                opacity={isDm ? 0.45 : 0.93}
              />
            ))}
            {rectPreview && (
              <Rect
                x={Math.min(rectPreview.x0, rectPreview.x1)}
                y={Math.min(rectPreview.y0, rectPreview.y1)}
                width={Math.abs(rectPreview.x1 - rectPreview.x0)}
                height={Math.abs(rectPreview.y1 - rectPreview.y0)}
                stroke="#7c9cff"
                strokeWidth={2 / view.scale}
                dash={[8 / view.scale, 4 / view.scale]}
              />
            )}
          </Layer>
          <GridLayer grid={grid} view={view} viewport={size} />
          <Layer listening={false}>
            <ZoneLayer zones={activeMap?.zones ?? []} grid={grid} />
          </Layer>
          <Layer>
            {movementCells.map((c) => (
              <Rect
                key={`mv-${c.x},${c.y}`}
                x={c.x}
                y={c.y}
                width={c.size}
                height={c.size}
                fill="#7c9cff"
                opacity={0.18}
                listening={false}
              />
            ))}
            {aimCells.map((c) => (
              <Rect
                key={`aim-${c.x},${c.y}`}
                x={c.x}
                y={c.y}
                width={c.size}
                height={c.size}
                fill="#ff9f43"
                opacity={0.34}
                listening={false}
              />
            ))}
            {aim?.origin && (
              <Line
                points={[
                  aim.origin.x - 8 / view.scale,
                  aim.origin.y,
                  aim.origin.x + 8 / view.scale,
                  aim.origin.y,
                ]}
                stroke="#ff9f43"
                strokeWidth={3 / view.scale}
                listening={false}
              />
            )}
            {multiTargetTokens.map((t, i) => (
              <Fragment key={`mt-${i}-${t.id}`}>
                <Rect
                  x={t.x - t.w / 2}
                  y={t.y - t.h / 2}
                  width={t.w}
                  height={t.h}
                  stroke="#ffd43b"
                  strokeWidth={3 / view.scale}
                  listening={false}
                />
                <Text
                  text={`${i + 1}`}
                  x={t.x - 6 / view.scale}
                  y={t.y - 8 / view.scale}
                  fontSize={18 / view.scale}
                  fill="#ffd43b"
                  stroke="#000000"
                  strokeWidth={3 / view.scale}
                  fillAfterStrokeEnabled
                  listening={false}
                />
              </Fragment>
            ))}
            {dragGhost &&
              activeMap &&
              (() => {
                const ghost = activeMap.tokens.find((t) => t.id === dragGhost.id);
                if (!ghost) return null;
                return <TokenGhost token={ghost} x={dragGhost.x} y={dragGhost.y} />;
              })()}
            {activeMap?.tokens
              .filter((t) => !(!isDm && isCellHidden(t.x, t.y)))
              .map((token) => (
                <TokenView key={token.id} token={token} />
              ))}
            {dragPath && dragPath.points.length > 1 && (
              <>
                <Line
                  points={dragPath.points.flatMap((p) => [p.x, p.y])}
                  stroke="#4ecb71"
                  strokeWidth={4 / view.scale}
                  dash={[10 / view.scale, 6 / view.scale]}
                  opacity={0.9}
                  listening={false}
                />
                <Text
                  text={`${dragPath.feet} фт`}
                  x={dragPath.points[dragPath.points.length - 1]!.x + 10 / view.scale}
                  y={dragPath.points[dragPath.points.length - 1]!.y - 26 / view.scale}
                  fontSize={16 / view.scale}
                  fill="#cfe1ff"
                  stroke="#000000"
                  strokeWidth={3 / view.scale}
                  fillAfterStrokeEnabled
                  listening={false}
                />
                {(() => {
                  const target = dragPath.points[dragPath.points.length - 1]!;
                  const dragged = activeMap?.tokens.find((t) => t.id === dragGhost?.id);
                  const size = grid.size || 50;
                  const hw = (dragged?.w ?? size) / 2;
                  const hh = (dragged?.h ?? size) / 2;
                  return (
                    <>
                      <Line
                        points={[target.x - hw, target.y - hh, target.x + hw, target.y + hh]}
                        stroke="#4ecb71"
                        strokeWidth={3 / view.scale}
                        listening={false}
                      />
                      <Line
                        points={[target.x - hw, target.y + hh, target.x + hw, target.y - hh]}
                        stroke="#4ecb71"
                        strokeWidth={3 / view.scale}
                        listening={false}
                      />
                    </>
                  );
                })()}
              </>
            )}
          </Layer>
          <Layer listening={false}>
            {veilRects && veilRects.length > 0 && (
              <Shape
                listening={false}
                sceneFunc={(context) => {
                  context.beginPath();
                  for (const r of veilRects) context.rect(r.x, r.y, r.size, r.size);
                  context.fillStyle = '#07090d';
                  context.fill();
                }}
              />
            )}
            {measure && (
              <>
                <Line
                  points={[measure.from.x, measure.from.y, measure.to.x, measure.to.y]}
                  stroke="#ff5a5a"
                  strokeWidth={2 / view.scale}
                  dash={[10 / view.scale, 6 / view.scale]}
                />
                <Text
                  text={`${measure.feet} фт`}
                  x={(measure.from.x + measure.to.x) / 2}
                  y={(measure.from.y + measure.to.y) / 2 - 16 / view.scale}
                  fontSize={14 / view.scale}
                  fill="#ff8a8a"
                  stroke="#000000"
                  strokeWidth={3 / view.scale}
                  fillAfterStrokeEnabled
                />
              </>
            )}
          </Layer>
        </Stage>
      )}
      <ConditionsOverlay />
    </div>
  );
}
