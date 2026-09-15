import { describe, expect, it } from 'vitest';
import type { ActionDef } from '../domain/actions';
import { automationForAction, automationForSpell } from './automation';
import type { Spell } from './spells';

function makeAction(partial: Partial<ActionDef>): ActionDef {
  return { id: 'test', name: 'Test', source: 'basic', costs: ['action'], ...partial };
}

function makeSpell(partial: Partial<Spell>): Spell {
  return {
    key: 'XPHB:Test',
    name: 'Test',
    source: 'XPHB',
    level: 1,
    school: 'Evocation',
    time: [{ number: 1, unit: 'action' }],
    range: { type: 'point', distance: { type: 'feet', amount: 60 } },
    components: {},
    duration: [{ type: 'instant' }],
    classes: ['wizard'],
    automation: 'full',
    description: [],
    ...partial,
  };
}

describe('automationForSpell', () => {
  it('спасбросок + урон: спас, половина и выражение', () => {
    const spell = makeSpell({
      level: 3,
      damage: { dice: ['8d6'], types: ['fire'] },
      save: ['dex'],
      saveHalf: true,
      higherLevel: ['The damage increases by 1d6 for each slot level above 3.'],
    });
    const def = automationForSpell(spell, { castLevel: 4 });
    expect(def.resolution).toBe('save');
    expect(def.save).toEqual({ ability: 'dex', half: true });
    expect(def.damage).toEqual({ dice: '8d6 + 1d6', types: ['fire'] });
    expect(def.heal).toBeUndefined();
  });

  it('spell-атака: тип и число атак из текста/апкаста', () => {
    const spell = makeSpell({
      level: 2,
      spellAttack: 'ranged',
      damage: { dice: ['2d6'], types: ['fire'] },
      description: ['You create three rays of fire.'],
      higherLevel: ['The spell creates one additional ray for each slot level above 2.'],
    });
    const base = automationForSpell(spell);
    expect(base.resolution).toBe('attack');
    expect(base.attack).toEqual({ rangeType: 'ranged' });
    expect(base.count).toBe(3);
    const upcast = automationForSpell(spell, { castLevel: 3 });
    expect(upcast.count).toBe(4);
  });

  it('авто-урон без бросков', () => {
    const spell = makeSpell({ level: 1, damage: { dice: ['3d4+3'], types: ['force'] } });
    const def = automationForSpell(spell);
    expect(def.resolution).toBe('auto');
    expect(def.damage?.dice).toBe('3d4+3');
  });

  it('лечение — heal, не урон', () => {
    const spell = makeSpell({ level: 1, damage: { dice: ['2d8'], types: [] }, healing: true });
    const def = automationForSpell(spell);
    expect(def.resolution).toBe('auto');
    expect(def.heal?.dice).toBe('2d8');
    expect(def.damage).toBeUndefined();
  });

  it('массовое лечение: до 6/5 целей из добавлений', () => {
    const mhwSpell = makeSpell({
      key: 'XPHB:Mass Healing Word',
      name: 'Mass Healing Word',
      level: 3,
      damage: { dice: ['2d4'], types: [] },
      healing: true,
    });
    const mhw = automationForSpell(mhwSpell);
    expect(mhw.targets).toBe(6);
    expect(mhw.heal?.dice).toBe('2d4');
    const prayer = makeSpell({
      key: 'XPHB:Prayer of Healing',
      name: 'Prayer of Healing',
      level: 2,
      damage: { dice: ['2d8'], types: [] },
      healing: true,
    });
    expect(automationForSpell(prayer).targets).toBe(5);
    const massCure = makeSpell({
      key: 'XPHB:Mass Cure Wounds',
      name: 'Mass Cure Wounds',
      level: 5,
      damage: { dice: ['5d8'], types: [] },
      healing: true,
    });
    expect(automationForSpell(massCure).targets).toBe(6);
  });

  it('без механики — manual', () => {
    const def = automationForSpell(makeSpell({ level: 0, automation: 'manual' }));
    expect(def.resolution).toBe('manual');
  });

  it('каталог важнее деривации (Bless с «фантомными» костями)', () => {
    const spell = makeSpell({
      key: 'XPHB:Bless',
      name: 'Bless',
      damage: { dice: ['1d4'], types: ['radiant'] },
      save: ['cha'],
    });
    const def = automationForSpell(spell);
    expect(def.resolution).toBe('effect');
    expect(def.damage).toBeUndefined();
    expect(def.effects?.[0]?.targets).toBe(3);
  });

  it('Shield из каталога: +5 AC до конца хода', () => {
    const def = automationForSpell(makeSpell({ key: 'XPHB:Shield', name: 'Shield', automation: 'manual' }));
    expect(def.resolution).toBe('effect');
    expect(def.effects?.[0]?.modifiers[0]).toMatchObject({ target: 'ac', mode: 'add', value: 5 });
  });

  it('эффектные дебаффы несут спас и концентрацию (Hold Person)', () => {
    const def = automationForSpell(makeSpell({ key: 'XPHB:Hold Person', name: 'Hold Person', automation: 'manual' }));
    expect(def.save).toEqual({ ability: 'wis', half: undefined });
    expect(def.concentration).toBe(true);
  });

  it('Sleep: спас, эскалация в без сознания и пробуждение от урона', () => {
    const def = automationForSpell(makeSpell({ key: 'XPHB:Sleep', name: 'Sleep', automation: 'manual' }));
    const effect = def.effects?.[0];
    expect(def.save?.ability).toBe('wis');
    expect(effect?.conditions).toEqual(['incapacitated']);
    expect(effect?.escalate?.condition).toBe('unconscious');
    expect(effect?.wakeOnDamage).toBe(true);
  });

  it('Shocking Grasp: деривация атаки + добавка с запретом OA', () => {
    const spell = makeSpell({
      key: 'XPHB:Shocking Grasp',
      name: 'Shocking Grasp',
      level: 0,
      spellAttack: 'melee',
      damage: { dice: ['1d8'], types: ['lightning'] },
    });
    const def = automationForSpell(spell);
    expect(def.resolution).toBe('attack');
    expect(def.damage?.dice).toBe('1d8');
    expect(def.effects?.[0]?.restrictions?.noOpportunityAttacks).toBe(true);
    expect(def.effects?.[0]?.duration).toEqual({ type: 'endOfTurn', of: 'target' });
  });

  it('Spirit Guardians: деривация урона + зона с подстановкой костей', () => {
    const spell = makeSpell({
      key: 'XPHB:Spirit Guardians',
      name: 'Spirit Guardians',
      level: 3,
      save: ['wis'],
      saveHalf: true,
      damage: { dice: ['3d8'], types: ['necrotic', 'radiant'] },
      higherLevel: ['The damage increases by 1d8 for each spell slot level above 3.'],
    });
    const def = automationForSpell(spell, { castLevel: 4 });
    expect(def.resolution).toBe('save');
    expect(def.damage).toEqual({ dice: '3d8 + 1d8', types: ['radiant'] });
    expect(def.zone?.anchor).toBe('source');
    expect(def.zone?.enterOncePerTurn).toBe(true);
    expect(def.zone?.triggers?.startOfTurn?.damage?.dice).toBe('3d8 + 1d8');
    expect(def.zone?.aura?.effects?.[0]?.modifiers[0]).toMatchObject({ target: 'speed', mode: 'multiply', value: 0.5 });
  });

  it('Hunger of Hadar: слепота «полностью внутри» и урон по триггерам', () => {
    const def = automationForSpell(
      makeSpell({ key: 'XPHB:Hunger of Hadar', name: 'Hunger of Hadar', automation: 'manual' })
    );
    expect(def.zone?.containment).toBe('fullyWithin');
    expect(def.zone?.aura?.effects?.[0]?.conditions).toEqual(['blinded']);
    expect(def.zone?.triggers?.startOfTurn?.containment).toBe('anyCell');
    expect(def.zone?.triggers?.endOfTurn?.containment).toBe('anyCell');
    expect(def.zone?.triggers?.startOfTurn?.damage?.types).toEqual(['cold']);
    expect(def.zone?.triggers?.endOfTurn?.save?.ability).toBe('dex');
    expect(def.zone?.flags).toMatchObject({ difficultTerrain: true, blocksLight: true });
  });

  it('Web: зона с выпутыванием (STR/Athletics)', () => {
    const def = automationForSpell(makeSpell({ key: 'XPHB:Web', name: 'Web', automation: 'manual' }));
    expect(def.save?.ability).toBe('dex');
    expect(def.effects?.[0]?.conditions).toEqual(['restrained']);
    expect(def.effects?.[0]?.escape).toEqual({ ability: 'str', skill: 'athletics' });
    expect(def.zone?.triggers?.startOfTurn?.effects?.[0]?.escape?.ability).toBe('str');
  });

  it('Grease и Stinking Cloud: зоны с триггерами', () => {
    const grease = automationForSpell(makeSpell({ key: 'XPHB:Grease', name: 'Grease', automation: 'manual' }));
    expect(grease.zone?.duration).toEqual({ type: 'rounds', rounds: 10 });
    expect(grease.zone?.triggers?.endOfTurn?.effects?.[0]?.conditions).toEqual(['prone']);

    const cloud = automationForSpell(
      makeSpell({ key: 'XPHB:Stinking Cloud', name: 'Stinking Cloud', automation: 'manual' })
    );
    const trigger = cloud.zone?.triggers?.startOfTurn;
    expect(trigger?.save?.ability).toBe('con');
    expect(trigger?.effects?.[0]?.conditions).toEqual(['poisoned']);
    expect(trigger?.effects?.[0]?.restrictions).toMatchObject({ noActions: true, noBonus: true });
    expect(cloud.zone?.flags?.obscured).toBe('heavy');
  });

  it('Mirror Image: каталог даёт образы с зарядами', () => {
    const def = automationForSpell(
      makeSpell({ key: 'XPHB:Mirror Image', name: 'Mirror Image', automation: 'manual' })
    );
    expect(def.resolution).toBe('effect');
    expect(def.effects?.[0]?.misdirect).toEqual({ charges: 3, die: 'd6', threshold: 3 });
  });

  it('Slow: спас и ограничения экономики', () => {
    const def = automationForSpell(makeSpell({ key: 'XPHB:Slow', name: 'Slow', automation: 'manual' }));
    const effect = def.effects?.[0];
    expect(def.save?.ability).toBe('wis');
    expect(effect?.restrictions).toMatchObject({
      noReactions: true,
      actionOrBonusOnly: true,
      oneAttackOnly: true,
      spellFailureChance: 25,
    });
    expect(effect?.modifiers.map((m) => m.target)).toEqual(['speed', 'ac', 'save']);
  });
});

describe('automationForAction', () => {
  it('базовое действие: Рывок — utility extraMovement', () => {
    const def = automationForAction(makeAction({ id: 'dash', name: 'Рывок' }));
    expect(def?.resolution).toBe('utility');
    expect(def?.utility).toEqual({ kind: 'extraMovement' });
  });

  it('Второе дыхание: 1d10 + уровень воина', () => {
    const def = automationForAction(makeAction({ id: 'class:fighter:secondWind', source: 'class' }), {
      classes: [{ className: 'fighter', level: 3 }],
    });
    expect(def?.resolution).toBe('auto');
    expect(def?.heal?.dice).toBe('1d10+3');
  });

  it('черта без каталога — undefined (заглушка в чат)', () => {
    expect(automationForAction(makeAction({ id: 'class:wizard:portent', source: 'class' }))).toBeUndefined();
  });
});
