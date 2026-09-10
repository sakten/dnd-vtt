import { useState } from 'react';
import { applyRest, type PlayerResources, type ResourceItem } from 'shared';
import { useGameStore } from '../store/useGameStore';

function Pips({ current, max, onSet }: { current: number; max: number; onSet: (n: number) => void }) {
  return (
    <div className="pips">
      {Array.from({ length: max }, (_, i) => (
        <button
          key={i}
          className={`pip${i < current ? ' filled' : ''}`}
          title={`${i + 1} / ${max}`}
          onClick={() => onSet(i + 1 === current ? i : i + 1)}
        />
      ))}
    </div>
  );
}

function EditableNumber({
  value,
  onCommit,
  min = 0,
  className,
  title,
}: {
  value: number;
  onCommit: (n: number) => void;
  min?: number;
  className?: string;
  title?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  if (!editing) {
    return (
      <span
        className={className}
        title={title ?? 'Двойной клик — изменить'}
        onDoubleClick={() => {
          setDraft(String(value));
          setEditing(true);
        }}
      >
        {value}
      </span>
    );
  }
  const commit = () => {
    onCommit(Math.max(min, Number(draft) || 0));
    setEditing(false);
  };
  return (
    <input
      className={`${className ?? ''} number-edit`}
      type="number"
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
        else if (e.key === 'Escape') setEditing(false);
      }}
    />
  );
}

function HeartIcon() {
  return (
    <svg className="death-icon success" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
      <path
        d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
        fill="currentColor"
      />
    </svg>
  );
}

function SkullIcon() {
  return (
    <svg className="death-icon fail" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
      <circle cx="12" cy="10" r="7.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="9.2" cy="9.5" r="1.6" fill="currentColor" />
      <circle cx="14.8" cy="9.5" r="1.6" fill="currentColor" />
      <path d="M9 15.5v2.2M12 15.5v2.2M15 15.5v2.2" stroke="currentColor" strokeWidth="1.6" fill="none" />
      <path d="M6.5 18.5h11" stroke="currentColor" strokeWidth="1.6" fill="none" />
    </svg>
  );
}

