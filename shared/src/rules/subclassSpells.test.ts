import { describe, expect, it } from 'vitest';
import { grantedSpells, poolSpells } from './subclassSpells';

describe('grantedSpells', () => {
  it('домены жреца выдаются по доступному кругу', () => {
    const keys = grantedSpells([{ className: 'cleric', level: 1, subclass: 'life' }]).map((g) => g.key);
    expect(keys).toContain('XPHB:Bless');
    expect(keys).toContain('XPHB:Cure Wounds');
    expect(keys).not.toContain('XPHB:Aid');
  });

  it('на 5 уровне домена появляются 2–3 круги', () => {
    const keys = grantedSpells([{ className: 'cleric', level: 5, subclass: 'life' }]).map((g) => g.key);
    expect(keys).toContain('XPHB:Aid');
    expect(keys).toContain('XPHB:Mass Healing Word');
    expect(keys).not.toContain('XPHB:Aura of Life');
  });

  it('классовые выдачи (паладин) и клятва', () => {
    const lvl2 = grantedSpells([{ className: 'paladin', level: 2, subclass: 'devotion' }]).map((g) => g.key);
    expect(lvl2).toContain('XPHB:Divine Smite');
    expect(lvl2).not.toContain('XPHB:Find Steed');
    expect(lvl2).toContain('XPHB:Shield of Faith');

    const lvl5 = grantedSpells([{ className: 'paladin', level: 5, subclass: 'devotion' }]).map((g) => g.key);
    expect(lvl5).toContain('XPHB:Find Steed');
    expect(lvl5).toContain('XPHB:Zone of Truth');
  });

  it('без подкласса — только классовые выдачи', () => {
    const keys = grantedSpells([{ className: 'ranger', level: 1 }]).map((g) => g.key);
    expect(keys).toContain("XPHB:Hunter's Mark");
  });
});

describe('poolSpells', () => {
  it('expanded-список патрона ограничен кругом', () => {
    const keys = poolSpells([{ className: 'warlock', level: 3, subclass: 'fathomless' }]).map((g) => g.key);
    expect(keys).toContain('XPHB:Thunderwave');
    expect(keys).toContain('XPHB:Silence');
    expect(keys).not.toContain('XPHB:Lightning Bolt');
  });
});
