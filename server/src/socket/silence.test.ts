import { describe, expect, it } from 'vitest';
import { findSpell } from '../spells';
import { makeConnCtx } from '../test/ctx';
import { makeRoom, makeToken } from '../test/fixtures';
import { validateSpellCast, type SpellCastInput } from './spellResolve';
import type { Token, ZoneInstance } from 'shared';

function setup() {
  const caster = makeToken('t1', { x: 100, y: 100 });
  const target = makeToken('t2', { x: 150, y: 100, ac: '12', hpMax: '20' });
  const room = makeRoom();
  room.scene.maps[0]!.tokens.push(caster, target);
  const f = makeConnCtx(room, { dm: true });
  return { room, caster, target, f };
}

const silenceZone = (overrides: Partial<ZoneInstance> = {}): ZoneInstance => ({
  id: 'z1',
  name: 'Silence',
  sourceKey: 'XPHB:Silence',
  sourceId: 't9',
  origin: { x: 100, y: 100 },
  area: { shape: 'sphere', size: 20 },
  duration: { type: 'concentration' },
  concentration: true,
  containment: 'fullyWithin',
  flags: { silence: true },
  ...overrides,
});

function castInput(caster: Token, target: Token, spellKey: string): SpellCastInput {
  return {
    caster,
    mapId: 'm1',
    spell: findSpell(spellKey)!,
    castLevel: 0,
    characterLevel: 1,
    stats: null,
    targets: [target],
    author: 'DM',
  };
}

describe('молчание: запрет вербальных кастов', () => {
  it('под Silence каст с вербальным компонентом отклоняется', () => {
    const { room, caster, target } = setup();
    room.scene.maps[0]!.zones = [silenceZone()];
    expect(validateSpellCast(room, castInput(caster, target, 'XPHB:Fire Bolt'))).toEqual({ code: 'silenced' });
  });

  it('без вербального компонента в той же зоне каст проходит', () => {
    const { room, caster, target } = setup();
    room.scene.maps[0]!.zones = [silenceZone()];
    expect(validateSpellCast(room, castInput(caster, target, 'XPHB:Minor Illusion'))).toBeUndefined();
  });

  it('вне зоны каст с вербальным компонентом проходит', () => {
    const { room, caster, target } = setup();
    room.scene.maps[0]!.zones = [silenceZone()];
    caster.x = 1000;
    const input = castInput(caster, target, 'XPHB:Detect Magic');
    expect(validateSpellCast(room, { ...input, targets: [] })).toBeUndefined();
  });
});
