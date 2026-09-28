import { describe, expect, it } from 'vitest';
import type { ZoneInstance, ZoneWallDef } from '../domain/automation';
import { findPath } from './movement';
import { crossesWalls } from './walls';
import {
  createZoneSections,
  damageZoneSection,
  tokensCrossingSegments,
  wallPushPlan,
  wallsWithZones,
  zoneSheetCrossings,
  zoneWallSectionCount,
  zoneWallSegments,
  zoneWallSectionMidpoint,
} from './zoneWalls';

const GRID = { size: 50, offsetX: 0, offsetY: 0 };

const ICE_WALL: ZoneWallDef = {
  sectionFeet: 10,
  hp: 30,
  ac: 12,
  immunities: ['cold', 'poison', 'psychic'],
  vulnerabilities: ['fire'],
  breach: { save: { ability: 'con', half: true }, damage: { dice: '5d6cold', types: ['cold'] } },
};

function iceZone(partial: Partial<ZoneInstance> = {}): ZoneInstance {
  const zone: ZoneInstance = {
    id: 'z1',
    name: 'Wall of Ice',
    sourceKey: 'XPHB:Wall of Ice',
    sourceId: 'c1',
    origin: { x: 125, y: 125 },
    direction: { x: 125, y: 225 },
    area: { shape: 'line', size: 100, width: 1 },
    duration: { type: 'concentration' },
    wall: ICE_WALL,
    ...partial,
  };
  zone.sections = zone.sections ?? createZoneSections(ICE_WALL, zoneWallSectionCount(zone, GRID));
  return zone;
}

const tokenAt = (cx: number, cy: number, cells = 1) => ({
  x: cx * 50 + 25,
  y: cy * 50 + 25,
  w: cells * 50,
  h: cells * 50,
});

