import { useEffect, useState } from 'react';
import {
  DEFAULT_AC,
  DEFAULT_SPEED,
  modifiedValue,
  statNumber,
  type ConditionInstance,
  type Faction,
  type Sense,
  type TokenFields,
  type TokenStatblock,
} from 'shared';
import { useGameStore } from '../store/useGameStore';
import { t, type MessageKey } from '../i18n';
import { effectDurationText, effectSummaryText } from '../i18n/domain';
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

const FACTION_KEYS: Record<Faction, MessageKey> = {
  ally: 'ui.token.faction.ally',
  enemy: 'ui.token.faction.enemy',
  neutral: 'ui.token.faction.neutral',
};

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
  const [senses, setSenses] = useState<Sense[]>([]);
  const [faction, setFaction] = useState<Faction>('neutral');
  const [visible, setVisible] = useState(true);
  const [conditions, setConditions] = useState<ConditionInstance[]>([]);
  const [statblock, setStatblock] = useState<TokenStatblock | undefined>(undefined);
  const [saved, setSaved] = useState(false);

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
      canInteract: token.canInteract ?? false,
      damageDefenses: token.damageDefenses ?? [],
    });
    setHpCurrent(token.hpCurrent ?? 0);
    setHpTemp(token.hpTemp ?? 0);
    setSpeed(token.speed ?? DEFAULT_SPEED);
    setSenses(token.senses ?? []);
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

  const isCharacter = token.character === true;

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

  const persist = () => {
    setTokenFields(token.id, {
      ...draft,
      hpCurrent,
      hpTemp,
      conditions,
      ...(isDm ? { speed, senses, faction, visible, statblock } : {}),
    });
  };

  const save = () => {
    persist();
    close(null);
  };

  const saveStay = () => {
    persist();
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1500);
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
            <div className="tm-name">{draft.name || t('ui.token.noName')}</div>
            <div className="tm-stats">
              <span
                title={
                  acBonus
                    ? t('ui.tokenMenu.acBaseWithEffects', {
                        base: acBase,
                        default: acExplicit > 0 ? '' : t('ui.tokenMenu.defaultSuffix'),
                        effective: acEffective,
                      })
                    : t('ui.tokenMenu.ac', {
                        default: acExplicit > 0 ? '' : t('ui.tokenMenu.acDefault13'),
                      })
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
              <span>{t('ui.common.feet', { n: speed })}</span>
            </div>
            <div className="tm-conds">
              <ConditionChips conditions={conditions} spellByKey={spellByKey} max={null} />
              <EffectChips effects={token.effects ?? []} spellByKey={spellByKey} max={null} tokenId={token.id} />
              <DefenseChips defenses={draft.damageDefenses} />
            </div>
            <div className="tm-sub">
              {draft.isPlayerToken && (
                <span className={`tm-faction ${faction}`}>{t(FACTION_KEYS[faction])}</span>
              )}
              {draft.isPlayerToken && (
                <span className="tm-owner">
                  {draft.owner ? t('ui.token.playerTokenOwner', { owner: draft.owner }) : t('ui.token.playerToken')}
                </span>
              )}
            </div>
          </div>
          <button className="tm-close" aria-label={t('ui.common.close')} onClick={() => close(null)}>
            ×
          </button>
        </div>

        <div className="tm-tabs">
          <button className={`tm-tab${tab === 'main' ? ' active' : ''}`} onClick={() => setTab('main')}>
            {t('ui.common.main')}
          </button>
          {(isDm || canEdit) && (
            <button className={`tm-tab${tab === 'statblock' ? ' active' : ''}`} onClick={() => setTab('statblock')}>
              {t('ui.token.tabStatblock')}
            </button>
          )}
          {isDm && statblock?.spellcasting && (
            <button className={`tm-tab${tab === 'spells' ? ' active' : ''}`} onClick={() => setTab('spells')}>
              {t('ui.common.spells')}
            </button>
          )}
        </div>

        <div className="tm-body">
          {tab === 'main' && (
            <>
              <div className="sheet-section-title">{t('ui.tokenMenu.passport')}</div>
              <TokenPassportFields
                value={draft}
                onChange={patchDraft}
                speed={speed}
                onSpeedChange={isDm && !isCharacter ? setSpeed : undefined}
                senses={senses}
                onSensesChange={isDm && !isCharacter ? setSenses : undefined}
                readOnly={isCharacter}
              />
              {isDm && (
                <>
                  <div className="tm-seg-row">
                    <span className="tm-seg-label">{t('ui.tokenMenu.faction')}</span>
                    <div className="tm-seg">
                      {(['ally', 'enemy', 'neutral'] as Faction[]).map((f) => (
                        <button key={f} className={faction === f ? 'active' : ''} onClick={() => setFaction(f)}>
                          {t(FACTION_KEYS[f])}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="tm-seg-row">
                    <span className="tm-seg-label">{t('ui.tokenMenu.visibility')}</span>
                    <div className="tm-seg">
                      <button className={visible ? 'active' : ''} onClick={() => setVisible(true)}>
                        {t('ui.tokenMenu.show')}
                      </button>
                      <button className={!visible ? 'active' : ''} onClick={() => setVisible(false)}>
                        {t('ui.tokenMenu.hide')}
                      </button>
                    </div>
                  </div>
                  <TokenPlayerFields value={draft} onChange={patchDraft} isDm />
                </>
              )}
              {!isDm && setCurrentCharacter && currentCharacterId !== null && currentCharacterId === token.libraryItemId && (
                <button
                  type="button"
                  className="tm-link-btn"
                  onClick={() => {
                    setCurrentCharacter(null);
                    close(null);
                  }}
                >
                  {t('ui.token.unlinkCharacter')}
                </button>
              )}
              {!isDm &&
                !token.owner &&
                token.isPlayerToken &&
                setCurrentCharacter &&
                currentCharacterId !== token.libraryItemId && (
                  <button
                    type="button"
                    className="tm-link-btn"
                    onClick={() => {
                      setCurrentCharacter(token.libraryItemId);
                      close(null);
                    }}
                  >
                    {t('ui.token.makeMyCharacter')}
                  </button>
                )}

              <div className="sheet-section-title">{t('ui.tokenMenu.hp')}</div>
              <TokenHealthFields
                value={draft}
                onChange={patchDraft}
                current={hpCurrent}
                onCurrentChange={setHpCurrent}
                temp={hpTemp}
                onTempChange={setHpTemp}
                currentMin={-999}
                readOnly={isCharacter}
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
                        {t('ui.tokenMenu.damage')}
                      </button>
                      <button className="tm-heal" onClick={() => quickHp(1)}>
                        {t('ui.tokenMenu.heal')}
                      </button>
                    </div>
                  ) : undefined
                }
              />

              {isCharacter && (
                <div className="field-warning">
                  {t('ui.tokenMenu.characterStatsNote')}
                </div>
              )}

              <ConditionsForm value={conditions} onChange={setConditions} />

              {visibleEffects.length > 0 && (
                <div className="conditions-form">
                  <div className="sheet-section-title">{t('ui.tokenMenu.effectsTitle', { n: visibleEffects.length })}</div>
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
                              title={t('ui.tokenMenu.zoneAuraTitle')}
                            >
                              {t('ui.tokenMenu.zoneAura')}
                            </span>
                          ) : ownConcentration ? (
                            <button
                              type="button"
                              className="condition-remove"
                              onClick={() => endConcentration(token.id)}
                              title={t('ui.tokenMenu.endConcentrationTitle')}
                            >
                              {t('ui.common.stop')}
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="condition-remove"
                              onClick={() => removeEffect(e.id)}
                              title={t('ui.tokenMenu.removeEffectTitle')}
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
                  <div className="sheet-section-title">{t('ui.tokenMenu.featuresTitle', { n: hiddenEffects.length })}</div>
                  {hiddenEffects.map((e) => (
                    <div className="condition-row" key={e.id}>
                      <span className="condition-label" title={`${e.name}${effectSummaryText(e) ? ` — ${effectSummaryText(e)}` : ''}`}>
                        {e.name}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {!isCharacter && (
                <DamageDefensesForm
                  value={draft.damageDefenses}
                  onChange={(damageDefenses) => setDraft((d) => (d ? { ...d, damageDefenses } : d))}
                />
              )}

              <DescriptionField value={draft} onChange={patchDraft} />
            </>
          )}

          {tab === 'statblock' && (isDm || canEdit) && (
            <>
              <AttacksForm
                attacks={draft.attacks}
                onChange={(attacks) => setDraft((d) => (d ? { ...d, attacks } : d))}
                readOnly={isCharacter}
              />
              <StatblockForm
                value={isCharacter ? token.statblock : statblock}
                onChange={setStatblock}
                readOnly={isCharacter}
              />
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
              {t('ui.common.delete')}
            </button>
          )}
          <button className={saved ? 'saved' : ''} disabled={!canEdit} onClick={saveStay}>
            {saved ? t('ui.common.saved') : t('ui.common.save')}
          </button>
          <button
            className="primary"
            disabled={!canEdit}
            onClick={save}
          >
            {t('ui.common.done')}
          </button>
        </div>
    </Modal>
  );
}
