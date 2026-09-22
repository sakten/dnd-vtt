import { describe, expect, it } from 'vitest';
import type { ActionDef } from '../domain/actions';
import { automationForAction, automationForSpell, spellAutomated } from './automation';
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

  it('Expeditious Retreat: эффект выдаёт Рывок бонусным действием', () => {
    const def = automationForSpell(
      makeSpell({ key: 'XPHB:Expeditious Retreat', name: 'Expeditious Retreat', automation: 'manual' })
    );
    const effect = def.effects?.[0];
    expect(def.resolution).toBe('effect');
    expect(def.concentration).toBe(true);
    expect(effect?.to).toBe('self');
    expect(effect?.actions).toEqual([{ id: 'dash', name: 'Рывок', cost: 'bonus', baseActionId: 'dash' }]);
  });

  it("Dragon's Breath: эффект выдаёт Выдох с типом урона и скейлом от круга", () => {
    const spell = makeSpell({
      key: "XPHB:Dragon's Breath",
      name: "Dragon's Breath",
      level: 2,
      save: ['dex'],
      saveHalf: true,
      areaSpec: { shape: 'cone', size: 15 },
      damage: { dice: ['3d6'], types: ['acid', 'cold', 'fire', 'lightning', 'poison'] },
      higherLevel: ['The damage increases by 1d6 for each spell slot level above 2.'],
    });
    const def = automationForSpell(spell, { castLevel: 3, variant: 'cold' });
    const action = def.effects?.[0]?.actions?.[0];
    expect(def.resolution).toBe('effect');
    expect(def.concentration).toBe(true);
    expect(def.effects?.[0]?.variant).toBe('cold');
    expect(action?.cost).toBe('action');
    expect(action?.def?.resolution).toBe('save');
    expect(action?.def?.save).toEqual({ ability: 'dex', half: true });
    expect(action?.def?.damage).toEqual({ dice: '3d6 + 1d6', types: ['cold'] });
    expect(action?.def?.area).toEqual({ shape: 'cone', size: 15 });
    expect(action?.def?.targeting).toEqual({ kind: 'area', area: { shape: 'cone', size: 15 }, range: 15 });
  });

  it('Vampiric Touch: атака при касте, повтор действием, вытягивание жизни', () => {
    const spell = makeSpell({
      key: 'XPHB:Vampiric Touch',
      name: 'Vampiric Touch',
      level: 3,
      spellAttack: 'melee',
      damage: { dice: ['3d6'], types: ['necrotic'] },
      higherLevel: ['The damage increases by 1d6 for each spell slot level above 3.'],
    });
    const def = automationForSpell(spell, { castLevel: 4 });
    expect(def.resolution).toBe('attack');
    expect(def.attack?.rangeType).toBe('melee');
    expect(def.damage).toEqual({ dice: '3d6 + 1d6', types: ['necrotic'] });
    expect(def.lifesteal).toBe(true);
    expect(def.concentration).toBe(true);
    const action = def.effects?.[0]?.actions?.[0];
    expect(action?.cost).toBe('action');
    expect(action?.def?.resolution).toBe('attack');
    expect(action?.def?.damage).toEqual({ dice: '3d6 + 1d6', types: ['necrotic'] });
    expect(action?.def?.targeting).toEqual({ kind: 'creature', range: 5 });
  });

  it('Flame Blade: клинок даёт атаку с мод. характеристики', () => {
    const spell = makeSpell({ key: 'XPHB:Flame Blade', name: 'Flame Blade', level: 2 });
    const def = automationForSpell(spell, { castLevel: 2 });
    const action = def.effects?.[0]?.actions?.[0];
    expect(def.resolution).toBe('effect');
    expect(def.concentration).toBe(true);
    expect(action?.cost).toBe('action');
    expect(action?.def?.damage).toEqual({ dice: '3d6', types: ['fire'], abilityMod: true });
  });

  it('Sunbeam: луч при касте (слепота) и повтор действием', () => {
    const spell = makeSpell({
      key: 'XPHB:Sunbeam',
      name: 'Sunbeam',
      level: 6,
      save: ['con'],
      saveHalf: true,
      damage: { dice: ['6d8'], types: ['radiant'] },
      areaSpec: { shape: 'line', size: 60, width: 5 },
    });
    const def = automationForSpell(spell, { castLevel: 6 });
    expect(def.resolution).toBe('save');
    expect(def.save).toEqual({ ability: 'con', half: true });
    expect(def.damage?.types).toEqual(['radiant']);
    expect(def.effects?.[0]?.conditions).toEqual(['blinded']);
    const action = def.effects?.[1]?.actions?.[0];
    expect(action?.cost).toBe('action');
    expect(action?.def?.resolution).toBe('save');
    expect(action?.def?.effects?.[0]?.conditions).toEqual(['blinded']);
  });

  it('Conjure Woodland Beings: аура по врагам, кости от круга, Отход бонусом', () => {
    const spell = makeSpell({
      key: 'XPHB:Conjure Woodland Beings',
      name: 'Conjure Woodland Beings',
      level: 4,
      save: ['wis'],
      saveHalf: true,
      damage: { dice: ['5d8'], types: ['force'] },
      higherLevel: ['The damage increases by 1d8 for each spell slot level above 4.'],
    });
    const def = automationForSpell(spell, { castLevel: 5 });
    expect(def.side).toBe('hostile');
    expect(def.damage).toEqual({ dice: '5d8 + 1d8', types: ['force'] });
    expect(def.zone?.side).toBe('hostile');
    expect(def.zone?.triggers?.endOfTurn?.damage?.dice).toBe('5d8 + 1d8');
    expect(def.effects?.[0]?.actions?.[0]).toEqual({
      id: 'disengage',
      name: 'Отход',
      cost: 'bonus',
      baseActionId: 'disengage',
    });
  });

  it("spellAutomated: билдеры (Dragon's Breath, Sunbeam, Vampiric Touch) автоматизированы", () => {
    expect(spellAutomated({ key: "XPHB:Dragon's Breath", automation: 'manual' })).toBe(true);
    expect(spellAutomated({ key: 'XPHB:Sunbeam', automation: 'manual' })).toBe(true);
    expect(spellAutomated({ key: 'XPHB:Vampiric Touch', automation: 'manual' })).toBe(true);
  });

  it('Heat Metal: авто-урон, помеха на атаки/проверки, повтор бонусом', () => {
    const spell = makeSpell({
      key: 'XPHB:Heat Metal',
      name: 'Heat Metal',
      level: 2,
      damage: { dice: ['2d8'], types: ['fire'] },
      higherLevel: ['The damage increases by 1d8 for each spell slot level above 2.'],
    });
    const def = automationForSpell(spell, { castLevel: 3 });
    expect(def.resolution).toBe('auto');
    expect(def.concentration).toBe(true);
    expect(def.damage).toEqual({ dice: '2d8 + 1d8', types: ['fire'] });
    expect(def.effects?.[0]?.modifiers?.map((m) => [m.target, m.mode])).toEqual([
      ['attack', 'disadvantage'],
      ['check', 'disadvantage'],
    ]);
    expect(def.effects?.[0]?.duration).toEqual({ type: 'endOfTurn', of: 'source' });
    const action = def.effects?.[1]?.actions?.[0];
    expect(action?.cost).toBe('bonus');
    expect(action?.def?.resolution).toBe('auto');
    expect(action?.def?.damage).toEqual({ dice: '2d8 + 1d8', types: ['fire'] });
    expect(action?.def?.targeting).toEqual({ kind: 'creature', range: 60 });
  });

  it('Hex/Hunter\'s Mark: метку можно перенести бонусным действием', () => {
    for (const key of ['XPHB:Hex', "XPHB:Hunter's Mark"]) {
      const def = automationForSpell(makeSpell({ key, name: key, automation: 'manual' }));
      const action = def.effects?.[0]?.actions?.[0];
      expect(action?.cost).toBe('bonus');
      expect(action?.def?.retarget).toBe(true);
      expect(action?.def?.targeting).toEqual({ kind: 'creature', range: 90 });
      expect(def.effects?.[1]?.mark).toBe(true);
    }
  });

  it('свет: Faerie Fire dim, Sunbeam sunlight, Light/Daylight — источники света', () => {
    const faerie = automationForSpell(makeSpell({ key: 'XPHB:Faerie Fire', name: 'Faerie Fire', automation: 'manual' }));
    expect(faerie.effects?.[0]?.light).toEqual({ bright: 0, dim: 10 });

    const sun = automationForSpell(makeSpell({ key: 'XPHB:Sunbeam', name: 'Sunbeam', level: 6 }));
    expect(sun.effects?.[1]?.light).toEqual({ bright: 30, dim: 30, sunlight: true });

    const light = automationForSpell(makeSpell({ key: 'XPHB:Light', name: 'Light', level: 0 }));
    expect(light.resolution).toBe('effect');
    expect(light.effects?.[0]?.light).toEqual({ bright: 20, dim: 20 });
    expect(spellAutomated({ key: 'XPHB:Light', automation: 'manual' })).toBe(true);

    const daylight = automationForSpell(makeSpell({ key: 'XPHB:Daylight', name: 'Daylight', level: 3 }));
    expect(daylight.zone?.light).toEqual({ bright: 60, dim: 60, sunlight: true });
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

  it('Hideous Laughter: спас WIS, prone+incapacitated, повтор от урона с преимуществом', () => {
    const def = automationForSpell(
      makeSpell({ key: "XPHB:Tasha's Hideous Laughter", name: 'Hideous Laughter', automation: 'manual' })
    );
    const effect = def.effects?.[0];
    expect(def.resolution).toBe('effect');
    expect(def.save?.ability).toBe('wis');
    expect(def.concentration).toBe(true);
    expect(effect?.conditions).toEqual(['incapacitated', 'prone']);
    expect(effect?.duration).toEqual({ type: 'untilSave', ability: 'wis', dc: 0, timing: 'end' });
    expect(effect?.saveOnDamage).toEqual({ advantage: true });
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
    expect(def.zone?.excludeSource).toBe(true);
  });

  it('Hunger of Hadar: слепота и урон по любому пересечению клеток', () => {
    const def = automationForSpell(
      makeSpell({ key: 'XPHB:Hunger of Hadar', name: 'Hunger of Hadar', automation: 'manual' })
    );
    expect(def.zone?.containment).toBeUndefined();
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

  it('Darkness и Fog Cloud: зоны с вижн-флагами', () => {
    const darkness = automationForSpell(makeSpell({ key: 'XPHB:Darkness', name: 'Darkness', automation: 'manual' }));
    expect(darkness.zone?.area).toEqual({ shape: 'sphere', size: 15 });
    expect(darkness.zone?.flags?.blocksLight).toBe(true);

    const fog = automationForSpell(makeSpell({ key: 'XPHB:Fog Cloud', name: 'Fog Cloud', automation: 'manual' }));
    expect(fog.zone?.area).toEqual({ shape: 'sphere', size: 20 });
    expect(fog.zone?.flags?.obscured).toBe('heavy');
  });

  it('Darkvision: эффект с сенсом 150 фт', () => {
    const def = automationForSpell(makeSpell({ key: 'XPHB:Darkvision', name: 'Darkvision', automation: 'manual' }));
    expect(def.effects?.[0]?.senses).toEqual([{ type: 'darkvision', range: 150 }]);
  });

  it('Cloudkill и Sleet Storm: зоны мглы с триггерами', () => {
    const cloudkill = automationForSpell(
      makeSpell({ key: 'XPHB:Cloudkill', name: 'Cloudkill', automation: 'manual' })
    );
    expect(cloudkill.zone?.area).toEqual({ shape: 'sphere', size: 20 });
    expect(cloudkill.zone?.flags?.obscured).toBe('heavy');
    expect(cloudkill.zone?.triggers?.startOfTurn?.save).toMatchObject({ ability: 'con', half: true });
    expect(cloudkill.zone?.triggers?.startOfTurn?.damage?.dice).toBe('5d8');

    const sleet = automationForSpell(
      makeSpell({ key: 'XPHB:Sleet Storm', name: 'Sleet Storm', automation: 'manual' })
    );
    expect(sleet.zone?.area).toEqual({ shape: 'cylinder', size: 20 });
    expect(sleet.zone?.flags).toMatchObject({ difficultTerrain: true, obscured: 'heavy' });
    expect(sleet.zone?.triggers?.enter?.effects?.[0]?.conditions).toEqual(['prone']);
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
