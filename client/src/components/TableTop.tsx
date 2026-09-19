import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Stage, Layer, Image as KonvaImage } from 'react-konva';
import Konva from 'konva';
import type { AttackRangeType, CharacterSheet, MapInfo, Token, Wall, ZoneInstance } from 'shared';
import {
  BASE_ACTIONS,
  areaCells,
  countAttackAdvantage,
  gridDistanceFeet,
  reachableCells,
  segmentRectDistance,
  sightContextOf,
  snapToGrid,
  spreadCells,
  zoneVisionKind,
} from 'shared';
import { useGameStore } from '../store/useGameStore';
import { useActiveMap } from '../store/hooks';
import { activeGridOf, activeMapOf, tokenById } from '../store/selectors';
import type { TargetingState } from '../domain/interaction';
import { useImage } from '../lib/useImage';
import { visibleCells } from '../lib/los';
import { useVisionViewers } from '../lib/useVision';
import { canControlWith, useIsDm } from '../lib/control';
import { newId } from '../lib/id';
import { cellIndex, cellKey, fogRects as buildFogRects, type WorldPoint } from '../lib/fog';
import { useMapCamera } from '../lib/useMapCamera';
import { useFogBrush } from '../lib/useFogBrush';
import { useAreaBrush } from '../lib/useAreaBrush';
import { useTokenDrop } from '../lib/useTokenDrop';
import GridLayer from './GridLayer';
import ZoneLayer from './ZoneLayer';
import ConditionsOverlay from './ConditionsOverlay';
import ObjectsLayer from './table/ObjectsLayer';
import AimLayer from './table/AimLayer';
import TokenLayer from './table/TokenLayer';
import VeilLayer from './table/VeilLayer';
import { buildFxMask, type FxMask } from './spellFx/mask';

const SpellFxOverlay = lazy(() => import('./spellFx/SpellFxOverlay'));

function MapSprite({ map }: { map: MapInfo }) {
  const image = useImage(map.url);
  if (!image) return null;
  return <KonvaImage image={image} width={map.width} height={map.height} listening={false} />;
}

