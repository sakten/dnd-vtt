import { useMemo, useState } from 'react';
import {
  ABILITIES,
  CLASSES,
  DAMAGE_TYPES,
  type AbilityKey,
  type AreaSpec,
  type Spell,
  type SpellDef,
  type SpellDuration,
  type SpellSchool,
  type SpellUpcast,
} from 'shared';
import { t, type MessageKey } from '../i18n';
import { abilityName, classLabel, damageLabel } from '../i18n/domain';
import { specIssueText } from '../i18n/errors';
import { spellDisplayName } from '../i18n/names';
import {
  WIZARD_PROFILES,
  blankRecord,
  copyRecord,
  keyFromName,
  validateConstructor,
  type WizardProfileId,
} from '../lib/spellConstructor';
import { spellLevelLabel, spellMechanicsShort, spellSchoolLabel } from '../lib/spellText';
import { useSpells } from '../lib/useSpells';
import { useGameStore } from '../store/useGameStore';
import { Field } from './Field';
import Modal from './Modal';
import SpellIcon from './SpellIcon';

type Stage = 'wizard' | 'base' | 'form';

const SCHOOLS: SpellSchool[] = [
  'Abjuration',
  'Conjuration',
  'Divination',
  'Enchantment',
  'Evocation',
  'Illusion',
  'Necromancy',
  'Transmutation',
];
const UNITS = ['action', 'bonus', 'reaction', 'minute', 'hour'] as const;
const RANGE_TYPES = ['touch', 'ranged', 'self'] as const;
const DURATION_KINDS = ['instantaneous', 'concentration', 'timed', 'permanent'] as const;
const AREA_SHAPES: AreaSpec['shape'][] = ['sphere', 'cone', 'cube', 'line', 'cylinder'];
const CANTrip_LEVELS = [5, 11, 17];
const ABILITY_KEYS = ABILITIES.map((a) => a.key);

type DurationKind = (typeof DURATION_KINDS)[number];

interface Props {
  initial: SpellDef;
  /** true — ключ записи зафиксирован (редактирование существующего кастома). */
  lockedKey: boolean;
  /** Стартовый экран: «с нуля» (мастер), копия канона, готовый черновик. */
  start?: Stage;
  onClose: () => void;
}

