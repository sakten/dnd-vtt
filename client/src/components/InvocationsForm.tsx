import { useEffect, useMemo, useState } from 'react';
import {
  choiceSpellGrants,
  featSpellGrants,
  grantedSpells,
  invocationAutomated,
  invocationIssue,
  invocationLimit,
  spellAutomated,
  warlockLevelOf,
  type CharacterSheet,
  type InvocationEntry,
  type InvocationsData,
  type Spell,
} from 'shared';
import { useSpells } from '../lib/useSpells';
import { t } from '../i18n';

interface Props {
  sheet: CharacterSheet;
  onChange: (invocations: string[]) => void;
}

type Issue = ReturnType<typeof invocationIssue>;

/** Воззвания варлока (XPHB): выбор с жёсткой проверкой уровня, лимита и предпосылок. */
export default function InvocationsForm({ sheet, onChange }: Props) {
  const [data, setData] = useState<InvocationsData | null>(null);
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState('');
  const spells = useSpells();

  useEffect(() => {
    let alive = true;
    import('shared/invocationsData')
      .then((mod) => {
        if (alive) setData(mod.default);
      })
      .catch(() => void 0);
    return () => {
      alive = false;
    };
  }, []);

  const level = warlockLevelOf(sheet);
  const chosen = sheet.invocations ?? [];
  const cantrips = useMemo(() => {
    if (!spells) return [];
    const byKey = new Map(spells.map((s) => [s.key, s]));
    const keys = new Set<string>();
    for (const s of sheet.spells ?? []) keys.add(s.key);
    for (const g of grantedSpells(sheet.classes)) keys.add(g.key);
    for (const g of choiceSpellGrants(sheet.choices)) keys.add(g.key);
    for (const g of featSpellGrants(sheet.choices)) keys.add(g.key);
    return [...keys]
      .map((key) => byKey.get(key))
      .filter((s): s is Spell => !!s && s.level === 0)
      .map((s) => ({ key: s.key, damage: !!s.damage, attack: !!s.spellAttack }));
  }, [sheet, spells]);

  if (level <= 0) return null;
  const limit = data ? invocationLimit(level, data.limits) : 0;
  const ctx = { warlockLevel: level, chosen: new Set(chosen), cantrips };
  const byKey = new Map((data?.invocations ?? []).map((i) => [i.key, i]));

  const issueOf = (inv: InvocationEntry): Issue | 'limit' | undefined => {
    if (chosen.includes(inv.key)) return undefined;
    const issue = invocationIssue(inv, ctx);
    if (issue) return issue;
    return chosen.length >= limit ? 'limit' : undefined;
  };

  /** Красный маркер: движок механику не ведёт (или заклинание инвокации не автоматизировано). */
  const autoOf = (key: string): boolean =>
    invocationAutomated(key, {
      spellAutomated: (spellKey) => {
        const spell = spells?.find((s) => s.key === spellKey);
        return !!spell && spellAutomated(spell);
      },
    });

  const reasonText = (issue: Issue | 'limit', inv: InvocationEntry): string => {
    if (issue === 'limit') return t('ui.invocations.reason.limit');
    if (issue === 'level') return t('ui.invocations.reason.level', { n: inv.prereq?.level ?? inv.level });
    if (issue === 'pact') return t('ui.invocations.reason.pact');
    if (issue === 'requires') {
      const name = byKey.get(inv.prereq?.requires ?? '')?.name ?? inv.prereq?.requires ?? '';
      return t('ui.invocations.reason.requires', { name });
    }
    return t('ui.invocations.reason.cantrip');
  };

  const candidates = (data?.invocations ?? [])
    .filter((inv) => !query || inv.name.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));

  const toggle = (key: string) => {
    onChange(chosen.includes(key) ? chosen.filter((k) => k !== key) : [...chosen, key]);
  };

  return (
    <div className="inv-form">
      <div className="sheet-section-title">{t('ui.invocations.title')}</div>
      <div className="inv-counter">
        {t('ui.invocations.counter', { n: chosen.length, max: limit })} · {t('ui.invocations.warlockLevel', { n: level })}
      </div>
      {!chosen.length && <div className="spells-note">{t('ui.invocations.empty')}</div>}
      {chosen.map((key) => {
        const inv = byKey.get(key);
        return (
          <div className="spell-row" key={key}>
            <span className="spell-name">
              {!autoOf(key) && <span className="inv-manual" title={t('ui.invocations.manual')} />}
              {inv?.name ?? key}
            </span>
            <span className="spell-school">{t('ui.invocations.levelShort', { n: inv?.level ?? 1 })}</span>
            <button
              type="button"
              className="spell-remove"
              title={t('ui.invocations.removeTitle')}
              onClick={() => toggle(key)}
            >
              ✕
            </button>
          </div>
        );
      })}
      <button type="button" className="spell-add" onClick={() => setPicking((v) => !v)}>
        {picking ? t('ui.common.close') : t('ui.invocations.add')}
      </button>

      {picking && (
        <div className="inv-picker">
          <input
            type="text"
            className="inv-search"
            placeholder={t('ui.invocations.search')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {candidates.map((inv) => {
            const added = chosen.includes(inv.key);
            const issue = issueOf(inv);
            return (
              <button
                key={inv.key}
                type="button"
                className={`inv-row${added ? ' on' : ''}`}
                disabled={!added && !!issue}
                onClick={() => toggle(inv.key)}
              >
                <span className="inv-row-head">
                  <span className="inv-name">
                    {!autoOf(inv.key) && <span className="inv-manual" title={t('ui.invocations.manual')} />}
                    {inv.name}
                  </span>
                  <span className="inv-meta">
                    {t('ui.invocations.levelShort', { n: inv.level })}
                    {!added && issue ? ` · ${reasonText(issue, inv)}` : ''}
                  </span>
                </span>
                <span className="inv-desc">{inv.description.slice(0, 180)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
