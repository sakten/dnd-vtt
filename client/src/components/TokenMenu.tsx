import { useEffect, useState } from 'react';
import {
  DEFAULT_AC,
  DEFAULT_SPEED,
  effectDurationText,
  effectSummary,
  modifiedValue,
  statNumber,
  type ConditionInstance,
  type Faction,
  type TokenFields,
  type TokenStatblock,
} from 'shared';
import { useGameStore } from '../store/useGameStore';
import { useMapToken } from '../store/hooks';
import { useCanControlId, useIsDm } from '../lib/control';
import { useSpellByKey } from '../lib/useSpells';
import AttacksForm from './AttacksForm';
import ConditionChips from './ConditionChips';
import ConditionsForm from './ConditionsForm';
import DamageDefensesForm from './DamageDefensesForm';
import DefenseChips from './DefenseChips';
import EffectChips from './EffectChips';
import Modal from './Modal';
import StatblockForm from './StatblockForm';
import StatblockSpells from './StatblockSpells';
import { DescriptionField, TokenHealthFields, TokenPassportFields, TokenPlayerFields } from './TokenFieldsForm';

const FACTION_RU: Record<Faction, string> = { ally: 'Союзник', enemy: 'Враг', neutral: 'Нейтрал' };

export default function TokenMenu() {
  const menuId = useGameStore((s) => s.tokenMenuId);
  const token = useMapToken(menuId);
  const close = useGameStore((s) => s.setTokenMenu);
  const setTokenFields = useGameStore((s) => s.setTokenFields);
  const removeToken = useGameStore((s) => s.removeToken);
  const adjustTokenHp = useGameStore((s) => s.adjustTokenHp);
  const endConcentration = useGameStore((s) => s.endConcentration);
  const setCurrentCharacter = useGameStore((s) => s.setCurrentCharacter);
  const sheet = useGameStore((s) => s.sheet);
  const currentCharacterId = useGameStore((s) => s.currentCharacterId);
  const isDm = useIsDm();
  const canEdit = useCanControlId(menuId);
  const spellByKey = useSpellByKey();

  const [tab, setTab] = useState<'main' | 'statblock' | 'spells'>('main');
  const [draft, setDraft] = useState<TokenFields | null>(null);
  const [hpCurrent, setHpCurrent] = useState(0);
  const [hpTemp, setHpTemp] = useState(0);
  const [hpAmount, setHpAmount] = useState(5);
  const [speed, setSpeed] = useState(DEFAULT_SPEED);
  const [darkvision, setDarkvision] = useState(0);
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
    setDarkvision(token.darkvision ?? 0);
    setFaction(token.faction ?? 'neutral');
    setVisible(token.visible !== false);
    setConditions(token.conditions ?? []);
    setStatblock(token.statblock);
    setTab('main');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- черновик инициализируется при открытии меню
  }, [menuId]);

  // Сняли галку «кастер» — вкладка заклинаний исчезает, уходим на статблок.
  useEffect(() => {
    if (tab === 'spells' && !statblock?.spellcasting) setTab('statblock');
  }, [tab, statblock]);

  if (!token || !draft) return null;

  const patchDraft = (patch: Partial<TokenFields>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  const hpMax = statNumber(draft.hpMax);
  const pct = hpMax > 0 ? Math.max(0, Math.min(1, hpCurrent / hpMax)) : 0;
  const hpColor = pct > 0.5 ? '#4ecb71' : pct > 0.25 ? '#ffd166' : '#ff6b6b';

  const acExplicit = statNumber(draft.ac);
  const acBase = acExplicit > 0 ? acExplicit : DEFAULT_AC;
  const acAbilities =
    currentCharacterId && token.libraryItemId === currentCharacterId
      ? sheet?.abilities
      : token.statblock?.abilities;
  const acEffective = modifiedValue(acBase, token.effects ?? [], 'ac', {}, acAbilities);
  const acBonus = acEffective - acBase;

  const visibleEffects = (token.effects ?? []).filter((e) => !e.hidden);
  const hiddenEffects = (token.effects ?? []).filter((e) => e.hidden);

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
      ...(isDm ? { speed, darkvision, faction, visible, statblock } : {}),
    });
    close(null);
  };

  const removeEffect = (effectId: string) => {
    const nextEffects = (token.effects ?? []).filter((e) => e.id !== effectId);
    const nextConditions = (token.conditions ?? []).filter((c) => c.effectId !== effectId);
    setTokenFields(token.id, { effects: nextEffects, conditions: nextConditions });
    setConditions(nextConditions);
  };

  return (
    <Modal onClose={() => close(null)} className="token-modal">
        <div className="tm-header">
          <div className="tm-portrait">
            {draft.imageUrl ? <img src={draft.imageUrl} alt={draft.name} draggable={false} /> : <span>{'?'}</span>}
          </div>
          <div className="tm-head-info">
            <div className="tm-name">{draft.name || 'Без имени'}</div>
            <div className="tm-stats">
              <span
                title={
                  acBonus
                    ? `Базовый ${acBase}${acExplicit > 0 ? '' : ' (по умолчанию)'}, с эффектами ${acEffective}`
                    : `Класс брони${acExplicit > 0 ? '' : ' (по умолчанию 13)'}`
                }
              >
                AC {acEffective}
                {acBonus !== 0 && (
                  <em className={`tm-ac-buff${acBonus < 0 ? ' negative' : ''}`}>
                    {acBonus > 0 ? `+${acBonus}` : acBonus}
                  </em>
                )}
              </span>
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
              <EffectChips effects={token.effects ?? []} spellByKey={spellByKey} max={null} tokenId={token.id} />
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
          {isDm && statblock?.spellcasting && (
            <button className={`tm-tab${tab === 'spells' ? ' active' : ''}`} onClick={() => setTab('spells')}>
              Заклинания
            </button>
          )}
        </div>

        <div className="tm-body">
          {tab === 'main' && (
            <>
              <div className="sheet-section-title">Паспорт</div>
              <TokenPassportFields
                value={draft}
                onChange={patchDraft}
                speed={speed}
                onSpeedChange={isDm ? setSpeed : undefined}
                darkvision={darkvision}
                onDarkvisionChange={isDm ? setDarkvision : undefined}
              />
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
                  <TokenPlayerFields value={draft} onChange={patchDraft} isDm />
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
              <TokenHealthFields
                value={draft}
                onChange={patchDraft}
                current={hpCurrent}
                onCurrentChange={setHpCurrent}
                temp={hpTemp}
                onTempChange={setHpTemp}
                currentMin={-999}
                quick={
                  isDm ? (
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
                  ) : undefined
                }
              />

              <ConditionsForm value={conditions} onChange={setConditions} />

              {visibleEffects.length > 0 && (
                <div className="conditions-form">
                  <div className="sheet-section-title">Эффекты ({visibleEffects.length})</div>
                  {visibleEffects.map((e) => {
                    const zoneAura = !!e.zoneId;
                    const ownConcentration = e.concentration === true && e.sourceId === token.id;
                    return (
                      <div className="condition-row" key={e.id}>
                        <EffectChips effects={[e]} spellByKey={spellByKey} max={null} tokenId={token.id} />
                        <span className="condition-label" title={`${e.name} — ${effectDurationText(e.duration)}`}>
                          {effectDurationText(e.duration)}
                        </span>
                        {canEdit &&
                          (zoneAura ? (
                            <span
                              className="condition-aura"
                              title="Аура зоны: снимается выходом из зоны или прекращением концентрации"
                            >
                              аура зоны
                            </span>
                          ) : ownConcentration ? (
                            <button
                              type="button"
                              className="condition-remove"
                              onClick={() => endConcentration(token.id)}
                              title="Прекратить концентрацию (снимет зоны и эффекты)"
                            >
                              Прекратить
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="condition-remove"
                              onClick={() => removeEffect(e.id)}
                              title="Снять эффект"
                            >
                              ✕
                            </button>
                          ))}
                      </div>
                    );
                  })}
                </div>
              )}

              {hiddenEffects.length > 0 && (
                <div className="conditions-form">
                  <div className="sheet-section-title">Черты класса ({hiddenEffects.length})</div>
                  {hiddenEffects.map((e) => (
                    <div className="condition-row" key={e.id}>
                      <span className="condition-label" title={`${e.name}${effectSummary(e) ? ` — ${effectSummary(e)}` : ''}`}>
                        {e.name}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <DamageDefensesForm
                value={draft.damageDefenses}
                onChange={(damageDefenses) => setDraft((d) => (d ? { ...d, damageDefenses } : d))}
              />

              <DescriptionField value={draft} onChange={patchDraft} />
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

          {tab === 'spells' && isDm && statblock?.spellcasting && (
            <StatblockSpells statblock={statblock} onChange={setStatblock} />
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
    </Modal>
  );
}
