import { describe, expect, it } from 'vitest';
import cbtSpellsRaw from '../data/cbt/spells.json';
import spellsData from '../spellsData';
import type { SpellDef } from './automation/materialize';
import { automationForSpell } from './automation';
import { classFeatures } from './classActions';
import { featureActionAutomation, passiveFeatures } from './featureAutomation';
import { featuresFor } from './features';
import { CAT_SPRING_KEY, spellTargetKind } from './spellCast';
import { grantedSpells } from './subclassSpells';

const symbiote = (level: number) => [{ className: 'druid', level, subclass: 'symbiote' }] as const;
const SPELLS = (cbtSpellsRaw as unknown as { spells: SpellDef[] }).spells;
const cat = SPELLS.find((s) => s.key === CAT_SPRING_KEY)!;
const hunter = SPELLS.find((s) => s.key === 'GHLoE:Hunter Sense')!;

describe('Круг симбиота (CBT)', () => {
  it('черты появляются на 3 и 6 уровнях', () => {
    const l3 = featuresFor([...symbiote(3)]).map((f) => f.key);
    expect(l3).toContain('druid.symbiote:primalSymbiote');
    expect(l3).toContain('druid.symbiote:symbioticTransformation');
    expect(l3).not.toContain('druid.symbiote:symbioticReflexes');
    expect(featuresFor([...symbiote(6)]).map((f) => f.key)).toContain('druid.symbiote:symbioticReflexes');
  });

  it('Стойкость симбиота — преимущество на концентрацию', () => {
    const passive = passiveFeatures([...symbiote(3)]).find((f) => f.key === 'druid.symbiote:primalSymbiote');
    expect(passive?.effects[0]?.modifiers[0]).toMatchObject({
      target: 'save',
      mode: 'advantage',
      filter: { concentration: true },
    });
  });

  it('Симбиотическая трансформация: AC/скрытность/временные хиты по уровню', () => {
    const at6 = featureActionAutomation('class:druid.symbiote:symbioticTransformation', [...symbiote(6)]);
    const effect = at6?.effects?.[0];
    expect(effect?.duration).toEqual({ type: 'rounds', rounds: 10 });
    expect(effect?.modifiers).toEqual([
      { target: 'ac', mode: 'add', value: 2 },
      { target: 'check', mode: 'advantage', filter: { skill: 'stealth' } },
    ]);
    expect(effect?.triggers?.[0]).toMatchObject({ on: 'startOfTurn', turn: { tempHp: 5 } });
    const at8 = featureActionAutomation('class:druid.symbiote:symbioticTransformation', [...symbiote(8)]);
    expect(at8?.effects?.[0]?.triggers?.[0]?.turn?.tempHp).toBe(6);
  });

  it('Симбиотические рефлексы требуют трансформацию и кастуют Haste', () => {
    const action = classFeatures([...symbiote(6)]).find(
      (a) => a.id === 'class:druid.symbiote:symbioticReflexes'
    );
    expect(action?.requiresEffect).toBe('class:druid.symbiote:symbioticTransformation');
    expect(action?.resourceKey).toBe('druid.symbiote:symbioticReflexes');
    expect(action?.spellKey).toBe('XPHB:Haste');
    expect(featureActionAutomation('class:druid.symbiote:symbioticReflexes', [...symbiote(6)])).toBeUndefined();
    const haste = spellsData.spells.find((s) => s.key === 'XPHB:Haste')!;
    const def = automationForSpell(haste);
    expect(def.concentration).toBe(true);
    expect(def.effects?.[0]?.modifiers?.map((m) => m.target)).toEqual([
      'ac',
      'speed',
      'extraActions',
      'save',
    ]);
    expect(def.effects?.[0]?.onEnd?.name).toBe('Вялость');
  });

  it('круговые заклинания и Haste выдаются по уровню друида', () => {
    const at5 = grantedSpells([...symbiote(5)]).map((g) => g.key);
    expect(at5).not.toContain('XPHB:Haste');
    const at6 = grantedSpells([...symbiote(6)]).map((g) => g.key);
    expect(at6).toEqual(
      expect.arrayContaining(['XPHB:Guidance', 'XPHB:Entangle', 'XPHB:Barkskin', 'XPHB:Plant Growth', 'XPHB:Haste'])
    );
    expect(at6).not.toContain('XPHB:Hallucinatory Terrain');
    const at7 = grantedSpells([...symbiote(7)]).map((g) => g.key);
    expect(at7).toContain('XPHB:Hallucinatory Terrain');
    const at9 = grantedSpells([...symbiote(9)]).map((g) => g.key);
    expect(at9).toContain('XPHB:Tree Stride');
  });

  it("Cat's Spring: выбор урона, скейл и преимущество следующей атаки", () => {
    expect(spellTargetKind(cat)).toBe('creature');
    const def = automationForSpell(cat, { variant: 'force' });
    expect(def.resolution).toBe('attack');
    expect(cat.automation?.choices?.[0]?.options).toEqual(['slashing', 'force']);
    expect(def.damage && 'dice' in def.damage ? def.damage.types : []).toEqual(['force']);
    expect(cat.cantrip?.map((t) => t.dice)).toEqual(['2d8', '3d8', '4d8']);
    expect(def.effects?.[0]).toMatchObject({
      duration: { type: 'rounds', rounds: 2 },
      consumeOnSourceAttack: true,
      modifiers: [{ target: 'attack', mode: 'advantage', filter: { direction: 'against', sourceOnly: true } }],
    });
  });

  it('Hunter Sense: концентрация и эффект на согласную цель', () => {
    expect(spellTargetKind(hunter)).toBe('creature');
    const def = automationForSpell(hunter);
    expect(def.resolution).toBe('effect');
    expect(def.concentration).toBe(true);
    expect(def.targeting).toEqual({ kind: 'creature', range: 5 });
    expect(def.effects?.[0]?.duration).toEqual({ type: 'concentration' });
  });
});
