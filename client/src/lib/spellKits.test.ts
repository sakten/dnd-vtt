import { describe, expect, it } from 'vitest';
import { automationForSpell } from 'shared';
import spellsData from 'shared/spellsData';
import {
  KIT_DELIVERIES,
  KIT_RESOLUTIONS,
  isGridPayload,
  kitDeliveries,
  kitOf,
  kitRecord,
  kitResolutions,
  type SpellKit,
} from './spellKits';

const find = (name: string) => spellsData.spells.find((s) => s.name === name)!;

describe('spellKits (Р1: оси конструктора)', () => {
  it('матрица совместимости: атака — только цели; спас/авто — все доставки', () => {
    expect(KIT_RESOLUTIONS).toEqual(['attack', 'save', 'auto']);
    expect(kitDeliveries('attack')).toEqual(['creatures']);
    expect(kitDeliveries('save')).toEqual(KIT_DELIVERIES);
    expect(kitDeliveries('auto')).toEqual(KIT_DELIVERIES);
    expect(kitResolutions('damage')).toEqual(KIT_RESOLUTIONS);
    expect(kitResolutions('heal')).toEqual(['auto']);
    expect(kitResolutions('effect')).toEqual(['save', 'auto']);
    expect(isGridPayload('damage')).toBe(true);
    expect(isGridPayload('summon')).toBe(false);
  });

  it('kitRecord: сетка и особые payload-ы собираются в компилируемую запись', () => {
    const kits: SpellKit[] = [
      { payload: 'damage', resolution: 'attack', delivery: 'creatures' },
      { payload: 'damage', resolution: 'save', delivery: 'area' },
      { payload: 'damage', resolution: 'save', delivery: 'zone' },
      { payload: 'damage', resolution: 'save', delivery: 'aura' },
      { payload: 'damage', resolution: 'auto', delivery: 'creatures' },
      { payload: 'damage', resolution: 'auto', delivery: 'zone' },
      { payload: 'heal', resolution: 'auto', delivery: 'creatures' },
      { payload: 'heal', resolution: 'auto', delivery: 'aura' },
      { payload: 'effect', resolution: 'attack', delivery: 'creatures' },
      { payload: 'effect', resolution: 'save', delivery: 'creatures' },
      { payload: 'effect', resolution: 'save', delivery: 'zone' },
      { payload: 'effect', resolution: 'auto', delivery: 'creatures' },
      { payload: 'weapon' },
      { payload: 'shape' },
      { payload: 'utility' },
      { payload: 'manual' },
    ];
    for (const kit of kits) {
      const record = kitRecord('Тест', kit);
      expect(record.key).toBe('CUSTOM:Тест');
      expect(() => automationForSpell(record), JSON.stringify(kit)).not.toThrow();
    }
  });

  it('kitRecord: доставка задаёт область/зону/ауру', () => {
    const area = kitRecord('Тест', { payload: 'damage', resolution: 'save', delivery: 'area' });
    expect(area.areaSpec).toEqual({ shape: 'sphere', size: 20 });
    expect(area.area).toEqual(['S']);

    const zone = kitRecord('Тест', { payload: 'damage', resolution: 'save', delivery: 'zone' });
    expect(zone.automation.zone).toMatchObject({ area: { shape: 'sphere', size: 10 }, origin: 'point' });
    expect(zone.automation.zone?.anchor).toBeUndefined();
    expect(zone.concentration).toBe(true);
    expect(zone.automation.zone?.triggers?.enter).toMatchObject({ damage: { dice: { ref: 'spellDamage' } } });
    expect(zone.areaSpec).toEqual({ shape: 'sphere', size: 10 });
    expect(zone.area).toEqual(['S']);

    const aura = kitRecord('Тест', { payload: 'damage', resolution: 'save', delivery: 'aura' });
    expect(aura.automation.zone).toMatchObject({ anchor: 'source', side: 'hostile', excludeSource: true });
    expect(aura.automation.zone?.triggers?.startOfTurn).toBeTruthy();

    const effect = kitRecord('Тест', { payload: 'effect', resolution: 'save', delivery: 'creatures' });
    expect(effect.automation.primary).toBe('effect');
    expect(effect.automation.save).toEqual({ ability: 'wis' });
    expect(effect.automation.effects).toHaveLength(1);
  });

  it('kitOf: канон раскладывается по осям', () => {
    expect(kitOf(find('Fireball'))).toEqual({ payload: 'damage', resolution: 'save', delivery: 'area' });
    expect(kitOf(find('Moonbeam'))).toEqual({ payload: 'damage', resolution: 'save', delivery: 'zone' });
    expect(kitOf(find('Spirit Guardians'))).toEqual({ payload: 'damage', resolution: 'save', delivery: 'aura' });
    expect(kitOf(find('Cloudkill'))).toEqual({ payload: 'damage', resolution: 'auto', delivery: 'zone' });
    expect(kitOf(find('Magic Missile'))).toEqual({ payload: 'damage', resolution: 'auto', delivery: 'creatures' });
    expect(kitOf(find('Haste'))).toEqual({ payload: 'effect', resolution: 'auto', delivery: 'creatures' });
    expect(kitOf(find('Hold Person'))).toEqual({ payload: 'effect', resolution: 'save', delivery: 'creatures' });
    expect(kitOf(find('Cure Wounds'))).toEqual({ payload: 'heal', resolution: 'auto', delivery: 'creatures' });
    expect(kitOf(find('Polymorph'))).toEqual({ payload: 'shape' });
    expect(kitOf(find('True Strike'))).toEqual({ payload: 'weapon' });
  });
});
