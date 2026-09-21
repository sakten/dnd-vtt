import { useEffect, useMemo, useState } from 'react';
import {
  crValue,
  druidLevelOf,
  hasMoonCircle,
  knownShapeLimit,
  wildShapeFormIssue,
  wildShapeLimit,
  type BestiaryEntry,
  type CharacterSheet,
} from 'shared';
import { loadBestiary } from '../lib/bestiary';
import { t } from '../i18n';

interface Props {
  sheet: CharacterSheet;
  onChange: (known: string[]) => void;
}

/** Известные формы друида (Wild Shape): выбор до лимита уровня с проверкой CR/полёта. */
export default function WildShapeForm({ sheet, onChange }: Props) {
  const [entries, setEntries] = useState<BestiaryEntry[] | null>(null);
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState('');
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

  const level = druidLevelOf(sheet.classes);
  const moon = hasMoonCircle(sheet.classes);
  const limit = wildShapeLimit(level, moon);
  const chosen = sheet.wildShape?.known ?? [];
  const byKey = useMemo(() => new Map((entries ?? []).map((e) => [e.key, e])), [entries]);

  if (!limit) return null;
  const max = knownShapeLimit(level, moon);

  const issueOf = (entry: BestiaryEntry): string | undefined => {
    if (chosen.includes(entry.key)) return undefined;
    const issue = wildShapeFormIssue(entry, limit);
    if (issue === 'shapeTooBig') return t('ui.shape.issue.cr', { cr: limit.maxCr });
    if (issue === 'shapeNoFly') return t('ui.shape.issue.fly');
    if (issue === 'shapeNoBeast') return t('ui.shape.issue.beast');
    return chosen.length >= max ? t('ui.shape.reason.limit') : undefined;
  };

  const candidates = (entries ?? [])
    .filter((e) => e.type === 'beast')
    // Недоступные формы не показываем: CR/полёт по таблице; CR 0 — только под галкой.
    .filter((e) => chosen.includes(e.key) || (!wildShapeFormIssue(e, limit) && (showCr0 || crValue(e.cr) > 0)))
    .filter((e) => !query || e.name.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  const toggle = (key: string) => {
    onChange(chosen.includes(key) ? chosen.filter((k) => k !== key) : [...chosen, key]);
  };

  return (
    <div className="inv-form">
      <div className="sheet-section-title">{t('ui.shape.title')}</div>
      <div className="inv-counter">
        {t('ui.shape.counter', { n: chosen.length, max })} · {t('ui.shape.druidLevel', { n: level })}
        {moon ? ` · ${t('ui.shape.moon')}` : ''}
      </div>
      {!chosen.length && <div className="spells-note">{t('ui.shape.empty')}</div>}
      {chosen.map((key) => {
        const entry = byKey.get(key);
        const issue = entry ? wildShapeFormIssue(entry, limit) : 'shapeNoForm';
        return (
          <div className="spell-row" key={key}>
            <span className="spell-name">
              {entry?.name ?? key}
              {issue ? ` · ${t('ui.shape.nowUnfit')}` : ''}
            </span>
            <span className="spell-school">{entry?.cr ? `CR ${entry.cr}` : ''}</span>
            <button
              type="button"
              className="spell-remove"
              title={t('ui.shape.removeTitle')}
              onClick={() => toggle(key)}
            >
              ✕
            </button>
          </div>
        );
      })}
      <button type="button" className="spell-add" onClick={() => setPicking((v) => !v)}>
        {picking ? t('ui.common.close') : t('ui.shape.add')}
      </button>

      {picking && (
        <div className="inv-picker">
          <input
            type="text"
            className="inv-search"
            placeholder={t('ui.shape.search')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <label className="adv-check">
            <input type="checkbox" checked={showCr0} onChange={(e) => setShowCr0(e.target.checked)} />
            {t('ui.shape.showCr0')}
          </label>
          {candidates.map((entry) => {
            const added = chosen.includes(entry.key);
            const issue = issueOf(entry);
            return (
              <button
                key={entry.key}
                type="button"
                className={`inv-row${added ? ' on' : ''}`}
                disabled={!added && !!issue}
                onClick={() => toggle(entry.key)}
              >
                <span className="inv-row-head">
                  <span className="inv-name">{entry.name}</span>
                  <span className="inv-meta">
                    {t('ui.shape.meta', { cr: entry.cr, ac: entry.ac, hp: entry.hpAverage, speed: entry.speed })}
                    {!added && issue ? ` · ${issue}` : ''}
                  </span>
                </span>
                <span className="inv-desc">{entry.description.slice(0, 160)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
