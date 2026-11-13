import {
  ARCANE_RECOVERY_MAX_SLOT_LEVEL,
  DEFAULT_ABILITIES,
  applyRest,
  arcaneRecoveryBudget,
  deathSaveAdvantage,
  effectiveCharacterMaxHp,
  isRecord,
  rollDice,
  sanitizeResources,
  sheetMods,
  type DiceRollResult,
  type PlayerResources,
  type RollLabelParams,
} from 'shared';
import type { ConnCtx } from './context';
import { fail } from './errors';
import { endShapeToken, endShapesOf } from './forms';
import { removeZonesOfSource } from './zones';
import { playerScope, rejectIfReaction } from './guards';
import { pushRollMessage } from './messages';

export function registerResourceHandlers(ctx: ConnCtx) {
  const { manager, emitChanged } = ctx;

    ctx.on('resources:update', (payload) => {
      const scope = playerScope(ctx);
      if (!scope) return;
      if (rejectIfReaction(ctx, true)) return;
      const { room, playerId } = scope;
      if (!isRecord(payload)) return;
      const sheet = room.sheets[playerId];
      const classes = sheet?.classes ?? [];
      const mods = sheet ? sheetMods(sheet.abilities) : sheetMods(DEFAULT_ABILITIES);
      const hpMax = sheet ? effectiveCharacterMaxHp(sheet) : undefined;
      room.resources[playerId] = sanitizeResources(payload as PlayerResources, classes, mods, hpMax, sheet?.choices, sheet?.race);
      const changed = manager.characterTokens(room, playerId);
      ctx.emitResources(room, playerId);
      emitChanged(room, changed);
      ctx.notifyPlayers(room);
    });

    ctx.on('resources:hitDie', (payload) => {
      const scope = playerScope(ctx);
      if (!scope) return;
      if (rejectIfReaction(ctx, true)) return;
      const { room, playerId } = scope;
      const sheet = room.sheets[playerId];
      const res = room.resources[playerId];
      if (!sheet || !res) return;
      const requested = Number(payload?.die);
      const entry =
        res.hitDice.find((h) => h.current > 0 && h.die === requested) ?? res.hitDice.find((h) => h.current > 0);
      if (!entry) return;
      // Кость хитов лечит кость + модификатор Телосложения (в броске — явным слагаемым).
      const con = sheetMods(sheet.abilities).con;
      const roll = rollDice(`1d${entry.die}${con > 0 ? `+${con}` : con < 0 ? `${con}` : ''}`);
      const heal = Math.max(0, roll.total);
      entry.current -= 1;
      res.hp.current = Math.min(res.hp.max, res.hp.current + heal);
      // Хит-дайс — тоже лечение: стабильность снимается, но мёртвых не оживляет.
      if (res.hp.current > 0 && res.hp.deathFailures < 3) {
        res.hp.deathSuccesses = 0;
        res.hp.deathFailures = 0;
        delete res.hp.stable;
      }
      const changed = manager.characterTokens(room, playerId);
      const author = room.players.find((p) => p.id === playerId)?.name ?? '?';
      pushRollMessage(ctx, room, {
        author,
        roll,
        kind: 'plain',
        params: { subject: `Хит дайс d${entry.die} (лечение ${heal})` },
      });
      ctx.emitResources(room, playerId);
      emitChanged(room, changed);
      ctx.notifyPlayers(room);
    });

    ctx.on('resources:rest', ({ type }) => {
      const scope = playerScope(ctx);
      if (!scope) return;
      if (rejectIfReaction(ctx)) return;
      const { room, playerId } = scope;
      if (type !== 'short' && type !== 'long') return;
      const res = room.resources[playerId];
      if (!res) return;
      if (type === 'long') {
        // Формы не переживают долгий отдых: свои снимаются, Polymorph-цели — по источнику.
        const owned = manager.characterTokens(room, playerId);
        for (const c of owned) endShapeToken(ctx, room, c.mapId, c.token);
        endShapesOf(ctx, room, new Set(owned.map((c) => c.token.id)));
        // Зоны без концентрации (Daylight и подобные) тоже снимаются — длительности >1 мин не трекаем.
        for (const c of owned) removeZonesOfSource(ctx, room, c.token.id);
        // Истёкшие эффекты (и их состояния/концентрация) снимаются.
        emitChanged(room, manager.clearEffectsForPlayer(room, playerId));
      }
      room.resources[playerId] = applyRest(res, type);
      emitChanged(room, manager.characterTokens(room, playerId));
      ctx.emitResources(room, playerId);
      ctx.notifyPlayers(room);
    });

    ctx.on('resources:arcaneRecovery', (payload) => {
      const scope = playerScope(ctx);
      if (!scope) return;
      if (rejectIfReaction(ctx, true)) return;
      const { room, playerId } = scope;
      const sheet = room.sheets[playerId];
      const res = room.resources[playerId];
      if (!sheet || !res) return;
      const wizard = sheet.classes.find((c) => c.className === 'wizard');
      const item = res.resources.find((r) => r.key === 'wizard:arcaneRecovery');
      if (!wizard || !item || item.current <= 0) {
        fail(ctx, 'arcaneRecoveryUnavailable');
        return;
      }
      const picks = new Map<number, number>();
      for (const entry of Array.isArray(payload?.slots) ? payload.slots : []) {
        const level = Math.round(Number(entry?.level));
        const count = Math.round(Number(entry?.count));
        if (
          !Number.isInteger(level) ||
          !Number.isInteger(count) ||
          level < 1 ||
          level > ARCANE_RECOVERY_MAX_SLOT_LEVEL ||
          count <= 0
        ) {
          fail(ctx, 'arcaneRecoveryInvalid');
          return;
        }
        picks.set(level, (picks.get(level) ?? 0) + count);
      }
      if (!picks.size) {
        fail(ctx, 'arcaneRecoveryEmpty');
        return;
      }
      const budget = arcaneRecoveryBudget(wizard.level);
      let total = 0;
      const recovery: { level: number; count: number }[] = [];
      for (const [level, count] of picks) {
        const slot = res.spellSlots.find((s) => s.level === level);
        if (!slot || count > slot.max - slot.current) {
          fail(ctx, 'arcaneRecoveryInvalid');
          return;
        }
        total += level * count;
        recovery.push({ level, count });
      }
      if (total > budget) {
        fail(ctx, 'arcaneRecoveryBudget', { max: budget });
        return;
      }
      for (const { level, count } of recovery) {
        const slot = res.spellSlots.find((s) => s.level === level)!;
        slot.current = Math.min(slot.max, slot.current + count);
      }
      item.current -= 1;
      const author = room.players.find((p) => p.id === playerId)?.name ?? '?';
      ctx.systemMessage(room, { code: 'resources.arcaneRecovery', params: { name: author, levels: total } });
      ctx.emitResources(room, playerId);
      ctx.notifyPlayers(room);
    });

    ctx.on('resources:deathSave', (payload) => {
      const scope = playerScope(ctx);
      if (!scope) return;
      if (rejectIfReaction(ctx, true)) return;
      const { room, playerId } = scope;
      const res = room.resources[playerId];
      if (!res) return;
      // Стабильный (Spare the Dying/3 успеха) death-сейвы не бросает.
      if (res.hp.stable) {
        fail(ctx, 'alreadyStable');
        return;
      }
      let expr = typeof payload?.expression === 'string' ? payload.expression : 'd20';
      // Beacon of Hope: преимущество на death-сейвы; помеха игрока гасится по правилам.
      if (manager.characterTokens(room, playerId).some((c) => deathSaveAdvantage(c.token.effects))) {
        const disadvantage = /d20d/.test(expr);
        expr = expr.replace(/d20[ad]/g, 'd20');
        if (!disadvantage) expr = expr.replace(/d20/, 'd20a');
      }
      let roll: DiceRollResult;
      try {
        roll = rollDice(expr);
      } catch {
        roll = rollDice('d20');
      }
      const die = roll.dice.find((d) => d.sides === 20 && d.sign === 1);
      const kept = die ? die.values.find((v) => !die.dropped.includes(v)) ?? die.values[0] ?? 0 : roll.total;
      let outcome: RollLabelParams['outcome'];
      if (kept === 20) {
        res.hp.deathSuccesses = Math.min(3, res.hp.deathSuccesses + 2);
        outcome = 'critSuccess';
      } else if (kept === 1) {
        res.hp.deathFailures = Math.min(3, res.hp.deathFailures + 2);
        outcome = 'critFail';
      } else if (kept >= 10) {
        res.hp.deathSuccesses = Math.min(3, res.hp.deathSuccesses + 1);
        outcome = 'success';
      } else {
        res.hp.deathFailures = Math.min(3, res.hp.deathFailures + 1);
        outcome = 'fail';
      }
      if (res.hp.deathFailures >= 3) {
        delete res.hp.stable;
        emitChanged(room, manager.markControlledTokensDead(room, playerId, true));
      } else if (res.hp.deathSuccesses >= 3) {
        // Три успеха = стабилен: death-сейвы больше не бросаются до получения урона.
        res.hp.stable = true;
        res.hp.deathFailures = 0;
      }
      const author = room.players.find((p) => p.id === playerId)?.name ?? '?';
      const params: RollLabelParams = {
        outcome,
        successes: res.hp.deathSuccesses,
        failures: res.hp.deathFailures,
      };
      pushRollMessage(ctx, room, { author, roll, kind: 'death', params });
      ctx.emitResources(room, playerId);
    });

}
