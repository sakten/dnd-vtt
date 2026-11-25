import { LARGE_FORM_ACTION, type ActionDef, type Token } from 'shared';
import type { Room } from '../roomTypes';
import type { ConnCtx } from './context';
import { fail } from './errors';

export function endLargeForm(
  ctx: ConnCtx,
  room: Room,
  mapId: string,
  token: Token,
  action: ActionDef
): void {
  const effects = token.effects.filter((e) => e.sourceKey === LARGE_FORM_ACTION);
  if (!effects.length) {
    fail(ctx, 'featureInactive');
    return;
  }
  for (const effect of effects) ctx.manager.removeEffect(room, token, effect.id);
  ctx.emitChanged(room, [{ mapId, token }]);
  ctx.systemMessage(room, { code: 'actions.used', params: { name: token.name, action: action.name } });
}