import { describe, expect, it } from 'vitest';
import spellsData from 'shared/spellsData';
import type { Spell } from 'shared';
import { setLocale } from '../i18n';
import { spellLevelLabel, spellMechanics, spellSchoolLabel } from './spellText';

const fireball = spellsData.spells.find((s) => s.key === 'XPHB:Fireball') as Spell;
const swordBurst = spellsData.spells.find((s) => s.key === 'TCE:Sword Burst') as Spell;

describe('spellText', () => {
  it('RU: сводка локализована, нотация «к», школа и круг по-русски', () => {
    setLocale('ru');
    const lines = spellMechanics(fireball).join(' | ');
    expect(lines).toContain('Действие: 1 действие');
    expect(lines).toContain('Дистанция: 150 фт');
    expect(lines).toContain('Область: сфера (20 фт)');
    expect(lines).toContain('Длительность: мгновенно');
    expect(lines).toContain('Спасбросок: Ловкость');
    expect(lines).toContain('Урон: 8к6 огонь');
    expect(lines).toContain('при успехе — половина');
    expect(lines).toContain('Компоненты: В, С, М');
    expect(lines).not.toMatch(/\b(Action|Range|Duration|Damage)\b/);
    expect(spellSchoolLabel('Evocation')).toBe('Воплощение');
    expect(spellLevelLabel(3)).toBe('3 круг');
    expect(spellLevelLabel(0)).toBe('Фокусы');
  });

  it('EN: сводка без кириллицы, официальные термины', () => {
    setLocale('en');
    const lines = spellMechanics(fireball).join(' | ');
    expect(lines).not.toMatch(/[А-Яа-яЁё]/);
    expect(lines).toContain('Action: 1 Action');
    expect(lines).toContain('Range: 150 ft.');
    expect(lines).toContain('Area: sphere (20 ft.)');
    expect(lines).toContain('Duration: Instantaneous');
    expect(lines).toContain('Save: Dexterity');
    expect(lines).toContain('Damage: 8d6 fire');
    expect(lines).toContain('half on success');
    expect(spellSchoolLabel('Evocation')).toBe('Evocation');
    expect(spellSchoolLabel('Unknown')).toBe('Unknown');
    expect(spellLevelLabel(3)).toBe('Level 3');
    expect(spellLevelLabel(0)).toBe('Cantrips');
  });

  it('EN: Sword Burst — целиком английский (регресс смешанного RU/EN тултипа)', () => {
    setLocale('en');
    const lines = spellMechanics(swordBurst).join(' | ');
    expect(lines).not.toMatch(/[А-Яа-яЁё]/);
    expect(lines).toContain('Action: 1 Action');
    expect(lines).toContain('Range: 5 ft.');
    expect(lines).toContain('Save: Dexterity');
    expect(lines).toContain('Damage: 1d6, 2d6, 3d6, 4d6 force');
    expect(lines).toContain('Components: V');
  });

  it('RU: Sword Burst — целиком русский', () => {
    setLocale('ru');
    const lines = spellMechanics(swordBurst).join(' | ');
    expect(lines).toContain('Спасбросок: Ловкость');
    expect(lines).toContain('Урон: 1к6, 2к6, 3к6, 4к6 силовой');
    expect(lines).toContain('Компоненты: В');
    expect(spellSchoolLabel('Conjuration')).toBe('Вызов');
  });
});