export default function ResourcesPanel() {
  const resources = useGameStore((s) => s.resources);
  const updateResources = useGameStore((s) => s.updateResources);
  const rollHitDie = useGameStore((s) => s.rollHitDie);
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newMax, setNewMax] = useState('1');
  const [newReset, setNewReset] = useState<ResourceItem['reset']>('long');

  if (!resources) return null;
  const r = resources;
  const change = (fn: (res: PlayerResources) => PlayerResources) => updateResources(fn(r));

  const setHp = (patch: Partial<PlayerResources['hp']>) =>
    change((res) => ({ ...res, hp: { ...res.hp, ...patch } }));

  const addResource = () => {
    const name = newName.trim();
    if (!name) return;
    const max = Math.max(0, Number(newMax) || 0);
    change((res) => ({
      ...res,
      resources: [
        ...res.resources,
        { id: crypto.randomUUID(), name, current: max, max, reset: newReset },
      ],
    }));
    setNewName('');
    setNewMax('1');
  };

  const updateResource = (id: string, patch: Partial<ResourceItem>) =>
    change((res) => ({
      ...res,
      resources: res.resources.map((it) => (it.id === id ? { ...it, ...patch } : it)),
    }));

  const removeResource = (id: string) =>
    change((res) => ({ ...res, resources: res.resources.filter((it) => it.id !== id) }));

  return (
    <>
      <button className={`resources-tab${open ? ' hidden' : ''}`} onClick={() => setOpen(true)}>
        Ресурсы
      </button>
      {open && (
        <div className="resources-panel">
          <div className="resources-head">
            <strong>Ресурсы</strong>
            <button className="icon" title="Свернуть" onClick={() => setOpen(false)}>
              ◀
            </button>
          </div>

          <div className="resources-section">
            <div className="resources-hp">
              <EditableNumber
                className="hp-current"
                value={r.hp.current}
                title="Текущие хиты — двойной клик"
                onCommit={(n) => setHp({ current: n })}
              />
              <span className="hp-sep">/</span>
              <span className="hp-max-static" title="Максимум задаётся в карточке персонажа">
                {r.hp.max}
              </span>
              <span className="hp-temp-wrap">
                +<EditableNumber className="hp-temp" value={r.hp.temp} title="Временные хиты — двойной клик" onCommit={(n) => setHp({ temp: n })} /> вр.
              </span>
            </div>
            <div className="death-saves">
              <div className="death-group">
                <HeartIcon />
                {[0, 1, 2].map((i) => (
                  <button
                    key={`s${i}`}
                    className={`save-pip success${i < r.hp.deathSuccesses ? ' filled' : ''}`}
                    title="Удачный спасбросок от смерти"
                    onClick={() => setHp({ deathSuccesses: i + 1 === r.hp.deathSuccesses ? i : i + 1 })}
                  />
                ))}
              </div>
              <div className="death-group">
                {[0, 1, 2].map((i) => (
                  <button
                    key={`f${i}`}
                    className={`save-pip fail${i < r.hp.deathFailures ? ' filled' : ''}`}
                    title="Неудачный спасбросок от смерти"
                    onClick={() => setHp({ deathFailures: i + 1 === r.hp.deathFailures ? i : i + 1 })}
                  />
                ))}
                <SkullIcon />
              </div>
            </div>
          </div>

          {r.hitDice.length > 0 && (
            <div className="resources-section">
              <div className="resources-subtitle">Кости хитов</div>
              {r.hitDice.map((h) => (
                <div className="resource-row" key={h.die}>
                  <span className="resource-name">Кость d{h.die}</span>
                  <span className="resource-current">{h.current}</span>
                  <span className="dim">/</span>
                  <span className="resource-max-static">{h.max}</span>
                  <button
                    className="hit-die-btn"
                    disabled={h.current <= 0}
                    title={`Потратить кость d${h.die} и восстановить хиты`}
                    onClick={() => rollHitDie(h.die)}
                  >
                    Кинуть
                  </button>
                </div>
              ))}
            </div>
          )}

          {r.spellSlots.length > 0 && (
            <div className="resources-section">
              <div className="resources-subtitle">Ячейки заклинаний</div>
              {r.spellSlots.map((s) => (
                <div className="resource-row" key={s.level}>
                  <span className="resource-name">{s.level} ур.</span>
                  <Pips
                    current={s.current}
                    max={s.max}
                    onSet={(n) =>
                      change((res) => ({
                        ...res,
                        spellSlots: res.spellSlots.map((x) => (x.level === s.level ? { ...x, current: n } : x)),
                      }))
                    }
                  />
                </div>
              ))}
            </div>
          )}

          {r.pact.max > 0 && (
            <div className="resources-section">
              <div className="resources-subtitle">Ячейки колдуна ({r.pact.level} ур.)</div>
              <div className="resource-row">
                <span className="resource-name">Pact</span>
                <Pips
                  current={r.pact.current}
                  max={r.pact.max}
                  onSet={(n) => change((res) => ({ ...res, pact: { ...res.pact, current: n } }))}
                />
              </div>
            </div>
          )}

          <div className="resources-section">
            <div className="resources-subtitle">Прочие ресурсы</div>
            {r.resources.map((item) => {
              const maxControl = item.auto ? (
                <span className="resource-max-static" title="Задаётся правилами класса">
                  {item.max}
                </span>
              ) : (
                <EditableNumber
                  className="resource-max"
                  value={item.max}
                  title="Максимум — двойной клик"
                  onCommit={(max) => updateResource(item.id, { max, current: Math.min(item.current, max) })}
                />
              );
              return (
                <div className="resource-row" key={item.id}>
                  <span className="resource-name" title={item.name}>
                    {item.name}
                  </span>
                  {item.max > 0 && item.max <= 5 ? (
                    <>
                      <Pips
                        current={item.current}
                        max={item.max}
                        onSet={(n) => updateResource(item.id, { current: n })}
                      />
                      {maxControl}
                    </>
                  ) : (
                    <>
                      <EditableNumber
                        className="resource-current"
                        value={item.current}
                        onCommit={(n) => updateResource(item.id, { current: Math.min(item.max, n) })}
                      />
                      <span className="dim">/</span>
                      {maxControl}
                    </>
                  )}
                  {!item.auto && (
                    <button className="icon danger" title="Удалить" onClick={() => removeResource(item.id)}>
                      ✕
                    </button>
                  )}
                </div>
              );
            })}
            <div className="add-resource">
              <input
                type="text"
                placeholder="Свой ресурс"
                maxLength={40}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <input
                type="number"
                min={0}
                value={newMax}
                title="Максимум"
                onChange={(e) => setNewMax(e.target.value)}
              />
              <select value={newReset} onChange={(e) => setNewReset(e.target.value as ResourceItem['reset'])}>
                <option value="short">кор.</option>
                <option value="long">дол.</option>
                <option value="never">—</option>
              </select>
              <button className="icon" title="Добавить" onClick={addResource}>
                +
              </button>
            </div>
          </div>

          <div className="resources-rest">
            <button onClick={() => updateResources(applyRest(r, 'short'))}>Короткий отдых</button>
            <button onClick={() => updateResources(applyRest(r, 'long'))}>Долгий отдых</button>
          </div>
        </div>
      )}
    </>
  );
}