/** Конструктор кастомного заклинания (R16 К1): вход, мета-форма, превью, сохранение. */
export default function SpellConstructorModal({ initial, lockedKey, start = 'form', onClose }: Props) {
  const [stage, setStage] = useState<Stage>(start);
  const [record, setRecord] = useState<SpellDef>(() => structuredClone(initial));
  const spells = useSpells();
  const importCustom = useGameStore((s) => s.importCustomSpell);
  const [query, setQuery] = useState('');

  const setMeta = (patch: Partial<Spell>) =>
    setRecord((r) => {
      const next = { ...r, ...patch };
      if (patch.name !== undefined && !lockedKey) next.key = keyFromName(patch.name);
      return next;
    });

  const validation = useMemo(() => validateConstructor(record), [record]);
  const issueTexts = useMemo(
    () => [
      ...validation.local.map((issue) => t(`ui.constructor.issue.${issue.code}` as MessageKey, issue.params)),
      ...validation.spec.map(specIssueText),
    ],
    [validation]
  );
  const preview = useMemo(() => {
    try {
      return spellMechanicsShort(record);
    } catch {
      return '';
    }
  }, [record]);

  const duration = record.duration[0];
  const durationKind: DurationKind =
    duration?.type === 'concentration' || duration?.type === 'timed' || duration?.type === 'permanent'
      ? duration.type
      : 'instantaneous';
  const durationAmount = duration?.duration?.amount ?? 1;
  const durationUnit = duration?.duration?.type ?? 'minutes';
  const setDuration = (kind: DurationKind, amount = durationAmount, unit = durationUnit) => {
    let next: SpellDuration[];
    if (kind === 'instantaneous') next = [{ type: 'instantaneous' }];
    else if (kind === 'permanent') next = [{ type: 'permanent' }];
    else next = [{ type: kind, duration: { type: unit, amount } }];
    setMeta({ duration: next, concentration: kind === 'concentration' ? true : undefined });
  };

  const saveAbility = (record.save?.[0] ?? '') as AbilityKey | '';
  const area = record.areaSpec;
  const upcast = (patch: Partial<SpellUpcast>) =>
    setMeta({ upcast: { above: upcastAbove(), ...record.upcast, ...patch } });
  function upcastAbove(): number | undefined {
    return record.upcast?.above ?? (record.level > 0 ? record.level : undefined);
  }

  const tier = (level: number) => record.cantrip?.find((x) => x.level === level);
  const setTier = (level: number, patch: { dice?: string; count?: number }) => {
    const current = tier(level) ?? { level };
    const next = { ...current, ...patch };
    const list = [...(record.cantrip ?? []).filter((x) => x.level !== level), next]
      .filter((x) => x.dice || (x.count ?? 0) > 1)
      .sort((a, b) => a.level - b.level);
    setMeta({ cantrip: list.length ? list : undefined });
  };

  const save = () => {
    if (issueTexts.length) return;
    importCustom(JSON.stringify(record));
    onClose();
  };

  const fill = spells
    ?.filter((s) => {
      const q = query.trim().toLowerCase();
      return q ? s.name.toLowerCase().includes(q) || spellDisplayName(s).toLowerCase().includes(q) : true;
    })
    .slice(0, 60);

  if (stage === 'wizard' || stage === 'base') {
    return (
      <Modal onClose={onClose} className="spell-constructor" title={t('ui.constructor.title')}>
        {stage === 'wizard' ? (
          <>
            <div className="sheet-section-title">{t('ui.constructor.wizardTitle')}</div>
            <div className="constructor-profiles">
              {WIZARD_PROFILES.map((profile) => (
                <button
                  type="button"
                  key={profile.id}
                  className="constructor-profile"
                  onClick={() => {
                    setRecord(blankRecord(profile.id as WizardProfileId, t('ui.constructor.defaultName')));
                    setStage('form');
                  }}
                >
                  <span className="constructor-profile-name">{t(profile.labelKey as MessageKey)}</span>
                  <span className="hint">{t(profile.hintKey as MessageKey)}</span>
                </button>
              ))}
            </div>
            <div className="modal-actions">
              <button type="button" onClick={() => setStage('base')}>
                {t('ui.constructor.copyTitle')}
              </button>
              <button type="button" onClick={onClose}>
                {t('ui.common.cancel')}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="sheet-section-title">{t('ui.constructor.copyTitle')}</div>
            <p className="hint">{t('ui.constructor.copyHint')}</p>
            <input
              type="text"
              placeholder={t('ui.constructor.searchPlaceholder')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="spell-picker-list constructor-base-list">
              {(fill ?? []).map((s) => (
                <button
                  type="button"
                  key={s.key}
                  className="spell-pick constructor-base-item"
                  onClick={() => {
                    setRecord(copyRecord(s as SpellDef, t('ui.constructor.copySuffix')));
                    setStage('form');
                  }}
                >
                  <SpellIcon spell={s} className="spell-pick-icon" />
                  <span className="spell-pick-name">{spellDisplayName(s)}</span>
                  <span className="spell-pick-meta">
                    {spellLevelLabel(s.level)} · {spellSchoolLabel(s.school)}
                  </span>
                </button>
              ))}
              {spells && !fill?.length && <div className="spells-note">{t('ui.common.notFoundDot')}</div>}
            </div>
            <div className="modal-actions">
              <button type="button" onClick={() => setStage('wizard')}>
                {t('ui.constructor.backToWizard')}
              </button>
            </div>
          </>
        )}
      </Modal>
    );
  }

  return (
    <Modal onClose={onClose} className="spell-constructor" title={t('ui.constructor.title')}>
      <div className="constructor-grid">
        <div className="constructor-fields">
          <div className="field-row">
            <Field label={t('ui.constructor.name')}>
              <input type="text" maxLength={80} value={record.name} onChange={(e) => setMeta({ name: e.target.value })} />
            </Field>
            <Field label={t('ui.constructor.key')}>
              <input type="text" value={record.key} readOnly />
            </Field>
          </div>

          <div className="field-row">
            <Field label={t('ui.constructor.level')}>
              <select value={record.level} onChange={(e) => setMeta({ level: Number(e.target.value) })}>
                {Array.from({ length: 10 }, (_, i) => i).map((level) => (
                  <option key={level} value={level}>
                    {spellLevelLabel(level)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('ui.constructor.school')}>
              <select value={record.school} onChange={(e) => setMeta({ school: e.target.value as SpellSchool })}>
                {SCHOOLS.map((school) => (
                  <option key={school} value={school}>
                    {spellSchoolLabel(school)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('ui.constructor.time')}>
              <select value={record.time[0]?.unit ?? 'action'} onChange={(e) => setMeta({ time: [{ number: 1, unit: e.target.value }] })}>
                {UNITS.map((unit) => (
                  <option key={unit} value={unit}>
                    {t(`ui.constructor.unit.${unit}` as MessageKey)}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="ability-types">
            <span className="constructor-chip-title">{t('ui.constructor.classes')}</span>
            {Object.keys(CLASSES).map((key) => {
              const checked = record.classes.includes(key);
              return (
                <button
                  type="button"
                  key={key}
                  className={`ability-type${checked ? ' on' : ''}`}
                  onClick={() =>
                    setMeta({ classes: checked ? record.classes.filter((c) => c !== key) : [...record.classes, key] })
                  }
                >
                  {classLabel(key, key)}
                </button>
              );
            })}
          </div>

          <div className="field-row">
            <Field label={t('ui.constructor.range')}>
              <select
                value={record.range.type}
                onChange={(e) => {
                  const type = e.target.value;
                  setMeta({ range: type === 'ranged' ? { type, distance: { type: 'feet', amount: 60 } } : { type } });
                }}
              >
                {RANGE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t(`ui.constructor.rangeType.${type}` as MessageKey)}
                  </option>
                ))}
              </select>
            </Field>
            {record.range.type === 'ranged' && (
              <Field label={t('ui.constructor.rangeFeet')}>
                <input
                  type="number"
                  min={5}
                  step={5}
                  value={record.range.distance?.amount ?? 60}
                  onChange={(e) =>
                    setMeta({
                      range: { ...record.range, distance: { type: 'feet', amount: Number(e.target.value) || 5 } },
                    })
                  }
                />
              </Field>
            )}
            <Field label={t('ui.constructor.duration')}>
              <select value={durationKind} onChange={(e) => setDuration(e.target.value as DurationKind)}>
                {DURATION_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {t(`ui.constructor.durationKind.${kind}` as MessageKey)}
                  </option>
                ))}
              </select>
            </Field>
            {(durationKind === 'timed' || durationKind === 'concentration') && (
              <Field label={t('ui.constructor.durationAmount')}>
                <input
                  type="number"
                  min={1}
                  value={durationAmount}
                  onChange={(e) => setDuration(durationKind, Number(e.target.value) || 1, durationUnit)}
                />
              </Field>
            )}
          </div>

          <div className="constructor-checks">
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={record.ritual === true}
                onChange={(e) => setMeta({ ritual: e.target.checked || undefined })}
              />
              <span>{t('ui.constructor.ritual')}</span>
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={record.components.v === true}
                onChange={(e) => setMeta({ components: { ...record.components, v: e.target.checked || undefined } })}
              />
              <span>{t('ui.constructor.componentV')}</span>
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={record.components.s === true}
                onChange={(e) => setMeta({ components: { ...record.components, s: e.target.checked || undefined } })}
              />
              <span>{t('ui.constructor.componentS')}</span>
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={record.components.m !== undefined && record.components.m !== false}
                onChange={(e) => setMeta({ components: { ...record.components, m: e.target.checked ? true : undefined } })}
              />
              <span>{t('ui.constructor.componentM')}</span>
            </label>
            {record.components.m !== undefined && record.components.m !== false && (
              <input
                type="text"
                placeholder={t('ui.constructor.material')}
                value={typeof record.components.m === 'string' ? record.components.m : ''}
                onChange={(e) =>
                  setMeta({ components: { ...record.components, m: e.target.value || true } })
                }
              />
            )}
          </div>

          <div className="sheet-section-title">{t('ui.constructor.attackSave')}</div>
          <div className="field-row">
            <Field label={t('ui.constructor.attack')}>
              <select
                value={record.spellAttack ?? ''}
                onChange={(e) => setMeta({ spellAttack: (e.target.value || undefined) as Spell['spellAttack'] })}
              >
                <option value="">{t('ui.constructor.attackNone')}</option>
                <option value="melee">{t('ui.constructor.attackMelee')}</option>
                <option value="ranged">{t('ui.constructor.attackRanged')}</option>
              </select>
            </Field>
            <Field label={t('ui.constructor.save')}>
              <select value={saveAbility} onChange={(e) => setMeta({ save: e.target.value ? [e.target.value as AbilityKey] : undefined })}>
                <option value="">{t('ui.constructor.saveNone')}</option>
                {ABILITY_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {abilityName(key)}
                  </option>
                ))}
              </select>
            </Field>
            {saveAbility && (
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={record.saveHalf === true}
                  onChange={(e) => setMeta({ saveHalf: e.target.checked || undefined })}
                />
                <span>{t('ui.constructor.saveHalf')}</span>
              </label>
            )}
          </div>

          <div className="sheet-section-title">{t('ui.constructor.damage')}</div>
          <div className="field-row">
            <Field label={t('ui.constructor.damageDice')}>
              <input
                type="text"
                placeholder="3d6"
                value={(record.damage?.dice ?? []).join(' + ')}
                onChange={(e) => {
                  const dice = e.target.value
                    .split('+')
                    .map((x) => x.trim())
                    .filter(Boolean);
                  setMeta({ damage: dice.length ? { dice, types: record.damage?.types ?? [] } : undefined });
                }}
              />
            </Field>
          </div>
          <div className="ability-types">
            {DAMAGE_TYPES.map((damage) => {
              const checked = record.damage?.types?.includes(damage.key) ?? false;
              return (
                <button
                  type="button"
                  key={damage.key}
                  className={`ability-type${checked ? ' on' : ''}`}
                  onClick={() => {
                    if (!record.damage) return;
                    const types = checked
                      ? record.damage.types.filter((x) => x !== damage.key)
                      : [...record.damage.types, damage.key];
                    setMeta({ damage: { ...record.damage, types } });
                  }}
                >
                  {damageLabel(damage.key)}
                </button>
              );
            })}
          </div>

          <div className="sheet-section-title">{t('ui.constructor.area')}</div>
          <div className="field-row">
            <Field label={t('ui.constructor.areaShape')}>
              <select
                value={area?.shape ?? ''}
                onChange={(e) => {
                  const shape = e.target.value as AreaSpec['shape'] | '';
                  setMeta({
                    areaSpec: shape
                      ? { shape, size: area?.size ?? 15, ...(shape === 'line' ? { width: area?.width ?? 5 } : {}) }
                      : undefined,
                  });
                }}
              >
                <option value="">{t('ui.constructor.areaNone')}</option>
                {AREA_SHAPES.map((shape) => (
                  <option key={shape} value={shape}>
                    {t(`ui.constructor.areaShapeName.${shape}` as MessageKey)}
                  </option>
                ))}
              </select>
            </Field>
            {area && (
              <Field label={t('ui.constructor.areaSize')}>
                <input
                  type="number"
                  min={5}
                  step={5}
                  value={area.size}
                  onChange={(e) => setMeta({ areaSpec: { ...area, size: Number(e.target.value) || 5 } })}
                />
              </Field>
            )}
            {area?.shape === 'line' && (
              <Field label={t('ui.constructor.areaWidth')}>
                <input
                  type="number"
                  min={5}
                  step={5}
                  value={area.width ?? 5}
                  onChange={(e) => setMeta({ areaSpec: { ...area, width: Number(e.target.value) || 5 } })}
                />
              </Field>
            )}
          </div>

          {record.level === 0 ? (
            <>
              <div className="sheet-section-title">{t('ui.constructor.cantrip')}</div>
              {CANTrip_LEVELS.map((level) => {
                const item = tier(level);
                return (
                  <div className="field-row" key={level}>
                    <span className="constructor-tier-label">{t('ui.constructor.cantripLevel', { level })}</span>
                    <Field label={t('ui.constructor.upcastDice')}>
                      <input
                        type="text"
                        placeholder="2d10"
                        value={item?.dice ?? ''}
                        onChange={(e) => setTier(level, { dice: e.target.value.trim() || undefined })}
                      />
                    </Field>
                    <Field label={t('ui.constructor.upcastAttacks')}>
                      <input
                        type="number"
                        min={0}
                        value={item?.count ?? ''}
                        onChange={(e) => setTier(level, { count: Number(e.target.value) || undefined })}
                      />
                    </Field>
                  </div>
                );
              })}
            </>
          ) : (
            <>
              <div className="sheet-section-title">{t('ui.constructor.upcast')}</div>
              <div className="field-row">
                <Field label={t('ui.constructor.upcastAbove')}>
                  <input
                    type="number"
                    min={0}
                    max={9}
                    value={upcastAbove() ?? ''}
                    onChange={(e) => upcast({ above: Number(e.target.value) || undefined })}
                  />
                </Field>
                <Field label={t('ui.constructor.upcastDice')}>
                  <input type="text" placeholder="1d6" value={record.upcast?.dice ?? ''} onChange={(e) => upcast({ dice: e.target.value.trim() || undefined })} />
                </Field>
                <Field label={t('ui.constructor.upcastFlat')}>
                  <input type="number" value={record.upcast?.flat ?? ''} onChange={(e) => upcast({ flat: Number(e.target.value) || undefined })} />
                </Field>
                <Field label={t('ui.constructor.upcastTargets')}>
                  <input type="number" min={0} value={record.upcast?.targets ?? ''} onChange={(e) => upcast({ targets: Number(e.target.value) || undefined })} />
                </Field>
                <Field label={t('ui.constructor.upcastAttacks')}>
                  <input type="number" min={0} value={record.upcast?.attacks ?? ''} onChange={(e) => upcast({ attacks: Number(e.target.value) || undefined })} />
                </Field>
              </div>
            </>
          )}

          <div className="sheet-section-title">{t('ui.constructor.description')}</div>
          <textarea
            className="room-custom-json"
            value={record.description.join('\n')}
            onChange={(e) => setMeta({ description: e.target.value.split('\n') })}
          />
        </div>

        <div className="constructor-aside">
          <div className="sheet-section-title">{t('ui.constructor.preview')}</div>
          <div className="constructor-preview">
            <SpellIcon spell={record} className="spell-pick-icon" />
            <div>
              <div className="constructor-preview-name">{record.name || t('ui.constructor.unnamed')}</div>
              <div className="hint">
                {spellLevelLabel(record.level)} · {spellSchoolLabel(record.school)}
                {record.concentration ? ` · ${t('ui.spells.concentrationShort')}` : ''}
              </div>
            </div>
          </div>
          {preview && <div className="hint constructor-preview-mech">{preview}</div>}
          {issueTexts.length > 0 && (
            <div className="constructor-issues">
              <div className="sheet-section-title">{t('ui.constructor.issues')}</div>
              <ul>
                {issueTexts.map((text, i) => (
                  <li key={i}>{text}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="modal-actions">
            <button type="button" onClick={onClose}>
              {t('ui.common.cancel')}
            </button>
            <button type="button" className="primary" disabled={issueTexts.length > 0} onClick={save}>
              {t('ui.common.save')}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
