import { passiveFeatures, type ClassLevel, type Token } from 'shared';
import type { Room } from '../roomTypes';
import type { ConnCtx } from './context';
import { applyEffectTo } from './effectsApply';

const FEATURE_PREFIX = 'feature:';

/** Снимает с токена скрытые эффекты черт, которых больше нет у персонажа. */
function pruneFeatureEffects(ctx: ConnCtx, room: Room, token: Token, classes: ClassLevel[]): void {
  const desired = new Set<string>();
  for (const feature of passiveFeatures(classes)) {
    feature.effects.forEach((_def, index) => desired.add(`${FEATURE_PREFIX}${feature.key}#${index}`));
  }
  for (const effect of [...token.effects]) {
    const key = effect.sourceKey;
    if (key && key.startsWith(FEATURE_PREFIX) && !desired.has(key)) {
      ctx.manager.removeEffect(room, token, effect.id);
    }
  }
}

/** Прописывает токену скрытые эффекты пассивных черт персонажа (идемпотентно). */
export function syncFeatureEffects(ctx: ConnCtx, room: Room, mapId: string, token: Token, classes: ClassLevel[]): void {
  pruneFeatureEffects(ctx, room, token, classes);
  for (const feature of passiveFeatures(classes)) {
    feature.effects.forEach((def, index) => {
      const sourceKey = `${FEATURE_PREFIX}${feature.key}#${index}`;
      applyEffectTo(ctx, room, {
        sourceKey,
        sourceId: sourceKey,
        mapId,
        effectDef: { ...def, name: def.name || feature.name, hidden: true },
        target: token,
      });
    });
  }
}

/** Все токены персонажа игрока (по привязанному предмету библиотеки). */
function characterTokens(room: Room, libraryItemId: string): { mapId: string; token: Token }[] {
  const out: { mapId: string; token: Token }[] = [];
  for (const map of room.scene.maps) {
    for (const token of map.tokens) {
      if (token.libraryItemId === libraryItemId) out.push({ mapId: map.id, token });
    }
  }
  return out;
}

/** Пересобирает фичевые эффекты у всех токенов персонажа (например, при отвязке листа). */
export function syncFeatureEffectsForItem(
  ctx: ConnCtx,
  room: Room,
  libraryItemId: string,
  classes: ClassLevel[] | undefined
): void {
  for (const { mapId, token } of characterTokens(room, libraryItemId)) {
    syncFeatureEffects(ctx, room, mapId, token, classes ?? []);
    ctx.emitToken(room, 'token:update', mapId, token);
  }
}
