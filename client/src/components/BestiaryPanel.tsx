import { useEffect, useMemo, useState } from 'react';
import { bestiaryIconPath, bestiaryTokenFields, type BestiaryEntry, type MonsterSize } from 'shared';
import Modal from './Modal';
import { loadBestiary } from '../lib/bestiary';
import { useIsDm } from '../lib/control';
import { useGameStore } from '../store/useGameStore';
import { t, type MessageKey } from '../i18n';

const SIZES: MonsterSize[] = ['T', 'S', 'M', 'L', 'H', 'G'];
const SIZE_KEYS: Record<MonsterSize, MessageKey> = {
  T: 'ui.bestiary.size.T',
  S: 'ui.bestiary.size.S',
  M: 'ui.bestiary.size.M',
  L: 'ui.bestiary.size.L',
  H: 'ui.bestiary.size.H',
  G: 'ui.bestiary.size.G',
};
const DEFENSE_LABELS = { immunity: '🛡', resistance: '◐', vulnerability: '⚡' } as const;

function crValue(cr: string): number {
  if (!cr || cr === '—') return 0;
  const [num, den] = cr.split('/');
  const value = Number(num);
  if (!Number.isFinite(value)) return 0;
  return den ? value / Number(den) : value;
}

export default function BestiaryPanel() {
  const setOpen = useGameStore((s) => s.setBestiaryOpen);
  const addLibraryItem = useGameStore((s) => s.addLibraryItem);
  const isDm = useIsDm();
  const [entries, setEntries] = useState<BestiaryEntry[] | null>(null);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [size, setSize] = useState('');
  const [familiarOnly, setFamiliarOnly] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    loadBestiary().then((list) => {
      if (alive) setEntries(list);
    });
    return () => {
      alive = false;
    };
  }, []);

  const types = useMemo(
    () => [...new Set((entries ?? []).map((e) => e.type).filter(Boolean))].sort(),
    [entries]
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (entries ?? [])
      .filter((e) => (!query || e.name.toLowerCase().includes(query)))
      .filter((e) => (!type || e.type === type))
      .filter((e) => (!size || e.size === size))
      .filter((e) => (!familiarOnly || e.familiar))
      .sort((a, b) => crValue(a.cr) - crValue(b.cr) || a.name.localeCompare(b.name));
  }, [entries, search, type, size, familiarOnly]);

  const add = (entry: BestiaryEntry) => {
    addLibraryItem(bestiaryTokenFields(entry));
    setAdded(entry.key);
    window.setTimeout(() => setAdded((current) => (current === entry.key ? null : current)), 1500);
  };

  return (
    <Modal onClose={() => setOpen(false)} title={t('ui.bestiary.title')} className="bestiary-modal" testId="bestiary-panel">
      <div className="bestiary-filters">
        <input
          type="text"
          value={search}
          placeholder={t('ui.bestiary.search')}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">{t('ui.bestiary.allTypes')}</option>
          {types.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <select value={size} onChange={(e) => setSize(e.target.value)}>
          <option value="">{t('ui.bestiary.allSizes')}</option>
          {SIZES.map((value) => (
            <option key={value} value={value}>
              {t(SIZE_KEYS[value])}
            </option>
          ))}
        </select>
        <label className="bestiary-familiar">
          <input type="checkbox" checked={familiarOnly} onChange={(e) => setFamiliarOnly(e.target.checked)} />
          {t('ui.bestiary.familiar')}
        </label>
      </div>
      <div className="bestiary-hint">{isDm ? t('ui.bestiary.hintDm') : t('ui.bestiary.hintPlayer')}</div>
      <div className="bestiary-count">{t('ui.bestiary.count', { count: filtered.length })}</div>
      <div className="bestiary-list">
        {entries === null && <div className="hint">{t('ui.bestiary.loading')}</div>}
        {entries !== null && filtered.length === 0 && <div className="hint">{t('ui.bestiary.empty')}</div>}
        {filtered.map((entry) => (
          <div className="bestiary-item" data-testid="bestiary-item" key={entry.key}>
            <div className="bestiary-row" onClick={() => setSelected((current) => (current === entry.key ? null : entry.key))}>
              <img className="bestiary-icon" src={bestiaryIconPath(entry)} alt="" width={40} height={40} loading="lazy" />
              <span className="bestiary-name">{entry.name}</span>
              <span className="bestiary-meta">
                {entry.type || '—'} · CR {entry.cr} · {t(SIZE_KEYS[entry.size])}
              </span>
              <span className="bestiary-stats">
                AC {entry.ac} · HP {entry.hpAverage}
              </span>
              <span className="bestiary-defenses">
                {entry.immunities.map((type) => (
                  <span key={`i:${type}`} title={type} className="def-imm">
                    {DEFENSE_LABELS.immunity}
                  </span>
                ))}
                {entry.resistances.map((type) => (
                  <span key={`r:${type}`} title={type} className="def-res">
                    {DEFENSE_LABELS.resistance}
                  </span>
                ))}
                {entry.vulnerabilities.map((type) => (
                  <span key={`v:${type}`} title={type} className="def-vul">
                    {DEFENSE_LABELS.vulnerability}
                  </span>
                ))}
              </span>
              {isDm && (
                <button
                  className="bestiary-add"
                  data-testid="bestiary-add"
                  disabled={added === entry.key}
                  onClick={(e) => {
                    e.stopPropagation();
                    add(entry);
                  }}
                >
                  {added === entry.key ? t('ui.bestiary.added') : t('ui.bestiary.add')}
                </button>
              )}
            </div>
            {selected === entry.key && (
              <div className="bestiary-details">
                {entry.appearance && <div className="bestiary-appearance">{entry.appearance}</div>}
                {entry.description && <div className="bestiary-desc">{entry.description}</div>}
                {entry.attacks.length > 0 && (
                  <div className="bestiary-block">
                    <b>{t('ui.bestiary.attacks')}</b>
                    <ul>
                      {entry.attacks.map((attack, i) => (
                        <li key={i}>
                          {attack.name}: {attack.hit} · {attack.damage}
                          {attack.damageType ? ` (${attack.damageType})` : ''}
                          {attack.rangeType === 'ranged' ? ` · ${attack.rangeNormal}${attack.rangeLong ? `/${attack.rangeLong}` : ''} ft` : ` · ${attack.rangeNormal} ft`}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {entry.actions.length > 0 && (
                  <div className="bestiary-block">
                    <b>{t('ui.bestiary.actions')}</b>
                    <ul>
                      {entry.actions.map((action) => (
                        <li key={action.id}>
                          {action.name}
                          {action.recharge ? ` (${action.recharge})` : ''}
                          {action.legendaryCost ? ` · L${action.legendaryCost}` : ''}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </Modal>
  );
}
