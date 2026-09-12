import { spellVisual } from '../lib/spellIcon';
import { SPELL_ICONS } from './spellIcons';
import { SPELL_GLYPHS } from './spellGlyphs';
import type { Spell } from 'shared';

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

function LevelBadge({ numeral, accent }: { numeral: string; accent: string }) {
  return (
    <g>
      <circle cx="53" cy="11" r="7.6" fill="#0b0f14" opacity="0.82" />
      <circle cx="53" cy="11" r="7.6" fill="none" stroke={accent} strokeWidth="1.2" opacity="0.9" />
      {numeral && (
        <text
          x="53"
          y="14.7"
          textAnchor="middle"
          fontFamily="system-ui, sans-serif"
          fontSize="9"
          fontWeight="700"
          fill={accent}
        >
          {numeral}
        </text>
      )}
    </g>
  );
}

/**
 * Иконка заклинания: детальная рисованная (если есть) либо штриховая заглушка,
 * плюс бейдж круга в правом верхнем углу (фокусы — пустой бейдж).
 */
export default function SpellIcon({ spell, className }: { spell: Spell; className?: string }) {
  const key = spell.name.toLowerCase();
  const { accent } = spellVisual(spell);
  const numeral = ROMAN[spell.level] ?? '';
  const detailed = SPELL_ICONS[key];

  return (
    <svg className={className} viewBox="3 3 58 58" fill="none" aria-hidden="true">
      {detailed ? (
        detailed
      ) : (
        <g
          transform="translate(7 6) scale(2)"
          fill="none"
          stroke={accent}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {SPELL_GLYPHS[key] ?? <circle cx="12" cy="12" r="9" />}
        </g>
      )}
      <LevelBadge numeral={numeral} accent={accent} />
    </svg>
  );
}
