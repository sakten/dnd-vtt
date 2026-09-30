import type { Spell } from '../spells';
import type { MaterializedAutomation } from './materialize';
import type { ValueExpr } from './spec';

/**
 * Спек из данных заклинания — зеркало прежней деривации (`automationForSpell`):
 * кости — ссылка `spellDamage` (скейл при компиляции), число атак — `spellAttackCount`,
 * типы/хил/спас — из meta; без костей — `manual`. Отдельный модуль без импорта
 * реестра спеков (`specs/`): нужен и каталогу, и конструктору на клиенте
 * (R20 — реестр не должен возвращаться в клиентский бандл).
 */
export function generatedAutomation(spell: Spell): MaterializedAutomation {
  const concentration = spell.concentration === true ? { concentration: true } : {};
  if (!spell.damage?.dice?.[0]?.trim()) return { primary: 'manual', ...concentration };
  const dice: ValueExpr = { ref: 'spellDamage' };
  const types = [...(spell.damage?.types ?? [])];
  const typed = types.length ? { types } : {};
  const roll = spell.healing === true ? { heal: { dice, ...typed } } : { damage: { dice, ...typed } };
  if (spell.spellAttack) {
    return {
      primary: 'attack',
      attack: { rangeType: spell.spellAttack },
      count: { ref: 'spellAttackCount' },
      ...roll,
      ...concentration,
    };
  }
  if (spell.save?.length && spell.save[0]) {
    return {
      primary: 'save',
      save: { ability: spell.save[0], half: spell.saveHalf === true },
      ...roll,
      ...concentration,
    };
  }
  return { primary: 'auto', count: { ref: 'spellAttackCount' }, ...roll, ...concentration };
}
