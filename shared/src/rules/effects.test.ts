import { describe, expect, it } from 'vitest';
import {
  attackRollParts,
  checkRollParts,
  combineRollMode,
  combineRollParts,
  concentrationDc,
  concentratingEffects,
  conditionImmunities,
  damageLinks,
  damageRollParts,
  effectDefenses,
  effectDurationParts,
  effectSummaryParts,
  evalModifierValue,
  hasConcentration,
  ignoresDifficultTerrain,
  immuneToSpeedReduction,
  isDiceValue,
  magicalDamageType,
  magicWeaponAttacks,
  modifiedValue,
  restrictionsFor,
  rollParts,
  saveRollParts,
  withRollParts,
} from './effects';
import { spellAutomated, spellEffectDefs } from './automation';
import type { EffectInstance, Modifier } from '../domain/effects';

let seq = 0;
const mod = (partial: Omit<Modifier, 'id'>): Modifier => ({ id: `m${++seq}`, ...partial });

const effect = (partial: Partial<EffectInstance>): EffectInstance => ({
  id: `e${++seq}`,
  name: 'Effect',
  duration: { type: 'concentration' },
  modifiers: [],
  ...partial,
});

describe('значения модификаторов', () => {
  it('числа и формулы с характеристиками', () => {
    expect(evalModifierValue(5)).toBe(5);
    expect(evalModifierValue('13+dex', { dex: 16 })).toBe(16);
    expect(evalModifierValue('dex+2', { dex: 8 })).toBe(1);
    expect(evalModifierValue('-2')).toBe(-2);
    expect(evalModifierValue('1d4', { dex: 10 })).toBe(0);
  });

  it('кости распознаются отдельно', () => {
    expect(isDiceValue('1d4')).toBe(true);
    expect(isDiceValue('-2d6')).toBe(true);
    expect(isDiceValue('13+dex')).toBe(false);
    expect(isDiceValue(3)).toBe(false);
  });
});

describe('части броска', () => {
  it('собирает слагаемые, кости и преимущество', () => {
    const parts = rollParts([
      mod({ target: 'attack', mode: 'add', value: 2 }),
      mod({ target: 'attack', mode: 'add', value: '1d4' }),
      mod({ target: 'attack', mode: 'advantage' }),
    ]);
    expect(parts).toEqual({ flat: 2, dice: ['1d4'], mode: 'a' });
  });

  it('преимущество и помеха взаимно гасятся при объединении', () => {
    const combined = combineRollParts([
      { flat: 1, dice: [], mode: 'a' },
      { flat: 0, dice: ['1d4'], mode: 'd' },
    ]);
    expect(combined.flat).toBe(1);
    expect(combined.dice).toEqual(['1d4']);
    expect(combined.mode).toBeUndefined();
  });

  it('5e: два преимущества и одна помеха — обычный бросок', () => {
    const parts = rollParts([
      mod({ target: 'attack', mode: 'advantage' }),
      mod({ target: 'attack', mode: 'advantage' }),
      mod({ target: 'attack', mode: 'disadvantage' }),
    ]);
    expect(parts.mode).toBeUndefined();
  });

  it('дописывает части к выражению броска', () => {
    expect(withRollParts('d20+5', { flat: 2, dice: ['1d4'], mode: 'a' })).toBe('d20+5+2+1d4');
    expect(withRollParts('d6', { flat: -1, dice: ['-1d4'] })).toBe('d6-1-1d4');
    expect(withRollParts('d20', { flat: 0, dice: [] })).toBe('d20');
  });
});

