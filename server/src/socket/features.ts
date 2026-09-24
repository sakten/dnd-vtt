import { featChoiceEffects, passiveFeatures, type ChoiceFeature, type ClassLevel, type FeatureChoice, type Token } from 'shared';
import type { Room } from '../roomTypes';
import type { ConnCtx } from './context';
import { applyEffectTo } from './effectsApply';
import { tokensOfLibraryItem } from '../room/helpers';

const FEATURE_PREFIX = 'feature:';

/** Пассивные эффекты персонажа: черты классов + выбранные фиты. */
function passiveSources(classes: ClassLevel[], choices?: FeatureChoice[]): ChoiceFeature[] {
  return [...passiveFeatures(classes), ...featChoiceEffects(choices, classes)];
}

/** Снимает с токена скрытые эффекты черт, которых больше нет у персонажа. */
function pruneFeatureEffects(
  ctx: ConnCtx,
  room: Room,
  token: Token,
  classes: ClassLevel[],
  choices?: FeatureChoice[]
): void {
  const desired = new Set<string>();
  for (const feature of passiveSources(classes, choices)) {
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
export function syncFeatureEffects(
  ctx: ConnCtx,
  room: Room,
  mapId: string,
  token: Token,
  classes: ClassLevel[],
  choices?: FeatureChoice[]
): void {
  pruneFeatureEffects(ctx, room, token, classes, choices);
  for (const feature of passiveSources(classes, choices)) {
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

/** Пересобирает фичевые эффекты у всех токенов персонажа (например, при отвязке листа). */
export function syncFeatureEffectsForItem(
  ctx: ConnCtx,
  room: Room,
  libraryItemId: string,
  classes: ClassLevel[] | undefined,
  choices?: FeatureChoice[]
): void {
  for (const { mapId, token } of tokensOfLibraryItem(room, libraryItemId)) {
    syncFeatureEffects(ctx, room, mapId, token, classes ?? [], choices);
    ctx.emitToken(room, 'token:update', mapId, token);
  }
}
