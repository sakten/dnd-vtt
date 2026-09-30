import { useEffect, useMemo, useState } from 'react';
import {
  ABILITIES,
  CLASSES,
  CONDITION_KEYS,
  DAMAGE_TYPES,
  type AbilityKey,
  type AreaSpec,
  type BestiaryEntry,
  type BestiarySummonProfile,
  type ConditionKey,
  type EffectDuration,
  type EffectSpec,
  type ManualSpec,
  type ModifierSpec,
  type ShapeDef,
  type Spell,
  type SpellDef,
  type SpellDuration,
  type SpellSchool,
  type SpellUpcast,
  type SummonSpec,
  type UtilitySpec,
} from 'shared';
import { t, type MessageKey } from '../i18n';
import { abilityName, classLabel, conditionLabel, damageLabel } from '../i18n/domain';
import { specIssueText } from '../i18n/errors';
import { spellDisplayName } from '../i18n/names';
import { newId } from '../lib/id';
import {
  WIZARD_PROFILES,
  blankRecord,
  canSwitchPrimary,
  copyRecord,
  keyFromName,
  partUsageKeys,
  switchPrimary,
  validateConstructor,
  withSave,
  withSpellAttack,
  type SimpleBranch,
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
/** Вид дистанции (в данных — `range.distance.type`, `range.type` обычно `point`). */
const DISTANCE_KINDS = ['feet', 'touch', 'self', 'sight'] as const;
const DURATION_KINDS = ['instant', 'timed', 'permanent'] as const;
const DURATION_UNITS = ['minute', 'hour', 'day', 'round'] as const;
const AREA_SHAPES: AreaSpec['shape'][] = ['sphere', 'cone', 'cube', 'line', 'cylinder'];
const CANTrip_LEVELS = [5, 11, 17];
const ABILITY_KEYS = ABILITIES.map((a) => a.key);
/** Цели/режимы/длительности эффектов, редактируемые формой (остальное — JSON). */
const MODIFIER_TARGETS = [
  'attack',
  'damage',
  'ac',
  'save',
  'check',
  'speed',
  'initiative',
  'maxHp',
  'spellDc',
  'spellAttack',
  'extraActions',
  'extraBonusActions',
  'reach',
] as const;
const MODIFIER_MODES = [
  'add',
  'multiply',
  'set',
  'advantage',
  'disadvantage',
  'resistance',
  'immunity',
  'vulnerability',
] as const;
const EFFECT_DURATIONS = ['permanent', 'concentration', 'endOfTurn', 'rounds'] as const;
const SIMPLE_SWITCH: SimpleBranch[] = ['attack', 'save', 'auto', 'effect'];
/** Виды утилит, редактируемые формой (остальные — только JSON). */
const UTILITY_KINDS = [
  'tempHp',
  'healPool',
  'teleport',
  'extraAttacks',
  'extraMovement',
  'disengage',
  'wake',
  'revive',
  'stabilize',
  'extraAction',
] as const;
const UTILITY_DICE_KINDS = new Set<string>(['tempHp', 'healPool']);
const UTILITY_AMOUNT_KINDS = new Set<string>(['teleport', 'extraAttacks', 'extraMovement', 'healPool']);

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
  const [tab, setTab] = useState<'form' | 'json'>('form');
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [bestiary, setBestiary] = useState<BestiaryEntry[] | null>(null);

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
  const damageParts = record.damage?.parts ?? [];
  const usage = useMemo(() => partUsageKeys(record), [record]);

  // Каталог существ для пикера призыва — ленивый чанк (как в других панелях).
  useEffect(() => {
    if (record.automation.primary !== 'summon' || bestiary) return;
    let alive = true;
    import('shared/bestiaryData')
      .then((mod) => {
        if (alive) setBestiary([...mod.default.entries].sort((a, b) => a.name.localeCompare(b.name)));
      })
      .catch(() => void 0);
    return () => {
      alive = false;
    };
  }, [record.automation.primary, bestiary]);

  const automation = record.automation;
  const primary = automation.primary;
  const switchable = canSwitchPrimary(record);
  const effectsAllowed = ['attack', 'save', 'auto', 'effect', 'utility'].includes(primary);
  const effects = automation.effects ?? [];
  const setEffects = (list: EffectSpec[]) =>
    setRecord((r) => ({ ...r, automation: { ...r.automation, effects: list.length ? list : undefined } }));
  const patchEffect = (index: number, patch: Partial<EffectSpec>) => {
    const list = [...effects];
    list[index] = { ...list[index]!, ...patch };
    setEffects(list);
  };
  const patchManual = (patch: Partial<ManualSpec>) =>
    setRecord((r) => ({
      ...r,
      automation: { ...r.automation, manual: { ...(r.automation.manual ?? {}), ...patch } },
    }));
  const manual = automation.manual ?? {};
  const summon = automation.summon;
  const patchSummon = (patch: Partial<SummonSpec>) =>
    setRecord((r) => ({
      ...r,
      automation: {
        ...r.automation,
        summon: { initiative: 'afterCaster', ...(r.automation.summon ?? {}), ...patch },
      },
    }));
  const patchProfile = (patch: Partial<BestiarySummonProfile>) => {
    const merged = { ...(summon?.profile ?? {}), ...patch };
    const clean = Object.fromEntries(Object.entries(merged).filter(([, value]) => value !== undefined));
    patchSummon({ profile: Object.keys(clean).length ? (clean as BestiarySummonProfile) : undefined });
  };
  const utility = automation.utility;
  const patchUtility = (patch: Partial<UtilitySpec>) =>
    setRecord((r) => ({
      ...r,
      automation: { ...r.automation, utility: { kind: 'tempHp', ...(r.automation.utility ?? {}), ...patch } },
    }));
  const patchShape = (patch: Partial<ShapeDef>) =>
    setRecord((r) => ({
      ...r,
      automation: { ...r.automation, shape: { kind: 'polymorph', ...(r.automation.shape ?? {}), ...patch } },
    }));

  const issueTextsOf = (target: SpellDef) => {
    const v = validateConstructor(target);
    return [
      ...v.local.map((issue) => t(`ui.constructor.issue.${issue.code}` as MessageKey, issue.params)),
      ...v.spec.map(specIssueText),
    ];
  };
  const openJson = () => {
    setJsonText(JSON.stringify(record, null, 2));
    setJsonError(null);
    setTab('json');
  };
  const parseJson = (): SpellDef | undefined => {
    try {
      const parsed = JSON.parse(jsonText) as SpellDef;
      if (!parsed || typeof parsed !== 'object' || !parsed.automation) throw new Error('record');
      parsed.key = lockedKey ? record.key : keyFromName(parsed.name || record.name);
      return parsed;
    } catch {
      setJsonError(t('ui.constructor.jsonInvalid'));
      return undefined;
    }
  };
  const applyJson = () => {
    const parsed = parseJson();
    if (!parsed) return;
    setRecord(structuredClone(parsed));
    setTab('form');
    setJsonError(null);
  };
  const saveJson = () => {
    const parsed = parseJson();
    if (!parsed) return;
    // Ошибки — переключаемся на форму с живой валидацией; иначе сохраняем запись из JSON.
    if (issueTextsOf(parsed).length) {
      setRecord(structuredClone(parsed));
      setTab('form');
      return;
    }
    importCustom(JSON.stringify(parsed));
    onClose();
  };
  const patchModifier = (effectIndex: number, modIndex: number, patch: Partial<ModifierSpec>) => {
    const list = [...(effects[effectIndex]!.modifiers ?? [])];
    list[modIndex] = { ...(list[modIndex] as ModifierSpec), ...patch };
    patchEffect(effectIndex, { modifiers: list });
  };
  const removeModifier = (effectIndex: number, modIndex: number) => {
    patchEffect(effectIndex, {
      modifiers: (effects[effectIndex]!.modifiers ?? []).filter((_, i) => i !== modIndex),
    });
  };
  const addModifier = (effectIndex: number) => {
    patchEffect(effectIndex, {
      modifiers: [...(effects[effectIndex]!.modifiers ?? []), { target: 'damage', mode: 'add', value: 1 } as ModifierSpec],
    });
  };
  const toggleCondition = (effectIndex: number, key: ConditionKey) => {
    const list = effects[effectIndex]!.conditions ?? [];
    const gated = list.filter((c) => typeof c !== 'string');
    const plain = list.filter((c): c is string => typeof c === 'string');
    const next = plain.includes(key) ? plain.filter((c) => c !== key) : [...plain, key];
    const merged = [...gated, ...next];
    patchEffect(effectIndex, { conditions: merged.length ? merged : undefined });
  };
  const addEffect = () => {
    setEffects([
      ...effects,
      { id: newId(), name: record.name, duration: { type: 'permanent' }, to: 'targets', modifiers: [] },
    ]);
  };
  const setEffectDuration = (effectIndex: number, kind: (typeof EFFECT_DURATIONS)[number], rounds: number) => {
    const duration: EffectDuration =
      kind === 'rounds'
        ? { type: 'rounds', rounds: Math.max(1, rounds) }
        : kind === 'endOfTurn'
          ? { type: 'endOfTurn', of: 'target' }
          : { type: kind };
    patchEffect(effectIndex, { duration });
  };
  const parseModifierValue = (raw: string): number | string | undefined => {
    const text = raw.trim();
    if (!text) return undefined;
    return /^-?\d+(\.\d+)?$/.test(text) ? Number(text) : text;
  };

  const distanceType = record.range.distance?.type ?? (record.range.type === 'self' ? 'self' : 'touch');
  const distanceKinds: string[] = DISTANCE_KINDS.includes(distanceType as (typeof DISTANCE_KINDS)[number])
    ? [...DISTANCE_KINDS]
    : [distanceType, ...DISTANCE_KINDS];
  const setDistanceKind = (kind: string) =>
    setMeta({
      range: {
        ...record.range,
        distance: kind === 'feet' ? { type: 'feet', amount: record.range.distance?.amount ?? 60 } : { type: kind },
      },
    });

  const duration = record.duration[0];
  const durationKind: DurationKind =
    duration?.type === 'timed' || duration?.type === 'permanent' ? duration.type : 'instant';
  const durationConcentration = duration?.concentration === true;
  const durationAmount = duration?.duration?.amount ?? 1;
  const durationUnit = duration?.duration?.type ?? 'minute';
  const durationUnits: string[] = DURATION_UNITS.includes(durationUnit as (typeof DURATION_UNITS)[number])
    ? [...DURATION_UNITS]
    : [durationUnit, ...DURATION_UNITS];
  const setDuration = (
    kind: DurationKind,
    amount = durationAmount,
    unit = durationUnit,
    concentration = durationConcentration
  ) => {
    let next: SpellDuration[];
    if (kind === 'instant') next = [{ type: 'instant' }];
    else if (kind === 'permanent') next = [{ type: 'permanent' }];
    else {
      next = [{ type: 'timed', duration: { type: unit, amount }, ...(concentration ? { concentration: true } : {}) }];
    }
    const conc = kind === 'timed' && concentration;
    setMeta({ duration: next, concentration: conc || undefined });
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
      <div className="constructor-tabs">
        <button type="button" className={tab === 'form' ? 'active' : ''} onClick={() => setTab('form')}>
          {t('ui.constructor.tabForm')}
        </button>
        <button type="button" className={tab === 'json' ? 'active' : ''} onClick={openJson}>
          {t('ui.constructor.tabJson')}
        </button>
      </div>
      {tab === 'json' ? (
        <>
          <textarea
            className="room-custom-json constructor-json"
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
          />
          {jsonError && <p className="hint constructor-json-error">{jsonError}</p>}
          <p className="hint">{t('ui.constructor.jsonHint')}</p>
          <div className="modal-actions">
            <button type="button" onClick={applyJson}>
              {t('ui.constructor.jsonApply')}
            </button>
            <button type="button" className="primary" onClick={saveJson}>
              {t('ui.common.save')}
            </button>
          </div>
        </>
      ) : (
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
            <Field label={t('ui.constructor.branch')}>
              {switchable ? (
                <select value={primary} onChange={(e) => setRecord((r) => switchPrimary(r, e.target.value as SimpleBranch))}>
                  {SIMPLE_SWITCH.map((branch) => (
                    <option key={branch} value={branch}>
                      {t(`ui.constructor.branchName.${branch}` as MessageKey)}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="constructor-branch">{t(`ui.constructor.branchName.${primary}` as MessageKey)}</span>
              )}
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
              <select value={distanceType} onChange={(e) => setDistanceKind(e.target.value)}>
                {distanceKinds.map((kind) => (
                  <option key={kind} value={kind}>
                    {t(`ui.constructor.rangeType.${kind}` as MessageKey)}
                  </option>
                ))}
              </select>
            </Field>
            {distanceType === 'feet' && (
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
            {durationKind === 'timed' && (
              <>
                <Field label={t('ui.constructor.durationAmount')}>
                  <input
                    type="number"
                    min={1}
                    value={durationAmount}
                    onChange={(e) => setDuration(durationKind, Number(e.target.value) || 1, durationUnit)}
                  />
                </Field>
                <Field label={t('ui.constructor.durationUnit')}>
                  <select
                    value={durationUnit}
                    onChange={(e) => setDuration(durationKind, durationAmount, e.target.value, durationConcentration)}
                  >
                    {durationUnits.map((unit) => (
                      <option key={unit} value={unit}>
                        {t(`ui.constructor.durationUnit.${unit}` as MessageKey)}
                      </option>
                    ))}
                  </select>
                </Field>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={durationConcentration}
                    onChange={(e) => setDuration(durationKind, durationAmount, durationUnit, e.target.checked)}
                  />
                  <span>{t('ui.constructor.concentration')}</span>
                </label>
              </>
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
                onChange={(e) =>
                  setRecord((r) => withSpellAttack(r, (e.target.value || undefined) as Spell['spellAttack']))
                }
              >
                <option value="" disabled={primary === 'attack'}>
                  {t('ui.constructor.attackNone')}
                </option>
                <option value="melee">{t('ui.constructor.attackMelee')}</option>
                <option value="ranged">{t('ui.constructor.attackRanged')}</option>
              </select>
            </Field>
            <Field label={t('ui.constructor.save')}>
              <select
                value={saveAbility}
                onChange={(e) =>
                  setRecord((r) =>
                    withSave(r, (e.target.value || undefined) as AbilityKey | undefined, r.saveHalf === true)
                  )
                }
              >
                <option value="" disabled={primary === 'save'}>
                  {t('ui.constructor.saveNone')}
                </option>
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
                  onChange={(e) => setRecord((r) => withSave(r, saveAbility, e.target.checked))}
                />
                <span>{t('ui.constructor.saveHalf')}</span>
              </label>
            )}
          </div>

          <div className="sheet-section-title">{t('ui.constructor.damage')}</div>
          {damageParts.length > 0 ? (
            <>
              {damageParts.map((part, index) => (
                <div className="field-row constructor-part" key={index}>
                  <span className="constructor-tier-label">{t(`ui.constructor.role.${part.role}` as MessageKey)}</span>
                  <span className="constructor-part-dice">{part.dice}</span>
                  <span className="constructor-part-types">
                    {part.types.map((type) => damageLabel(type)).join(' / ')}
                  </span>
                  <span className="hint">{(usage[index] ?? []).map((key) => t(key as MessageKey)).join(', ')}</span>
                </div>
              ))}
              <p className="hint">{t('ui.constructor.partsHint')}</p>
            </>
          ) : (
            <>
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
            </>
          )}

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

          {effectsAllowed && (
            <>
              <div className="sheet-section-title">{t('ui.constructor.effects')}</div>
              {effects.map((effect, index) => {
                const leveled = typeof effect.duration === 'object' && 'levels' in effect.duration;
                const duration = leveled ? undefined : (effect.duration as EffectDuration);
                const durationKind = duration?.type ?? 'permanent';
                return (
                  <div className="constructor-effect" key={effect.id}>
                    <div className="field-row">
                      <Field label={t('ui.constructor.effectName')}>
                        <input
                          type="text"
                          value={effect.name}
                          onChange={(e) => patchEffect(index, { name: e.target.value })}
                        />
                      </Field>
                      <Field label={t('ui.constructor.effectTo')}>
                        <select
                          value={effect.to ?? 'targets'}
                          onChange={(e) => patchEffect(index, { to: e.target.value as 'self' | 'targets' })}
                        >
                          <option value="targets">{t('ui.constructor.effectTo.targets')}</option>
                          <option value="self">{t('ui.constructor.effectTo.self')}</option>
                        </select>
                      </Field>
                      {leveled ? (
                        <span className="hint">{t('ui.constructor.effectLeveled')}</span>
                      ) : (
                        <Field label={t('ui.constructor.duration')}>
                          <select value={durationKind} onChange={(e) => setEffectDuration(index, e.target.value as (typeof EFFECT_DURATIONS)[number], duration?.type === 'rounds' ? duration.rounds : 1)}>
                            {EFFECT_DURATIONS.map((kind) => (
                              <option key={kind} value={kind}>
                                {t(`ui.constructor.effectDuration.${kind}` as MessageKey)}
                              </option>
                            ))}
                          </select>
                        </Field>
                      )}
                      {duration?.type === 'rounds' && (
                        <Field label={t('ui.constructor.effectRound')}>
                          <input
                            type="number"
                            min={1}
                            value={duration.rounds}
                            onChange={(e) => setEffectDuration(index, 'rounds', Number(e.target.value) || 1)}
                          />
                        </Field>
                      )}
                      <button type="button" onClick={() => setEffects(effects.filter((_, i) => i !== index))}>
                        {t('ui.constructor.remove')}
                      </button>
                    </div>
                    {(effect.modifiers ?? []).map((entry, mi) => {
                      if (typeof entry !== 'object' || 'if' in entry) return null;
                      const mod = entry as ModifierSpec;
                      return (
                        <div className="field-row constructor-modifier" key={mi}>
                          <select
                            value={mod.target}
                            onChange={(e) => patchModifier(index, mi, { target: e.target.value as ModifierSpec['target'] })}
                          >
                            {MODIFIER_TARGETS.map((target) => (
                              <option key={target} value={target}>
                                {t(`ui.constructor.mtarget.${target}` as MessageKey)}
                              </option>
                            ))}
                          </select>
                          <select
                            value={mod.mode}
                            onChange={(e) => patchModifier(index, mi, { mode: e.target.value as ModifierSpec['mode'] })}
                          >
                            {MODIFIER_MODES.map((mode) => (
                              <option key={mode} value={mode}>
                                {t(`ui.constructor.mmode.${mode}` as MessageKey)}
                              </option>
                            ))}
                          </select>
                          <input
                            type="text"
                            placeholder={t('ui.constructor.modifierValue')}
                            value={mod.value === undefined ? '' : String(mod.value)}
                            onChange={(e) => patchModifier(index, mi, { value: parseModifierValue(e.target.value) })}
                          />
                          <button type="button" onClick={() => removeModifier(index, mi)}>
                            {t('ui.constructor.remove')}
                          </button>
                        </div>
                      );
                    })}
                    <button type="button" onClick={() => addModifier(index)}>
                      {t('ui.constructor.addModifier')}
                    </button>
                    <div className="ability-types">
                      {CONDITION_KEYS.map((key) => {
                        const checked = (effect.conditions ?? []).some((c) => c === key);
                        return (
                          <button
                            type="button"
                            key={key}
                            className={`ability-type${checked ? ' on' : ''}`}
                            onClick={() => toggleCondition(index, key)}
                          >
                            {conditionLabel(key)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              <button type="button" onClick={addEffect}>
                {t('ui.constructor.addEffect')}
              </button>
            </>
          )}

          {primary === 'manual' && (
            <>
              <div className="sheet-section-title">{t('ui.constructor.manual')}</div>
              <div className="field-row">
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={manual.byDesign === true}
                    onChange={(e) => patchManual({ byDesign: e.target.checked || undefined })}
                  />
                  <span>{t('ui.constructor.manualByDesign')}</span>
                </label>
                <Field label={t('ui.constructor.manualChip')}>
                  <select
                    value={manual.chip ?? ''}
                    onChange={(e) => patchManual({ chip: (e.target.value || undefined) as ConditionKey | undefined })}
                  >
                    <option value="">{t('ui.constructor.manualChipNone')}</option>
                    {CONDITION_KEYS.map((key) => (
                      <option key={key} value={key}>
                        {conditionLabel(key)}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </>
          )}

          {primary === 'summon' && summon && (
            <>
              <div className="sheet-section-title">{t('ui.constructor.summon')}</div>
              <div className="field-row">
                <Field label={t('ui.constructor.summonCreature')}>
                  <select
                    value={summon.creature ?? ''}
                    onChange={(e) => patchSummon({ creature: e.target.value || undefined })}
                  >
                    <option value="">{t('ui.constructor.summonNone')}</option>
                    {(bestiary ?? []).map((entry) => (
                      <option key={entry.key} value={entry.key}>
                        {entry.name} · {entry.source}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t('ui.constructor.summonInitiative')}>
                  <select
                    value={summon.initiative}
                    onChange={(e) => patchSummon({ initiative: e.target.value as SummonSpec['initiative'] })}
                  >
                    <option value="afterCaster">{t('ui.constructor.summonAfterCaster')}</option>
                    <option value="own">{t('ui.constructor.summonOwn')}</option>
                  </select>
                </Field>
                <Field label={t('ui.constructor.summonCount')}>
                  <input
                    type="number"
                    min={1}
                    max={9}
                    value={summon.count ?? 1}
                    onChange={(e) => patchSummon({ count: Math.max(1, Number(e.target.value) || 1) })}
                  />
                </Field>
                <Field label={t('ui.constructor.summonBaseLevel')}>
                  <input
                    type="number"
                    min={1}
                    max={9}
                    value={summon.baseLevel ?? ''}
                    onChange={(e) => patchSummon({ baseLevel: Number(e.target.value) || undefined })}
                  />
                </Field>
              </div>
              <div className="constructor-checks">
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={summon.fromFamiliar === true}
                    onChange={(e) => patchSummon({ fromFamiliar: e.target.checked || undefined })}
                  />
                  <span>{t('ui.constructor.summonFamiliar')}</span>
                </label>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={summon.profile?.spellAttack === true}
                    onChange={(e) => patchProfile({ spellAttack: e.target.checked || undefined })}
                  />
                  <span>{t('ui.constructor.summonSpellAttack')}</span>
                </label>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={summon.profile?.spellDc === true}
                    onChange={(e) => patchProfile({ spellDc: e.target.checked || undefined })}
                  />
                  <span>{t('ui.constructor.summonSpellDc')}</span>
                </label>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={summon.profile?.multiattackHalfLevel === true}
                    onChange={(e) => patchProfile({ multiattackHalfLevel: e.target.checked || undefined })}
                  />
                  <span>{t('ui.constructor.summonMultiattack')}</span>
                </label>
              </div>
              <div className="field-row">
                <Field label={t('ui.constructor.summonProfileBase')}>
                  <input
                    type="number"
                    min={0}
                    max={9}
                    value={summon.profile?.baseLevel ?? ''}
                    onChange={(e) => patchProfile({ baseLevel: e.target.value === '' ? undefined : Number(e.target.value) })}
                  />
                </Field>
                <Field label={t('ui.constructor.summonHpPerLevel')}>
                  <input
                    type="number"
                    value={summon.profile?.hpPerLevel ?? ''}
                    onChange={(e) => patchProfile({ hpPerLevel: e.target.value === '' ? undefined : Number(e.target.value) })}
                  />
                </Field>
                <Field label={t('ui.constructor.summonAcPerLevel')}>
                  <input
                    type="number"
                    value={summon.profile?.acPerLevel ?? ''}
                    onChange={(e) => patchProfile({ acPerLevel: e.target.value === '' ? undefined : Number(e.target.value) })}
                  />
                </Field>
              </div>
              <p className="hint">{t('ui.constructor.summonHint')}</p>
            </>
          )}

          {primary === 'utility' && utility && (
            <>
              <div className="sheet-section-title">{t('ui.constructor.utility')}</div>
              <div className="field-row">
                <Field label={t('ui.constructor.utilityKind')}>
                  <select
                    value={utility.kind}
                    onChange={(e) => patchUtility({ kind: e.target.value as UtilitySpec['kind'] })}
                  >
                    {!UTILITY_KINDS.includes(utility.kind as (typeof UTILITY_KINDS)[number]) && (
                      <option value={utility.kind}>{utility.kind}</option>
                    )}
                    {UTILITY_KINDS.map((kind) => (
                      <option key={kind} value={kind}>
                        {t(`ui.constructor.utilityKind.${kind}` as MessageKey)}
                      </option>
                    ))}
                  </select>
                </Field>
                {UTILITY_DICE_KINDS.has(utility.kind) && (
                  <Field label={t('ui.constructor.utilityDice')}>
                    <input
                      type="text"
                      placeholder="1d4 + 4"
                      value={typeof utility.dice === 'string' || typeof utility.dice === 'number' ? String(utility.dice) : ''}
                      onChange={(e) => patchUtility({ dice: e.target.value.trim() || undefined })}
                    />
                  </Field>
                )}
                {UTILITY_AMOUNT_KINDS.has(utility.kind) && (
                  <Field label={t('ui.constructor.utilityAmount')}>
                    <input
                      type="number"
                      min={0}
                      value={utility.amount ?? ''}
                      onChange={(e) => patchUtility({ amount: Number(e.target.value) || undefined })}
                    />
                  </Field>
                )}
              </div>
              <p className="hint">{t('ui.constructor.utilityHint')}</p>
            </>
          )}

          {automation.shape && (
            <>
              <div className="sheet-section-title">{t('ui.constructor.shape')}</div>
              <div className="field-row">
                <span className="constructor-tier-label">{t('ui.constructor.shapePolymorph')}</span>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={automation.shape.crByTarget === true}
                    onChange={(e) => patchShape({ crByTarget: e.target.checked || undefined })}
                  />
                  <span>{t('ui.constructor.shapeCrByTarget')}</span>
                </label>
              </div>
            </>
          )}

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
      )}
    </Modal>
  );
}
