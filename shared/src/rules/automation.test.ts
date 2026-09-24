import { describe, expect, it } from 'vitest';
import type { ActionDef } from '../domain/actions';
import { automationForAction, automationForSpell, spellAutomated, spellVariantDef } from './automation';
import { findBaseAction } from './actions';
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

  it('Revivify/Spare the Dying/Death Ward — каталог, маркер «не автоматизировано» снят', () => {
    const revivify = makeSpell({ key: 'XPHB:Revivify', name: 'Revivify', level: 3, automation: 'manual' });
    const reviveDef = automationForSpell(revivify);
    expect(reviveDef.resolution).toBe('utility');
    expect(reviveDef.utility).toEqual({ kind: 'revive' });
    expect(spellAutomated(revivify)).toBe(true);

    const spare = makeSpell({ key: 'XPHB:Spare the Dying', name: 'Spare the Dying', level: 0, automation: 'manual' });
    expect(automationForSpell(spare).utility).toEqual({ kind: 'stabilize' });
    expect(spellAutomated(spare)).toBe(true);

    const ward = makeSpell({ key: 'XPHB:Death Ward', name: 'Death Ward', level: 4, automation: 'manual' });
    const wardDef = automationForSpell(ward);
    expect(wardDef.resolution).toBe('effect');
    expect(wardDef.effects?.[0]?.deathWard).toBe(true);
    expect(wardDef.effects?.[0]?.duration).toEqual({ type: 'rounds', rounds: 4800 });
    expect(spellAutomated(ward)).toBe(true);
  });

  it('Heal — плоское лечение 70 (+10/круг выше 6) и снятие состояний', () => {
    const heal = makeSpell({ key: 'XPHB:Heal', name: 'Heal', level: 6, automation: 'manual' });
    const base = automationForSpell(heal);
    expect(base.resolution).toBe('auto');
    expect(base.heal?.dice).toBe('70');
    expect(base.endConditions).toEqual(['blinded', 'deafened', 'poisoned']);
    expect(spellAutomated(heal)).toBe(true);
    expect(automationForSpell(heal, { castLevel: 8 }).heal?.dice).toBe('90');
  });

  it('Lesser Restoration — каталог: endCondition и допустимые состояния', () => {
    const lesser = makeSpell({
      key: 'XPHB:Lesser Restoration',
      name: 'Lesser Restoration',
      level: 2,
      automation: 'manual',
    });
    const def = automationForSpell(lesser);
    expect(def.resolution).toBe('utility');
    expect(def.utility).toEqual({ kind: 'endCondition' });
    expect(def.endConditions).toEqual(['blinded', 'deafened', 'paralyzed', 'poisoned']);
    expect(spellAutomated(lesser)).toBe(true);
  });

  it('Heroism — иммунитет к испугу и temp HP за ход от мода кастера', () => {
    const heroism = makeSpell({ key: 'XPHB:Heroism', name: 'Heroism', level: 1, automation: 'manual' });
    const def = automationForSpell(heroism, { castLevel: 1, spellMod: 3 });
    expect(def.resolution).toBe('effect');
    expect(def.effects?.[0]?.conditionImmunities).toEqual(['frightened']);
    expect(def.effects?.[0]?.triggers?.startOfTurn?.tempHp).toBe(3);
    expect(spellAutomated(heroism)).toBe(true);
    expect(
      automationForSpell(heroism, { castLevel: 1, spellMod: 0 }).effects?.[0]?.triggers
    ).toBeUndefined();
  });

  it('Enhance Ability — преимущество на проверки выбранной характеристики (вариант каста)', () => {
    const enhance = makeSpell({ key: 'XPHB:Enhance Ability', name: 'Enhance Ability', level: 2, automation: 'manual' });
    const def = automationForSpell(enhance, { variant: 'dex' });
    expect(def.resolution).toBe('effect');
    expect(def.effects?.[0]?.modifiers[0]).toMatchObject({
      target: 'check',
      mode: 'advantage',
      filter: { ability: 'dex' },
    });
    expect(def.effects?.[0]?.variant).toBe('dex');
    expect(def.effects?.[0]?.targets).toBe(1);
    expect(automationForSpell(enhance, { castLevel: 4, variant: 'dex' }).effects?.[0]?.targets).toBe(3);
    // Без варианта/с чужим значением — первая характеристика списка.
    expect(automationForSpell(enhance).effects?.[0]?.modifiers[0]?.filter?.ability).toBe('str');
    expect(automationForSpell(enhance, { variant: 'bogus' }).effects?.[0]?.modifiers[0]?.filter?.ability).toBe('str');
    expect(spellAutomated(enhance)).toBe(true);
    expect(spellVariantDef('XPHB:Enhance Ability')).toEqual({ param: 'ability', options: ['str', 'dex', 'int', 'wis', 'cha'] });
  });

  it('Invisibility — невидимость до конца концентрации, обрыв атака/каст, апкаст целей', () => {
    const inv = makeSpell({ key: 'XPHB:Invisibility', name: 'Invisibility', level: 2, automation: 'manual' });
    const def = automationForSpell(inv, { castLevel: 2 });
    expect(def.resolution).toBe('effect');
    expect(def.effects?.[0]?.conditions).toEqual(['invisible']);
    expect(def.effects?.[0]?.breakOn).toEqual(['attack', 'spell']);
    expect(def.effects?.[0]?.concentration).toBe(true);
    expect(def.effects?.[0]?.targets).toBe(1);
    expect(automationForSpell(inv, { castLevel: 4 }).effects?.[0]?.targets).toBe(3);
    expect(spellAutomated(inv)).toBe(true);
  });

  it('Greater Invisibility — невидимость без обрыва', () => {
    const greater = makeSpell({
      key: 'XPHB:Greater Invisibility',
      name: 'Greater Invisibility',
      level: 4,
      automation: 'manual',
    });
    const effect = automationForSpell(greater, { castLevel: 4 }).effects?.[0];
    expect(effect?.conditions).toEqual(['invisible']);
    expect(effect?.breakOn).toBeUndefined();
    expect(effect?.targets).toBe(1);
    expect(spellAutomated(greater)).toBe(true);
  });

  it('See Invisibility — носитель видит невидимых (флаг эффекта)', () => {
    const see = makeSpell({
      key: 'XPHB:See Invisibility',
      name: 'See Invisibility',
      level: 2,
      automation: 'manual',
    });
    const def = automationForSpell(see);
    expect(def.resolution).toBe('effect');
    expect(def.effects?.[0]?.seesInvisible).toBe(true);
    expect(def.effects?.[0]?.to).toBe('self');
    expect(spellAutomated(see)).toBe(true);
  });

  it('Primordial Ward — сопротивление 5 типам и ward-типы для реакции', () => {
    const ward = makeSpell({ key: 'XGE:Primordial Ward', name: 'Primordial Ward', level: 6, automation: 'manual' });
    const def = automationForSpell(ward, { castLevel: 6 });
    expect(def.resolution).toBe('effect');
    expect(def.concentration).toBe(true);
    const effect = def.effects?.[0];
    expect(effect?.to).toBe('self');
    expect(effect?.ward).toEqual(['acid', 'cold', 'fire', 'lightning', 'thunder']);
    expect(effect?.modifiers.filter((m) => m.mode === 'resistance')).toHaveLength(5);
    expect(spellAutomated(ward)).toBe(true);
  });

  it('Protection from Poison — снятие яда, преимущество на сейв от него, сопротивление', () => {
    const pp = makeSpell({
      key: 'XPHB:Protection from Poison',
      name: 'Protection from Poison',
      level: 2,
      automation: 'manual',
    });
    const def = automationForSpell(pp);
    expect(def.resolution).toBe('effect');
    expect(def.endConditions).toEqual(['poisoned']);
    expect(def.effects?.[0]?.modifiers).toEqual([
      { target: 'save', mode: 'advantage', filter: { conditions: ['poisoned'] } },
      { target: 'damage', mode: 'resistance', value: 0, filter: { damageType: 'poison' } },
    ]);
    expect(spellAutomated(pp)).toBe(true);
  });

  it('Warding Bond — +1 AC/спас, сопротивление всем типам, перенос урона', () => {
    const wb = makeSpell({ key: 'XPHB:Warding Bond', name: 'Warding Bond', level: 2, automation: 'manual' });
    const def = automationForSpell(wb);
    expect(def.resolution).toBe('effect');
    const effect = def.effects?.[0];
    expect(effect?.damageLink).toBe(true);
    expect(effect?.modifiers.filter((m) => m.mode === 'resistance')).toHaveLength(16);
    expect(effect?.modifiers.filter((m) => m.target === 'ac' || m.target === 'save')).toHaveLength(2);
    expect(effect?.modifiers.some((m) => m.filter?.damageType === 'magicalSlashing')).toBe(true);
    expect(spellAutomated(wb)).toBe(true);
  });

  it('Magic Weapon — +1/+2/+3 к попаданию и урону, атаки магические', () => {
    const mw = makeSpell({ key: 'XPHB:Magic Weapon', name: 'Magic Weapon', level: 2, automation: 'manual' });
    const base = automationForSpell(mw, { castLevel: 2 });
    expect(base.resolution).toBe('effect');
    expect(base.effects?.[0]?.magicWeapon).toBe(true);
    expect(base.effects?.[0]?.modifiers).toEqual([
      { target: 'attack', mode: 'add', value: 1, filter: { weapon: true } },
      { target: 'damage', mode: 'add', value: 1, filter: { weapon: true } },
    ]);
    expect(automationForSpell(mw, { castLevel: 4 }).effects?.[0]?.modifiers[0]?.value).toBe(2);
    expect(automationForSpell(mw, { castLevel: 6 }).effects?.[0]?.modifiers[0]?.value).toBe(3);
    expect(spellAutomated(mw)).toBe(true);
  });

  it('Помощь: разбудить цель в 5 фт (utility wake)', () => {
    const def = automationForAction(findBaseAction('help')!);
    expect(def?.utility).toMatchObject({ kind: 'wake' });
    expect(def?.targeting).toEqual({ kind: 'creature', range: 5 });
  });

  it('Eyebite — первичный вариант и три действия на ход', () => {
    const eyebite = makeSpell({
      key: 'XPHB:Eyebite',
      name: 'Eyebite',
      level: 6,
      automation: 'manual',
      concentration: true,
      save: ['wis'],
    });
    const def = automationForSpell(eyebite, { variant: 'panicked' });
    expect(def.resolution).toBe('effect');
    expect(def.save).toEqual({ ability: 'wis' });
    expect(def.targeting).toEqual({ kind: 'creature', range: 60 });
    const carrier = def.effects?.[0];
    expect(carrier?.to).toBe('self');
    expect(carrier?.actions?.map((a) => a.id)).toEqual(['eyebite:asleep', 'eyebite:panicked', 'eyebite:sickened']);
    expect(carrier?.actions?.every((a) => a.cost === 'action' && a.def?.targeting?.kind === 'creature')).toBe(true);
    const initial = def.effects?.[1];
    expect(initial?.conditions).toEqual(['frightened']);
    expect(initial?.markSaved).toBe(true);
    const defaultDef = automationForSpell(eyebite);
    expect(defaultDef.effects?.[1]?.conditions).toEqual(['unconscious']);
    expect(defaultDef.effects?.[1]?.wakeOnDamage).toBe(true);
    expect(spellAutomated(eyebite)).toBe(true);
  });

  it('Irresistible Dance — Charmed, танец и повторный спас «Собраться»', () => {
    const dance = makeSpell({
      key: "XPHB:Otto's Irresistible Dance",
      name: 'Irresistible Dance',
      level: 6,
      automation: 'manual',
      concentration: true,
      save: ['wis'],
    });
    const def = automationForSpell(dance);
    expect(def.resolution).toBe('effect');
    expect(def.save).toEqual({ ability: 'wis' });
    expect(def.targeting).toEqual({ kind: 'creature', range: 30 });
    const effect = def.effects?.[0];
    expect(effect?.conditions).toBeUndefined();
    expect(effect?.modifiers.some((m) => m.target === 'speed' && m.mode === 'multiply' && m.value === 0)).toBe(true);
    expect(effect?.modifiers.some((m) => m.target === 'save' && m.mode === 'disadvantage' && m.filter?.ability === 'dex')).toBe(
      true
    );
    expect(effect?.modifiers.some((m) => m.target === 'attack' && m.mode === 'advantage' && m.filter?.direction === 'against')).toBe(
      true
    );
    expect(effect?.escape).toMatchObject({ kind: 'save', ability: 'wis', label: 'Собраться' });
    expect(def.saveSuccess?.[0]?.duration).toEqual({ type: 'endOfTurn', of: 'target' });
    expect(spellAutomated(dance)).toBe(true);
  });

  it('Scatter — до пяти целей, точки в 120 фт от кастера', () => {
    const scatter = makeSpell({ key: 'XGE:Scatter', name: 'Scatter', level: 6, automation: 'manual' });
    const def = automationForSpell(scatter);
    expect(def.resolution).toBe('utility');
    expect(def.utility).toMatchObject({ kind: 'scatter', targets: 5, destinationFeet: 120 });
    expect(spellAutomated(scatter)).toBe(true);
  });

  it("Pass without Trace — аура +10 к Скрытности, привязана к кастеру", () => {
    const passTrace = makeSpell({
      key: 'XPHB:Pass without Trace',
      name: 'Pass without Trace',
      level: 2,
      automation: 'manual',
      concentration: true,
    });
    const def = automationForSpell(passTrace);
    expect(def.resolution).toBe('effect');
    expect(def.zone?.anchor).toBe('source');
    expect(def.zone?.area).toEqual({ shape: 'sphere', size: 30 });
    expect(def.zone?.aura?.effects?.[0]?.modifiers[0]).toMatchObject({
      target: 'check',
      mode: 'add',
      value: 10,
      filter: { skill: 'stealth' },
    });
    expect(spellAutomated(passTrace)).toBe(true);
  });

  it('Searing Smite — урон при попадании и в начале хода, спас CON до успеха', () => {
    const searing = makeSpell({
      key: 'XPHB:Searing Smite',
      name: 'Searing Smite',
      level: 1,
      automation: 'manual',
      damage: { dice: ['1d6'], types: ['fire'] },
      save: ['con'],
      higherLevel: ['All the damage increases by 1d6 for each spell slot level above 1.'],
    });
    const def = automationForSpell(searing, { castLevel: 2 });
    expect(def.resolution).toBe('auto');
    expect(def.damage?.dice).toBe('1d6 + 1d6');
    const effect = def.effects?.[0];
    expect(effect?.duration).toEqual({ type: 'untilSave', ability: 'con', dc: 0, timing: 'start' });
    expect(effect?.triggers?.startOfTurn?.damage?.dice).toBe('1d6 + 1d6');
    expect(spellAutomated(searing)).toBe(true);
  });

  it('Ensnaring Strike — спас STR, опутан и урон в начале хода, выпутывание', () => {
    const ensnaring = makeSpell({
      key: 'XPHB:Ensnaring Strike',
      name: 'Ensnaring Strike',
      level: 1,
      automation: 'manual',
      damage: { dice: ['1d6'], types: ['piercing'] },
      save: ['str'],
      concentration: true,
      higherLevel: ['The damage increases by 1d6 for each spell slot level above 1.'],
    });
    const def = automationForSpell(ensnaring, { castLevel: 1 });
    expect(def.resolution).toBe('save');
    expect(def.concentration).toBe(true);
    expect(def.save).toEqual({ ability: 'str' });
    const effect = def.effects?.[0];
    expect(effect?.conditions).toEqual(['restrained']);
    expect(effect?.escape).toEqual({ ability: 'str', skill: 'athletics' });
    expect(effect?.triggers?.startOfTurn?.damage?.dice).toBe('1d6');
    expect(spellAutomated(ensnaring)).toBe(true);
  });

  it('XPHB-смайты — доп. кости с апкастом, спас и эффекты при провале', () => {
    const divine = makeSpell({ key: 'XPHB:Divine Smite', name: 'Divine Smite', level: 1 });
    expect(automationForSpell(divine, { castLevel: 3 }).damage).toEqual({ dice: '2d8 + 1d8 + 1d8', types: ['radiant'] });
    expect(spellAutomated(divine)).toBe(true);

    const thunderous = makeSpell({ key: 'XPHB:Thunderous Smite', name: 'Thunderous Smite', level: 1 });
    const thunder = automationForSpell(thunderous, { castLevel: 2 });
    expect(thunder.damage?.dice).toBe('2d6 + 1d6');
    expect(thunder.save).toEqual({ ability: 'str' });
    expect(thunder.force).toEqual({ kind: 'push', feet: 10 });
    expect(thunder.effects?.[0]?.conditions).toEqual(['prone']);

    const wrathful = makeSpell({ key: 'XPHB:Wrathful Smite', name: 'Wrathful Smite', level: 1 });
    const wrath = automationForSpell(wrathful, { castLevel: 2 });
    expect(wrath.damage?.dice).toBe('1d6 + 1d6');
    expect(wrath.concentration).toBe(true);
    expect(wrath.effects?.[0]?.conditions).toEqual(['frightened']);
    expect(wrath.effects?.[0]?.duration).toEqual({ type: 'untilSave', ability: 'wis', dc: 0, timing: 'start' });

    const blinding = makeSpell({ key: 'XPHB:Blinding Smite', name: 'Blinding Smite', level: 3 });
    const blind = automationForSpell(blinding, { castLevel: 4 });
    expect(blind.damage?.dice).toBe('3d8 + 1d8');
    expect(blind.effects?.[0]?.conditions).toEqual(['blinded']);
    expect(blind.effects?.[0]?.duration).toEqual({ type: 'untilSave', ability: 'con', dc: 0, timing: 'start' });

    const shining = makeSpell({ key: 'XPHB:Shining Smite', name: 'Shining Smite', level: 2 });
    const shine = automationForSpell(shining, { castLevel: 3 });
    expect(shine.damage?.dice).toBe('2d6 + 1d6');
    expect(shine.effects?.[0]?.light).toEqual({ bright: 0, dim: 5 });
    expect(shine.effects?.[0]?.conditionImmunities).toEqual(['invisible']);
    expect(shine.effects?.[0]?.modifiers[0]).toMatchObject({
      target: 'attack',
      mode: 'advantage',
      filter: { direction: 'against' },
    });

    const staggering = makeSpell({ key: 'XPHB:Staggering Smite', name: 'Staggering Smite', level: 4 });
    const stagger = automationForSpell(staggering);
    expect(stagger.damage?.dice).toBe('4d6');
    expect(stagger.effects?.[0]?.duration).toEqual({ type: 'endOfTurn', of: 'source' });
    expect(stagger.effects?.[0]?.conditions).toEqual(['stunned']);

    const banishing = makeSpell({ key: 'XPHB:Banishing Smite', name: 'Banishing Smite', level: 5 });
    const banish = automationForSpell(banishing, { castLevel: 7 });
    expect(banish.damage?.dice).toBe('5d10');
    expect(banish.save).toEqual({ ability: 'cha' });
    expect(banish.concentration).toBe(true);
    expect(banish.effects?.[0]?.banish).toBe(true);
    expect(banish.effects?.[0]?.duration).toEqual({ type: 'rounds', rounds: 10 });
    expect(banish.effects?.[0]?.conditions).toEqual(['incapacitated']);
  });

  it('лимит «1 минута» = 10 раундов; больше минуты и instant — без лимита', () => {
    const bless = makeSpell({
      key: 'XPHB:Bless',
      name: 'Bless',
      level: 1,
      duration: [{ type: 'timed', concentration: true, duration: { type: 'minute', amount: 1 } }],
    });
    expect(automationForSpell(bless).maxRounds).toBe(10);

    const hex = makeSpell({
      key: 'XPHB:Hex',
      name: 'Hex',
      level: 1,
      duration: [{ type: 'timed', concentration: true, duration: { type: 'hour', amount: 1 } }],
    });
    expect(automationForSpell(hex).maxRounds).toBeUndefined();

    const guardians = makeSpell({
      key: 'XPHB:Spirit Guardians',
      name: 'Spirit Guardians',
      level: 3,
      duration: [{ type: 'timed', concentration: true, duration: { type: 'minute', amount: 10 } }],
    });
    expect(automationForSpell(guardians).maxRounds).toBeUndefined();

    const thunderous = makeSpell({ key: 'XPHB:Thunderous Smite', name: 'Thunderous Smite', level: 1 });
    expect(automationForSpell(thunderous).maxRounds).toBeUndefined();
  });

  it('Freedom of Movement — каталог: иммунитеты, скорость и местность', () => {
    const fom = makeSpell({ key: 'XPHB:Freedom of Movement', name: 'Freedom of Movement', level: 4, automation: 'manual' });
    const def = automationForSpell(fom);
    const effect = def.effects?.[0];
    expect(def.resolution).toBe('effect');
    expect(effect?.conditionImmunities).toEqual(['paralyzed', 'restrained']);
    expect(effect?.immuneToSpeedReduction).toBe(true);
    expect(effect?.ignoresDifficultTerrain).toBe(true);
    expect(effect?.duration).toEqual({ type: 'rounds', rounds: 600 });
    expect(spellAutomated(fom)).toBe(true);
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

  it('зоны с перемещением: Moonbeam, Flaming Sphere, Faithful Hound', () => {
    const moonbeam = automationForSpell(
      makeSpell({
        key: 'XPHB:Moonbeam',
        name: 'Moonbeam',
        level: 2,
        save: ['con'],
        saveHalf: true,
        damage: { dice: ['2d10'], types: ['radiant'] },
        higherLevel: ['The damage increases by 1d10 for each spell slot level above 2.'],
      }),
      { castLevel: 3 }
    );
    expect(moonbeam.damage).toEqual({ dice: '2d10 + 1d10', types: ['radiant'] });
    expect(moonbeam.zone?.light).toEqual({ bright: 0, dim: 5 });
    expect(moonbeam.zone?.triggers?.enter?.damage?.dice).toBe('2d10 + 1d10');
    expect(moonbeam.zone?.actions?.[0]).toMatchObject({ cost: 'action', def: { utility: { kind: 'moveZone', amount: 60 } } });

    const sphere = automationForSpell(
      makeSpell({
        key: 'XPHB:Flaming Sphere',
        name: 'Flaming Sphere',
        level: 2,
        save: ['dex'],
        saveHalf: true,
        damage: { dice: ['2d6'], types: ['fire'] },
      })
    );
    expect(sphere.resolution).toBe('effect');
    expect(sphere.damage).toBeUndefined();
    expect(sphere.zone?.triggers?.endOfTurn?.damage?.dice).toBe('2d6');
    expect(sphere.zone?.light).toEqual({ bright: 20, dim: 20 });
    expect(sphere.zone?.actions?.[0]).toMatchObject({ cost: 'bonus', def: { utility: { kind: 'moveZone', amount: 30 } } });

    const hound = automationForSpell(
      makeSpell({ key: "XPHB:Mordenkainen's Faithful Hound", name: 'Faithful Hound', level: 4, save: ['dex'] })
    );
    expect(hound.side).toBe('hostile');
    expect(hound.zone?.triggers?.endOfTurn).toMatchObject({
      save: { ability: 'dex' },
      damage: { dice: '4d8', types: ['force'] },
    });
    expect(hound.zone?.actions?.[0]).toMatchObject({ cost: 'action', def: { utility: { kind: 'moveZone', amount: 30 } } });
  });

  it('Call Lightning: туча-цилиндр 60, удар 5 фт при касте и повтор действием', () => {
    const spell = makeSpell({
      key: 'XPHB:Call Lightning',
      name: 'Call Lightning',
      level: 3,
      save: ['dex'],
      saveHalf: true,
      damage: { dice: ['3d10'], types: ['lightning'] },
      higherLevel: ['The damage increases by 1d10 for each spell slot level above 3.'],
    });
    const def = automationForSpell(spell, { castLevel: 4 });
    expect(def.resolution).toBe('save');
    expect(def.concentration).toBe(true);
    expect(def.damage).toEqual({ dice: '3d10 + 1d10', types: ['lightning'] });
    expect(def.area).toEqual({ shape: 'sphere', size: 5 });
    expect(def.zone?.area).toEqual({ shape: 'cylinder', size: 60 });
    const strike = def.zone?.actions?.[0];
    expect(strike?.cost).toBe('action');
    expect(strike?.def?.save).toEqual({ ability: 'dex', half: true });
    expect(strike?.def?.damage).toEqual({ dice: '3d10 + 1d10', types: ['lightning'] });
    expect(strike?.def?.targeting).toEqual({ kind: 'area', area: { shape: 'sphere', size: 5 }, range: 60 });
    expect(spellAutomated({ key: 'XPHB:Call Lightning', automation: 'manual' })).toBe(true);
  });

  it('эффектные дебаффы несут спас и концентрацию (Hold Person)', () => {
    const def = automationForSpell(makeSpell({ key: 'XPHB:Hold Person', name: 'Hold Person', automation: 'manual' }));
    expect(def.save).toEqual({ ability: 'wis', half: undefined });
    expect(def.concentration).toBe(true);
  });

  it('Banishment: спас CHA, 10 раундов концентрации и флаг изгнания', () => {
    const def = automationForSpell(makeSpell({ key: 'XPHB:Banishment', name: 'Banishment', automation: 'manual' }));
    expect(def.resolution).toBe('effect');
    expect(def.save).toEqual({ ability: 'cha', half: undefined });
    expect(def.concentration).toBe(true);
    const effect = def.effects?.[0];
    expect(effect?.duration).toEqual({ type: 'rounds', rounds: 10 });
    expect(effect?.concentration).toBe(true);
    expect(effect?.conditions).toEqual(['incapacitated']);
    expect(effect?.banish).toBe(true);
    expect(spellAutomated({ key: 'XPHB:Banishment', automation: 'manual' })).toBe(true);
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
    expect(def.side).toBe('hostile');
    expect(def.zone?.anchor).toBe('source');
    expect(def.zone?.side).toBe('hostile');
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

  it('Protection from Energy: выбранный тип — сопротивление, вариант в подписи', () => {
    const spell = makeSpell({
      key: 'XPHB:Protection from Energy',
      name: 'Protection from Energy',
      level: 3,
      automation: 'manual',
    });
    const fire = automationForSpell(spell, { variant: 'fire' });
    expect(fire.resolution).toBe('effect');
    expect(fire.concentration).toBe(true);
    const effect = fire.effects?.[0];
    expect(effect?.modifiers).toEqual([
      { target: 'damage', mode: 'resistance', value: 0, filter: { damageType: 'fire' } },
    ]);
    expect(effect?.variant).toBe('fire');
    expect(automationForSpell(spell).effects?.[0]?.variant).toBe('acid');
    expect(spellAutomated({ key: 'XPHB:Protection from Energy', automation: 'manual' })).toBe(true);
    // Вариант damageType не должен уходить в билдер Dragon's Breath (конус).
    expect(fire.area).toBeUndefined();
  });

  it('Beacon of Hope: авто-цели союзников, преимущество WIS/death-сейвов, максимум лечения', () => {
    const def = automationForSpell(
      makeSpell({ key: 'XPHB:Beacon of Hope', name: 'Beacon of Hope', level: 3, automation: 'manual' })
    );
    expect(def.resolution).toBe('effect');
    expect(def.concentration).toBe(true);
    expect(def.autoTargets).toEqual({ feet: 30, side: 'ally', includeSelf: true });
    const effect = def.effects?.[0];
    expect(effect?.modifiers).toEqual([{ target: 'save', mode: 'advantage', filter: { ability: 'wis' } }]);
    expect(effect?.maximizeHealing).toBe(true);
    expect(effect?.deathSaveAdvantage).toBe(true);
    expect(spellAutomated({ key: 'XPHB:Beacon of Hope', automation: 'manual' })).toBe(true);
  });

  it('Aura of Life: аура союзников — сопротивление некротике и подъём до 1 HP в начале хода', () => {
    const def = automationForSpell(
      makeSpell({ key: 'XPHB:Aura of Life', name: 'Aura of Life', level: 4, automation: 'manual' })
    );
    expect(def.zone?.side).toBe('ally');
    expect(def.zone?.anchor).toBe('source');
    expect(def.zone?.aura?.effects?.[0]?.modifiers).toEqual([
      { target: 'damage', mode: 'resistance', value: 0, filter: { damageType: 'necrotic' } },
    ]);
    expect(def.zone?.triggers?.startOfTurn?.healTo).toBe(1);
    expect(spellAutomated({ key: 'XPHB:Aura of Life', automation: 'manual' })).toBe(true);
  });

  it('Aura of Purity: сопротивление яду, иммунитет к отравлению, преимущество сейвов против состояний', () => {    const def = automationForSpell(
      makeSpell({ key: 'XPHB:Aura of Purity', name: 'Aura of Purity', level: 4, automation: 'manual' })
    );
    const effect = def.zone?.aura?.effects?.[0];
    expect(def.zone?.side).toBe('ally');
    expect(effect?.conditionImmunities).toEqual(['poisoned']);
    expect(effect?.modifiers[0]).toEqual({
      target: 'damage',
      mode: 'resistance',
      value: 0,
      filter: { damageType: 'poison' },
    });
    expect(effect?.modifiers[1]?.filter?.conditions).toEqual([
      'blinded',
      'charmed',
      'deafened',
      'frightened',
      'poisoned',
      'stunned',
    ]);
    expect(spellAutomated({ key: 'XPHB:Aura of Purity', automation: 'manual' })).toBe(true);
  });

  it('Skill Empowerment: выбранный навык — модификатор $proficiency (экспертиза)', () => {
    const spell = makeSpell({
      key: 'XGE:Skill Empowerment',
      name: 'Skill Empowerment',
      level: 5,
      automation: 'manual',
    });
    const def = automationForSpell(spell, { variant: 'stealth' });
    expect(def.resolution).toBe('effect');
    expect(def.concentration).toBe(true);
    const effect = def.effects?.[0];
    expect(effect?.modifiers).toEqual([
      { target: 'check', mode: 'add', value: '$proficiency', filter: { skill: 'stealth' } },
    ]);
    expect(effect?.variant).toBe('stealth');
    // Без варианта — первый навык списка.
    expect(automationForSpell(spell).effects?.[0]?.variant).toBeDefined();
    expect(spellAutomated({ key: 'XGE:Skill Empowerment', automation: 'manual' })).toBe(true);
  });

  it('Circle of Power: аура союзников — преимущество сейвов против магии, успех без урона', () => {
    const def = automationForSpell(
      makeSpell({ key: 'XPHB:Circle of Power', name: 'Circle of Power', level: 5, automation: 'manual' })
    );
    expect(def.zone?.side).toBe('ally');
    expect(def.zone?.anchor).toBe('source');
    const aura = def.zone?.aura?.effects?.[0];
    expect(aura?.modifiers).toEqual([{ target: 'save', mode: 'advantage', filter: { magical: true } }]);
    expect(aura?.saveNoDamage).toBe(true);
    expect(spellAutomated({ key: 'XPHB:Circle of Power', automation: 'manual' })).toBe(true);
  });

  it('Far Step: телепорт 60 фт при касте + бонусный повтор действием', () => {
    const spell = makeSpell({ key: 'XGE:Far Step', name: 'Far Step', level: 5, automation: 'manual' });
    const def = automationForSpell(spell);
    expect(def.resolution).toBe('utility');
    expect(def.concentration).toBe(true);
    expect(def.utility).toEqual({ kind: 'teleport', amount: 60 });
    const action = def.effects?.[0]?.actions?.[0];
    expect(action?.cost).toBe('bonus');
    expect(action?.def?.utility).toEqual({ kind: 'teleport', amount: 60 });
    expect(action?.def?.targeting).toEqual({ kind: 'point', range: 60 });
    expect(spellAutomated({ key: 'XGE:Far Step', automation: 'manual' })).toBe(true);
  });

  it('Armor of Agathys: врем. HP и ответный холод растут с кругом', () => {
    const spell = makeSpell({
      key: 'XPHB:Armor of Agathys',
      name: 'Armor of Agathys',
      level: 1,
      automation: 'manual',
    });
    const base = automationForSpell(spell);
    expect(base.resolution).toBe('effect');
    const effect = base.effects?.[0];
    expect(effect?.tempHp).toBe(5);
    expect(effect?.retaliate).toEqual({ damageType: 'cold', amount: 5 });
    const upcast = automationForSpell(spell, { castLevel: 3 });
    expect(upcast.effects?.[0]?.tempHp).toBe(15);
    expect(upcast.effects?.[0]?.retaliate).toEqual({ damageType: 'cold', amount: 15 });
    expect(spellAutomated({ key: 'XPHB:Armor of Agathys', automation: 'manual' })).toBe(true);
  });

  it('Protection from Evil and Good: помеха шести типам и scoped-иммунитет', () => {
    const spell = makeSpell({
      key: 'XPHB:Protection from Evil and Good',
      name: 'Protection from Evil and Good',
      level: 1,
      automation: 'manual',
    });
    const def = automationForSpell(spell);
    expect(def.concentration).toBe(true);
    const effect = def.effects?.[0];
    const types = ['aberration', 'celestial', 'elemental', 'fey', 'fiend', 'undead'];
    expect(effect?.modifiers[0]).toEqual({
      target: 'attack',
      mode: 'disadvantage',
      filter: { direction: 'against', creatureTypes: types },
    });
    expect(effect?.modifiers[1]).toEqual({
      target: 'save',
      mode: 'advantage',
      filter: { conditions: ['charmed', 'frightened'] },
    });
    expect(effect?.conditionImmunitiesFrom).toEqual({ conditions: ['charmed', 'frightened'], types });
    expect(spellAutomated({ key: 'XPHB:Protection from Evil and Good', automation: 'manual' })).toBe(true);
  });

  it('Sanctuary: спас Мдр атакующего или потеря атаки; обрыв на attack/spell/damage', () => {
    const spell = makeSpell({ key: 'XPHB:Sanctuary', name: 'Sanctuary', level: 1, automation: 'manual' });
    const def = automationForSpell(spell);
    expect(def.resolution).toBe('effect');
    const effect = def.effects?.[0];
    expect(effect?.sanctuary).toBe(true);
    expect(effect?.breakOn).toEqual(['attack', 'spell', 'damage']);
    expect(spellAutomated({ key: 'XPHB:Sanctuary', automation: 'manual' })).toBe(true);
  });

  it('Command: вариант-приказ (halt/grovel/flee), апкаст и исключение нежити', () => {
    const spell = makeSpell({ key: 'XPHB:Command', name: 'Command', level: 1, automation: 'manual' });
    const halt = automationForSpell(spell, { variant: 'halt' });
    expect(halt.resolution).toBe('effect');
    expect(halt.save).toEqual({ ability: 'wis' });
    expect(halt.excludeCreatureTypes).toEqual(['undead']);
    const effect = halt.effects?.[0];
    expect(effect?.modifiers).toEqual([{ target: 'speed', mode: 'multiply', value: 0 }]);
    expect(effect?.restrictions).toEqual({ noActions: true, noBonus: true });
    expect(effect?.variant).toBe('halt');
    expect(effect?.duration).toEqual({ type: 'endOfTurn', of: 'target' });

    const grovel = automationForSpell(spell, { variant: 'grovel' });
    expect(grovel.effects?.[0]?.conditions).toEqual(['prone']);
    expect(grovel.effects?.[0]?.modifiers).toEqual([{ target: 'speed', mode: 'multiply', value: 0 }]);

    const flee = automationForSpell(spell, { variant: 'flee' });
    expect(flee.effects?.[0]?.modifiers).toEqual([]);
    expect(flee.effects?.[0]?.conditions).toBeUndefined();
    expect(spellAutomated({ key: 'XPHB:Command', automation: 'manual' })).toBe(true);
  });
});

describe('automationForAction', () => {
  it('Misty Step: телепорт до 30 футов (utility)', () => {
    const def = automationForSpell(makeSpell({ key: 'XPHB:Misty Step', name: 'Misty Step', level: 2 }), {});
    expect(def.resolution).toBe('utility');
    expect(def.utility).toEqual({ kind: 'teleport', amount: 30 });
  });

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

describe('Green-Flame Blade (клинок-кантрип)', () => {
  const spell = () => makeSpell({ key: 'TCE:Green-Flame Blade', name: 'Green-Flame Blade', level: 0 });

  it('билдер: оружейная атака правой рукой, райдер и вторичный урон по уровням', () => {
    const l1 = automationForSpell(spell(), { characterLevel: 1 });
    expect(l1.resolution).toBe('attack');
    expect(l1.attack).toEqual({ rangeType: 'melee' });
    expect(l1.weaponAttack?.riderDice).toBeUndefined();
    expect(l1.weaponAttack?.secondary).toEqual({ rangeFeet: 5, damageType: 'fire' });

    const l5 = automationForSpell(spell(), { characterLevel: 5 });
    expect(l5.weaponAttack?.riderDice).toBe('1d8fire');
    expect(l5.weaponAttack?.secondary?.dice).toBe('1d8');

    const l11 = automationForSpell(spell(), { characterLevel: 11 });
    expect(l11.weaponAttack?.riderDice).toBe('2d8fire');
    expect(l11.weaponAttack?.secondary?.dice).toBe('2d8');

    const l17 = automationForSpell(spell(), { characterLevel: 17 });
    expect(l17.weaponAttack?.riderDice).toBe('3d8fire');
    expect(l17.weaponAttack?.secondary?.dice).toBe('3d8');
    expect(spellAutomated(spell())).toBe(true);
  });
});
