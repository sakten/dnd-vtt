import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Stage, Layer, Rect, Image as KonvaImage, Line, Text } from 'react-konva';
import Konva from 'konva';
import type { MapInfo } from 'shared';
import { areaCells, gridDistanceFeet, reachableCells, snapToGrid } from 'shared';
import { useGameStore } from '../store/useGameStore';
import { useImage } from '../lib/useImage';
import { canAddLibraryItem, canControlWith } from '../lib/control';
import GridLayer from './GridLayer';
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

const cellIndex = (v: number, offset: number, size: number) => Math.floor((v - offset) / size);
const cellKey = (cx: number, cy: number) => `${cx},${cy}`;

export default function TableTop() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const paintRef = useRef<{ pressed: boolean; start: WorldPoint | null }>({ pressed: false, start: null });
  const [rectPreview, setRectPreview] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);

  const view = useGameStore((s) => s.view);
  const setView = useGameStore((s) => s.setView);
  const setViewport = useGameStore((s) => s.setViewport);
  const grid = useGameStore((s) => s.scene.grid);
  const maps = useGameStore((s) => s.scene.maps);
  const viewMapId = useGameStore((s) => s.viewMapId);
  const setSelected = useGameStore((s) => s.setSelected);
  const role = useGameStore((s) => s.role);
  const targetTokenId = useGameStore((s) => s.targetTokenId);
  const measureFromId = useGameStore((s) => s.measureFromId);
  const currentCharacterId = useGameStore((s) => s.currentCharacterId);
  const fogMode = useGameStore((s) => s.fogMode);
  const updateFog = useGameStore((s) => s.updateFog);
  const aim = useGameStore((s) => s.aim);
  const aimToCursor = useGameStore((s) => s.aimToCursor);
  const confirmAim = useGameStore((s) => s.confirmAim);
  const multiTarget = useGameStore((s) => s.multiTarget);
  const addMultiTarget = useGameStore((s) => s.addMultiTarget);
  const activeMap = useMemo(() => maps.find((m) => m.id === viewMapId) ?? null, [maps, viewMapId]);
  const hiddenSet = useMemo(() => new Set(activeMap?.fog.hidden ?? []), [activeMap?.fog.hidden]);

  // id активной записи инициативы, которой управляет текущий пользователь (для подсветки хода).
  const activeControlId = useGameStore((s) => {
    const map = s.scene.maps.find((m) => m.id === s.viewMapId);
    if (!map || !map.combat.active || map.combat.currentIndex < 0) return null;
    const entry = map.combat.entries[map.combat.currentIndex];
    if (!entry?.tokenId) return null;
    const token = map.tokens.find((t) => t.id === entry.tokenId);
    if (!token || !canControlWith(s, token)) return null;
    return entry.id;
  });

  const movementCells = useMemo(() => {
    if (!activeMap || !activeControlId) return [];
    const combat = activeMap.combat;
    const entry = combat.entries.find((e) => e.id === activeControlId);
    const token = entry?.tokenId ? activeMap.tokens.find((t) => t.id === entry.tokenId) : undefined;
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
      if (role === 'player' && hiddenSet.has(cellKey(gx, gy))) continue;
      cells.push({ x: grid.offsetX + gx * size, y: grid.offsetY + gy * size, size });
    }
    return cells;
  }, [activeMap, activeControlId, grid, role, hiddenSet]);

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
      if (cx < 0 || cy < 0) continue;
      if (activeMap && (cx >= maxCx || cy >= maxCy)) continue;
      if (role === 'player' && hiddenSet.has(key)) continue;
      out.push({ x: g.offsetX + cx * size, y: g.offsetY + cy * size, size });
    }
    return out;
  }, [aim, grid, activeMap, role, hiddenSet]);

  const multiTargetTokens = useMemo(() => {
    if (!multiTarget || !activeMap) return [];
    return multiTarget.targets
      .map((id) => activeMap.tokens.find((t) => t.id === id) ?? null)
      .filter((t): t is NonNullable<typeof t> => !!t);
  }, [multiTarget, activeMap]);

  const measure = useMemo(() => {
    if (!activeMap || !targetTokenId) return null;
    const to = activeMap.tokens.find((t) => t.id === targetTokenId);
    if (!to) return null;
    const fromId =
      measureFromId ?? activeMap.tokens.find((t) => t.libraryItemId === currentCharacterId)?.id ?? null;
    const from = activeMap.tokens.find((t) => t.id === fromId);
    if (!from || from.id === to.id) return null;
    const feet = gridDistanceFeet(from, to, grid.size || 50);
    return { from, to, feet };
  }, [activeMap, targetTokenId, measureFromId, currentCharacterId, grid.size]);

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

  const fogRects = useMemo(() => {
    if (!activeMap) return [];
    const f = activeMap.fog;
    return f.hidden.map((key) => {
      const [cx, cy] = key.split(',').map(Number);
      return { x: f.offsetX + cx * f.size, y: f.offsetY + cy * f.size, size: f.size };
    });
  }, [activeMap]);

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
    if (multiTarget) {
      e.evt.preventDefault();
      const stage = e.target.getStage();
      const pointer = stage?.getPointerPosition();
      if (stage && pointer && activeMap) {
        const w = toWorld(stage, pointer);
        const hit = activeMap.tokens
          .filter((t) => Math.abs(w.x - t.x) <= t.w / 2 && Math.abs(w.y - t.y) <= t.h / 2)
          .sort((a, b) => b.z - a.z)[0];
        if (hit) addMultiTarget(hit.id);
      }
      return;
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
    if (!fogMode.active) {
      if (e.target === e.target.getStage()) {
        setSelected(null);
        useGameStore.getState().setTargetToken(null);
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
    if (aim) {
      const stage = e.target.getStage();
      const pointer = stage?.getPointerPosition();
      if (stage && pointer) aimToCursor(toWorld(stage, pointer));
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
    if (!fogMode.active) return;
    if (fogMode.tool === 'rect' && paintRef.current.start && rectPreview) {
      applyCells(cellKeysBetween(paintRef.current.start, { x: rectPreview.x1, y: rectPreview.y1 }), fogMode.action);
    }
    paintRef.current.pressed = false;
    paintRef.current.start = null;
    setRectPreview(null);
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
    const { view: v, scene: s } = useGameStore.getState();
    let wx = (sx - v.x) / v.scale;
    let wy = (sy - v.y) / v.scale;
    if (s.grid.snap) {
      const cells = item.cells ?? 1;
      wx = snapToGrid(wx, s.grid.offsetX, s.grid.size, cells);
      wy = snapToGrid(wy, s.grid.offsetY, s.grid.size, cells);
    }
    useGameStore.getState().addTokenAt(item.id, wx, wy);
  };

  return (
    <div
      ref={containerRef}
      className="table-top"
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
          draggable={!fogMode.active && !aim && !multiTarget}
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
          onMouseUp={handleMouseUp}
          onTouchStart={(e) => {
            if (!fogMode.active && e.target === e.target.getStage()) {
              setSelected(null);
              useGameStore.getState().setTargetToken(null);
            }
          }}
        >
          <Layer>{activeMap && <MapSprite map={activeMap} />}</Layer>
          <Layer listening={false}>
            {fogRects.map((r) => (
              <Rect
                key={`${r.x},${r.y}`}
                x={r.x}
                y={r.y}
                width={r.size}
                height={r.size}
                fill="#07090d"
                opacity={role === 'dm' ? 0.45 : 0.93}
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
            {activeMap?.tokens
              .filter((t) => !(role === 'player' && isCellHidden(t.x, t.y)))
              .map((token) => (
                <TokenView key={token.id} token={token} />
              ))}
          </Layer>
          <Layer listening={false}>
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
