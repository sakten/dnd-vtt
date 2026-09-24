import {
  automationForSpell,
  crossesWalls,
  effectiveSpellRangeFeet,
  gridDistanceFeet,
  gridOfMap,
  handOf,
  hasInvocation,
  INVOCATION_PACT_KEYS,
  loadoutOf,
  polymorphFormIssue,
  spellCastArea,
  spellIsSelf,
  tokenVisibleFrom,
  weaponContextOf,
  type ErrorPayload,
  type Spell,
  type SpellStats,
  type Token,
} from 'shared';
import type { Room } from '../roomTypes';
import { actorStats } from '../room/actor';
import { sheetOfToken } from '../room/helpers';
import type { ConnCtx } from './context';
import { executeAutomation } from './automation';
import { runBladeCantrip } from './bladeCantrips';
import { summonEntry, summonFormIssue, hasFreeSummonSpot } from './summons';
import { polymorphMaxCr, shapePlacementIssue } from './forms';
import { teleportIssue } from './teleport';

export interface SpellCastInput {
  caster: Token;
  mapId: string;
  spell: Spell;
  castLevel: number;
  characterLevel: number;
  /** Боевые характеристики кастера; null — нет заклинательной характеристики. */
  stats: SpellStats | null;
  targets: Token[];
  advantage?: 'a' | 'd';
  /** Цели собраны из области (origin уже проверен вызывающим). */
  area?: boolean;
  /** Точка/направление каста (для создания зон). */
  origin?: { x: number; y: number } | null;
  direction?: { x: number; y: number } | null;
  /** Выбранная форма призыва (Find Familiar). */
  summonKey?: string;
  /** Вариант заклинания (Dragon's Breath: тип урона выдоха). */
  variant?: string;
  /** Выбор состояния для снятия (Lesser/Greater Restoration). */
  condition?: string;
  /** Scatter: точки назначения по целям. */
  placements?: { targetId: string; x: number; y: number }[];
  author: string;
}

