import {
  DEFAULT_ABILITIES,
  applyRest,
  effectiveMaxHp,
  isRecord,
  rollDice,
  sanitizeResources,
  sheetMods,
  type DiceRollResult,
  type PlayerResources,
  type RollLabelParams,
} from 'shared';
import type { ConnCtx } from './context';
import { playerScope, rejectIfReaction } from './guards';
import { pushRollMessage } from './messages';

export function registerResourceHandlers(ctx: ConnCtx) {
  const { manager, emitToken } = ctx;

    ctx.on('resources:update', (payload) => {
      const scope = playerScope(ctx);
      if (!scope) return;
      if (rejectIfReaction(ctx, true)) return;
      const { room, playerId } = scope;
      if (!isRecord(payload)) return;
      const sheet = room.sheets[playerId];
      const classes = sheet?.classes ?? [];
      const mods = sheet ? sheetMods(sheet.abilities) : sheetMods(DEFAULT_ABILITIES);
      const hpMax = sheet ? effectiveMaxHp(sheet) : undefined;
      room.resources[playerId] = sanitizeResources(payload as PlayerResources, classes, mods, hpMax);
      const changed = manager.syncSheetToTokens(room, playerId);
      ctx.emitResources(room, playerId);
      for (const c of changed) emitToken(room, 'token:update', c.mapId, c.token);
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
      const roll = rollDice(`1d${entry.die}`);
      const heal = Math.max(0, roll.total + sheetMods(sheet.abilities).con);
      entry.current -= 1;
      res.hp.current = Math.min(res.hp.max, res.hp.current + heal);
      const changed = manager.syncSheetToTokens(room, playerId);
      const author = room.players.find((p) => p.id === playerId)?.name ?? '?';
      pushRollMessage(ctx, room, {
        author,
        roll,
        label: `Хит дайс d${entry.die} (лечение ${heal})`,
      });
      ctx.emitResources(room, playerId);
      for (const c of changed) emitToken(room, 'token:update', c.mapId, c.token);
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
        // Долгий отдых: истёкшие эффекты (и их состояния/концентрация) снимаются.
        for (const c of manager.clearEffectsForPlayer(room, playerId)) {
          emitToken(room, 'token:update', c.mapId, c.token);
        }
      }
      room.resources[playerId] = applyRest(res, type);
      for (const c of manager.syncSheetToTokens(room, playerId)) {
        emitToken(room, 'token:update', c.mapId, c.token);
      }
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
      const expr = typeof payload?.expression === 'string' ? payload.expression : 'd20';
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
        for (const c of manager.markControlledTokensDead(room, playerId, true)) {
          emitToken(room, 'token:update', c.mapId, c.token);
        }
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
