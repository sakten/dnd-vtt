import { describe, expect, it } from 'vitest';
import spellsRaw from '../data/spells.json';
import { automationForSpell } from './automation';
import type { Spell } from './spells';

/**
 * Поведенческий замок спеков (R16): проверяет не равенство билдерам, а правильность
 * механики на реальных данных `spells.json` через боевой путь `automationForSpell`
 * (derive → resolveSpec → compileSpec). Ожидания — RAW, а не текущий код.
 */
const SPELLS = (spellsRaw as unknown as { spells: Spell[] }).spells;
const find = (key: string): Spell => {
  const spell = SPELLS.find((s) => s.key === key);
  if (!spell) throw new Error(`нет заклинания ${key}`);
  return spell;
};

describe('поведение спеков (RAW, реальные данные)', () => {
  it('Command: halt — скорость 0 и запрет действий; grovel — ещё и prone; approach — без обоих', () => {
    const spell = find('XPHB:Command');
    const halt = automationForSpell(spell, { variant: 'halt' });
    const haltEffect = halt.effects?.[0];
    expect(halt.save).toEqual({ ability: 'wis' });
    expect(halt.excludeCreatureTypes).toEqual(['undead']);
    expect(haltEffect?.targets).toBe(1);
    expect(haltEffect?.duration).toEqual({ type: 'endOfTurn', of: 'target' });
    expect(haltEffect?.restrictions).toEqual({ noActions: true, noBonus: true });
    expect(haltEffect?.modifiers).toEqual([{ target: 'speed', mode: 'multiply', value: 0 }]);
    expect(haltEffect?.conditions).toBeUndefined();

    const grovel = automationForSpell(spell, { variant: 'grovel' }).effects?.[0];
    expect(grovel?.conditions).toEqual(['prone']);
    expect(grovel?.modifiers).toHaveLength(1);

    const approach = automationForSpell(spell, { variant: 'approach' }).effects?.[0];
    expect(approach?.modifiers).toEqual([]);
    expect(approach?.conditions).toBeUndefined();
  });

  it("Dragon's Breath: действие-выдох — спас DEX, область из данных, тип из выбора", () => {
    const spell = find("XPHB:Dragon's Breath");
    const def = automationForSpell(spell, { castLevel: 2, variant: 'cold' });
    const action = def.effects?.[0]?.actions?.[0];
    expect(def.effects?.[0]?.variant).toBe('cold');
    expect(action).toMatchObject({ cost: 'action' });
    expect(action?.def?.resolution).toBe('save');
    expect(action?.def?.save).toEqual({ ability: 'dex', half: true });
    expect(action?.def?.area).toEqual({ shape: 'cone', size: 15 });
    expect(action?.def?.targeting).toEqual({ kind: 'area', area: { shape: 'cone', size: 15 }, range: 15 });
    expect(action?.def?.damage?.types).toEqual(['cold']);
    expect(action?.def?.damage?.dice).toMatch(/^\d+d\d+$/);
  });

  it('Fire Shield: warm — сопротивление холоду и ответ огнём; chill — наоборот', () => {
    const spell = find('XPHB:Fire Shield');
    const warm = automationForSpell(spell, { variant: 'warm' }).effects?.[0];
    expect(warm?.modifiers).toEqual([
      { target: 'damage', mode: 'resistance', value: 0, filter: { damageType: 'cold' } },
    ]);
    expect(warm?.retaliate).toEqual({ damageType: 'fire', dice: '2d8' });

    const chill = automationForSpell(spell, { variant: 'chill' }).effects?.[0];
    expect(chill?.modifiers).toEqual([
      { target: 'damage', mode: 'resistance', value: 0, filter: { damageType: 'fire' } },
    ]);
    expect(chill?.retaliate).toEqual({ damageType: 'cold', dice: '2d8' });
  });

  it('Protection from Energy: сопротивление выбранному типу, концентрация', () => {
    const spell = find('XPHB:Protection from Energy');
    const def = automationForSpell(spell, { variant: 'thunder' });
    expect(def.concentration).toBe(true);
    expect(def.effects?.[0]?.variant).toBe('thunder');
    expect(def.effects?.[0]?.modifiers).toEqual([
      { target: 'damage', mode: 'resistance', value: 0, filter: { damageType: 'thunder' } },
    ]);
  });

  it('Spirit Shroud: аура 10 фт — −10 скорости и шаг типа с апкастом каждые 2 круга', () => {
    const spell = find('TCE:Spirit Shroud');
    const base = automationForSpell(spell, { castLevel: 3, variant: 'necrotic' });
    expect(base.zone?.area).toEqual({ shape: 'sphere', size: 10 });
    expect(base.zone?.origin).toBe('self');
    expect(base.zone?.anchor).toBe('source');
    expect(base.zone?.side).toBe('hostile');
    const aura = base.zone?.aura?.effects?.[0];
    expect(aura?.modifiers).toEqual([{ target: 'speed', mode: 'add', value: -10 }]);
    expect(aura?.takesExtraDamage).toEqual({ dice: '1d8', damageType: 'necrotic' });

    // Апкаст: выше 3 круга каждые два уровня +1к8 (5 → 2d8, 7 → 3d8).
    expect(
      automationForSpell(spell, { castLevel: 5, variant: 'radiant' }).zone?.aura?.effects?.[0]?.takesExtraDamage
    ).toEqual({ dice: '2d8', damageType: 'radiant' });
    expect(automationForSpell(spell, { castLevel: 7 }).zone?.aura?.effects?.[0]?.takesExtraDamage?.dice).toBe('3d8');
    // Без выбора — первый тип варианта.
    expect(automationForSpell(spell, { castLevel: 3 }).zone?.aura?.effects?.[0]?.variant).toBe('cold');
  });

  it('Destructive Wave: составной урон (гром + тип выбора), prone при провале', () => {
    const spell = find('XPHB:Destructive Wave');
    const radiant = automationForSpell(spell, { variant: 'radiant' });
    expect(radiant.save).toEqual({ ability: 'con', half: true });
    expect(radiant.damage).toEqual({ dice: '5d6thunder + 5d6radiant', types: ['thunder', 'radiant'] });
    expect(radiant.effects?.[0]?.conditions).toEqual(['prone']);
    expect(automationForSpell(spell, { variant: 'necrotic' }).damage).toEqual({
      dice: '5d6thunder + 5d6necrotic',
      types: ['thunder', 'necrotic'],
    });
    // Без выбора — тип по умолчанию (излучение).
    expect(automationForSpell(spell).damage?.types).toEqual(['thunder', 'radiant']);
  });

  it('Wall of Fire: полоса 60×10 / кольцо r10, 5d8 огнём (+1d8/круг), мгла и триггеры', () => {
    const spell = find('XPHB:Wall of Fire');
    const vertical = automationForSpell(spell, { variant: 'vertical' });
    expect(vertical.zone?.area).toEqual({ shape: 'line', size: 60, width: 10 });
    expect(vertical.zone?.origin).toBe('point');
    expect(vertical.zone?.enterOncePerTurn).toBe(true);
    expect(vertical.damage).toEqual({ dice: '5d8fire', types: ['fire'] });
    expect(vertical.zone?.triggers?.enter?.save).toEqual({ ability: 'dex', half: true });
    expect(vertical.zone?.triggers?.enter?.damage).toEqual({ dice: '5d8fire', types: ['fire'] });
    expect(vertical.zone?.triggers?.endOfTurn?.damage).toEqual({ dice: '5d8fire', types: ['fire'] });
    expect(vertical.zone?.flags).toEqual({ obscured: 'heavy' });
    // Кольцо: внешний радиус 10, свободная середина 5; апкаст +1d8/круг.
    expect(automationForSpell(spell, { variant: 'ring' }).zone?.area).toEqual({ shape: 'ring', size: 10, inner: 5 });
    expect(automationForSpell(spell, { castLevel: 6, variant: 'vertical' }).damage?.dice).toBe('7d8fire');
  });

  it('Wall of Sand: слепота и ×3 движение в мгле, вариант — подпись при выборе', () => {
    const spell = find('XGE:Wall of Sand');
    const horizontal = automationForSpell(spell, { variant: 'horizontal' });
    expect(horizontal.zone?.area).toEqual({ shape: 'line', size: 30, width: 10 });
    expect(horizontal.zone?.flags).toEqual({ obscured: 'heavy', movementCost: 3 });
    expect(horizontal.zone?.aura?.effects?.[0]?.conditions).toEqual(['blinded']);
    expect(horizontal.zone?.aura?.effects?.[0]?.variant).toBe('horizontal');
    expect(automationForSpell(spell).zone?.aura?.effects?.[0]?.variant).toBeUndefined();
  });
});