/** Проверка возможности накладывания (до списания ячейки/слота). */
export function validateSpellCast(room: Room, input: SpellCastInput): ErrorPayload | undefined {
  const { caster, spell } = input;
  const invocations = sheetOfToken(room, caster).sheet?.invocations;
  const def = automationForSpell(spell, {
    castLevel: input.castLevel,
    characterLevel: input.characterLevel,
    spellMod: input.stats?.mod,
    invocations,
  });
  const targets = input.targets.filter((t) => !!t);
  const hasRoll = !!(def.damage || def.heal);

  // Зона от точки без режима области (Faithful Hound): точка в пределах дистанции и видна кастеру.
  if (def.zone && def.zone.origin === 'point' && input.origin && !input.area) {
    const map = room.scene.maps.find((m) => m.id === input.mapId);
    const gridSize = gridOfMap(map, room.scene.grid).size;
    const feet = (Math.hypot(input.origin.x - caster.x, input.origin.y - caster.y) / gridSize) * 5;
    const range = effectiveSpellRangeFeet(spell, invocations);
    if (range !== null && feet > range) return { code: 'outOfRange', params: { feet: Math.round(feet) } };
    if (map && crossesWalls(caster, input.origin, map.walls, 'sight')) return { code: 'noClearPath' };
  }

  if (def.effects?.some((d) => d.markTarget) && !targets[0]) {
    return { code: 'spellNoTarget' };
  }

  // Клинок-кантрип (Green-Flame/Booming Blade, True Strike): оружие в правой руке, цель в досягаемости.
  if (def.weaponAttack) {
    const sheet = sheetOfToken(room, caster).sheet;
    const loadout = loadoutOf({
      attacks: sheet?.attacks,
      hands: sheet?.hands,
      effects: caster.effects,
      ...weaponContextOf(sheet),
    });
    const held = sheet ? handOf(loadout, 'right') : undefined;
    if (!held) return { code: 'noHeldWeapon' };
    // True Strike бьёт и дальним оружием; остальные клинки — только ближним.
    if (!def.weaponAttack.anyWeapon && held.rangeType !== 'melee') return { code: 'noHeldWeapon' };
    if (!targets[0]) return { code: 'spellNoTarget' };
    const map = room.scene.maps.find((m) => m.id === input.mapId);
    const grid = gridOfMap(map, room.scene.grid);
    const feet = gridDistanceFeet(caster, targets[0], grid.size);
    const maxFeet = def.weaponAttack.anyWeapon
      ? held.rangeLong || held.rangeNormal || 5
      : held.rangeNormal || 5;
    if (feet > maxFeet) return { code: 'outOfRange', params: { feet: Math.round(feet) } };
    if (map && targets[0].id !== caster.id && !tokenVisibleFrom(caster, targets[0], map.walls, grid)) {
      return { code: 'noClearPath' };
    }
    return undefined;
  }

  if (def.attack && hasRoll) {
    if (!input.stats) return { code: 'spellNoAttack' };
    if (!targets[0]) return { code: 'spellNoTarget' };
  } else if (def.save && hasRoll) {
    if (!input.stats) return { code: 'spellNoDc' };
    if (!targets.length && !input.area) return { code: 'spellNoTarget' };
  }

  // Polymorph: форма-зверь обязательна; CR ≤ CR/уровня цели; место проверяется до списания ячейки.
  if (def.shape?.crByTarget) {
    if (!targets.length) return { code: 'spellNoTarget' };
    const entry = input.summonKey ? summonEntry(input.summonKey) : undefined;
    if (!entry || entry.type !== 'beast') return { code: 'shapeNoForm' };
    for (const target of targets) {
      const maxCr = polymorphMaxCr(room, target);
      if (maxCr !== undefined && polymorphFormIssue(entry, maxCr)) {
        return { code: 'shapeCrTooHigh', params: { max: maxCr } };
      }
      const placement = shapePlacementIssue(room, input.mapId, target, entry.cells);
      if (placement) return placement;
    }
  }

  // Призыв ставится в точку в пределах дистанции с чистым путём (без цели-существа).
  if (def.resolution === 'summon') {
    if (!input.origin) return { code: 'noAreaPoint' };
    // Форма фамильяра: обычная — всегда, особая Pact of the Chain — только с инвокацией.
    const key = input.summonKey ?? def.summon?.creature ?? '';
    if (def.summon?.choices) {
      if (!key) return { code: 'summonNoForm' };
      const chain = hasInvocation(sheetOfToken(room, caster).sheet ?? {}, INVOCATION_PACT_KEYS.chain);
      const issue = summonFormIssue(key, chain);
      if (issue) return { code: issue };
    }
    const entry = key ? summonEntry(key) : undefined;
    if (!entry) return { code: 'summonNoForm' };
    const map = room.scene.maps.find((m) => m.id === input.mapId);
    const gridSize = gridOfMap(map, room.scene.grid).size;
    const feet = (Math.hypot(input.origin.x - caster.x, input.origin.y - caster.y) / gridSize) * 5;
    const range = effectiveSpellRangeFeet(spell, invocations);
    if (range !== null && feet > range) return { code: 'outOfRange', params: { feet: Math.round(feet) } };
    if (map && crossesWalls(caster, input.origin, map.walls, 'sight')) return { code: 'noClearPath' };
    if (!hasFreeSummonSpot(room, input.mapId, entry.cells, input.origin)) return { code: 'summonNoSpace' };
    return undefined;
  }

  // Revivify: цель должна быть мертва; Spare the Dying: цель на 0 HP, не мёртвая и не стабильная.
  if (def.utility?.kind === 'revive' || def.utility?.kind === 'stabilize') {
    if (!targets.length) return { code: 'spellNoTarget' };
    for (const target of targets) {
      const stats = actorStats(room, target);
      const dead = target.conditions.some((c) => c.key === 'dead');
      if (def.utility.kind === 'revive') {
        if (!dead) return { code: 'reviveNotDead' };
        continue;
      }
      if (dead || stats.hp.current > 0) return { code: 'stabilizeNotDying' };
      if (stats.controllerId && room.resources[stats.controllerId]?.hp.stable) return { code: 'alreadyStable' };
    }
  }

  // Lesser/Greater Restoration: у цели есть снимаемое состояние; выбор обязателен, если их 2+.
  if (def.utility?.kind === 'endCondition') {
    if (!targets.length) return { code: 'spellNoTarget' };
    const allowed = def.endConditions ?? [];
    for (const target of targets) {
      const present = allowed.filter((key) => target.conditions.some((c) => c.key === key));
      if (!present.length) return { code: 'restoreNoCondition' };
      if (input.condition) {
        if (!present.includes(input.condition as (typeof present)[number])) return { code: 'restoreNoCondition' };
      } else if (present.length > 1) {
        return { code: 'restoreNoChoice' };
      }
    }
  }

  // Телепорт (Misty Step): точка в пределах дистанции, свободна и видна кастеру.
  if (def.utility?.kind === 'teleport') {
    if (!input.origin) return { code: 'noAreaPoint' };
    return teleportIssue(room, input.mapId, caster, input.origin, def.utility.amount ?? 30);
  }

  // Scatter: до N целей в 30 фт; каждая — точка назначения в 120 фт от кастера (видна, свободна).
  if (def.utility?.kind === 'scatter') {
    const placements = input.placements ?? [];
    if (!placements.length || placements.length > (def.utility.targets ?? 5)) return { code: 'spellNoTarget' };
    const map = room.scene.maps.find((m) => m.id === input.mapId);
    const grid = gridOfMap(map, room.scene.grid);
    const sourceFeet = effectiveSpellRangeFeet(spell, invocations) ?? 30;
    const limit = def.utility.destinationFeet ?? 120;
    for (const placement of placements) {
      const target = map?.tokens.find((t) => t.id === placement.targetId);
      if (!target || !map) return { code: 'spellNoTarget' };
      const toTarget = gridDistanceFeet(caster, target, grid.size);
      if (toTarget > sourceFeet) return { code: 'outOfRange', params: { feet: Math.round(toTarget) } };
      if (target.id !== caster.id && !tokenVisibleFrom(caster, target, map.walls, grid)) {
        return { code: 'noClearPath' };
      }
      const issue = teleportIssue(room, input.mapId, target, { x: placement.x, y: placement.y }, limit, caster);
      if (issue) return issue;
    }
    return undefined;
  }

  if (input.area) return undefined;

  // Creature-таргетинг у self-заклинания (Eyebite): дистанция и видимость цели.
  if (def.targeting?.kind === 'creature') {
    const range = def.targeting.range ?? 5;
    const map = room.scene.maps.find((m) => m.id === input.mapId);
    const grid = gridOfMap(map, room.scene.grid);
    for (const target of targets) {
      if (target.id === caster.id) continue;
      const feet = gridDistanceFeet(caster, target, grid.size);
      if (feet > range) return { code: 'outOfRange', params: { feet: Math.round(feet) } };
      if (map && !tokenVisibleFrom(caster, target, map.walls, grid)) return { code: 'noClearPath' };
    }
    return undefined;
  }
  const rangeFeet = effectiveSpellRangeFeet(spell, invocations);
  if (rangeFeet === null || spellIsSelf(spell)) return undefined;
  const map = room.scene.maps.find((m) => m.id === input.mapId);
  const gridSize = gridOfMap(map, room.scene.grid).size;
  for (const target of targets) {
    if (target.id === caster.id) continue;
    const feet = gridDistanceFeet(caster, target, gridSize);
    if (feet > rangeFeet) return { code: 'outOfRange', params: { feet: Math.round(feet) } };
  }
  return undefined;
}

