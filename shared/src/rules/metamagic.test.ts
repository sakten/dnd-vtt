import { describe, expect, it } from 'vitest';
import type { AutomationDef } from '../domain/automation';
import type { FeatureChoice } from '../domain/feature';
import type { ClassLevel } from '../domain/sheet';
import type { Spell } from './spells';
import {
  DISTANT_SPELL_KEY,
  extendAutomation,
  extendedSpellEligible,
  knownMetamagic,
  metamagicLimit,
  metamagicRangeFeet,
  transmuteAutomation,
  twinnedSpellEligible,
} from './metamagic';

const sorc = (level: number): ClassLevel[] => [{ className: 'sorcerer', level }];
const spell = (range: Spell['range']): Spell =>
  ({
    key: 'TEST:Spell',
    name: 'Test',
    source: 'XPHB',
    level: 1,
    school: 'Evocation',
    time: [{ number: 1, unit: 'action' }],
    range,
    components: {},
    duration: [{ type: 'instant' }],
    classes: ['sorcerer'],
    description: [],
  }) as Spell;

describe('метамагия (каталог)', () => {
  it('лимит опций: 2/4/6 на 2/10/17', () => {
    expect(metamagicLimit(sorc(1))).toBe(0);
    expect(metamagicLimit(sorc(2))).toBe(2);
    expect(metamagicLimit(sorc(9))).toBe(2);
    expect(metamagicLimit(sorc(10))).toBe(4);
    expect(metamagicLimit(sorc(17))).toBe(6);
  });

  it('известные опции фильтруются по kind и каталогу', () => {
    const choices = [
      { kind: 'metamagic', key: DISTANT_SPELL_KEY },
      { kind: 'metamagic', key: 'XPHB:Nope' },
      { kind: 'feat', key: 'XPHB:tough' },
    ] as FeatureChoice[];
    expect(knownMetamagic(choices)).toEqual([DISTANT_SPELL_KEY]);
  });

  it('Distant Spell удваивает дистанцию; касание → 30 фт', () => {
    const ranged = spell({ type: 'point', distance: { type: 'feet', amount: 120 } });
    expect(metamagicRangeFeet(ranged, undefined, DISTANT_SPELL_KEY)).toBe(240);
    expect(metamagicRangeFeet(ranged, undefined, undefined)).toBe(120);
    const touch = spell({ type: 'point', distance: { type: 'touch' } });
    expect(metamagicRangeFeet(touch, undefined, DISTANT_SPELL_KEY)).toBe(30);
  });

  it('Transmuted Spell меняет типы урона и типизированные кости', () => {
    const def = {
      key: 'TEST:Burn',
      name: 'Burn',
      resolution: 'save',
      save: { ability: 'dex' },
      damage: { dice: '8d6', types: ['fire'] },
      burst: { rangeFeet: 5, dice: '2d6fire', damageType: 'fire' },
    } as AutomationDef;
    const out = transmuteAutomation(def, 'cold');
    expect(out.damage).toMatchObject({ dice: '8d6', types: ['cold'] });
    expect(out.burst).toMatchObject({ dice: '2d6cold', damageType: 'cold' });
  });

  it('Extended Spell удваивает длительность и даёт преимущество на концентрацию', () => {
    const def = {
      key: 'TEST:Long',
      name: 'Long',
      resolution: 'effect',
      maxRounds: 10,
      effects: [{ name: 'Long', duration: { type: 'rounds', rounds: 5 }, modifiers: [] }],
      zone: { area: { shape: 'sphere', size: 10 }, origin: 'point', duration: { type: 'rounds', rounds: 10 } },
    } as AutomationDef;
    const out = extendAutomation(def);
    expect(out.maxRounds).toBe(20);
    expect(out.effects?.[0]?.duration).toEqual({ type: 'rounds', rounds: 10 });
    expect(out.zone?.duration).toEqual({ type: 'rounds', rounds: 20 });
    expect(out.concentrationAdvantage).toBe(true);
  });

  it('Extended/Twinned применимы только к подходящему заклинанию', () => {
    const timed = spell({ type: 'point', distance: { type: 'feet', amount: 60 } });
    expect(extendedSpellEligible({ ...timed, duration: [{ type: 'timed', duration: { type: 'minute', amount: 1 } }] })).toBe(
      true
    );
    expect(twinnedSpellEligible(timed)).toBe(false);
    expect(twinnedSpellEligible({ ...timed, upcast: { above: 1, targets: 1 } })).toBe(true);
  });
});
