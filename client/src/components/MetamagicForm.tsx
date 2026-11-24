import { useMemo, useState } from 'react';
import {
  METAMAGIC_OPTIONS,
  knownMetamagic,
  metamagicDef,
  metamagicLimit,
  type CharacterSheet,
  type FeatureChoice,
} from 'shared';
import { getLocale, t } from '../i18n';

interface Props {
  sheet: CharacterSheet;
  onChange: (choices: FeatureChoice[]) => void;
}

/** Метамагия чародея (XPHB): выбор 2/4/6 опций с проверкой лимита. */
export default function MetamagicForm({ sheet, onChange }: Props) {
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState('');

  const limit = metamagicLimit(sheet.classes);
  const chosen = knownMetamagic(sheet.choices);
  const nameOf = (key: string): string => {
    const def = metamagicDef(key);
    return def ? (getLocale() === 'en' ? def.nameEn : def.name) : key;
  };

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return METAMAGIC_OPTIONS.filter(
      (option) =>
        !q || option.name.toLowerCase().includes(q) || option.nameEn.toLowerCase().includes(q)
    );
  }, [query]);

  if (limit <= 0) return null;

  const toggle = (key: string) => {
    const exists = chosen.includes(key);
    if (!exists && chosen.length >= limit) return;
    const next = exists ? chosen.filter((k) => k !== key) : [...chosen, key];
    const others = (sheet.choices ?? []).filter((c) => c.kind !== 'metamagic');
    onChange([...others, ...next.map((k): FeatureChoice => ({ kind: 'metamagic', key: k }))]);
  };

  return (
    <div className="inv-form">
      <div className="sheet-section-title">{t('ui.metamagic.title')}</div>
      <div className="inv-counter">{t('ui.metamagic.counter', { n: chosen.length, max: limit })}</div>
      {!chosen.length && <div className="spells-note">{t('ui.metamagic.empty')}</div>}
      {chosen.map((key) => {
        const def = metamagicDef(key);
        return (
          <div className="spell-row" key={key}>
            <span className="spell-name">
              {!def?.automated && <span className="inv-manual" title={t('ui.metamagic.manual')} />}
              {nameOf(key)}
            </span>
            <span className="spell-school">{t('ui.metamagic.cost', { n: def?.cost ?? 1 })}</span>
            <button
              type="button"
              className="spell-remove"
              title={t('ui.metamagic.removeTitle')}
              onClick={() => toggle(key)}
            >
              ✕
            </button>
          </div>
        );
      })}
      <button type="button" className="spell-add" onClick={() => setPicking((v) => !v)}>
        {picking ? t('ui.common.close') : t('ui.metamagic.add')}
      </button>

      {picking && (
        <div className="inv-picker">
          <input
            type="text"
            className="inv-search"
            placeholder={t('ui.metamagic.search')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {chosen.length >= limit && <div className="spells-note">{t('ui.metamagic.limit')}</div>}
          {candidates.map((option) => {
            const added = chosen.includes(option.key);
            const blocked = !added && chosen.length >= limit;
            return (
              <button
                key={option.key}
                type="button"
                className={`inv-row${added ? ' on' : ''}`}
                disabled={blocked}
                onClick={() => toggle(option.key)}
              >
                <span className="inv-row-head">
                  <span>
                    {nameOf(option.key)}
                    {!option.automated && <span className="inv-manual" title={t('ui.metamagic.manual')} />}
                  </span>
                  <span>{t('ui.metamagic.cost', { n: option.cost })}</span>
                </span>
                <span className="inv-row-desc">{option.description}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