describe('zoneWalls: геометрия тонкой стены', () => {
  it('линия: 10 секций по 10 фт, стена по правой грани колонки-якоря', () => {
    const zone = iceZone();
    const segments = zoneWallSegments(zone, GRID);
    expect(segments).toHaveLength(10);
    expect(segments[0]!.a).toEqual({ x: 150, y: 100 });
    expect(segments[0]!.b).toEqual({ x: 150, y: 200 });
    expect(segments[9]!.b).toEqual({ x: 150, y: 1100 });
    expect(zone.sections).toHaveLength(10);
    expect(zone.sections!.every((s) => s.hp === 30 && s.maxHp === 30 && !s.broken)).toBe(true);
    expect(zoneWallSectionMidpoint(segments, 0)).toEqual({ x: 150, y: 150 });
  });

  it('цепочка панелей (wallPath): сегменты по узлам, секции по панелям', () => {
    const zone = iceZone({
      origin: { x: 325, y: 125 },
      direction: null,
      wallPath: [
        { x: 325, y: 125 },
        { x: 425, y: 125 },
        { x: 525, y: 125 },
        { x: 525, y: 225 },
      ],
    });
    const segments = zoneWallSegments(zone, GRID);
    expect(segments).toHaveLength(3);
    expect(segments.map((s) => s.section)).toEqual([0, 1, 2]);
    expect(segments[0]).toMatchObject({ a: { x: 325, y: 125 }, b: { x: 425, y: 125 } });
    expect(zoneWallSectionCount(zone, GRID)).toBe(3);
    // Пробой средней панели снимает только её препятствие.
    damageZoneSection(zone, 1, [{ amount: 30 }]);
    const walls = wallsWithZones([], [zone], GRID);
    expect(walls).toHaveLength(2);
    // Проход сквозь пробитую панель 1 ловится, касание целой (0) — нет.
    const small = { w: 50, h: 50 };
    expect(zoneSheetCrossings(zone, small, { x: 475, y: 75 }, { x: 475, y: 125 }, GRID)).toEqual([1]);
    expect(zoneSheetCrossings(zone, small, { x: 325, y: 75 }, { x: 325, y: 125 }, GRID)).toEqual([]);
    // Большой токен (2×2) скользит краем по листу: центр линию не пересекает, подошва — да.
    expect(
      zoneSheetCrossings(zone, { w: 100, h: 100 }, { x: 475, y: 175 }, { x: 475, y: 225 }, GRID)
    ).toEqual([1]);
  });
  it('купол: полигон r10 и 6 равных дуг-секций (~10.47 фт)', () => {
    const zone = iceZone({ area: { shape: 'ring', size: 10, inner: 9 }, direction: null });
    const segments = zoneWallSegments(zone, GRID);
    expect(segments).toHaveLength(24);
    expect(new Set(segments.map((s) => s.section))).toEqual(new Set([0, 1, 2, 3, 4, 5]));
    expect(zone.sections).toHaveLength(6);
    // По 4 сегмента на дугу — дуги одинаковой длины.
    const perSection = new Map<number, number>();
    for (const s of segments) perSection.set(s.section, (perSection.get(s.section) ?? 0) + 1);
    expect([...perSection.values()]).toEqual([4, 4, 4, 4, 4, 4]);
    // Точки полигона — на радиусе 100px от центра.
    for (const s of segments) {
      expect(Math.hypot(s.a.x - 125, s.a.y - 125)).toBeCloseTo(100, 5);
    }
  });

  it('пробой: иммунитет холоду, уязвимость к огню, снятие препятствия', () => {
    const zone = iceZone();
    // Холод: иммунитет — секция не повреждена.
    expect(damageZoneSection(zone, 0, [{ damageType: 'cold', amount: 40 }])).toEqual({
      applied: 0,
      note: 'immunity',
      broken: false,
    });
    // Огонь: уязвимость ×2.
    expect(damageZoneSection(zone, 0, [{ damageType: 'fire', amount: 10 }])).toEqual({
      applied: 20,
      note: 'vulnerability',
      broken: false,
    });
    expect(zone.sections![0]!.hp).toBe(10);
    expect(wallsWithZones([], [zone], GRID)).toHaveLength(10);
    // Добивание: секция пробита, препятствий 9, «лист» — 1 сегмент.
    expect(damageZoneSection(zone, 0, [{ damageType: 'slashing', amount: 10 }])).toEqual({
      applied: 10,
      broken: true,
    });
    expect(wallsWithZones([], [zone], GRID)).toHaveLength(9);
    // Пробитая секция урон больше не принимает.
    expect(damageZoneSection(zone, 0, [{ amount: 10 }])).toBeUndefined();
    // Пересечение «листа» шагом: секция 0 (y 100–200), другие — нет.
    const small = { w: 50, h: 50 };
    expect(zoneSheetCrossings(zone, small, { x: 125, y: 125 }, { x: 175, y: 125 }, GRID)).toEqual([0]);
    expect(zoneSheetCrossings(zone, small, { x: 125, y: 500 }, { x: 175, y: 500 }, GRID)).toEqual([]);
  });

  it('движение: переход через грани стены заблокирован, вдоль — свободен', () => {
    // Стена от верхнего края карты: обойти её конец в границах карты нельзя.
    const zone = iceZone({ origin: { x: 125, y: 25 } });
    const grid = GRID;
    const bounds = { cols: 10, rows: 10 };
    const walls = wallsWithZones([], [zone], grid);
    // Через стену (колонки 2 → 3 по x=150) — путь не находится.
    expect(
      findPath({ from: { x: 125, y: 25 }, to: { x: 175, y: 25 }, grid, bounds, walls })
    ).toBeNull();
    // Вдоль стены на той же стороне — свободно.
    expect(
      findPath({ from: { x: 125, y: 25 }, to: { x: 125, y: 125 }, grid, bounds, walls })
    ).not.toBeNull();
    // После пробоя первой секции проход через неё открыт.
    damageZoneSection(zone, 0, [{ amount: 30 }]);
    expect(
      findPath({
        from: { x: 125, y: 25 },
        to: { x: 175, y: 25 },
        grid,
        bounds,
        walls: wallsWithZones([], [zone], grid),
      })
    ).not.toBeNull();
  });

  it('прозрачная стена (Force): обзор свободен, проход и действия — как стена', () => {
    const force = iceZone({
      origin: { x: 125, y: 25 },
      wall: { sectionFeet: 10, immune: true, blocksLineOfSight: false },
    });
    const walls = wallsWithZones([], [force], GRID);
    expect(walls.every((w) => w.kind === 'window' && w.blocksActions === true)).toBe(true);
    // Обзор сквозь стену — свободен; проход и действия (каст/атаки/телепорт) — блокируются.
    expect(crossesWalls({ x: 125, y: 25 }, { x: 175, y: 25 }, walls, 'sight')).toBe(false);
    expect(crossesWalls({ x: 125, y: 25 }, { x: 175, y: 25 }, walls, 'move')).toBe(true);
    expect(crossesWalls({ x: 125, y: 25 }, { x: 175, y: 25 }, walls, 'action')).toBe(true);
    expect(
      findPath({ from: { x: 125, y: 25 }, to: { x: 175, y: 25 }, grid: GRID, bounds: { cols: 10, rows: 10 }, walls })
    ).toBeNull();
  });

  it('проходимая сегментная стена: маршрут свободен, обзор/действия — по флагам', () => {
    const passable = iceZone({
      origin: { x: 125, y: 25 },
      wall: { ...ICE_WALL, blocksMovement: false, blocksActions: false },
    });
    const walls = wallsWithZones([], [passable], GRID);
    expect(walls.every((w) => w.blocksMovement === false && w.blocksActions === false && w.kind === 'wall')).toBe(
      true
    );
    expect(crossesWalls({ x: 125, y: 25 }, { x: 175, y: 25 }, walls, 'move')).toBe(false);
    expect(crossesWalls({ x: 125, y: 25 }, { x: 175, y: 25 }, walls, 'sight')).toBe(true);
    expect(crossesWalls({ x: 125, y: 25 }, { x: 175, y: 25 }, walls, 'action')).toBe(false);
    expect(
      findPath({ from: { x: 125, y: 25 }, to: { x: 175, y: 25 }, grid: GRID, bounds: { cols: 10, rows: 10 }, walls })
    ).not.toBeNull();
  });

  it('разрезанные стеной существа: разрезана подошва, а не касание грани', () => {
    const zone = iceZone();
    const segments = zoneWallSegments(zone, GRID);
    // Токен в колонке 2 только касается стены x=150 краем подошвы — не разрезан.
    expect(tokensCrossingSegments([tokenAt(2, 2)], segments)).toHaveLength(0);
    // Токен ровно на линии стены (центр x=150) — разрезан.
    expect(tokensCrossingSegments([{ x: 150, y: 125, w: 50, h: 50 }], segments)).toHaveLength(1);
    // Большой (2×2) на стыке колонок 2–3 — разрезан.
    expect(tokensCrossingSegments([tokenAt(3, 2, 2)], segments)).toHaveLength(1);
  });

  it('выталкивание: разрезанное существо уходит на выбранную сторону и на сторону кастера', () => {
    // Стена через центры клеток (y=125): 1×1 на линии разрезан.
    const segments = [{ a: { x: 300, y: 125 }, b: { x: 400, y: 125 }, section: 0 }];
    const straddle = { id: 's', x: 375, y: 125, w: 50, h: 50 };
    const tokens = [straddle, { id: 'other', x: 625, y: 125, w: 50, h: 50 }];
    const bounds = { cols: 16, rows: 16 };
    // Сторона 'a' (левый нормаль хода вправо = низ) — вниз на клетку.
    expect(wallPushPlan({ segments, tokens, cut: [straddle], grid: GRID, bounds, side: 'a' })).toEqual([
      { tokenId: 's', x: 375, y: 175 },
    ]);
    expect(wallPushPlan({ segments, tokens, cut: [straddle], grid: GRID, bounds, side: 'b' })).toEqual([
      { tokenId: 's', x: 375, y: 75 },
    ]);
    // Без выбора — на сторону кастера (кастер снизу).
    expect(
      wallPushPlan({ segments, tokens, cut: [straddle], grid: GRID, bounds, caster: { x: 375, y: 300 } })
    ).toEqual([{ tokenId: 's', x: 375, y: 175 }]);
  });

  it('выталкивание: занятая сторона → противоположная, большой токен смещается на клетку', () => {
    const segments = [{ a: { x: 300, y: 125 }, b: { x: 400, y: 125 }, section: 0 }];
    const straddle = { id: 's', x: 375, y: 125, w: 50, h: 50 };
    // Внизу — край карты: выбранная сторона 'a' недоступна, уходим вверх.
    const bounds = { cols: 16, rows: 3 };
    expect(wallPushPlan({ segments, tokens: [straddle], cut: [straddle], grid: GRID, bounds, side: 'a' })).toEqual([
      { tokenId: 's', x: 375, y: 75 },
    ]);
    // Большой (2×2) у стены по линии сетки: минимальный сдвиг — клетка, подошва больше не разрезана.
    const line = zoneWallSegments(iceZone(), GRID);
    const big = { id: 'b', x: 150, y: 150, w: 100, h: 100 };
    const plan = wallPushPlan({ segments: line, tokens: [big], cut: [big], grid: GRID, side: 'a' });
    expect(plan).toEqual([{ tokenId: 'b', x: 100, y: 150 }]);
    expect(tokensCrossingSegments([{ ...big, x: plan[0]!.x, y: plan[0]!.y }], line)).toHaveLength(0);
    // Огромный (4×4, 200px) центром на линии: одной клетки мало, сдвиг — две (10 фт).
    const huge = { id: 'h', x: 150, y: 150, w: 200, h: 200 };
    const hugePlan = wallPushPlan({
      segments: line,
      tokens: [huge],
      cut: [huge],
      grid: GRID,
      bounds: { cols: 16, rows: 16 },
      side: 'b',
    });
    expect(hugePlan).toEqual([{ tokenId: 'h', x: 250, y: 150 }]);
    expect(tokensCrossingSegments([{ ...huge, x: hugePlan[0]!.x, y: hugePlan[0]!.y }], line)).toHaveLength(0);
  });
});
