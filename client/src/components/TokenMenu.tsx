import { useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_SPEED,
  statNumber,
  type ConditionInstance,
  type Faction,
  type Spell,
  type TokenFields,
  type TokenStatblock,
} from 'shared';
import { useGameStore } from '../store/useGameStore';
import { canControlWith } from '../lib/control';
import { useSpells } from '../lib/useSpells';
import AttacksForm from './AttacksForm';
import ConditionChips from './ConditionChips';
import ConditionsForm from './ConditionsForm';
import DamageDefensesForm from './DamageDefensesForm';
import DefenseChips from './DefenseChips';
import StatblockForm from './StatblockForm';

const FACTION_RU: Record<Faction, string> = { ally: 'Союзник', enemy: 'Враг', neutral: 'Нейтрал' };

export default function TokenMenu() {
  const menuId = useGameStore((s) => s.tokenMenuId);
  const token = useGameStore(
    (s) => s.scene.maps.find((m) => m.id === s.viewMapId)?.tokens.find((t) => t.id === s.tokenMenuId) ?? null
  );
  const close = useGameStore((s) => s.setTokenMenu);
  const setTokenFields = useGameStore((s) => s.setTokenFields);
  const removeToken = useGameStore((s) => s.removeToken);
  const adjustTokenHp = useGameStore((s) => s.adjustTokenHp);
  const setCurrentCharacter = useGameStore((s) => s.setCurrentCharacter);
  const isDm = useGameStore((s) => s.role === 'dm');
  const canEdit = useGameStore((s) => {
    const t = s.scene.maps.find((m) => m.id === s.viewMapId)?.tokens.find((x) => x.id === s.tokenMenuId);
    return t ? canControlWith(s, t) : false;
  });
  const spells = useSpells();
  const spellByKey = useMemo(() => new Map<string, Spell>(spells.map((s) => [s.key, s])), [spells]);

  const [tab, setTab] = useState<'main' | 'statblock'>('main');
  const [draft, setDraft] = useState<TokenFields | null>(null);
  const [hpCurrent, setHpCurrent] = useState(0);
  const [hpTemp, setHpTemp] = useState(0);
  const [hpAmount, setHpAmount] = useState(5);
  const [speed, setSpeed] = useState(DEFAULT_SPEED);
  const [faction, setFaction] = useState<Faction>('neutral');
  const [visible, setVisible] = useState(true);
  const [conditions, setConditions] = useState<ConditionInstance[]>([]);
  const [statblock, setStatblock] = useState<TokenStatblock | undefined>(undefined);

  useEffect(() => {
    if (!menuId || !token) return;
    setDraft({
      name: token.name,
      description: token.description,
      imageUrl: token.imageUrl,
      initiativeBonus: token.initiativeBonus ?? '',
      cells: token.cells,
      round: token.round,
      isPlayerToken: token.isPlayerToken,
      owner: token.owner,
      attacks: token.attacks,
      ac: token.ac,
      hpMax: token.hpMax,
      showStats: token.showStats,
      damageDefenses: token.damageDefenses ?? [],
    });
    setHpCurrent(token.hpCurrent ?? 0);
    setHpTemp(token.hpTemp ?? 0);
    setSpeed(token.speed ?? DEFAULT_SPEED);
    setFaction(token.faction ?? 'neutral');
    setVisible(token.visible !== false);
    setConditions(token.conditions ?? []);
    setStatblock(token.statblock);
    setTab('main');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- черновик инициализируется при открытии меню
  }, [menuId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  if (!token || !draft) return null;

  const hpMax = statNumber(draft.hpMax);
  const pct = hpMax > 0 ? Math.max(0, Math.min(1, hpCurrent / hpMax)) : 0;
  const hpColor = pct > 0.5 ? '#4ecb71' : pct > 0.25 ? '#ffd166' : '#ff6b6b';

  const quickHp = (sign: 1 | -1) => {
    const delta = sign * Math.max(0, Math.round(hpAmount));
    if (!delta) return;
    adjustTokenHp(token.id, delta);
    setHpCurrent((c) => Math.max(0, Math.min(hpMax || c + delta, c + delta)));
  };

  const save = () => {
    setTokenFields(token.id, {
      ...draft,
      hpCurrent,
      hpTemp,
      conditions,
      ...(isDm ? { speed, faction, visible, statblock } : {}),
    });
    close(null);
  };

  return (
    <div className="modal-backdrop" onMouseDown={() => close(null)}>
      <div className="modal token-modal" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
        <div className="tm-header">
          <div className="tm-portrait">
            {draft.imageUrl ? <img src={draft.imageUrl} alt={draft.name} draggable={false} /> : <span>{'?'}</span>}
          </div>
          <div className="tm-head-info">
            <div className="tm-name">{draft.name || 'Без имени'}</div>
            <div className="tm-stats">
              <span>AC {draft.ac || '—'}</span>
              <span className="tm-hp">
                <span className="tm-hp-bar">
                  <span className="tm-hp-fill" style={{ width: `${pct * 100}%`, background: hpColor }} />
                </span>
                {hpCurrent}/{hpMax || '—'}
                {hpTemp > 0 && <em className="tm-temp">+{hpTemp}</em>}
              </span>
              <span>{speed} фт</span>
            </div>
            <div className="tm-conds">
              <ConditionChips conditions={conditions} spellByKey={spellByKey} max={null} />
              <DefenseChips defenses={draft.damageDefenses} />
            </div>
            <div className="tm-sub">
              {draft.isPlayerToken && (
                <span className={`tm-faction ${faction}`}>{FACTION_RU[faction]}</span>
              )}
              {draft.isPlayerToken && (
                <span className="tm-owner">Токен игрока{draft.owner ? `: ${draft.owner}` : ''}</span>
              )}
            </div>
          </div>
          <button className="tm-close" aria-label="Закрыть" onClick={() => close(null)}>
            ×
          </button>
        </div>

        <div className="tm-tabs">
          <button className={`tm-tab${tab === 'main' ? ' active' : ''}`} onClick={() => setTab('main')}>
            Основное
          </button>
          {(isDm || canEdit) && (
            <button className={`tm-tab${tab === 'statblock' ? ' active' : ''}`} onClick={() => setTab('statblock')}>
              Статблок
            </button>
          )}
        </div>

        <div className="tm-body">
          {tab === 'main' && (
            <>
              <div className="sheet-section-title">Паспорт</div>
              <label className="field">
                <span>Название</span>
                <input
                  type="text"
                  value={draft.name}
                  maxLength={40}
                  onChange={(e) => setDraft((d) => (d ? { ...d, name: e.target.value } : d))}
                />
              </label>
              <div className="field-row">
                <label className="field">
                  <span>Бонус инициативы</span>
                  <input
                    type="text"
                    value={draft.initiativeBonus}
                    maxLength={10}
                    placeholder="+0"
                    onChange={(e) => setDraft((d) => (d ? { ...d, initiativeBonus: e.target.value } : d))}
                  />
                </label>
                {isDm && (
                  <label className="field">
                    <span>Скорость, фт</span>
                    <input
                      type="number"
                      min={0}
                      max={1000}
                      value={speed}
                      onChange={(e) => setSpeed(Math.max(0, Math.round(Number(e.target.value) || 0)))}
                    />
                  </label>
                )}
              </div>
              <div className="size-row">
                <span>Размер:</span>
                {[1, 2, 3, 4].map((n) => (
                  <button
                    key={n}
                    className={draft.cells === n ? 'active' : ''}
                    onClick={() => setDraft((d) => (d ? { ...d, cells: n } : d))}
                  >
                    {n}×{n}
                  </button>
                ))}
                <label className="checkbox-row inline">
                  <input
                    type="checkbox"
                    checked={draft.round}
                    onChange={(e) => setDraft((d) => (d ? { ...d, round: e.target.checked } : d))}
                  />
                  Круглый
                </label>
              </div>
              {isDm && (
                <>
                  <div className="tm-seg-row">
                    <span className="tm-seg-label">Фракция</span>
                    <div className="tm-seg">
                      {(['ally', 'enemy', 'neutral'] as Faction[]).map((f) => (
                        <button key={f} className={faction === f ? 'active' : ''} onClick={() => setFaction(f)}>
                          {FACTION_RU[f]}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="tm-seg-row">
                    <span className="tm-seg-label">Видимость</span>
                    <div className="tm-seg">
                      <button className={visible ? 'active' : ''} onClick={() => setVisible(true)}>
                        Показывать
                      </button>
                      <button className={!visible ? 'active' : ''} onClick={() => setVisible(false)}>
                        Скрыть
                      </button>
                    </div>
                  </div>
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={draft.isPlayerToken}
                      onChange={(e) =>
                        setDraft((d) =>
                          d
                            ? { ...d, isPlayerToken: e.target.checked, ...(e.target.checked ? {} : { owner: '' }) }
                            : d
                        )
                      }
                    />
                    Это токен игрока
                  </label>
                  {draft.isPlayerToken && (
                    <label className="field">
                      <span>Владелец (пусто — сам персонаж)</span>
                      <input
                        type="text"
                        value={draft.owner}
                        maxLength={40}
                        onChange={(e) => setDraft((d) => (d ? { ...d, owner: e.target.value } : d))}
                      />
                    </label>
                  )}
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={draft.showStats}
                      onChange={(e) => setDraft((d) => (d ? { ...d, showStats: e.target.checked } : d))}
                    />
                    Показывать статы игрокам
                  </label>
                </>
              )}
              {!isDm && !token.owner && token.isPlayerToken && setCurrentCharacter && (
                <button
                  type="button"
                  className="tm-link-btn"
                  onClick={() => {
                    setCurrentCharacter(token.libraryItemId);
                    close(null);
                  }}
                >
                  Сделать моим персонажем
                </button>
              )}

              <div className="sheet-section-title">Хирты</div>
              <div className="field-row">
                <label className="field">
                  <span>AC</span>
                  <input
                    type="text"
                    value={draft.ac}
                    maxLength={10}
                    placeholder="15"
                    onChange={(e) => setDraft((d) => (d ? { ...d, ac: e.target.value } : d))}
                  />
                </label>
                <label className="field">
                  <span>Макс. ХП</span>
                  <input
                    type="text"
                    value={draft.hpMax}
                    maxLength={10}
                    placeholder="20"
                    onChange={(e) => setDraft((d) => (d ? { ...d, hpMax: e.target.value } : d))}
                  />
                </label>
              </div>
              <div className="field-row">
                <label className="field">
                  <span>Текущее ХП</span>
                  <input
                    type="number"
                    value={hpCurrent}
                    onChange={(e) => setHpCurrent(Math.round(Number(e.target.value) || 0))}
                  />
                </label>
                <label className="field">
                  <span>Временные ХП</span>
                  <input
                    type="number"
                    value={hpTemp}
                    onChange={(e) => setHpTemp(Math.max(0, Math.round(Number(e.target.value) || 0)))}
                  />
                </label>
              </div>
              {isDm && (
                <div className="tm-quick-hp">
                  <input
                    type="number"
                    min={0}
                    value={hpAmount}
                    onChange={(e) => setHpAmount(Math.max(0, Math.round(Number(e.target.value) || 0)))}
                  />
                  <button className="tm-dmg" onClick={() => quickHp(-1)}>
                    − Урон
                  </button>
                  <button className="tm-heal" onClick={() => quickHp(1)}>
                    + Лечение
                  </button>
                </div>
              )}

              <ConditionsForm value={conditions} onChange={setConditions} />

              <DamageDefensesForm
                value={draft.damageDefenses}
                onChange={(damageDefenses) => setDraft((d) => (d ? { ...d, damageDefenses } : d))}
              />

              <div className="sheet-section-title">Описание</div>
              <label className="field">
                <textarea
                  value={draft.description}
                  rows={3}
                  maxLength={200}
                  onChange={(e) => setDraft((d) => (d ? { ...d, description: e.target.value } : d))}
                />
              </label>
            </>
          )}

          {tab === 'statblock' && (isDm || canEdit) && (
            <>
              <AttacksForm
                attacks={draft.attacks}
                onChange={(attacks) => setDraft((d) => (d ? { ...d, attacks } : d))}
              />
              {isDm && <StatblockForm value={statblock} onChange={setStatblock} />}
            </>
          )}
        </div>

        <div className="modal-actions spread">
          {canEdit && (
            <button
              className="danger"
              onClick={() => {
                removeToken(token.id);
                close(null);
              }}
            >
              Удалить
            </button>
          )}
          <button
            className="primary"
            disabled={!canEdit}
            onClick={save}
          >
            Готово
          </button>
        </div>
      </div>
    </div>
  );
}
