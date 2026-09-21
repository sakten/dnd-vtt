import {
  automationForSpell,
  crossesWalls,
  effectiveSpellRangeFeet,
  gridDistanceFeet,
  gridOfMap,
  hasInvocation,
  INVOCATION_PACT_KEYS,
  polymorphFormIssue,
  spellIsSelf,
  type ErrorPayload,
  type Spell,
  type SpellStats,
  type Token,
} from 'shared';
import type { Room } from '../roomTypes';
import { sheetOfToken } from '../room/helpers';
import type { ConnCtx } from './context';
import { executeAutomation } from './automation';
import { summonEntry, summonFormIssue, hasFreeSummonSpot } from './summons';
import { polymorphMaxCr, shapePlacementIssue } from './forms';

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
  author: string;
}

/** Проверка возможности накладывания (до списания ячейки/слота). */
export function validateSpellCast(room: Room, input: SpellCastInput): ErrorPayload | undefined {
  const { caster, spell } = input;
  const invocations = sheetOfToken(room, caster).sheet?.invocations;
  const def = automationForSpell(spell, {
    castLevel: input.castLevel,
    characterLevel: input.characterLevel,
    invocations,
  });
  const targets = input.targets.filter((t) => !!t);
  const hasRoll = !!(def.damage || def.heal);

  if (def.effects?.some((d) => d.markTarget) && !targets[0]) {
    return { code: 'spellNoTarget' };
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

  if (input.area) return undefined;
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
    invocations: sheetOfToken(room, input.caster).sheet?.invocations,
  });
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
    area: input.spell.areaSpec ?? null,
    ...(input.summonKey ? { summonKey: input.summonKey } : {}),
    manual: {
      description: input.spell.description,
      level: input.spell.level,
      castLevel: input.castLevel,
    },
  });
  return {};
}
