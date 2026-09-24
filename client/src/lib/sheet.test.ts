import { describe, expect, it } from 'vitest';
import { normalizeSheet, type Token } from 'shared';
import { checkEffectParts, defaultSheet } from './sheet';

describe('defaultSheet', () => {
  it('собирается normalizeSheet({}) — один источник дефолтов', () => {
    // id записей атак генерируются случайно — при сравнении игнорируем.
    const withoutIds = (sheet: ReturnType<typeof defaultSheet>) => ({
      ...sheet,
      attacks: sheet.attacks.map((attack) => ({ ...attack, id: undefined })),
    });
    expect(withoutIds(defaultSheet())).toEqual(withoutIds(normalizeSheet({})));
  });

  it('новые поля листа на месте, строка атаки пустая (плейсхолдеры формы)', () => {
    const sheet = defaultSheet();
    expect(sheet.choices).toEqual([]);
    expect(sheet.invocations).toBeUndefined();
    expect(sheet.wildShape).toBeUndefined();
    expect(sheet.attacks).toHaveLength(1);
    expect(sheet.attacks[0]).toMatchObject({ name: '', hit: '', damage: '' });
  });
});

describe('checkEffectParts', () => {
  it('собирает преимущество по характеристике и флэт по навыку из эффектов токена', () => {
    const sheet = defaultSheet();
    const token = {
      effects: [
        {
          id: 'e1',
          name: 'Enhance Ability',
          duration: { type: 'concentration' },
          modifiers: [{ id: 'm1', target: 'check', mode: 'advantage', filter: { ability: 'str' } }],
        },
        {
          id: 'e2',
          name: 'Pass without Trace',
          duration: { type: 'concentration' },
          modifiers: [{ id: 'm2', target: 'check', mode: 'add', value: 10, filter: { skill: 'stealth' } }],
        },
      ],
    } as unknown as Token;
    expect(checkEffectParts(token, sheet, { ability: 'str' }).mode).toBe('a');
    expect(checkEffectParts(token, sheet, { ability: 'dex', skill: 'stealth' })).toMatchObject({ flat: 10 });
    expect(checkEffectParts(undefined, sheet, { ability: 'str' })).toMatchObject({ flat: 0, mode: undefined });
  });
});
