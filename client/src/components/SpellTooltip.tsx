import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { spellDescription, spellHigherLevel, type Spell } from 'shared';
import { getLocale, t } from '../i18n';
import { spellDisplayName } from '../i18n/names';
import { useSpellText } from '../i18n/useLocalizedText';
import { spellLevelLabel, spellMechanics, spellSchoolLabel } from '../lib/spellText';

interface HoverState {
  spell: Spell;
  x: number;
  y: number;
  note?: string;
}

const HOVER_DELAY_MS = 1000;

/** Отложенный (1с) тултип с описанием заклинания; подходит для списка и пикера. */
export function useSpellTooltip() {
  const [hover, setHover] = useState<HoverState | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    []
  );

  const handlers = (spell: Spell, note?: string) => ({
    onMouseEnter: (e: MouseEvent) => {
      if (timer.current !== null) window.clearTimeout(timer.current);
      const { clientX: x, clientY: y } = e;
      timer.current = window.setTimeout(() => setHover({ spell, x, y, note }), HOVER_DELAY_MS);
    },
    onMouseMove: (e: MouseEvent) => {
      setHover((h) => (h && h.spell.key === spell.key ? { spell, x: e.clientX, y: e.clientY, note: h.note } : h));
    },
    onMouseLeave: () => {
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
        timer.current = null;
      }
      setHover(null);
    },
  });

  return { handlers, node: hover ? <SpellTooltip {...hover} /> : null };
}

function SpellTooltip({ spell, x, y, note }: HoverState) {
  useSpellText();
  const width = Math.min(440, window.innerWidth - 16);
  const estHeight = Math.min(340, window.innerHeight * 0.5);
  const left = Math.max(8, Math.min(x + 16, window.innerWidth - width - 8));
  const top = y + 16 + estHeight > window.innerHeight ? Math.max(8, y - estHeight - 16) : y + 16;
  const lang = getLocale();
  const description = spellDescription(spell.key, lang) ?? spell.description;
  const higherLevel = spellHigherLevel(spell.key, lang) ?? spell.higherLevel;

  return createPortal(
    <div className="spell-tooltip" style={{ left, top, width }}>
        <h4>{spellDisplayName(spell)}</h4>
      <div className="tip-meta">
        {spellLevelLabel(spell.level)} · {spellSchoolLabel(spell.school)}
        {spell.concentration ? t('ui.spellTooltip.concentration') : ''}
        {spell.ritual ? t('ui.spellTooltip.ritual') : ''}
      </div>
      <div className="tip-mechanics">
        {spellMechanics(spell).map((line) => (
          <div key={line}>{line}</div>
        ))}
      </div>
      {note && <div className="tip-note">{note}</div>}
      {description.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
      {higherLevel?.map((p, i) => (
        <p className="tip-higher" key={`h${i}`}>
          {p}
        </p>
      ))}
    </div>,
    document.body
  );
}
