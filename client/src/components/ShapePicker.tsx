import { useEffect, useState } from 'react';
import { crValue, wildShapeFormIssue, wildShapeLimit, type BestiaryEntry } from 'shared';
import { loadBestiary } from '../lib/bestiary';
import { t } from '../i18n';

interface Props {
  /** Известные формы персонажа (ключи каталога). */
  known: string[];
  /** Уровень друида: CR/полёт/размер пула. */
  level: number;
  /** Круг луны: CR = ⌊уровень/3⌋. */
  moon: boolean;
  onPick: (key: string) => void;
  onClose: () => void;
}

/** Выбор известной формы для принятия (Wild Shape): только доступные сейчас. */
export default function ShapePicker({ known, level, moon, onPick, onClose }: Props) {
  const [entries, setEntries] = useState<BestiaryEntry[] | null>(null);
  const [showCr0, setShowCr0] = useState(false);

  useEffect(() => {
    let alive = true;
    loadBestiary()
      .then((list) => {
        if (alive) setEntries(list);
      })
      .catch(() => void 0);
    return () => {
      alive = false;
    };
  }, []);

  const limit = wildShapeLimit(level, moon);
  if (!limit) return null;

  // Недоступные формы (CR/полёт) не показываем; CR 0 — под галкой.
  const forms = (entries ?? [])
    .filter((entry) => known.includes(entry.key))
    .filter((entry) => !wildShapeFormIssue(entry, limit))
    .filter((entry) => showCr0 || crValue(entry.cr) > 0);

  return (
    <div className="inv-form">
      <div className="sheet-section-title">{t('ui.shape.pickTitle')}</div>
      {!known.length && <div className="spells-note">{t('ui.shape.noKnown')}</div>}
      <label className="adv-check">
        <input type="checkbox" checked={showCr0} onChange={(e) => setShowCr0(e.target.checked)} />
        {t('ui.shape.showCr0')}
      </label>
      {!!known.length && !forms.length && <div className="spells-note">{t('ui.shape.pickEmpty')}</div>}
      {forms.map((entry) => (
        <button key={entry.key} type="button" className="inv-row" onClick={() => onPick(entry.key)}>
          <span className="inv-row-head">
            <span className="inv-name">{entry.name}</span>
            <span className="inv-meta">
              {t('ui.shape.meta', { cr: entry.cr, ac: entry.ac, hp: entry.hpAverage, speed: entry.speed })}
            </span>
          </span>
        </button>
      ))}
      <button type="button" className="spell-add" onClick={onClose}>
        {t('ui.common.close')}
      </button>
    </div>
  );
}
