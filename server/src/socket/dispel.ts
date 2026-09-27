import type { EffectInstance, Token, ZoneInstance } from 'shared';
import { findSpell } from '../spells';
import type { Room } from '../roomTypes';
import type { ConnCtx } from './context';
import { endConcentrationOf } from './effects';
import { removeZone } from './zones';

/**
 * Dispel Magic (XPHB 2024): движок снятия чужих заклинаний с существа и с зоны.
 * Предметы-цели — вне скоупа (TODO).
 */

/** Эффекты-заклинания на токене, которые может окончить Dispel Magic (служебные скрытые — нет). */
export function dispellableEffects(token: Token): EffectInstance[] {
  return token.effects.filter((e) => !!e.sourceKey && !e.hidden && !!findSpell(e.sourceKey));
}

/** Уровень заклинания-источника эффекта (undefined — не заклинание). */
export function effectSpellLevel(effect: EffectInstance): number | undefined {
  return effect.sourceKey ? findSpell(effect.sourceKey)?.level : undefined;
}

/** Уровень заклинания-источника зоны (undefined — не заклинание). */
export function zoneSpellLevel(zone: ZoneInstance): number | undefined {
  return zone.sourceKey ? findSpell(zone.sourceKey)?.level : undefined;
}

/**
 * Оканчивает эффект: у концентрации гасит концентрацию источника (только
 * концентрационные эффекты и зоны), у обычного эффекта снимает запись с носителя.
 */
export function endDispelledEffect(
  ctx: ConnCtx,
  room: Room,
  mapId: string,
  owner: Token,
  effect: EffectInstance
): void {
  if (effect.concentration && effect.sourceId) {
    const located = ctx.manager.locateToken(room, effect.sourceId);
    if (located) endConcentrationOf(ctx, room, located.token);
  }
  if (owner.effects.some((e) => e.id === effect.id)) {
    ctx.manager.removeEffect(room, owner, effect.id);
    ctx.emitToken(room, 'token:update', mapId, owner);
  }
  ctx.systemMessage(room, { code: 'automation.dispelled', params: { name: effect.name } });
}

/** Оканчивает зону-заклинание: концентрационная — вместе с концентрацией источника, иначе удаляется. */
export function endDispelledZone(ctx: ConnCtx, room: Room, mapId: string, zone: ZoneInstance): void {
  if (zone.concentration && zone.sourceId) {
    const located = ctx.manager.locateToken(room, zone.sourceId);
    if (located) {
      endConcentrationOf(ctx, room, located.token);
      if (!room.scene.maps.some((m) => (m.zones ?? []).some((z) => z.id === zone.id))) {
        ctx.systemMessage(room, { code: 'automation.dispelled', params: { name: zone.name } });
        return;
      }
    }
  }
  removeZone(ctx, room, mapId, zone);
  ctx.broadcastZones(room, mapId);
  ctx.systemMessage(room, { code: 'automation.dispelled', params: { name: zone.name } });
}
