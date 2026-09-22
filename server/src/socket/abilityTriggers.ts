import { monsterAbilityAutomation, monsterStats, type Token } from 'shared';
import type { Room } from '../roomTypes';
import type { ConnCtx } from './context';
import { executeAutomation } from './automation';

/** Токены, чьи триггерные способности сейчас исполняются (защита от самозацикливания). */
const running = new Set<string>();

/**
 * Автосрабатывание способностей монстра: «при получении урона» и «при смерти».
 * Цели собираются в радиусе от монстра (`autoTargets` из конструктора).
 */
export function runAbilityTriggers(
  ctx: ConnCtx,
  room: Room,
  mapId: string,
  token: Token,
  trigger: 'takeDamage' | 'death'
): void {
  const actions = (token.statblock?.actions ?? []).filter((a) => a.ability?.trigger === trigger);
  if (!actions.length || running.has(token.id)) return;
  running.add(token.id);
  try {
    for (const action of actions) {
      const def = monsterAbilityAutomation(action);
      if (!def) continue;
      // Триггерные атаки не поддерживаем: их окна реакций асинхронны и рвут цепочку урона.
      if (def.resolution === 'attack') continue;
      executeAutomation(ctx, {
        caster: token,
        mapId,
        def,
        targets: [],
        stats: monsterStats(token.statblock, action.ability),
        author: token.name,
      });
    }
  } finally {
    running.delete(token.id);
  }
}