/** Тип дистанции выбранной атаки: оружие/безоружный удар/способность-атака; null — не атака. */
function attackRangeTypeOf(
  targeting: TargetingState,
  attacker: Token,
  sheet: CharacterSheet | null | undefined,
  currentCharacterId: string | null
): AttackRangeType | null {
  const index = 'attackIndex' in targeting ? targeting.attackIndex : undefined;
  if (index !== undefined) {
    const attacks =
      currentCharacterId !== null && attacker.libraryItemId === currentCharacterId && sheet
        ? sheet.attacks
        : attacker.attacks;
    return attacks[index]?.rangeType ?? null;
  }
  if (targeting.kind !== 'action') return null;
  const action =
    attacker.statblock?.actions?.find((a) => a.id === targeting.actionId) ??
    BASE_ACTIONS.find((a) => a.id === targeting.actionId);
  if (action?.ability?.attack) return action.ability.attack.rangeType;
  return action?.id === 'unarmedStrike' ? 'melee' : null;
}

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
  const { size, toWorld, handleWheel, handleStageDrag } = useMapCamera(containerRef);
  const { onDragOver, onDrop } = useTokenDrop(containerRef);

  const [wallCursor, setWallCursor] = useState<{ x: number; y: number } | null>(null);
  const [attackCursor, setAttackCursor] = useState<WorldPoint | null>(null);
  const [doorHover, setDoorHover] = useState<{ id: string; state: 'open' | 'blocked' } | null>(null);
  const wallPressRef = useRef<{ x: number; y: number } | null>(null);

  const view = useGameStore((s) => s.view);
  const grid = useGameStore(activeGridOf);
  const setSelected = useGameStore((s) => s.setSelected);
  const isDm = useIsDm();
  const interaction = useGameStore((s) => s.interaction);
  const cancelInteraction = useGameStore((s) => s.cancelInteraction);
  const hoverTokenId = useGameStore((s) => s.hoverTokenId);
  const fogMode = useGameStore((s) => s.fogMode);
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
  const sheet = useGameStore((s) => s.sheet);
  const currentCharacterId = useGameStore((s) => s.currentCharacterId);
  const hiddenSet = useMemo(() => new Set(activeMap?.fog.hidden ?? []), [activeMap?.fog.hidden]);

  const fogBrush = useFogBrush(activeMap);
  const areaBrush = useAreaBrush(activeMap);
  const rectPreview = fogBrush.rectPreview ?? areaBrush.rectPreview;

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

  useEffect(() => {
    if (!targeting) setAttackCursor(null);
  }, [targeting]);

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
    const keys = new Set(areaCells(aim.spec, aim.origin, aim.direction, g));
    // Предпросмотр с распространением: эффект огибает углы, сплошная стена обрывает путь.
    const spread =
      activeMap && activeMap.walls.length > 0 ? spreadCells(keys, aim.origin, g, activeMap.walls) : keys;
    const maxCx = Math.ceil((activeMap?.width ?? 0) / size);
    const maxCy = Math.ceil((activeMap?.height ?? 0) / size);
    const out: { x: number; y: number; size: number }[] = [];
    for (const key of spread) {
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
    const rangeType = attackRangeTypeOf(targeting, from, sheet, currentCharacterId);
    const attackMode = rangeType
      ? countAttackAdvantage({
          attackerConditions: from.conditions,
          targetConditions: to.conditions,
          rangeType,
        }).mode ?? null
      : undefined;
    return { from, to, feet, attackMode };
  }, [activeMap, targeting, hoverTokenId, grid.size, sheet, currentCharacterId]);

  const fog = activeMap?.fog;
  const fogRects = useMemo(() => (fog ? buildFogRects(fog) : []), [fog]);

  // Вуаль зависит от стен/тьмы/областей/зон/размера карты и зрителей — не от любых
  // патчей токенов (HP, состояния, имя), иначе пересчёт на каждое изменение.
  const veilActive = !!activeMap;
  const veilWalls = activeMap?.walls;
  const veilVision = activeMap?.vision;
  const veilAreas = activeMap?.lightAreas;
  const veilZones = activeMap?.zones;
  const veilWidth = activeMap?.width ?? 0;
  const veilHeight = activeMap?.height ?? 0;

  const visionView = useMemo(() => {
    if (!veilActive || isDm) return null;
    const cell = grid.size || 50;
    const gridSpec = { size: cell, offsetX: grid.offsetX, offsetY: grid.offsetY };
    const compute = (zones: typeof veilZones, bounds = cellBounds) =>
      visibleCells({
        ...sightContextOf(
          { walls: veilWalls ?? [], vision: veilVision!, lightAreas: veilAreas ?? [], zones: zones ?? [] },
          gridSpec
        ),
        width: veilWidth,
        height: veilHeight,
        bounds,
        viewers: viewers ?? [],
      });
    const base = compute(veilZones);
    if (base === null) return null;
    // Для разметки самой вижн-зоны её собственная тьма/мгла не должна скрывать её клетки.
    // Считаем по bbox зоны, а не по всему вьюпорту — цена пропорциональна площади зоны.
    const zoneBounds = (zone: ZoneInstance) => {
      let cx0 = Infinity;
      let cy0 = Infinity;
      let cx1 = -Infinity;
      let cy1 = -Infinity;
      for (const key of areaCells(zone.area, zone.origin, zone.direction ?? null, gridSpec)) {
        const [cx, cy] = key.split(',').map(Number);
        cx0 = Math.min(cx0, cx ?? 0);
        cy0 = Math.min(cy0, cy ?? 0);
        cx1 = Math.max(cx1, cx ?? 0);
        cy1 = Math.max(cy1, cy ?? 0);
      }
      return Number.isFinite(cx0) ? { cx0, cy0, cx1, cy1 } : undefined;
    };
    const byZone = new Map<string, Set<string>>();
    for (const zone of veilZones ?? []) {
      if (zoneVisionKind(zone) === null) continue;
      const bounds = zoneBounds(zone);
      if (!bounds) continue;
      const set = compute(
        (veilZones ?? []).filter((z) => z.id !== zone.id),
        bounds
      );
      if (set) byZone.set(zone.id, set);
    }
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
        if (base.has(key) || hiddenSet.has(key)) continue;
        rects.push({
          x: grid.offsetX + cx * cell,
          y: grid.offsetY + cy * cell,
          size: cell,
        });
      }
    }
    return { rects, base, byZone };
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

  // Маска для оверлея эффектов: игрок видит анимацию только в видимых клетках (DM — везде).
  const fxMask = useMemo<FxMask | null>(() => {
    if (!visionView || !activeMap) return null;
    const cell = grid.size || 50;
    const cols = Math.ceil(activeMap.width / cell);
    const rows = Math.ceil(activeMap.height / cell);
    const blocked: string[] = [];
    for (const r of visionView.rects) {
      blocked.push(`${Math.round((r.x - grid.offsetX) / cell)},${Math.round((r.y - grid.offsetY) / cell)}`);
    }
    for (const key of hiddenSet) blocked.push(key);
    return buildFxMask({ cell, offsetX: grid.offsetX, offsetY: grid.offsetY, cols, rows, blocked });
  }, [visionView, hiddenSet, grid, activeMap]);

  const snapWall = (p: { x: number; y: number }) => ({
    x: snapToGrid(p.x, grid.offsetX, grid.size, 0),
    y: snapToGrid(p.y, grid.offsetY, grid.size, 0),
  });

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
      areaBrush.begin(toWorld(stage, pointer));
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
    fogBrush.begin(toWorld(stage, pointer));
  };

  const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (wallsMode.active) {
      const stage = e.target.getStage();
      const pointer = stage?.getPointerPosition();
      if (stage && pointer) setWallCursor(snapWall(toWorld(stage, pointer)));
      return;
    }
    if (lightMode.active) {
      if (!areaBrush.rectPreview) return;
      const stage = e.target.getStage();
      const pointer = stage?.getPointerPosition();
      if (!stage || !pointer) return;
      areaBrush.move(toWorld(stage, pointer));
      return;
    }
    if (aim) {
      const stage = e.target.getStage();
      const pointer = stage?.getPointerPosition();
      if (stage && pointer) aimToCursor(toWorld(stage, pointer));
      return;
    }
    if (targeting) {
      const stage = e.target.getStage();
      const pointer = stage?.getPointerPosition();
      if (stage && pointer) setAttackCursor(toWorld(stage, pointer));
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
    if (!fogMode.active) return;
    const stage = e.target.getStage();
    const pointer = stage?.getPointerPosition();
    if (!stage || !pointer) return;
    fogBrush.move(toWorld(stage, pointer));
  };

  const handleMouseUp = () => {
    if (lightMode.active) {
      areaBrush.end();
      return;
    }
    if (!fogMode.active) return;
    fogBrush.end();
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

  return (
    <div
      ref={containerRef}
      className={`table-top${aim || targeting || multiTarget ? ' targeting' : ''}${doorHover ? ` door-${doorHover.state}` : ''}`}
      data-testid="table-top"
      onDragOver={onDragOver}
      onDrop={onDrop}
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
          onDragMove={handleStageDrag}
          onDragEnd={handleStageDrag}
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
          <Layer>
            {activeMap && <MapSprite map={activeMap} />}
            <ObjectsLayer
              map={activeMap}
              isDm={isDm}
              viewScale={view.scale}
              cellPx={grid.size || 50}
              doorHover={doorHover}
              wallCandidates={wallCandidates}
              wallStart={wallStart}
              wallCursor={wallCursor}
              fogRects={fogRects}
              rectPreview={rectPreview}
            />
          </Layer>
          <GridLayer grid={grid} view={view} viewport={size} />
          <Layer listening={false}>
            <ZoneLayer zones={activeMap?.zones ?? []} grid={grid} mode={visionView ? 'fills' : 'full'} />
          </Layer>
          <Layer>
            <AimLayer
              movementCells={movementCells}
              aim={aim}
              aimCells={aimCells}
              multiTargetTokens={multiTargetTokens}
              viewScale={view.scale}
            />
            <TokenLayer
              map={activeMap}
              isDm={isDm}
              hidden={hiddenSet}
              dragGhost={dragGhost}
              dragPath={dragPath}
              viewScale={view.scale}
              gridSize={grid.size || 50}
            />
          </Layer>
          <Layer listening={false}>
            <VeilLayer
              visionView={visionView}
              zones={activeMap?.zones ?? []}
              grid={grid}
              measure={measure}
              attackCursor={attackCursor}
              viewScale={view.scale}
            />
          </Layer>
        </Stage>
      )}
      <ConditionsOverlay />
      <Suspense fallback={null}>
        <SpellFxOverlay mask={fxMask} />
      </Suspense>
    </div>
  );
}
