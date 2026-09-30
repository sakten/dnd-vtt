import { useEffect, useMemo, useState } from 'react';
import {
  ABILITIES,
  CLASSES,
  CONDITION_KEYS,
  DAMAGE_TYPES,
  SKILLS,
  type AbilityKey,
  type AreaSpec,
  type BestiaryEntry,
  type BestiarySummonProfile,
  type ChoiceSpec,
  type ConditionKey,
  type EffectDuration,
  type EffectSpec,
  type ManualSpec,
  type ShapeDef,
  type Spell,
  type SpellDef,
  type SpellDuration,
  type SpellSchool,
  type SpellUpcast,
  type SummonSpec,
  type UtilitySpec,
  type WeaponAttackSpec,
} from 'shared';
import { t, type MessageKey } from '../i18n';
import { abilityName, classLabel, conditionLabel, damageLabel, skillName } from '../i18n/domain';
import { specIssueText } from '../i18n/errors';
import { spellDisplayName } from '../i18n/names';
import { newId } from '../lib/id';
import {
  WIZARD_PROFILES,
  ZONE_SLOTS,
  automationNotes,
  blankChoice,
  blankRecord,
  canSwitchPrimary,
  copyRecord,
  keyFromName,
  partUsageKeys,
  patchZone,
  slotDamageSource,
  slotDamageWithPart,
  switchPrimary,
  validateConstructor,
  withChoices,
  withDamagePart,
  withSave,
  withSpellAttack,
  withZoneAura,
  withZonePayload,
  withZoneSlot,
  type AutomationNote,
  type PartUsage,
  type SimpleBranch,
  type WizardProfileId,
} from '../lib/spellConstructor';
import EffectListEditor, { EFFECT_DURATIONS, ExprField } from './EffectListEditor';
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
const SIMPLE_SWITCH: SimpleBranch[] = ['attack', 'save', 'auto', 'effect'];
const CHOICE_PARAMS = ['damageType', 'ability', 'skill', 'condition', 'mode', 'effect', 'command'] as const;
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
  const notes = useMemo(() => automationNotes(record), [record]);

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

  const zone = automation.zone;
  const wa = automation.weaponAttack;
  const patchWeaponAttack = (patch: Partial<WeaponAttackSpec> | null) =>
    setRecord((r) => {
      const next = { ...r.automation };
      if (patch === null) {
        delete next.weaponAttack;
        return { ...r, automation: next };
      }
      next.weaponAttack = { ...(r.automation.weaponAttack ?? {}), ...patch } as WeaponAttackSpec;
      return { ...r, automation: next };
    });
  const zoneArea = zone?.area && 'shape' in zone.area ? zone.area : undefined;
  const zoneWall = !!zone?.area && 'wall' in zone.area;
  const zoneDuration = zone && 'type' in (zone.duration as object) ? (zone.duration as EffectDuration) : undefined;
  const setZoneDuration = (kind: (typeof EFFECT_DURATIONS)[number], rounds: number) => {
    const duration: EffectDuration =
      kind === 'rounds'
        ? { type: 'rounds', rounds: Math.max(1, rounds) }
        : kind === 'endOfTurn'
          ? { type: 'endOfTurn', of: 'target' }
          : { type: kind };
    setRecord((r) => patchZone(r, { duration }));
  };
  const choices = automation.choices ?? [];
  const setChoices = (list: ChoiceSpec[]) => setRecord((r) => withChoices(r, list));
  const choiceValueOptions = (param: ChoiceSpec['param']): { key: string; label: string }[] | null => {
    if (param === 'damageType') return DAMAGE_TYPES.map((d) => ({ key: d.key, label: damageLabel(d.key) }));
    if (param === 'condition') return CONDITION_KEYS.map((k) => ({ key: k, label: conditionLabel(k) }));
    if (param === 'ability') return ABILITY_KEYS.map((k) => ({ key: k, label: abilityName(k) }));
    if (param === 'skill') return SKILLS.map((s) => ({ key: s.key, label: skillName(s.key) }));
    return null;
  };

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
  /** Строка слота части урона: слот триггера + спасбросок (или «без спасброска»). */
  const usageText = (u: PartUsage): string => {
    const base = t(u.key as MessageKey);
    if (!u.trigger) return base;
    const save = u.save ? t('ui.constructor.note.save', { ability: abilityName(u.save) }) : t('ui.constructor.usageNoSave');
    return `${base} · ${save}`;
  };
  /** Строка read-only заметки о сложной автоматизации. */
  const noteText = (note: AutomationNote): string => {
    switch (note.kind) {
      case 'zone': {
        const shape =
          note.shape && (AREA_SHAPES as string[]).includes(note.shape)
            ? t(`ui.constructor.areaShapeName.${note.shape}` as MessageKey)
            : note.shape;
        const duration =
          note.duration && (EFFECT_DURATIONS as readonly string[]).includes(note.duration)
            ? t(`ui.constructor.effectDuration.${note.duration}` as MessageKey)
            : note.duration;
        const flags = (note.flags ?? []).map((flag) => t(`ui.constructor.flag.${flag}` as MessageKey));
        return [t('ui.constructor.note.zone'), shape, note.size, duration, ...flags].filter(Boolean).join(' · ');
      }
      case 'zoneTrigger': {
        const slot = note.slot ? t(`ui.constructor.usage.${note.slot}` as MessageKey) : '';
        const save = note.ability
          ? t('ui.constructor.note.save', { ability: abilityName(note.ability) })
          : t('ui.constructor.usageNoSave');
        const damage = note.types?.length
          ? ` · ${t('ui.constructor.note.damage')}: ${note.types.map((type) => damageLabel(type)).join('/')}`
          : '';
        return `${t('ui.constructor.note.zoneTrigger')}${slot ? ` (${slot})` : ''}: ${save}${damage}`;
      }
      case 'auraEffect':
        return `${t('ui.constructor.note.aura')}: ${note.name}${
          note.conditions?.length ? ` · ${note.conditions.map((c) => conditionLabel(c)).join(', ')}` : ''
        }`;
      case 'effectTriggers':
        return `${t('ui.constructor.note.effectTriggers')}: ${note.name}`;
      case 'choice':
        return `${t('ui.constructor.note.choice')} «${note.name}»: ${(note.options ?? [])
          .map((option) => (note.param === 'damageType' ? damageLabel(option) : option))
          .join(', ')}`;
      case 'weaponAttack':
        return t('ui.constructor.note.weaponAttack');
      case 'uses':
        return t('ui.constructor.note.uses');
      case 'movement':
        return t('ui.constructor.note.movement');
      case 'loadout':
        return t('ui.constructor.note.loadout');
    }
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

          {wa ? (
            <>
              <div className="sheet-section-title">{t('ui.constructor.weaponAttack')}</div>
              <div className="constructor-checks">
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={wa.replace === true}
                    onChange={(e) => patchWeaponAttack({ replace: e.target.checked || undefined })}
                  />
                  <span>{t('ui.constructor.weaponReplace')}</span>
                </label>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={wa.anyWeapon === true}
                    onChange={(e) => patchWeaponAttack({ anyWeapon: e.target.checked || undefined })}
                  />
                  <span>{t('ui.constructor.weaponAny')}</span>
                </label>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={wa.spellAbility === true}
                    onChange={(e) => patchWeaponAttack({ spellAbility: e.target.checked || undefined })}
                  />
                  <span>{t('ui.constructor.weaponSpellAbility')}</span>
                </label>
              </div>
              <div className="field-row">
                <Field label={t('ui.constructor.riderDice')}>
                  <ExprField value={wa.riderDice} onChange={(value) => patchWeaponAttack({ riderDice: value })} placeholder="1d8" />
                </Field>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={!!wa.secondary}
                    onChange={(e) =>
                      patchWeaponAttack({
                        secondary: e.target.checked
                          ? {
                              rangeFeet: 5,
                              damageType: record.damage?.types?.[0] ?? 'fire',
                            }
                          : undefined,
                      })
                    }
                  />
                  <span>{t('ui.constructor.weaponSecondary')}</span>
                </label>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={!!wa.hitEffect}
                    onChange={(e) =>
                      patchWeaponAttack({
                        hitEffect: e.target.checked
                          ? { name: record.name, duration: { type: 'endOfTurn', of: 'target' }, to: 'targets' }
                          : undefined,
                      })
                    }
                  />
                  <span>{t('ui.constructor.weaponHitEffect')}</span>
                </label>
                <button type="button" onClick={() => patchWeaponAttack(null)}>
                  {t('ui.constructor.remove')}
                </button>
              </div>
              {wa.secondary && (
                <div className="field-row">
                  <Field label={t('ui.constructor.weaponRangeFeet')}>
                    <input
                      type="number"
                      min={0}
                      value={wa.secondary.rangeFeet}
                      onChange={(e) =>
                        patchWeaponAttack({ secondary: { ...wa.secondary!, rangeFeet: Number(e.target.value) || 0 } })
                      }
                    />
                  </Field>
                  <Field label={t('ui.constructor.loadoutDice')}>
                    <ExprField
                      value={wa.secondary.dice}
                      onChange={(value) => patchWeaponAttack({ secondary: { ...wa.secondary!, dice: value } })}
                      placeholder="2d6"
                    />
                  </Field>
                  <Field label={t('ui.constructor.partType')}>
                    <select
                      value={wa.secondary.damageType}
                      onChange={(e) => patchWeaponAttack({ secondary: { ...wa.secondary!, damageType: e.target.value } })}
                    >
                      {DAMAGE_TYPES.map((damage) => (
                        <option key={damage.key} value={damage.key}>
                          {damageLabel(damage.key)}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label={t('ui.constructor.save')}>
                    <select
                      value={wa.secondary.save?.ability ?? ''}
                      onChange={(e) => {
                        const ability = e.target.value as AbilityKey | '';
                        patchWeaponAttack({
                          secondary: {
                            ...wa.secondary!,
                            save: ability ? { ability, ...(wa.secondary!.save?.half ? { half: true } : {}) } : undefined,
                          },
                        });
                      }}
                    >
                      <option value="">{t('ui.constructor.saveNone')}</option>
                      {ABILITY_KEYS.map((key) => (
                        <option key={key} value={key}>
                          {abilityName(key)}
                        </option>
                      ))}
                    </select>
                  </Field>
                  {wa.secondary.save && (
                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={wa.secondary.save.half === true}
                        onChange={(e) =>
                          patchWeaponAttack({
                            secondary: {
                              ...wa.secondary!,
                              save: { ...wa.secondary!.save!, half: e.target.checked || undefined },
                            },
                          })
                        }
                      />
                      <span>{t('ui.constructor.saveHalf')}</span>
                    </label>
                  )}
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={wa.secondary.includePrimary === true}
                      onChange={(e) =>
                        patchWeaponAttack({
                          secondary: { ...wa.secondary!, includePrimary: e.target.checked || undefined },
                        })
                      }
                    />
                    <span>{t('ui.constructor.weaponIncludePrimary')}</span>
                  </label>
                </div>
              )}
              {wa.hitEffect && (
                <>
                  <div className="field-row">
                    <Field label={t('ui.constructor.effectName')}>
                      <input
                        type="text"
                        value={wa.hitEffect.name}
                        onChange={(e) => patchWeaponAttack({ hitEffect: { ...wa.hitEffect!, name: e.target.value } })}
                      />
                    </Field>
                    <Field label={t('ui.constructor.effectTo')}>
                      <select
                        value={wa.hitEffect.to ?? 'targets'}
                        onChange={(e) =>
                          patchWeaponAttack({
                            hitEffect: { ...wa.hitEffect!, to: e.target.value as 'self' | 'targets' },
                          })
                        }
                      >
                        <option value="targets">{t('ui.constructor.effectTo.targets')}</option>
                        <option value="self">{t('ui.constructor.effectTo.self')}</option>
                      </select>
                    </Field>
                    <Field label={t('ui.constructor.duration')}>
                      <select
                        value={wa.hitEffect.duration.type}
                        onChange={(e) =>
                          patchWeaponAttack({
                            hitEffect: {
                              ...wa.hitEffect!,
                              duration:
                                e.target.value === 'rounds'
                                  ? { type: 'rounds', rounds: 1 }
                                  : e.target.value === 'endOfTurn'
                                    ? { type: 'endOfTurn', of: 'target' }
                                    : ({ type: e.target.value } as EffectDuration),
                            },
                          })
                        }
                      >
                        {EFFECT_DURATIONS.map((kind) => (
                          <option key={kind} value={kind}>
                            {t(`ui.constructor.effectDuration.${kind}` as MessageKey)}
                          </option>
                        ))}
                      </select>
                    </Field>
                    {wa.hitEffect.duration.type === 'rounds' && (
                      <Field label={t('ui.constructor.effectRound')}>
                        <input
                          type="number"
                          min={1}
                          value={wa.hitEffect.duration.rounds}
                          onChange={(e) =>
                            patchWeaponAttack({
                              hitEffect: { ...wa.hitEffect!, duration: { type: 'rounds', rounds: Number(e.target.value) || 1 } },
                            })
                          }
                        />
                      </Field>
                    )}
                  </div>
                  <div className="ability-types">
                    {CONDITION_KEYS.map((key) => {
                      const checked = (wa.hitEffect!.conditions ?? []).includes(key);
                      return (
                        <button
                          type="button"
                          key={key}
                          className={`ability-type${checked ? ' on' : ''}`}
                          onClick={() =>
                            patchWeaponAttack({
                              hitEffect: {
                                ...wa.hitEffect!,
                                conditions: checked
                                  ? (wa.hitEffect!.conditions ?? []).filter((c) => c !== key)
                                  : [...(wa.hitEffect!.conditions ?? []), key],
                              },
                            })
                          }
                        >
                          {conditionLabel(key)}
                        </button>
                      );
                    })}
                  </div>
                  {(wa.hitEffect.modifiers?.length || wa.hitEffect.triggers) && (
                    <p className="hint">{t('ui.constructor.triggerGated')}</p>
                  )}
                </>
              )}
              <p className="hint">{t('ui.constructor.weaponHint')}</p>
            </>
          ) : (
            (primary === 'attack' || primary === 'auto') && (
              <button type="button" onClick={() => patchWeaponAttack({ anyWeapon: true, riderDice: '1d6' })}>
                {t('ui.constructor.weaponAttackAdd')}
              </button>
            )
          )}

          <div className="sheet-section-title">{t('ui.constructor.damage')}</div>
          {damageParts.length > 0 ? (
            <>
              {damageParts.map((part, index) => (
                <div className="field-row constructor-part" key={index}>
                  <span className="constructor-tier-label">{t(`ui.constructor.role.${part.role}` as MessageKey)}</span>
                  <Field label={t('ui.constructor.damageDice')}>
                    <input
                      type="text"
                      value={part.dice}
                      onChange={(e) => setRecord((r) => withDamagePart(r, index, { dice: e.target.value.trim() }))}
                    />
                  </Field>
                  {part.types.length === 1 ? (
                    <Field label={t('ui.constructor.partType')}>
                      <select
                        value={part.types[0]}
                        onChange={(e) => setRecord((r) => withDamagePart(r, index, { type: e.target.value }))}
                      >
                        {DAMAGE_TYPES.map((damage) => (
                          <option key={damage.key} value={damage.key}>
                            {damageLabel(damage.key)}
                          </option>
                        ))}
                      </select>
                    </Field>
                  ) : (
                    <span className="constructor-part-types">
                      {part.types.map((type) => damageLabel(type)).join(' / ')}
                    </span>
                  )}
                  <span className="hint">{(usage[index] ?? []).map((u) => usageText(u)).join(' · ')}</span>
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
              <EffectListEditor effects={effects} onChange={setEffects} defaultName={record.name} />
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

          {zone ? (
            <>
              <div className="sheet-section-title">{t('ui.constructor.zone')}</div>
              {zoneWall ? (
                <p className="hint">{t('ui.constructor.zoneWallHint')}</p>
              ) : (
                <div className="field-row">
                  <Field label={t('ui.constructor.areaShape')}>
                    <select
                      value={zoneArea?.shape ?? 'sphere'}
                      onChange={(e) => {
                        const shape = e.target.value as AreaSpec['shape'];
                        setRecord((r) =>
                          patchZone(r, {
                            area: { shape, size: zoneArea?.size ?? 15, ...(shape === 'line' ? { width: zoneArea?.width ?? 5 } : {}) },
                          })
                        );
                      }}
                    >
                      {AREA_SHAPES.map((shape) => (
                        <option key={shape} value={shape}>
                          {t(`ui.constructor.areaShapeName.${shape}` as MessageKey)}
                        </option>
                      ))}
                    </select>
                  </Field>
                  {zoneArea && (
                    <Field label={t('ui.constructor.areaSize')}>
                      <input
                        type="number"
                        min={5}
                        step={5}
                        value={zoneArea.size}
                        onChange={(e) =>
                          setRecord((r) => patchZone(r, { area: { ...zoneArea, size: Number(e.target.value) || 5 } }))
                        }
                      />
                    </Field>
                  )}
                  <Field label={t('ui.constructor.zoneOrigin')}>
                    <select
                      value={zone.origin ?? 'point'}
                      onChange={(e) =>
                        setRecord((r) => patchZone(r, { origin: e.target.value as 'self' | 'point' }))
                      }
                    >
                      <option value="point">{t('ui.constructor.zoneOriginPoint')}</option>
                      <option value="self">{t('ui.constructor.zoneOriginSelf')}</option>
                    </select>
                  </Field>
                  <Field label={t('ui.constructor.duration')}>
                    {zoneDuration ? (
                      <select
                        value={zoneDuration.type}
                        onChange={(e) =>
                          setZoneDuration(
                            e.target.value as (typeof EFFECT_DURATIONS)[number],
                            zoneDuration.type === 'rounds' ? zoneDuration.rounds : 1
                          )
                        }
                      >
                        {EFFECT_DURATIONS.map((kind) => (
                          <option key={kind} value={kind}>
                            {t(`ui.constructor.effectDuration.${kind}` as MessageKey)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="hint">{t('ui.constructor.effectLeveled')}</span>
                    )}
                  </Field>
                  {zoneDuration?.type === 'rounds' && (
                    <Field label={t('ui.constructor.effectRound')}>
                      <input
                        type="number"
                        min={1}
                        value={zoneDuration.rounds}
                        onChange={(e) => setZoneDuration('rounds', Number(e.target.value) || 1)}
                      />
                    </Field>
                  )}
                </div>
              )}
              <div className="constructor-checks">
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={zone.flags?.difficultTerrain === true}
                    onChange={(e) =>
                      setRecord((r) =>
                        patchZone(r, { flags: { ...(zone.flags ?? {}), difficultTerrain: e.target.checked || undefined } })
                      )
                    }
                  />
                  <span>{t('ui.constructor.flag.difficultTerrain')}</span>
                </label>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={zone.flags?.blocksLight === true}
                    onChange={(e) =>
                      setRecord((r) =>
                        patchZone(r, { flags: { ...(zone.flags ?? {}), blocksLight: e.target.checked || undefined } })
                      )
                    }
                  />
                  <span>{t('ui.constructor.flag.blocksLight')}</span>
                </label>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={zone.flags?.silence === true}
                    onChange={(e) =>
                      setRecord((r) =>
                        patchZone(r, { flags: { ...(zone.flags ?? {}), silence: e.target.checked || undefined } })
                      )
                    }
                  />
                  <span>{t('ui.constructor.flag.silence')}</span>
                </label>
                <Field label={t('ui.constructor.zoneObscured')}>
                  <select
                    value={zone.flags?.obscured ?? ''}
                    onChange={(e) =>
                      setRecord((r) =>
                        patchZone(r, {
                          flags: { ...(zone.flags ?? {}), obscured: (e.target.value || undefined) as 'light' | 'heavy' | undefined },
                        })
                      )
                    }
                  >
                    <option value="">{t('ui.constructor.areaNone')}</option>
                    <option value="light">{t('ui.constructor.zoneObscuredLight')}</option>
                    <option value="heavy">{t('ui.constructor.zoneObscuredHeavy')}</option>
                  </select>
                </Field>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={zone.enterOncePerTurn === true}
                    onChange={(e) => setRecord((r) => patchZone(r, { enterOncePerTurn: e.target.checked || undefined }))}
                  />
                  <span>{t('ui.constructor.zoneOncePerTurn')}</span>
                </label>
                <Field label={t('ui.constructor.zoneSide')}>
                  <select
                    value={zone.side ?? ''}
                    onChange={(e) =>
                      setRecord((r) => patchZone(r, { side: (e.target.value || undefined) as 'hostile' | 'ally' | undefined }))
                    }
                  >
                    <option value="">{t('ui.constructor.areaNone')}</option>
                    <option value="hostile">{t('ui.constructor.zoneSideHostile')}</option>
                    <option value="ally">{t('ui.constructor.zoneSideAlly')}</option>
                  </select>
                </Field>
              </div>
              {ZONE_SLOTS.map((slot) => {
                const payload = zone.triggers?.[slot];
                const source = slotDamageSource(payload);
                const literalDamage = payload?.damage && 'dice' in payload.damage ? payload.damage : undefined;
                return (
                  <div className="constructor-zone-slot" key={slot}>
                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={!!payload}
                        onChange={(e) => setRecord((r) => withZoneSlot(r, slot, e.target.checked))}
                      />
                      <span>{t(`ui.constructor.usage.${slot}` as MessageKey)}</span>
                    </label>
                    {payload && (
                      <div className="field-row">
                        <Field label={t('ui.constructor.save')}>
                          <select
                            value={payload.save?.ability ?? ''}
                            onChange={(e) => {
                              const ability = e.target.value as AbilityKey | '';
                              setRecord((r) =>
                                withZonePayload(r, slot, {
                                  save: ability
                                    ? { ability, ...(payload.save?.half ? { half: true } : {}) }
                                    : undefined,
                                })
                              );
                            }}
                          >
                            <option value="">{t('ui.constructor.saveNone')}</option>
                            {ABILITY_KEYS.map((key) => (
                              <option key={key} value={key}>
                                {abilityName(key)}
                              </option>
                            ))}
                          </select>
                        </Field>
                        {payload.save && (
                          <label className="checkbox-row">
                            <input
                              type="checkbox"
                              checked={payload.save.half === true}
                              onChange={(e) =>
                                setRecord((r) =>
                                  withZonePayload(r, slot, {
                                    save: { ...payload.save!, half: e.target.checked || undefined },
                                  })
                                )
                              }
                            />
                            <span>{t('ui.constructor.saveHalf')}</span>
                          </label>
                        )}
                        <Field label={t('ui.constructor.containment')}>
                          <select
                            value={payload.containment ?? 'anyCell'}
                            onChange={(e) =>
                              setRecord((r) =>
                                withZonePayload(r, slot, { containment: e.target.value as 'anyCell' | 'fullyWithin' })
                              )
                            }
                          >
                            <option value="anyCell">{t('ui.constructor.containmentAny')}</option>
                            <option value="fullyWithin">{t('ui.constructor.containmentFull')}</option>
                          </select>
                        </Field>
                        <Field label={t('ui.constructor.damage')}>
                          <select
                            value={source.kind === 'part' ? `part:${source.index ?? 0}` : source.kind}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (value === 'none') setRecord((r) => withZonePayload(r, slot, { damage: undefined }));
                              else if (value === 'literal')
                                setRecord((r) => withZonePayload(r, slot, { damage: { dice: '1d6', types: [] } }));
                              else {
                                const index = Number(value.slice('part:'.length)) || 0;
                                const part = record.damage?.parts?.[index];
                                if (part) {
                                  setRecord((r) =>
                                    withZonePayload(r, slot, { damage: slotDamageWithPart(payload, part, index).damage })
                                  );
                                }
                              }
                            }}
                          >
                            <option value="none">{t('ui.constructor.damageNone')}</option>
                            {(record.damage?.parts ?? []).map((part, index) => (
                              <option key={index} value={`part:${index}`}>
                                {t('ui.constructor.damagePart', { n: index + 1 })} ·{' '}
                                {part.types.map((type) => damageLabel(type)).join('/')}
                              </option>
                            ))}
                            <option value="literal">{t('ui.constructor.damageLiteral')}</option>
                          </select>
                        </Field>
                        {source.kind === 'literal' && literalDamage && (
                          <Field label={t('ui.constructor.damageDice')}>
                            <input
                              type="text"
                              value={
                                typeof literalDamage.dice === 'string' || typeof literalDamage.dice === 'number'
                                  ? String(literalDamage.dice)
                                  : ''
                              }
                              onChange={(e) => {
                                const dice = e.target.value.trim();
                                const types = (literalDamage.types ?? []).filter(
                                  (type): type is string => typeof type === 'string'
                                );
                                setRecord((r) =>
                                  withZonePayload(r, slot, { damage: dice ? { dice, types } : { dice: '', types } })
                                );
                              }}
                            />
                          </Field>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              <button type="button" onClick={() => setRecord((r) => patchZone(r, null))}>
                {t('ui.constructor.zoneRemove')}
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setRecord((r) => patchZone(r, {}))}>
              {t('ui.constructor.zoneAdd')}
            </button>
          )}

          {zone && (
            <>
              <div className="sheet-section-title">{t('ui.constructor.aura')}</div>
              {zone.aura?.effects?.length ? (
                <EffectListEditor
                  effects={zone.aura.effects}
                  onChange={(list) => setRecord((r) => withZoneAura(r, list))}
                  defaultName={record.name}
                  hint={t('ui.constructor.auraHint')}
                />
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    setRecord((r) =>
                      withZoneAura(r, [
                        { id: newId(), name: record.name, duration: { type: 'permanent' }, to: 'targets', modifiers: [] },
                      ])
                    )
                  }
                >
                  {t('ui.constructor.auraAdd')}
                </button>
              )}
            </>
          )}

          <div className="sheet-section-title">{t('ui.constructor.choices')}</div>
          {choices.map((choice, index) => {
            const options = choiceValueOptions(choice.param);
            return (
              <div className="field-row" key={choice.id}>
                <Field label={t('ui.constructor.choiceId')}>
                  <input
                    type="text"
                    value={choice.id}
                    onChange={(e) =>
                      setChoices(choices.map((c, i) => (i === index ? { ...c, id: e.target.value } : c)))
                    }
                  />
                </Field>
                <Field label={t('ui.constructor.choiceParam')}>
                  <select
                    value={choice.param}
                    onChange={(e) => {
                      const param = e.target.value as ChoiceSpec['param'];
                      setChoices(choices.map((c, i) => (i === index ? { ...c, param, options: [] } : c)));
                    }}
                  >
                    {CHOICE_PARAMS.map((param) => (
                      <option key={param} value={param}>
                        {param}
                      </option>
                    ))}
                  </select>
                </Field>
                {options ? (
                  <div className="ability-types">
                    {options.map((option) => {
                      const checked = choice.options.includes(option.key);
                      return (
                        <button
                          type="button"
                          key={option.key}
                          className={`ability-type${checked ? ' on' : ''}`}
                          onClick={() =>
                            setChoices(
                              choices.map((c, i) =>
                                i === index
                                  ? {
                                      ...c,
                                      options: checked
                                        ? c.options.filter((o) => o !== option.key)
                                        : [...c.options, option.key],
                                    }
                                  : c
                              )
                            )
                          }
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <Field label={t('ui.constructor.choiceOptions')}>
                    <input
                      type="text"
                      value={choice.options.join(', ')}
                      onChange={(e) =>
                        setChoices(
                          choices.map((c, i) =>
                            i === index
                              ? { ...c, options: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) }
                              : c
                          )
                        )
                      }
                    />
                  </Field>
                )}
                <button type="button" onClick={() => setChoices(choices.filter((_, i) => i !== index))}>
                  {t('ui.constructor.remove')}
                </button>
              </div>
            );
          })}
          <button type="button" onClick={() => setChoices([...choices, blankChoice()])}>
            {t('ui.constructor.addChoice')}
          </button>

          {notes.length > 0 && (
            <>
              <div className="sheet-section-title">{t('ui.constructor.automation')}</div>
              <ul className="constructor-notes">
                {notes.map((note, index) => (
                  <li key={index}>{noteText(note)}</li>
                ))}
              </ul>
              <p className="hint">{t('ui.constructor.automationHint')}</p>
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
