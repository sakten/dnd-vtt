import { spellWeaponOverride, type Spell } from 'shared';
import { getLocale, t, type MessageKey } from '../i18n';
import { abilityName, conditionLabel, damageLabel } from '../i18n/domain';

/** Текстовая сводка механики заклинания (RU/EN) для тултипа и списка. */

function catalogText(key: string): string | undefined {
  const text = t(key as MessageKey);
  return text === key ? undefined : text;
}

/** RU/EN-название школы магии по коду (`Abjuration`…). */
export function spellSchoolLabel(school: string): string {
  return catalogText(`domain.spellSchool.${school}`) ?? school;
}

export const spellLevelLabel = (level: number) =>
  level === 0 ? t('ui.spellLevel.cantrips') : t('ui.spellLevel.rank', { n: level });

function timeText(spell: Spell): string {
  return spell.time
    .map((entry) => {
      const unit = catalogText(`ui.spellTime.${entry.unit}`) ?? entry.unit;
      return `${entry.number} ${unit}${entry.condition ? ` (${entry.condition})` : ''}`;
    })
    .join(', ');
}

function rangeText(spell: Spell): string {
  const d = spell.range.distance;
  if (d) {
    if (!d.amount) return catalogText(`ui.spellRange.${d.type}`) ?? d.type;
    const unit = catalogText(`ui.spellRange.${d.type}`) ?? d.type;
    return `${d.amount} ${unit}`.trim();
  }
  return catalogText(`ui.spellRange.${spell.range.type}`) ?? spell.range.type;
}

function areaText(spell: Spell, raw: string): string | undefined {
  if (!spell.area?.length) return undefined;
  const shape = spell.area.map((a) => catalogText(`ui.spellArea.${a}`) ?? a).join('/');
  const size = raw.match(/(\d+)[- ]foot(?:\s+radius)?/i)?.[1];
  return size ? `${shape} (${t('ui.spellArea.size', { n: Number(size) })})` : shape;
}

function durationText(spell: Spell): string {
  const d = spell.duration[0];
  if (!d) return '—';
  if (d.type === 'instant') return t('ui.spellDuration.instant');
  if (d.type === 'permanent') return t('ui.spellDuration.permanent');
  if (d.type === 'special') return t('ui.spellDuration.special');
  if (d.type === 'timed' && d.duration) {
    const unit = catalogText(`ui.spellDuration.${d.duration.type}`) ?? d.duration.type;
    const base = `${d.duration.amount ?? ''} ${unit}`.trim();
    return d.concentration ? t('ui.spellDuration.timedConcentration', { value: base }) : base;
  }
  return d.concentration ? t('ui.spellDuration.concentration') : d.type;
}

function componentsText(spell: Spell): string {
  return [spell.components.v ? t('ui.spellComponent.v') : '', spell.components.s ? t('ui.spellComponent.s') : '', spell.components.m ? t('ui.spellComponent.m') : '']
    .filter(Boolean)
    .join(', ');
}

function saveText(spell: Spell): string {
  return (spell.save ?? []).map((a) => abilityName(a)).join(', ');
}

function diceText(dice: string[]): string {
  const joined = dice.join(', ');
  return getLocale() === 'ru' ? joined.replace(/(\d+)d(\d+)/gi, '$1к$2') : joined;
}

function damageText(spell: Spell, raw: string): string | undefined {
  // Shillelagh: кости данных — кость оружия по тирам, а не урон заклинания.
  if (spellWeaponOverride(spell)) return undefined;
  const dice = spell.damage?.dice ?? [];
  const types = spell.damage?.types ?? [];
  if (!dice.length && !types.length) return undefined;
  let text = [diceText(dice), types.map((type) => damageLabel(type).toLowerCase()).join(', ')].filter(Boolean).join(' ');
  if (spell.save?.length && /half as much/i.test(raw)) text += ` ${t('ui.spellMech.halfOnSuccess')}`;
  return text;
}

function conditionText(spell: Spell): string {
  return (spell.conditions ?? []).map((c) => conditionLabel(c).toLowerCase()).join(', ');
}

/** Строки механики: действие/дистанция/область/длительность/атака/спасбросок/урон/состояние/компоненты. */
export function spellMechanics(spell: Spell): string[] {
  const raw = spell.description.join(' ');
  const lines: string[] = [];
  lines.push(`${t('ui.spellMech.action')}: ${timeText(spell)}`);
  lines.push(`${t('ui.spellMech.range')}: ${rangeText(spell)}`);
  const area = areaText(spell, raw);
  if (area) lines.push(`${t('ui.spellMech.area')}: ${area}`);
  lines.push(`${t('ui.spellMech.duration')}: ${durationText(spell)}`);
  if (spell.spellAttack) {
    lines.push(`${t('ui.spellMech.attack')}: ${t(spell.spellAttack === 'ranged' ? 'ui.spellMech.ranged' : 'ui.spellMech.melee')}`);
  }
  if (spell.save?.length) lines.push(`${t('ui.spellMech.save')}: ${saveText(spell)}`);
  const damage = damageText(spell, raw);
  if (damage) lines.push(`${t('ui.spellMech.damage')}: ${damage}`);
  if (spell.conditions?.length) lines.push(`${t('ui.spellMech.condition')}: ${conditionText(spell)}`);
  const comps = componentsText(spell);
  if (comps) lines.push(`${t('ui.spellMech.components')}: ${comps}`);
  return lines;
}

/** Компактная механика одной строкой (для списка). */
export function spellMechanicsShort(spell: Spell): string {
  return spellMechanics(spell).join(' · ');
}
