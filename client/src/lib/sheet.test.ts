import { describe, expect, it } from 'vitest';
import { normalizeSheet } from 'shared';
import { defaultSheet } from './sheet';

describe('defaultSheet', () => {
  it('собирается normalizeSheet({}) — один источник дефолтов', () => {
    expect(defaultSheet()).toEqual(normalizeSheet({}));
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
