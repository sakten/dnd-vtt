import { importCustomSpell } from '../customSpells';
import { findSpellDef } from '../spells';
import type { ConnCtx } from './context';
import { asString } from './decode';
import { fail } from './errors';

/** Лимит JSON кастомного спелла: запись канона ~2–4 КБ, с запасом на патчи. */
const MAX_CUSTOM_JSON = 100_000;

/**
 * Кастомные заклинания комнаты (R16 срез 5): импорт — только DM, запись в
 * `room.customSpecs` (полная слитая `SpellDef`), рассылка всем — по ним кастуют
 * и игроки. Ошибка импорта — `chat:error` (`customInvalid`), без записи.
 */
export function registerCustomHandlers(ctx: ConnCtx) {
  ctx.on('custom:import', ({ json }) => {
    const room = ctx.dmRoom();
    if (!room) return;
    const text = asString(json, MAX_CUSTOM_JSON);
    if (!text) {
      fail(ctx, 'customInvalid');
      return;
    }
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      fail(ctx, 'customInvalid');
      return;
    }
    let record;
    try {
      record = importCustomSpell(raw, (key) => findSpellDef(room, key));
    } catch {
      fail(ctx, 'customInvalid');
      return;
    }
    room.customSpecs = [...room.customSpecs.filter((s) => s.key !== record.key), record];
    ctx.manager.saveSoon(room);
    ctx.broadcastAll('room:customSpecs', room.customSpecs);
  });

  ctx.on('custom:remove', (key) => {
    const room = ctx.dmRoom();
    const spellKey = asString(key, 120);
    if (!room || !spellKey) return;
    const next = room.customSpecs.filter((s) => s.key !== spellKey);
    if (next.length === room.customSpecs.length) return;
    room.customSpecs = next;
    ctx.manager.saveSoon(room);
    ctx.broadcastAll('room:customSpecs', room.customSpecs);
  });
}
