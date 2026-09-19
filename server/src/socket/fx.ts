import { randomUUID } from 'node:crypto';
import type { AreaSpec, AutomationDef, SpellFxPayload, Token } from 'shared';
import type { ConnCtx } from './context';

/** Данные применения для эффекта: кастер, способность, точка/направление/область. */
export interface FxCastInput {
  caster: Token;
  mapId: string;
  def: AutomationDef;
  origin?: { x: number; y: number } | null;
  direction?: { x: number; y: number } | null;
  area?: AreaSpec | null;
}

/**
 * Рассылает косметический эффект применения. Ничего не блокирует и не хранится:
 * клиент рисует анимацию сам (у кастера — после его d20). `utility`/`manual`
 * без визуального результата пропускаем, чтобы не слать пустые эффекты.
 */
export function emitSpellFx(ctx: ConnCtx, input: FxCastInput, targets: Token[]): void {
  const { def } = input;
  if (def.resolution === 'utility' || def.resolution === 'manual') return;
  if (!def.zone && !def.attack && !def.save && !def.damage && !def.heal && !def.effects?.length) return;

  const effects = def.effects ?? [];
  const toSelf = def.resolution === 'effect' && effects.length > 0 && effects.every((e) => (e.to ?? 'self') === 'self');
  const mode = def.heal && !def.damage ? 'heal' : def.resolution === 'effect' ? 'buff' : 'damage';
  // Вершина области на кастере (Burning Hands, Thunderwave): снаряд не летит, эффект идёт от себя.
  const selfArea =
    !!input.area &&
    !!input.origin &&
    Math.hypot(input.origin.x - input.caster.x, input.origin.y - input.caster.y) < 1;

  const payload: SpellFxPayload = {
    id: randomUUID(),
    mapId: input.mapId,
    casterId: input.caster.id,
    key: def.key,
    name: def.name,
    resolution: def.resolution,
    mode,
    ...(def.attack && { attack: def.attack.rangeType }),
    ...(input.area && { area: input.area }),
    origin: input.origin ?? null,
    direction: input.direction ?? null,
    targets: toSelf ? [] : targets.map((t) => t.id),
    types: def.damage?.types ?? [],
    count: Math.max(1, def.count ?? 1),
    ...(toSelf && { toSelf }),
    ...(selfArea && { selfArea }),
  };
  ctx.broadcastAll('fx:play', payload);
}