describe('атака: эффекты атакующего и защитника', () => {
  it('Blur на защитнике даёт помеху атакующему', () => {
    const blur = effect({ modifiers: [mod({ target: 'attack', mode: 'disadvantage' })] });
    expect(attackRollParts(undefined, [blur], { rangeType: 'melee' }).mode).toBe('d');
  });

  it('Faerie Fire на защитнике даёт преимущество атакующему', () => {
    const faerie = effect({ modifiers: [mod({ target: 'attack', mode: 'advantage' })] });
    expect(attackRollParts([], [faerie], {}).mode).toBe('a');
  });

  it('direction разделяет свои атаки и атаки по носителю (Reckless Attack)', () => {
    const own = effect({ modifiers: [mod({ target: 'attack', mode: 'advantage', filter: { direction: 'self' } })] });
    const against = effect({ modifiers: [mod({ target: 'attack', mode: 'advantage', filter: { direction: 'against' } })] });
    expect(attackRollParts([own], undefined, {}).mode).toBe('a');
    expect(attackRollParts([against], undefined, {}).mode).toBeUndefined();
    expect(attackRollParts(undefined, [against], {}).mode).toBe('a');
    expect(attackRollParts(undefined, [own], {}).mode).toBeUndefined();
  });

  it('Bless добавляет 1d4 к попаданию', () => {
    const bless = effect({ modifiers: [mod({ target: 'attack', mode: 'add', value: '1d4' })] });
    const parts = attackRollParts([bless], undefined, {});
    expect(parts.dice).toEqual(['1d4']);
  });

  it('targetId-фильтр (Hex) действует только по метке', () => {
    const hex = effect({
      modifiers: [mod({ target: 'damage', mode: 'add', value: '1d6', filter: { targetId: 't2' } })],
    });
    expect(damageRollParts([hex], { targetId: 't2' }).dice).toEqual(['1d6']);
    expect(damageRollParts([hex], { targetId: 't3' }).dice).toEqual([]);
    expect(damageRollParts([hex], {}).dice).toEqual([]);
  });
});

describe('спасброски', () => {
  it('модификатор действует только на свою характеристику', () => {
    const bless = effect({ modifiers: [mod({ target: 'save', mode: 'add', value: '1d4' })] });
    expect(saveRollParts([bless], 'con').dice).toEqual(['1d4']);
    const dexOnly = effect({ modifiers: [mod({ target: 'save', mode: 'add', value: 2, filter: { ability: 'dex' } })] });
    expect(saveRollParts([dexOnly], 'dex').flat).toBe(2);
    expect(saveRollParts([dexOnly], 'con').flat).toBe(0);
  });
});

describe('производные значения', () => {
  it('set — нижняя граница, add и multiply складываются', () => {
    const mageArmor = effect({ modifiers: [mod({ target: 'ac', mode: 'set', value: '13+dex' })] });
    expect(modifiedValue(12, [mageArmor], 'ac', {}, { dex: 16 })).toBe(16);
    expect(modifiedValue(15, [mageArmor], 'ac', {}, { dex: 12 })).toBe(15);
    const haste = effect({
      modifiers: [
        mod({ target: 'ac', mode: 'add', value: 2 }),
        mod({ target: 'speed', mode: 'multiply', value: 2 }),
      ],
    });
    const longstrider = effect({ modifiers: [mod({ target: 'speed', mode: 'add', value: 10 })] });
    expect(modifiedValue(10, [haste], 'ac')).toBe(12);
    expect(modifiedValue(30, [haste, longstrider], 'speed')).toBe(80);

    // Дробный множитель (Slow/Spirit Guardians): 0.5 не округляется до 1.
    const slow = effect({ modifiers: [mod({ target: 'speed', mode: 'multiply', value: 0.5 })] });
    expect(modifiedValue(30, [slow], 'speed')).toBe(15);
  });

  it('защиты из эффектов', () => {
    const stoneskin = effect({
      modifiers: [
        mod({ target: 'damage', mode: 'resistance', value: 0, filter: { damageType: 'slashing' } }),
        mod({ target: 'damage', mode: 'resistance', value: 0, filter: { damageType: 'piercing' } }),
      ],
    });
    const defenses = effectDefenses([stoneskin]);
    expect(defenses.map((d) => `${d.type}:${d.damageType}`)).toEqual(['resistance:slashing', 'resistance:piercing']);
  });
});

