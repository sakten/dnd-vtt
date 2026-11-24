import { describe, expect, it } from 'vitest';
import { normalizeSheet, type CharacterSheet } from 'shared';
import { makeConnCtx } from '../test/ctx';
import { makeResources, makeRoom } from '../test/fixtures';
import { registerSheetHandlers } from './sheet';

function sheet(className: string): CharacterSheet {
  return normalizeSheet({
    name: 'Иван',
    abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 10 },
    classes: [{ className, level: 5 }],
  });
}

describe('sheet:update: смена класса', () => {
  it('отдаёт клиенту новый лист и ресурсы нового класса', () => {
    const room = makeRoom({ controllers: { p1: 'lib1' } });
    room.sheets.p1 = sheet('fighter');
    room.resources.p1 = makeResources({
      resources: [{ id: 'r1', key: 'fighter:secondWind', name: 'Второе дыхание', current: 1, max: 1, reset: 'short', auto: true }],
    });
    const f = makeConnCtx(room, { playerId: 'p1' });
    registerSheetHandlers(f.ctx);

    f.invoke('sheet:update', sheet('barbarian'));

    const sent = f.selfEvents('sheet:update').at(-1)?.payload as { sheet: CharacterSheet };
    expect(sent.sheet.classes[0]?.className).toBe('barbarian');
    expect(room.sheets.p1!.classes[0]?.className).toBe('barbarian');

    const resources = f.selfEvents('resources:update').at(-1)?.payload as {
      resources: { key?: string }[];
    };
    expect(resources.resources.some((r) => r.key?.startsWith('fighter:'))).toBe(false);
    expect(resources.resources.some((r) => r.key === 'barbarian:rage')).toBe(true);
  });
});