/**
 * Резолв заклинания через generic-executor. Валидацию и экономику ведёт
 * вызывающий (`spells.ts` — до списания ячейки/слота; реакции — при выборе).
 */
export function resolveSpellCast(ctx: ConnCtx, input: SpellCastInput): { error?: ErrorPayload } {
  const room = ctx.getRoom();
  if (!room) return {};
  const def = automationForSpell(input.spell, {
    castLevel: input.castLevel,
    characterLevel: input.characterLevel,
    spellMod: input.stats?.mod,
    invocations: sheetOfToken(room, input.caster).sheet?.invocations,
    variant: input.variant,
  });
  // Клинки-кантрипы: атака оружием правой руки, а не заклинательный резолв.
  if (def.weaponAttack) {
    runBladeCantrip(ctx, room, input, def);
    return {};
  }
  executeAutomation(ctx, {
    caster: input.caster,
    mapId: input.mapId,
    def,
    targets: input.targets.filter((t) => !!t),
    stats: input.stats,
    author: input.author,
    advantage: input.advantage,
    origin: input.origin ?? null,
    direction: input.direction ?? null,
    area: spellCastArea(input.spell) ?? null,
    ...(input.summonKey ? { summonKey: input.summonKey } : {}),
    ...(input.condition ? { choice: input.condition } : {}),
    ...(input.placements ? { placements: input.placements } : {}),
    manual: {
      description: input.spell.description,
      level: input.spell.level,
      castLevel: input.castLevel,
    },
  });
  return {};
}