describe('концентрация', () => {
  it('СЛ спасброска — 10 или половина урона', () => {
    expect(concentrationDc(0)).toBe(10);
    expect(concentrationDc(18)).toBe(10);
    expect(concentrationDc(21)).toBe(10);
    expect(concentrationDc(22)).toBe(11);
    expect(concentrationDc(100)).toBe(50);
  });

  it('концентрация ищется по источнику', () => {
    const a = effect({ concentration: true, sourceId: 'token-a' });
    const b = effect({ concentration: true, sourceId: 'token-b' });
    expect(concentratingEffects([a, b], 'token-a').map((e) => e.id)).toEqual([a.id]);
    expect(hasConcentration([a, b], 'token-b')).toBe(true);
    expect(hasConcentration([a], 'token-c')).toBe(false);
  });

  it('структурные части длительности', () => {
    expect(effectDurationParts({ type: 'rounds', rounds: 3 })).toEqual({
      key: 'domain.effect.duration.rounds',
      params: { n: 3 },
    });
    expect(effectDurationParts({ type: 'untilSave', ability: 'wis', dc: 13, timing: 'start' }).key).toBe(
      'domain.effect.duration.untilSaveStart'
    );
    expect(effectDurationParts({ type: 'untilSave', ability: 'wis', dc: 13, timing: 'end' }).key).toBe(
      'domain.effect.duration.untilSaveEnd'
    );
    expect(effectDurationParts({ type: 'endOfTurn', of: 'target' }).key).toBe('domain.effect.duration.endOfTurnTarget');
    expect(effectDurationParts({ type: 'endOfTurn', of: 'source' }).key).toBe(
      'domain.effect.duration.endOfTurnSource'
    );
    expect(effectDurationParts({ type: 'concentration' })).toEqual({ key: 'domain.effect.duration.concentration' });
    expect(effectDurationParts({ type: 'permanent' }).key).toBe('domain.effect.duration.permanent');
  });
});

describe('проверки с эффектами (checkRollParts)', () => {
  it('преимущество по характеристике и флэт по навыку — только при совпадении фильтра', () => {
    const enhance = effect({ modifiers: [mod({ target: 'check', mode: 'advantage', filter: { ability: 'str' } })] });
    expect(checkRollParts([enhance], { ability: 'str' }).mode).toBe('a');
    expect(checkRollParts([enhance], { ability: 'dex' }).mode).toBeUndefined();

    const passTrace = effect({
      modifiers: [mod({ target: 'check', mode: 'add', value: 10, filter: { skill: 'stealth' } })],
    });
    expect(checkRollParts([passTrace], { ability: 'dex', skill: 'stealth' })).toMatchObject({ flat: 10 });
    expect(checkRollParts([passTrace], { ability: 'dex', skill: 'athletics' })).toMatchObject({ flat: 0 });
  });

  it('фильтр спасброска по состоянию (Protection from Poison) и связи урона (Warding Bond)', () => {
    const pp = effect({ modifiers: [mod({ target: 'save', mode: 'advantage', filter: { condition: 'poisoned' } })] });
    expect(saveRollParts([pp], 'con', undefined, 'poisoned').mode).toBe('a');
    expect(saveRollParts([pp], 'con', undefined, 'frightened').mode).toBeUndefined();
    const wb = effect({ damageLink: { tokenId: 't2' } });
    expect(damageLinks([wb])).toEqual(['t2']);
    expect(effectSummaryParts(wb)).toEqual([{ key: 'domain.effect.damageLink' }]);
  });

  it('Magic Weapon: флаг магического оружия и подмена физтипа', () => {
    const mw = effect({ magicWeapon: true });
    expect(magicWeaponAttacks([mw])).toBe(true);
    expect(magicWeaponAttacks([])).toBe(false);
    expect(effectSummaryParts(mw)).toEqual([{ key: 'domain.effect.magicWeapon' }]);
    expect(magicalDamageType('slashing')).toBe('magicalSlashing');
    expect(magicalDamageType('piercing')).toBe('magicalPiercing');
    expect(magicalDamageType('bludgeoning')).toBe('magicalBludgeoning');
    expect(magicalDamageType('fire')).toBe('fire');
    expect(magicalDamageType(undefined)).toBeUndefined();
  });

  it('combineRollMode: преимущество эффекта гасится помехой игрока', () => {
    expect(combineRollMode({ flat: 0, dice: [], mode: 'a' }, 'd')).toBeUndefined();
    expect(combineRollMode({ flat: 0, dice: [], mode: 'a' }, 'a')).toBe('a');
    expect(combineRollMode({ flat: 0, dice: [] }, 'd')).toBe('d');
    expect(combineRollMode({ flat: 0, dice: [] }, null)).toBeUndefined();
  });
});

