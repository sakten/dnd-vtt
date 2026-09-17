import {
  automationForSpell,
  gridDistanceFeet,
  spellIsSelf,
  spellRangeFeet,
  type ErrorPayload,
  type Spell,
  type SpellStats,
  type Token,
} from 'shared';
import type { Room } from '../roomTypes';
import type { ConnCtx } from './context';
import { executeAutomation } from './automation';

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
  author: string;
}

/** Проверка возможности накладывания (до списания ячейки/слота). */
export function validateSpellCast(room: Room, input: SpellCastInput): ErrorPayload | undefined {
  const { caster, spell } = input;
  const def = automationForSpell(spell, {
    castLevel: input.castLevel,
    characterLevel: input.characterLevel,
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

  if (input.area) return undefined;
  const rangeFeet = spellRangeFeet(spell);
  if (rangeFeet === null || spellIsSelf(spell)) return undefined;
  const map = room.scene.maps.find((m) => m.id === input.mapId);
  const gridSize = map?.grid.size || 50;
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
    manual: {
      description: input.spell.description,
      level: input.spell.level,
      castLevel: input.castLevel,
    },
  });
  return {};
}
