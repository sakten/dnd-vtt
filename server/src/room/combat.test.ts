import { describe, expect, it } from 'vitest';
import { makeCombatRoom, makeToken } from '../test/fixtures';
import { makeConnCtx } from '../test/ctx';
import { addTokenToCombat, startCombat } from './combat';

describe('бой: состояние ходов участников', () => {
  it('startCombat создаёт состояние хода каждому участнику очереди', () => {
    const room = makeCombatRoom([makeToken('t1'), makeToken('t2', { name: 'B' })]);
    const { manager } = makeConnCtx(room);

    startCombat(manager, room, 'm1');

    const combat = room.scene.maps[0]!.combat;
    expect(combat.entries).toHaveLength(2);
    for (const entry of combat.entries) {
      expect(combat.turns[entry.id], entry.name).toMatchObject({ actionUsed: false, bonusActionUsed: false });
    }
  });

  it('токен, добавленный в активный бой, сразу получает состояние хода', () => {
    const room = makeCombatRoom([makeToken('t1')]);
    const { manager } = makeConnCtx(room);
    const extra = makeToken('t2', { name: 'B' });
    room.scene.maps[0]!.tokens.push(extra);

    addTokenToCombat(manager, room, 'm1', extra);

    const combat = room.scene.maps[0]!.combat;
    const entry = combat.entries.find((e) => e.tokenId === 't2');
    expect(entry).toBeTruthy();
    expect(combat.turns[entry!.id]).toBeTruthy();
  });
});
