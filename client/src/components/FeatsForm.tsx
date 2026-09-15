import { useEffect, useMemo, useState } from 'react';
import {
  ABILITIES,
  FEATS,
  MAGICAL_DISCOVERIES_KEY,
  MAGICAL_DISCOVERIES_LISTS,
  featByKey,
  featMechanicsImplemented,
  magicalDiscoveriesAvailable,
  magicalDiscoveriesSpells,
  maxSpellLevel,
  type AbilityKey,
  type ClassLevel,
  type FeatCategory,
  type FeatDef,
  type FeatureChoice,
  type Spell,
} from 'shared';
import { loadSpells } from '../lib/spells';

const CATEGORY_NAMES: Record<FeatCategory, string> = {
  origin: 'Происхождение',
  general: 'Общий',
  fightingStyle: 'Боевой стиль',
};

interface Props {
  choices: FeatureChoice[];
  classes: ClassLevel[];
  onChange: (choices: FeatureChoice[]) => void;
}

/** Выборы фитов и черт персонажа: пикер каталога, заклинания Magic Initiate, Магические находки. */
export default function FeatsForm({ choices, classes, onChange }: Props) {
  const [picking, setPicking] = useState(false);
  const [category, setCategory] = useState<'all' | FeatCategory>('all');
  const [query, setQuery] = useState('');
  const [spells, setSpells] = useState<Spell[] | null>(null);

  const discovers = magicalDiscoveriesAvailable(classes);

  useEffect(() => {
    if ((picking || discovers) && !spells) void loadSpells().then(setSpells);
  }, [picking, discovers, spells]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return FEATS.filter(
      (f) => (category === 'all' || f.category === category) && (!q || f.name.toLowerCase().includes(q))
    );
  }, [category, query]);

  const patchAt = (index: number, patch: Partial<FeatureChoice>) =>
    onChange(choices.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  const removeAt = (index: number) => onChange(choices.filter((_c, i) => i !== index));

  const feats = choices
    .map((choice, index) => ({ choice, index }))
    .filter(({ choice }) => choice.kind === 'feat' && !!featByKey(choice.key));

  const discoveriesIndex = choices.findIndex(
    (c) => c.kind === 'featureOption' && c.key === MAGICAL_DISCOVERIES_KEY
  );
  const discoveries = magicalDiscoveriesSpells(choices);
  const patchDiscoveries = (patch: Partial<FeatureChoice>) => {
    if (discoveriesIndex >= 0) patchAt(discoveriesIndex, patch);
    else onChange([...choices, { kind: 'featureOption', key: MAGICAL_DISCOVERIES_KEY, spells: [], ...patch }]);
  };
  const discoveryPool = useMemo(() => {
    if (!discovers || !spells) return [];
    const level = classes.find((c) => c.className === 'bard')?.level ?? 0;
    const maxLvl = maxSpellLevel('bard', level, 'lore');
    const lists = new Set(MAGICAL_DISCOVERIES_LISTS.map((l) => l.className));
    return spells.filter((s) => s.level <= maxLvl && s.classes.some((c) => lists.has(c)));
  }, [discovers, spells, classes]);

  return (
    <div className="feats-form">
      <div className="sheet-section-title">Выбранные фиты</div>
      {feats.map(({ choice, index }) => {
        const feat = featByKey(choice.key)!;
        return (
          <div className="feat-row" key={`${choice.key}:${choice.list ?? index}`}>
            <div className="feat-head">
              <span className="feat-name">{feat.name}</span>
              {!featMechanicsImplemented(feat.key) && <span className="feat-todo">(TODO)</span>}
              <span className="feat-cat">{CATEGORY_NAMES[feat.category]}</span>
              <button className="feat-remove" title="Убрать фит" onClick={() => removeAt(index)}>
                ✕
              </button>
            </div>
            {feat.prereq && <div className="feat-hint">Требуется: {feat.prereq}</div>}
            {feat.spellLists && (
              <FeatSpellPicks feat={feat} choice={choice} spells={spells} onPatch={(p) => patchAt(index, p)} />
            )}
          </div>
        );
      })}
      {discovers && (
        <div className="feat-row">
          <div className="feat-head">
            <span className="feat-name">Магические находки</span>
            <span className="feat-cat">Коллегия Знания</span>
          </div>
          <div className="feat-hint">
            Два заклинания из списков жреца, друида или волшебника: заговор или круг, доступный барду.
            Всегда подготовлены, кастуются слотами.
          </div>
          {!spells && <div className="feat-hint">Загрузка заклинаний…</div>}
          {spells && (
            <div className="feat-spells">
              {[0, 1].map((slot) => (
                <label className="field" key={slot}>
                  <span>Заклинание {slot + 1}</span>
                  <select
                    value={discoveries[slot] ?? ''}
                    onChange={(e) => {
                      const next = [...discoveries];
                      next[slot] = e.target.value;
                      patchDiscoveries({ spells: next.filter(Boolean) });
                    }}
                  >
                    <option value="">— не выбрано —</option>
                    {discoveryPool
                      .filter((s) => s.key === discoveries[slot] || !discoveries.includes(s.key))
                      .map((s) => (
                        <option key={s.key} value={s.key}>
                          {s.name}
                        </option>
                      ))}
                  </select>
                </label>
              ))}
            </div>
          )}
        </div>
      )}
      {!picking && (
        <button className="feat-add" onClick={() => setPicking(true)}>
          + Добавить фит
        </button>
      )}
      {picking && (
        <div className="feat-picker">
          <div className="feat-picker-head">
            <input
              className="feat-search"
              placeholder="Поиск фита…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button className="feat-picker-close" onClick={() => setPicking(false)}>
              Закрыть
            </button>
          </div>
          <div className="feat-cats">
            {(['all', 'origin', 'general', 'fightingStyle'] as const).map((c) => (
              <button key={c} className={category === c ? 'active' : ''} onClick={() => setCategory(c)}>
                {c === 'all' ? 'Все' : CATEGORY_NAMES[c]}
              </button>
            ))}
          </div>
          <div className="feat-list">
            {list.map((f) => (
              <button
                className="feat-option"
                key={f.key}
                onClick={() => {
                  onChange([...choices, { kind: 'feat', key: f.key }]);
                  setPicking(false);
                }}
              >
                <span className="feat-option-name">
                  {f.name}
                  {!featMechanicsImplemented(f.key) && <span className="feat-todo"> (TODO)</span>}
                  {f.repeatable ? ' · повторяемый' : ''}
                </span>
                <span className="feat-option-desc">{f.description}</span>
                {f.prereq && <span className="feat-option-req">{f.prereq}</span>}
              </button>
            ))}
            {!list.length && <div className="feat-hint">Ничего не найдено</div>}
          </div>
        </div>
      )}
    </div>
  );
}

