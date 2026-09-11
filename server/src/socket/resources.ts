import { randomUUID } from 'node:crypto';
import {
  DEFAULT_ABILITIES,
  effectiveMaxHp,
  rollDice,
  sanitizeResources,
  sheetMods,
  type ChatMessage,
  type DiceRollResult,
  type PlayerResources,
} from 'shared';
import type { ConnCtx } from './context';

export function registerResourceHandlers(ctx: ConnCtx) {
  const { socket, manager, getRoom, broadcastAll } = ctx;

    socket.on('resources:update', (payload) => {
      if (!ctx.playerId) return;
      const room = getRoom();
      if (!room) return;
      if (!payload || typeof payload !== 'object') return;
      const sheet = room.sheets[ctx.playerId];
      const classes = sheet?.classes ?? [];
      const mods = sheet ? sheetMods(sheet.abilities) : sheetMods(DEFAULT_ABILITIES);
      const hpMax = sheet ? effectiveMaxHp(sheet) : undefined;
      room.resources[ctx.playerId] = sanitizeResources(payload as PlayerResources, classes, mods, hpMax);
      manager.saveSoon(room);
      socket.emit('resources:update', room.resources[ctx.playerId]);
      broadcastAll('players:update', manager.toState(room).players);
    });

    socket.on('resources:hitDie', (payload) => {
      if (!ctx.playerId) return;
      const room = getRoom();
      if (!room) return;
      const sheet = room.sheets[ctx.playerId];
      const res = room.resources[ctx.playerId];
      if (!sheet || !res) return;
      const requested = Number(payload?.die);
      const entry =
        res.hitDice.find((h) => h.current > 0 && h.die === requested) ?? res.hitDice.find((h) => h.current > 0);
      if (!entry) return;
      const roll = rollDice(`1d${entry.die}`);
      const heal = Math.max(0, roll.total + sheetMods(sheet.abilities).con);
      entry.current -= 1;
      res.hp.current = Math.min(res.hp.max, res.hp.current + heal);
      manager.saveSoon(room);
      const author = room.players.find((p) => p.id === ctx.playerId)?.name ?? '?';
      const message: ChatMessage = {
        id: randomUUID(),
        kind: 'roll',
        author,
        roll,
        label: `Хит дайс d${entry.die} (лечение ${heal})`,
        ts: Date.now(),
      };
      manager.addMessage(room, message);
      socket.emit('resources:update', res);
      broadcastAll('chat:message', message);
      broadcastAll('players:update', manager.toState(room).players);
    });

    socket.on('resources:deathSave', (payload) => {
      if (!ctx.playerId) return;
      const room = getRoom();
      if (!room) return;
      const res = room.resources[ctx.playerId];
      if (!res) return;
      const expr = typeof payload?.expression === 'string' ? payload.expression : 'd20';
      let roll: DiceRollResult;
      try {
        roll = rollDice(expr);
      } catch {
        roll = rollDice('d20');
      }
      const die = roll.dice.find((d) => d.sides === 20 && d.sign === 1);
      const kept = die ? die.values.find((v) => !die.dropped.includes(v)) ?? die.values[0] : roll.total;
      let outcome: string;
      if (kept === 20) {
        res.hp.deathSuccesses = Math.min(3, res.hp.deathSuccesses + 2);
        outcome = 'критический успех';
      } else if (kept === 1) {
        res.hp.deathFailures = Math.min(3, res.hp.deathFailures + 2);
        outcome = 'критический провал';
      } else if (kept >= 10) {
        res.hp.deathSuccesses = Math.min(3, res.hp.deathSuccesses + 1);
        outcome = 'успех';
      } else {
        res.hp.deathFailures = Math.min(3, res.hp.deathFailures + 1);
        outcome = 'провал';
      }
      manager.saveSoon(room);
      const author = room.players.find((p) => p.id === ctx.playerId)?.name ?? '?';
      const message: ChatMessage = {
        id: randomUUID(),
        kind: 'roll',
        author,
        roll,
        label: `Спасбросок от смерти: ${outcome} (успехи ${res.hp.deathSuccesses}/3, провалы ${res.hp.deathFailures}/3)`,
        ts: Date.now(),
      };
      manager.addMessage(room, message);
      socket.emit('resources:update', res);
      broadcastAll('chat:message', message);
    });

}
