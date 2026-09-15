import { describe, expect, it } from 'vitest';
import { FEATS, featByKey, featsByCategory, featChoiceEffects } from './feats';

describe('каталог фитов PHB24 (feats.json)', () => {
  it('Magic Initiate: три списка и выбор способности', () => {
    const feat = featByKey('XPHB:magicInitiate');
    expect(feat?.category).toBe('origin');
    expect(feat?.repeatable).toBe(true);
    expect(feat?.abilityChoose).toEqual(['int', 'wis', 'cha']);
    expect(feat?.spellLists?.map((l) => l.className)).toEqual(['cleric', 'druid', 'wizard']);
  });

  it('категории: origin 10, general и fightingStyle непустые', () => {
    expect(featsByCategory('origin')).toHaveLength(10);
    expect(featsByCategory('general').length).toBeGreaterThan(30);
    expect(featsByCategory('fightingStyle').length).toBeGreaterThan(8);
    expect(FEATS.every((f) => f.description)).toBe(true);
  });
});

describe('механики фитов из выборов', () => {
  it('Tough: +2 HP за каждый уровень персонажа', () => {
    const effects = featChoiceEffects([{ kind: 'feat', key: 'XPHB:tough' }], [
      { className: 'fighter', level: 4 },
      { className: 'cleric', level: 2 },
    ]);
    expect(effects).toHaveLength(1);
    expect(effects[0]!.effects[0]!.modifiers[0]).toMatchObject({ target: 'maxHp', mode: 'add', value: 12 });
  });

  it('Alert: +бонус владения к инициативе', () => {
    const effects = featChoiceEffects([{ kind: 'feat', key: 'XPHB:alert' }], [{ className: 'monk', level: 5 }]);
    expect(effects[0]!.effects[0]!.modifiers[0]).toMatchObject({ target: 'initiative', mode: 'add', value: 3 });
  });

  it('не-фиты и неизвестные ключи игнорируются', () => {
    expect(
      featChoiceEffects(
        [
          { kind: 'metamagic', key: 'XPHB:tough' },
          { kind: 'feat', key: 'XPHB:unknownFeat' },
        ],
        [{ className: 'fighter', level: 1 }]
      )
    ).toEqual([]);
  });
});