/** Настройка заклинаний фита со списками (Magic Initiate): список, способность, 2 заговора и заклинание 1 круга. */
function FeatSpellPicks({
  feat,
  choice,
  spells,
  onPatch,
}: {
  feat: FeatDef;
  choice: FeatureChoice;
  spells: Spell[] | null;
  onPatch: (patch: Partial<FeatureChoice>) => void;
}) {
  const lists = feat.spellLists ?? [];
  const list = choice.list ?? lists[0]?.className ?? '';
  const pool = (spells ?? []).filter((s) => s.classes.includes(list));
  const cantrips = pool.filter((s) => s.level === 0);
  const firsts = pool.filter((s) => s.level === 1);
  const chosen = choice.spells ?? [];

  const setCantrip = (slot: number, key: string) => {
    const next = [...chosen];
    next[slot] = key;
    onPatch({ spells: next.filter(Boolean) });
  };

  return (
    <div className="feat-spells">
      <label className="field">
        <span>Список</span>
        <select value={list} onChange={(e) => onPatch({ list: e.target.value, spells: [], spell: undefined })}>
          {lists.map((l) => (
            <option key={l.className} value={l.className}>
              {l.name}
            </option>
          ))}
        </select>
      </label>
      {feat.abilityChoose && (
        <label className="field">
          <span>Способность</span>
          <select
            value={choice.ability ?? feat.abilityChoose[0]}
            onChange={(e) => onPatch({ ability: e.target.value as AbilityKey })}
          >
            {feat.abilityChoose.map((a) => (
              <option key={a} value={a}>
                {ABILITIES.find((x) => x.key === a)?.name ?? a}
              </option>
            ))}
          </select>
        </label>
      )}
      {!spells && <div className="feat-hint">Загрузка заклинаний…</div>}
      {spells && (
        <>
          {[0, 1].map((slot) => (
            <label className="field" key={slot}>
              <span>Заговор {slot + 1}</span>
              <select value={chosen[slot] ?? ''} onChange={(e) => setCantrip(slot, e.target.value)}>
                <option value="">— не выбран —</option>
                {cantrips.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <label className="field">
            <span>Заклинание 1 круга</span>
            <select value={choice.spell ?? ''} onChange={(e) => onPatch({ spell: e.target.value || undefined })}>
              <option value="">— не выбрано —</option>
              {firsts.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
    </div>
  );
}
