import { describe, expect, it } from 'vitest';
import type { CharacterSheet } from 'shared';
import bestiaryData from 'shared/bestiaryData';
import { makeCombatRoom, makeResources, makeToken } from '../../test/fixtures';
import { makeConnCtx } from '../../test/ctx';
import { beginShape } from '../../room/shape';
import { hasPayableSpecial } from './internal';
import { applyReactionChoice, reactionSpellOptions } from './spellReactions';

const WOLF = bestiaryData.entries.find((e) => e.key === 'XMM:Wolf')!;

function sheet(classes: CharacterSheet['classes']): CharacterSheet {
  return {
    name: 'Кастер',
    abilities: { str: 10, dex: 14, con: 12, int: 16, wis: 10, cha: 10 },
    proficiencyBonus: '3',
    saves: {},
    skills: {},
    attacks: [],
    classes,
    spells: [{ key: 'XPHB:Shield', className: 'wizard' }],
    hpMax: '20',
    ac: '12',
    speed: 30,
    senses: [],
    damageDefenses: [],
  } as CharacterSheet;
}

function setup(classes: CharacterSheet['classes'] = [{ className: 'wizard', level: 5 }]) {
  const token = makeToken('t1', { libraryItemId: 'lib1', name: 'Кастер', x: 100, y: 100 });
  const room = makeCombatRoom([token], { p1: 'lib1' });
  room.sheets['p1'] = sheet(classes);
  room.resources['p1'] = makeResources({ spellSlots: [{ level: 1, current: 2, max: 2 }] });
  const f = makeConnCtx(room, { dm: true, all: true });
  return { room, token, f };
}

describe('реакционные касты в форме', () => {
  it('без формы Shield предлагается и стоит реакции', () => {
    const { room, token, f } = setup();
    expect(reactionSpellOptions(room, token, 'attackHit').map((o) => o.id)).toEqual(['spell:XPHB:Shield']);
    expect(hasPayableSpecial(f.manager, room, 'm1', token)).toBe(true);
  });

  it('Wild Shape до 18 уровня: реакционные касты не предлагаются', () => {
    const { room, token, f } = setup();
    beginShape(token, { entry: WOLF, kind: 'wildShape', tempHp: 5 });
    expect(reactionSpellOptions(room, token, 'attackHit')).toEqual([]);
    expect(hasPayableSpecial(f.manager, room, 'm1', token)).toBe(false);
  });

  it('друид 18 в Wild Shape кастует (Beast Spells)', () => {
    const { room, token } = setup([{ className: 'druid', level: 18 }]);
    beginShape(token, { entry: WOLF, kind: 'wildShape', tempHp: 18 });
    expect(reactionSpellOptions(room, token, 'attackHit').map((o) => o.id)).toEqual(['spell:XPHB:Shield']);
  });

  it('из Polymorph каст запрещён даже друиду 18', () => {
    const { room, token } = setup([{ className: 'druid', level: 18 }]);
    beginShape(token, { entry: WOLF, kind: 'polymorph', tempHp: 11, sourceTokenId: 'caster' });
    expect(reactionSpellOptions(room, token, 'attackHit')).toEqual([]);
  });

  it('защита от устаревшего окна: каст в форме не тратит ячейку и реакцию', () => {
    const { room, token, f } = setup();
    beginShape(token, { entry: WOLF, kind: 'wildShape', tempHp: 5 });

    applyReactionChoice(f.ctx, room, { tokenId: 't1', mapId: 'm1', optionId: 'spell:XPHB:Shield' }, [token]);

    expect(f.selfEvents('chat:error')[0]?.payload).toEqual({ code: 'shapeInForm' });
    expect(room.resources['p1']!.spellSlots[0]!.current).toBe(2);
    expect(token.effects).toEqual([]);
    expect(room.scene.maps[0]!.combat.turns['e1']!.reactionUsed).toBe(false);
  });
});
