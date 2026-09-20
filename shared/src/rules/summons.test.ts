import { describe, expect, it } from 'vitest';
import bestiaryData from '../bestiaryData';
import spellsData from '../spellsData';
import { automationForSpell, bestiaryTokenFields, spellAutomated, summonSpellDef, SUMMON_SPELLS } from '../rules';

const spellOf = (key: string) => spellsData.spells.find((spell) => spell.key === key)!;

describe('призывы: каталог', () => {
  it('каждая привязка ссылается на существующее заклинание и шаблон каталога', () => {
    expect(Object.keys(SUMMON_SPELLS).length).toBeGreaterThanOrEqual(12);
    for (const [spellKey, def] of Object.entries(SUMMON_SPELLS)) {
      expect(spellOf(spellKey)).toBeTruthy();
      if (def.template) expect(bestiaryData.entries.some((entry) => entry.key === def.template)).toBe(true);
      if (def.fromFamiliar) expect(bestiaryData.entries.filter((entry) => entry.familiar).length).toBeGreaterThan(10);
    }
  });

  it('Summon Fey: шаблон Fey Spirit, инициатива после кастера, скейл круга', () => {
    const def = automationForSpell(spellOf('XPHB:Summon Fey'), { castLevel: 4 });
    expect(def.resolution).toBe('summon');
    expect(def.concentration).toBe(true);
    expect(def.summon).toMatchObject({
      creature: 'XPHB:Fey Spirit',
      initiative: 'afterCaster',
      level: 4,
      count: 1,
      spellAttack: true,
      duration: { type: 'concentration' },
    });
    expect(spellAutomated(spellOf('XPHB:Summon Fey'))).toBe(true);
  });

  it('Find Familiar: выбор формы, своя инициатива, без концентрации', () => {
    const def = automationForSpell(spellOf('XPHB:Find Familiar'));
    expect(def.summon).toMatchObject({ initiative: 'own', duration: { type: 'permanent' } });
    expect(def.summon?.choices).toEqual([]);
    expect(def.summon?.creature).toBeUndefined();
    expect(def.concentration).toBeUndefined();
  });

  it('шаблоны со скейлом: HP/AC/урон растут с кругом', () => {
    const fey = bestiaryData.entries.find((entry) => entry.key === 'XPHB:Fey Spirit')!;
    const at3 = bestiaryTokenFields(fey, { slotLevel: 3, spellAttackBonus: 6 });
    const at5 = bestiaryTokenFields(fey, { slotLevel: 5, spellAttackBonus: 6 });
    expect(Number(at5.hpMax) - Number(at3.hpMax)).toBe(20);
    expect(Number(at5.ac) - Number(at3.ac)).toBe(2);
    expect(at3.attacks[0]?.damage).toBe('2d6 + 3 + 3');
    expect(at3.attacks[0]?.hit).toBe('+6');
  });

  it('Animate Objects — manual (ложный авто-урон выключен)', () => {
    const def = automationForSpell(spellOf('XPHB:Animate Objects'));
    expect(def.resolution).toBe('manual');
    expect(spellAutomated(spellOf('XPHB:Animate Objects'))).toBe(false);
  });

  it('Summon Shadowspawn без шаблона в каталоге — не привязан', () => {
    expect(summonSpellDef('TCE:Summon Shadowspawn')).toBeUndefined();
  });
});
