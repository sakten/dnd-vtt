import { useEffect, useState } from 'react';
import {
  battleMasterLevel,
  maneuverChoices,
  maneuverDescription,
  maneuverLimit,
  maneuverMeta,
  type CharacterSheet,
  type FeatureChoice,
  type ManeuverEntry,
  type ManeuversData,
} from 'shared';
import { getLocale, t } from '../i18n';
import { maneuverDisplayName, useNames } from '../i18n/names';
import { useManeuverText } from '../i18n/useLocalizedText';

interface Props {
  sheet: CharacterSheet;
  onChange: (choices: FeatureChoice[]) => void;
}

/** Манёвры боевого мастера (XPHB): выбор 3/5 известных приёмов с проверкой лимита. */
export default function ManeuversForm({ sheet, onChange }: Props) {
  useNames();
  useManeuverText();
  const [data, setData] = useState<ManeuversData | null>(null);
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let alive = true;
    import('shared/maneuversData')
      .then((mod) => {
        if (alive) setData(mod.default);
      })
      .catch(() => void 0);
    return () => {
      alive = false;
    };
  }, []);

  const level = battleMasterLevel(sheet.classes);
  const limit = maneuverLimit(level);
  const chosen = maneuverChoices(sheet.choices);

  if (level < 3) return null;
  const byKey = new Map((data?.maneuvers ?? []).map((m) => [m.key, m]));

  const displayName = (key: string, fallback: string): string => maneuverDisplayName(key, fallback);
  const automated = (key: string): boolean => maneuverMeta(key)?.automated === true;
  const descriptionOf = (key: string, entry?: ManeuverEntry): string =>
    maneuverDescription(key, getLocale()) ?? entry?.description ?? '';

  const candidates = (data?.maneuvers ?? [])
    .filter((m) => !query || m.name.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  const toggle = (key: string) => {
    const exists = chosen.includes(key);
    if (!exists && chosen.length >= limit) return;
    const next = exists ? chosen.filter((k) => k !== key) : [...chosen, key];
    const others = (sheet.choices ?? []).filter((c) => c.kind !== 'maneuver');
    onChange([...others, ...next.map((k): FeatureChoice => ({ kind: 'maneuver', key: k }))]);
  };

  return (
    <div className="inv-form">
      <div className="sheet-section-title">{t('ui.maneuvers.title')}</div>
      <div className="inv-counter">
        {t('ui.maneuvers.counter', { n: chosen.length, max: limit })} ·{' '}
        {t('ui.maneuvers.fighterLevel', { n: level })}
      </div>
      {!chosen.length && <div className="spells-note">{t('ui.maneuvers.empty')}</div>}
      {chosen.map((key) => {
        const entry = byKey.get(key);
        return (
          <div className="spell-row" key={key}>
            <span className="spell-name">
              {!automated(key) && <span className="inv-manual" title={t('ui.maneuvers.manual')} />}
              {displayName(key, entry?.name ?? key)}
            </span>
            <span className="spell-school">{t('ui.maneuvers.known')}</span>
            <button
              type="button"
              className="spell-remove"
              title={t('ui.maneuvers.removeTitle')}
              onClick={() => toggle(key)}
            >
              ✕
            </button>
          </div>
        );
      })}
      <button type="button" className="spell-add" onClick={() => setPicking((v) => !v)}>
        {picking ? t('ui.common.close') : t('ui.maneuvers.add')}
      </button>

      {picking && (
        <div className="inv-picker">
          <input
            type="text"
            className="inv-search"
            placeholder={t('ui.maneuvers.search')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {chosen.length >= limit && <div className="spells-note">{t('ui.maneuvers.reason.limit')}</div>}
          {candidates.map((entry) => {
            const added = chosen.includes(entry.key);
            const blocked = !added && chosen.length >= limit;
            const text = descriptionOf(entry.key, entry);
            return (
              <button
                key={entry.key}
                type="button"
                className={`inv-row${added ? ' on' : ''}`}
                disabled={blocked}
                onClick={() => toggle(entry.key)}
              >
                <span className="inv-row-head">
                  <span className="inv-name">
                    {!automated(entry.key) && <span className="inv-manual" title={t('ui.maneuvers.manual')} />}
                    {displayName(entry.key, entry.name)}
                  </span>
                  <span className="inv-meta">{added ? t('ui.maneuvers.known') : ''}</span>
                </span>
                <span className="inv-desc">{text.slice(0, 220)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