describe('effectSummaryParts (тултипы)', () => {
  it('преимущество по цели и метка Hex', () => {
    const faerie = effect({ modifiers: [mod({ target: 'attack', mode: 'advantage' })] });
    expect(effectSummaryParts(faerie)).toEqual([{ key: 'domain.effect.advAttackAgainst' }]);

    const hex = effect({
      modifiers: [mod({ target: 'damage', mode: 'add', value: '1d6', filter: { targetId: 't2' } })],
    });
    expect(effectSummaryParts(hex)).toEqual([{ key: 'domain.effect.addDamageMark', params: { value: '+1d6' } }]);
  });

  it('иммунитеты, скорость и триггеры (Freedom of Movement, Heroism)', () => {
    const fom = effect({
      conditionImmunities: ['paralyzed', 'restrained'],
      immuneToSpeedReduction: true,
      ignoresDifficultTerrain: true,
    });
    expect(effectSummaryParts(fom)).toEqual([
      { key: 'domain.effect.immuneTo', params: { condition: 'paralyzed' } },
      { key: 'domain.effect.immuneTo', params: { condition: 'restrained' } },
      { key: 'domain.effect.noSpeedReduction' },
      { key: 'domain.effect.ignoreDifficult' },
    ]);
    expect([...conditionImmunities([fom])].sort()).toEqual(['paralyzed', 'restrained']);
    expect(immuneToSpeedReduction([fom])).toBe(true);
    expect(ignoresDifficultTerrain([fom])).toBe(true);
    expect(immuneToSpeedReduction([])).toBe(false);

    const heroism = effect({ triggers: { startOfTurn: { tempHp: 3 } } });
    expect(effectSummaryParts(heroism)).toEqual([{ key: 'domain.effect.startOfTurnTempHp', params: { amount: 3 } }]);
  });

  it('Bless, состояния и сопротивления', () => {
    const bless = effect({
      modifiers: [
        mod({ target: 'attack', mode: 'add', value: '1d4' }),
        mod({ target: 'save', mode: 'add', value: '1d4' }),
      ],
    });
    expect(effectSummaryParts(bless)).toEqual([
      { key: 'domain.effect.addAttack', params: { value: '+1d4' } },
      { key: 'domain.effect.addSave', params: { value: '+1d4' } },
    ]);

    const hold = effect({ conditions: ['paralyzed'], modifiers: [] });
    expect(effectSummaryParts(hold)).toEqual([{ key: 'domain.condition.paralyzed' }]);

    const stoneskin = effect({
      modifiers: [mod({ target: 'damage', mode: 'resistance', value: 0, filter: { damageType: 'slashing' } })],
    });
    expect(effectSummaryParts(stoneskin)).toEqual([
      { key: 'domain.effect.resistance', params: { type: 'slashing' } },
    ]);

    const images = effect({ modifiers: [], misdirect: { charges: 3, die: 'd6', threshold: 3 } });
    expect(effectSummaryParts(images)).toEqual([{ key: 'domain.effect.mirrorImages', params: { charges: 3 } }]);

    const hidden = effect({ hidden: true, conditions: ['prone'] });
    expect(effectSummaryParts(hidden)).toEqual([]);

    expect(effectSummaryParts(effect({ modifiers: [] }))).toEqual([]);
  });
});

describe('каталог эффектов заклинаний', () => {
  it('Shield даёт +5 AC до конца хода', () => {
    const defs = spellEffectDefs('XPHB:Shield');
    expect(defs).toHaveLength(1);
    expect(defs?.[0]!.to).toBe('self');
    expect(defs![0]!.modifiers[0]!).toMatchObject({ target: 'ac', mode: 'add', value: 5 });
  });

  it('Bless — концентрация, +1d4 к атакам и спасброскам', () => {
    const defs = spellEffectDefs('XPHB:Bless');
    expect(defs?.[0]!.concentration).toBe(true);
    expect(defs?.[0]!.modifiers.map((m) => m.target)).toEqual(['attack', 'save']);
  });

  it('Haste ускоряет и даёт доп. действие', () => {
    const targets = spellEffectDefs('XPHB:Haste')?.[0]!.modifiers.map((m) => m.target);
    expect(targets).toEqual(['ac', 'speed', 'extraActions']);
  });

  it('неизвестное заклинание — без эффектов', () => {
    expect(spellEffectDefs('XPHB:Fireball')).toBeUndefined();
  });

  it('Hex привязывает бонус урона к метке', () => {
    const defs = spellEffectDefs('XPHB:Hex');
    expect(defs?.[0]!.markTarget).toBe(true);
    expect(defs?.[0]!.to).toBe('self');
    expect(defs![0]!.modifiers[0]!).toMatchObject({ target: 'damage', mode: 'add', value: '1d6necrotic' });
    expect(defs?.[1]!.to).toBe('targets');
  });

  it('Hold Person — паралич до успешного спасброска', () => {
    const def = spellEffectDefs('XPHB:Hold Person')?.[0];
    expect(def?.conditions).toEqual(['paralyzed']);
    expect(def?.duration.type).toBe('untilSave');
  });

  it('Aid даёт +5 к максимуму HP', () => {
    const def = spellEffectDefs('XPHB:Aid')?.[0];
    expect(def?.modifiers[0]).toMatchObject({ target: 'maxHp', mode: 'add', value: 5 });
  });

  it('spellAutomated: full или есть каталог эффектов', () => {
    expect(spellAutomated({ key: 'XPHB:Fireball', automation: 'full' })).toBe(true);
    expect(spellAutomated({ key: 'XPHB:Shield', automation: 'manual' })).toBe(true);
    expect(spellAutomated({ key: 'XPHB:Light', automation: 'manual' })).toBe(true);
    expect(spellAutomated({ key: 'XPHB:Comprehend Languages', automation: 'manual' })).toBe(false);
  });
});

describe('restrictionsFor', () => {
  it('недееспособность запрещает действия/бонусы/реакции', () => {
    const r = restrictionsFor([{ key: 'stunned', name: 'Ошеломлён', rounds: null }], []);
    expect(r.noActions).toBe(true);
    expect(r.noBonus).toBe(true);
    expect(r.noReactions).toBe(true);
    expect(r.noOpportunityAttacks).toBeUndefined();
  });

  it('эффекты добавляют ограничения и максимальный шанс провала', () => {
    const r = restrictionsFor(undefined, [
      effect({ restrictions: { noReactions: true, spellFailureChance: 25 } }),
      effect({ restrictions: { oneAttackOnly: true, spellFailureChance: 10 } }),
    ]);
    expect(r.noReactions).toBe(true);
    expect(r.oneAttackOnly).toBe(true);
    expect(r.spellFailureChance).toBe(25);
    expect(r.noActions).toBeUndefined();
  });

  it('эффект может запрещать заклинания (Ярость)', () => {
    const r = restrictionsFor(undefined, [effect({ restrictions: { noSpells: true } })]);
    expect(r.noSpells).toBe(true);
  });
});
