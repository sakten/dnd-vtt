import { useEffect, useMemo, useState } from 'react';
import {
  ABILITIES,
  CLASSES,
  CONDITION_KEYS,
  CREATURE_TYPES,
  DAMAGE_TYPES,
  SKILLS,
  type AbilityKey,
  type ActionSpec,
  type ActionTargeting,
  type AreaSpec,
  type BestiaryEntry,
  type BestiarySummonProfile,
  type ChoiceSpec,
  type ConditionKey,
  type DamageSpec,
  type EffectDuration,
  type EffectSpec,
  type ManualSpec,
  type PayloadSpec,
  type ShapeDef,
  type Spell,
  type SpellDamagePart,
  type SpellDef,
  type SpellDuration,
  type SpellSchool,
  type SpellUpcast,
  type SummonSpec,
  type UtilitySpec,
  type WeaponAttackSpec,
} from 'shared';
import { t, type MessageKey } from '../i18n';
import { abilityName, classLabel, conditionLabel, creatureTypeLabel, damageLabel, skillName } from '../i18n/domain';
import { specIssueText } from '../i18n/errors';
import { spellDisplayName } from '../i18n/names';
import { newId } from '../lib/id';
import {
  ZONE_SLOTS,
  automationNotes,
  blankChoice,
  canConvertPayload,
  canSwitchPrimary,
  copyRecord,
  keyFromName,
  partUsageKeys,
  patchPayloadSpec,
  patchZone,
  slotDamageSource,
  slotDamageWithPart,
  switchPrimary,
  validateConstructor,
  withChoices,
  withDamageDice,
  withDamagePart,
  withPayloadHeal,
  withSave,
  withSpellAttack,
  withZoneAura,
  withZonePayload,
  withZoneSlot,
  type AutomationNote,
  type PartUsage,
  type SimpleBranch,
} from '../lib/spellConstructor';
import {
  KIT_PAYLOADS,
  KIT_RESOLUTIONS,
  isGridPayload,
  kitDeliveries,
  kitOf,
  kitRecord,
  type KitPayload,
} from '../lib/spellKits';
import DamageDiceField from './DamageDiceField';
import EffectListEditor, { EFFECT_DURATIONS, ExprField, LightFields } from './EffectListEditor';
import EffectModifiersEditor from './EffectModifiersEditor';
import EffectTriggersEditor from './EffectTriggersEditor';
import { spellLevelLabel, spellMechanicsShort, spellSchoolLabel } from '../lib/spellText';
import { useSpells } from '../lib/useSpells';
import { useGameStore } from '../store/useGameStore';
import { Field } from './Field';
import Modal from './Modal';
import SpellIcon from './SpellIcon';

type Stage = 'wizard' | 'grid' | 'base' | 'form';

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
/** Виды утилит (R16): поля под каждый вид, экзотика — в JSON. */
const UTILITY_KINDS = [
  'extraAction',
  'extraMovement',
  'disengage',
  'check',
  'extraAttacks',
  'weaponAttack',
  'healPool',
  'tempHp',
  'patientDefense',
  'stepOfTheWind',
  'moveZone',
  'teleport',
  'scatter',
  'wake',
  'revive',
  'recallWeapon',
  'kenseisShot',
  'sharpenBlade',
  'stabilize',
  'endCondition',
  'direction',
  'telekinesis',
  'dispel',
] as const;
const UTILITY_DICE_KINDS = new Set<string>(['tempHp', 'healPool']);
const UTILITY_AMOUNT_KINDS = new Set<string>([
  'teleport',
  'extraAttacks',
  'extraMovement',
  'healPool',
  'moveZone',
  'telekinesis',
  'sharpenBlade',
  'extraAction',
]);
const UTILITY_MAXSIZE_KINDS = new Set<string>(['telekinesis']);

type DurationKind = (typeof DURATION_KINDS)[number];

interface Props {
  initial: SpellDef;
  /** true — ключ записи зафиксирован (редактирование существующего кастома). */
  lockedKey: boolean;
  /** Стартовый экран: «с нуля» (мастер), копия канона, готовый черновик. */
  start?: Stage;
  onClose: () => void;
}

/** Поля payload зоны (слоты триггеров и `onCreate`): спас, containment, привязка урона. */
function ZonePayloadFields({
  payload,
  parts,
  patch,
}: {
  payload: PayloadSpec;
  parts: SpellDamagePart[];
  patch: (patch: Partial<PayloadSpec>) => void;
}) {
  const source = slotDamageSource(payload);
  const literalDamage = payload.damage && 'dice' in payload.damage ? payload.damage : undefined;
  return (
    <div className="field-row">
      <Field label={t('ui.constructor.save')}>
        <select
          value={payload.save?.ability ?? ''}
          onChange={(e) => {
            const ability = e.target.value as AbilityKey | '';
            patch({ save: ability ? { ability, ...(payload.save?.half ? { half: true } : {}) } : undefined });
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
            onChange={(e) => patch({ save: { ...payload.save!, half: e.target.checked || undefined } })}
          />
          <span>{t('ui.constructor.saveHalf')}</span>
        </label>
      )}
      <Field label={t('ui.constructor.containment')}>
        <select
          value={payload.containment ?? 'anyCell'}
          onChange={(e) => patch({ containment: e.target.value as 'anyCell' | 'fullyWithin' })}
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
            if (value === 'none') patch({ damage: undefined });
            else if (value === 'literal') {
              const dice =
                literalDamage && (typeof literalDamage.dice === 'string' || typeof literalDamage.dice === 'number')
                  ? literalDamage.dice
                  : '1d6';
              patch({ damage: { dice, types: literalDamage?.types ?? [] } });
            } else {
              const index = Number(value.slice('part:'.length)) || 0;
              const part = parts[index];
              if (part) patch({ damage: slotDamageWithPart(payload, part, index).damage });
            }
          }}
        >
          <option value="none">{t('ui.constructor.damageNone')}</option>
          {parts.map((part, index) => (
            <option key={index} value={`part:${index}`}>
              {t('ui.constructor.damagePart', { n: index + 1 })} · {part.types.map((type) => damageLabel(type)).join('/')}
            </option>
          ))}
          <option value="literal">{t('ui.constructor.damageLiteral')}</option>
        </select>
      </Field>
      {source.kind === 'literal' && literalDamage && (
        <>
          <Field label={t('ui.constructor.damageDice')}>
            <input
              type="text"
              value={
                typeof literalDamage.dice === 'string' || typeof literalDamage.dice === 'number'
                  ? String(literalDamage.dice)
                  : ''
              }
              onChange={(e) => patch({ damage: { ...literalDamage, dice: e.target.value.trim() } })}
            />
          </Field>
          <div className="ability-types">
            {DAMAGE_TYPES.map((damage) => {
              const types = (literalDamage.types ?? []).filter((type): type is string => typeof type === 'string');
              const checked = types.includes(damage.key);
              return (
                <button
                  type="button"
                  key={damage.key}
                  className={`ability-type${checked ? ' on' : ''}`}
                  onClick={() =>
                    patch({
                      damage: {
                        ...literalDamage,
                        types: checked ? types.filter((type) => type !== damage.key) : [...types, damage.key],
                      },
                    })
                  }
                >
                  {damageLabel(damage.key)}
                </button>
              );
            })}
          </div>
        </>
      )}
      {(payload.effects?.length || payload.heal || payload.successDamage || payload.healTo !== undefined) && (
        <span className="hint">{t('ui.constructor.triggerGated')}</span>
      )}
    </div>
  );
}

/** Поля геометрии области (`AreaSpec`): форма/размер/ширина линии; подписи настраиваются. */
function AreaFields({
  value,
  onChange,
  none = true,
  labels = { shape: 'ui.constructor.areaShape', size: 'ui.constructor.areaSize', width: 'ui.constructor.areaWidth' },
}: {
  value: AreaSpec | undefined;
  onChange: (area: AreaSpec | undefined) => void;
  none?: boolean;
  labels?: { shape: MessageKey; size: MessageKey; width: MessageKey };
}) {
  return (
    <>
      <Field label={t(labels.shape)}>
        <select
          value={value?.shape ?? ''}
          onChange={(e) => {
            const shape = e.target.value as AreaSpec['shape'] | '';
            onChange(
              shape
                ? { shape, size: value?.size ?? 15, ...(shape === 'line' ? { width: value?.width ?? 5 } : {}) }
                : undefined
            );
          }}
        >
          {none && <option value="">{t('ui.constructor.areaNone')}</option>}
          {AREA_SHAPES.map((shape) => (
            <option key={shape} value={shape}>
              {t(`ui.constructor.areaShapeName.${shape}` as MessageKey)}
            </option>
          ))}
        </select>
      </Field>
      {value && (
        <Field label={t(labels.size)}>
          <input
            type="number"
            min={5}
            step={5}
            value={value.size}
            onChange={(e) => onChange({ ...value, size: Number(e.target.value) || 5 })}
          />
        </Field>
      )}
      {value?.shape === 'line' && (
        <Field label={t(labels.width)}>
          <input
            type="number"
            min={5}
            step={5}
            value={value.width ?? 5}
            onChange={(e) => onChange({ ...value, width: Number(e.target.value) || 5 })}
          />
        </Field>
      )}
    </>
  );
}

/** Урон (`DamageSpec`) в форме: литеральные кости/типы; составной — «из данных». */
function DamageSpecFields({
  damage,
  onChange,
}: {
  damage: DamageSpec | undefined;
  onChange: (damage: DamageSpec | undefined) => void;
}) {
  if (!damage || !('dice' in damage)) return <span className="hint">{t('ui.constructor.fromData')}</span>;
  const types = damage.types ?? [];
  const toggle = (key: string) =>
    onChange({
      ...damage,
      types: types.some((type) => type === key) ? types.filter((type) => type !== key) : [...types, key],
    });
  return (
    <>
      <Field label={t('ui.constructor.damageDice')}>
        <ExprField value={damage.dice} onChange={(value) => onChange({ ...damage, dice: value ?? '1d6' })} />
      </Field>
      <div className="ability-types">
        {DAMAGE_TYPES.map((entry) => (
          <button
            type="button"
            key={entry.key}
            className={`ability-type${types.some((type) => type === entry.key) ? ' on' : ''}`}
            onClick={() => toggle(entry.key)}
          >
            {damageLabel(entry.key)}
          </button>
        ))}
      </div>
    </>
  );
}

/** Конструктор кастомного заклинания (R16 К1): вход, мета-форма, превью, сохранение. */
export default function SpellConstructorModal({ initial, lockedKey, start = 'form', onClose }: Props) {
  const [stage, setStage] = useState<Stage>(start);
  const [kitPayload, setKitPayload] = useState<KitPayload | null>(null);
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
  const zoneActions = zone?.actions ?? [];
  const setZoneActions = (list: ActionSpec[]) =>
    setRecord((r) => patchZone(r, { actions: list.length ? list : undefined }));
  const patchZoneAction = (index: number, patch: Partial<ActionSpec>) => {
    const list = [...zoneActions];
    list[index] = { ...list[index]!, ...patch };
    setZoneActions(list);
  };
  const zoneActionKind = (action: ActionSpec): 'move' | 'attack' | 'save' | 'other' => {
    if (action.utility?.kind === 'moveZone') return 'move';
    if (action.primary === 'attack') return 'attack';
    if (action.primary === 'save') return 'save';
    return 'other';
  };
  const zoneActionRange = (action: ActionSpec): number | undefined =>
    action.targeting && 'range' in action.targeting ? action.targeting.range : undefined;
  const setZoneActionRange = (index: number, range: number | undefined, fallbackKind: ActionTargeting['kind']) => {
    const action = zoneActions[index]!;
    const targeting = action.targeting ?? { kind: fallbackKind };
    patchZoneAction(index, { targeting: { ...targeting, range } as ActionSpec['targeting'] });
  };
  const blankZoneAction = (kind: 'move' | 'attack' | 'save'): ActionSpec => {
    if (kind === 'move') {
      return {
        id: 'move',
        name: t('ui.constructor.zoneActionMove'),
        cost: 'bonus',
        defKey: 'zone:move',
        primary: 'utility',
        utility: { kind: 'moveZone', amount: 30 },
        targeting: { kind: 'point', range: 30 },
      };
    }
    if (kind === 'attack') {
      return {
        id: 'strike',
        name: record.name,
        cost: 'action',
        primary: 'attack',
        attack: { rangeType: 'melee' },
        count: 1,
        damage: { dice: { ref: 'spellDamage' }, types: ['force'] },
        targeting: { kind: 'creature', range: 5, from: 'origin' },
      };
    }
    return {
      id: 'strike',
      name: record.name,
      cost: 'action',
      primary: 'save',
      save: { ability: 'dex', half: true },
      damage: { dice: { ref: 'spellDamage' }, types: ['lightning'] },
      area: { shape: 'sphere', size: 5 },
      targeting: { kind: 'area', area: { shape: 'sphere', size: 5 }, range: 60 },
    };
  };
  const zoneHasMove = (z: NonNullable<typeof zone>): boolean =>
    (z.actions ?? []).some((action) => action.defKey === 'zone:move' || action.utility?.kind === 'moveZone');
  const zoneKindOf = (z: NonNullable<typeof zone>): 'static' | 'movable' | 'aura' =>
    z.anchor === 'source' ? 'aura' : zoneHasMove(z) ? 'movable' : 'static';
  const setZoneKind = (kind: 'static' | 'movable' | 'aura') => {
    if (!zone) return;
    const existingMove = (zone.actions ?? []).find(
      (action) => action.defKey === 'zone:move' || action.utility?.kind === 'moveZone'
    );
    const rest = (zone.actions ?? []).filter(
      (action) => action.defKey !== 'zone:move' && action.utility?.kind !== 'moveZone'
    );
    if (kind === 'aura') {
      setRecord((r) =>
        patchZone(r, { anchor: 'source', movable: undefined, actions: rest.length ? rest : undefined })
      );
      return;
    }
    if (kind === 'movable') {
      setRecord((r) =>
        patchZone(r, { anchor: undefined, movable: true, actions: [...rest, existingMove ?? blankZoneAction('move')] })
      );
      return;
    }
    setRecord((r) => patchZone(r, { anchor: undefined, movable: undefined, actions: rest.length ? rest : undefined }));
  };
  const patchTop = (patch: Record<string, unknown>) =>
    setRecord((r) => {
      const automation = { ...r.automation } as Record<string, unknown>;
      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined) delete automation[key];
        else automation[key] = value;
      }
      return { ...r, automation: automation as typeof r.automation };
    });
  const targeting = automation.targeting;
  const patchTargeting = (patch: Partial<ActionTargeting> | null) => {
    if (patch === null) {
      patchTop({ targeting: undefined });
      return;
    }
    const next = { ...(targeting ?? { kind: 'creature', range: 30 }) } as Record<string, unknown>;
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) delete next[key];
      else next[key] = value;
    }
    patchTop({ targeting: next });
  };
  const instantArea = automation.area;
  const instantAreaFromSpell = !!instantArea && 'from' in instantArea;
  const instantAreaLiteral: AreaSpec | undefined = !instantArea
    ? undefined
    : 'from' in instantArea
      ? instantArea.fallback
      : instantArea;
  const setInstantAreaMode = (mode: '' | 'own' | 'spell') => {
    const literal = instantAreaLiteral ?? { shape: 'sphere', size: 10 };
    if (!mode) patchTop({ area: undefined });
    else if (mode === 'spell') patchTop({ area: { from: 'spell', fallback: literal } });
    else patchTop({ area: literal });
  };
  const setInstantAreaLiteral = (next: AreaSpec | undefined) => {
    if (!next) {
      patchTop({ area: undefined });
      return;
    }
    patchTop({ area: instantAreaFromSpell ? { from: 'spell', fallback: next } : next });
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
  const kit = useMemo(() => kitOf(record), [record]);
  const payloadKind = kit?.payload;
  const recognized = kit !== null;
  /** Р2: для распознанного kit показываем только блоки, относящиеся к типу. */
  const showEffectsEditor = effectsAllowed && (!recognized || payloadKind === 'effect' || effects.length > 0);
  const showTargeting =
    !!targeting ||
    !recognized ||
    payloadKind === 'utility' ||
    (kit?.delivery === 'creatures' && kit?.resolution !== 'attack');
  const showTop =
    !recognized ||
    payloadKind === 'damage' ||
    payloadKind === 'heal' ||
    payloadKind === 'effect' ||
    payloadKind === 'utility' ||
    (payloadKind === 'manual' && !!targeting);
  const showArea = !recognized || !!area || !!automation.area || kit?.delivery === 'area' || kit?.delivery === 'zone';
  const showInstantArea = !recognized || !!automation.area;
  const showChoices =
    choices.length > 0 ||
    !recognized ||
    payloadKind === 'damage' ||
    payloadKind === 'heal' ||
    payloadKind === 'effect' ||
    payloadKind === 'weapon';
  const showZoneAdd =
    !recognized ||
    ((payloadKind === 'damage' || payloadKind === 'heal' || payloadKind === 'effect') && kit?.resolution !== 'attack');
  const showDamage =
    !recognized ||
    payloadKind === 'damage' ||
    payloadKind === 'heal' ||
    !!record.damage ||
    !!automation.damage ||
    !!automation.heal;
  const showAttackField =
    !recognized ||
    kit?.resolution === 'attack' ||
    !!record.spellAttack ||
    !!automation.attack ||
    !!automation.weaponAttack;
  const showSaveField = !recognized || kit?.resolution === 'save' || !!record.save || !!automation.save;
  const showAttackSave = showAttackField || showSaveField || primary === 'attack' || primary === 'auto';
  const kitSummary = useMemo(() => {
    const current = kitOf(record);
    if (!current) return t('ui.constructor.kitMixed');
    return [
      t(`ui.constructor.kit.${current.payload}` as MessageKey),
      ...(current.resolution ? [t(`ui.constructor.gridResolution.${current.resolution}` as MessageKey)] : []),
      ...(current.delivery ? [t(`ui.constructor.gridDelivery.${current.delivery}` as MessageKey)] : []),
    ].join(' · ');
  }, [record]);
  const addCarrierEffect = () =>
    setEffects([
      ...effects,
      { id: newId(), name: record.name, duration: { type: 'permanent' }, to: 'targets', modifiers: [] },
    ]);
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

  if (stage === 'wizard' || stage === 'grid' || stage === 'base') {
    return (
      <Modal onClose={onClose} className="spell-constructor" title={t('ui.constructor.title')}>
        {stage === 'wizard' ? (
          <>
            <div className="sheet-section-title">{t('ui.constructor.kitTitle')}</div>
            <div className="constructor-profiles">
              {KIT_PAYLOADS.map((payload) => (
                <button
                  type="button"
                  key={payload.id}
                  className="constructor-profile"
                  onClick={() => {
                    if (isGridPayload(payload.id)) {
                      setKitPayload(payload.id);
                      setStage('grid');
                    } else {
                      setRecord(kitRecord(t('ui.constructor.defaultName'), { payload: payload.id }));
                      setStage('form');
                    }
                  }}
                >
                  <span className="constructor-profile-name">{t(payload.labelKey as MessageKey)}</span>
                  <span className="hint">{t(payload.hintKey as MessageKey)}</span>
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
        ) : stage === 'grid' ? (
          <>
            <div className="sheet-section-title">{t('ui.constructor.gridTitle')}</div>
            <div className="constructor-kit-grid">
              {KIT_RESOLUTIONS.map((resolution) => (
                <div className="constructor-kit-row" key={resolution}>
                  <span className="constructor-tier-label">
                    {t(`ui.constructor.gridResolution.${resolution}` as MessageKey)}
                  </span>
                  <div className="constructor-kit-cells">
                    {kitDeliveries(resolution).map((delivery) => (
                      <button
                        type="button"
                        key={delivery}
                        className="constructor-profile"
                        aria-label={t('ui.constructor.gridCell', {
                          resolution: t(`ui.constructor.gridResolution.${resolution}` as MessageKey),
                          delivery: t(`ui.constructor.gridDelivery.${delivery}` as MessageKey),
                        })}
                        onClick={() => {
                          setRecord(
                            kitRecord(t('ui.constructor.defaultName'), {
                              payload: kitPayload ?? 'damage',
                              resolution,
                              delivery,
                            })
                          );
                          setStage('form');
                        }}
                      >
                        {t(`ui.constructor.gridDelivery.${delivery}` as MessageKey)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="modal-actions">
              <button type="button" onClick={() => setStage('wizard')}>
                {t('ui.constructor.backToWizard')}
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
      <p className="hint constructor-kit-summary">{kitSummary}</p>
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
          {record.time[0]?.unit === 'reaction' && (
            <p className="hint">{t('ui.constructor.reactionHint')}</p>
          )}

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

          {showAttackSave && (
            <>
          <div className="sheet-section-title">{t('ui.constructor.attackSave')}</div>
          <div className="field-row">
            {showAttackField && (
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
            )}
            {showSaveField && (
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
            )}
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
            {(primary === 'attack' || primary === 'auto') && (
              <>
                <Field label={t('ui.constructor.metaAttacks')}>
                  <input
                    type="number"
                    min={2}
                    value={record.attacks ?? ''}
                    onChange={(e) => {
                      const n = Math.round(Number(e.target.value));
                      setMeta({ attacks: n >= 2 ? n : undefined });
                    }}
                  />
                </Field>
                <Field label={t('ui.constructor.metaCount')}>
                  <ExprField value={automation.count} onChange={(value) => patchTop({ count: value })} placeholder="3" />
                </Field>
              </>
            )}
          </div>
            </>
          )}

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
                  <EffectModifiersEditor
                    modifiers={wa.hitEffect.modifiers}
                    onChange={(modifiers) => patchWeaponAttack({ hitEffect: { ...wa.hitEffect!, modifiers } })}
                  />
                  <EffectTriggersEditor
                    triggers={wa.hitEffect.triggers}
                    onChange={(triggers) => patchWeaponAttack({ hitEffect: { ...wa.hitEffect!, triggers } })}
                  />
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

          {showDamage && (
            <>
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
                <DamageDiceField
                  value={{ dice: record.damage?.dice ?? [], types: record.damage?.types ?? [] }}
                  onChange={(next) => setRecord((r) => withDamageDice(r, next))}
                  placeholder="3d6fire"
                />
              </div>
            </>
          )}
            </>
          )}

          {showArea && (
            <>
              <div className="sheet-section-title">{t('ui.constructor.area')}</div>
              <div className="field-row">
                <AreaFields value={area} onChange={(next) => setMeta({ areaSpec: next })} />
              </div>
            </>
          )}

          {showInstantArea && (
            <>
              <div className="sheet-section-title">{t('ui.constructor.instantArea')}</div>
              <div className="field-row">
                <Field label={t('ui.constructor.instantAreaMode')}>
                  <select
                    value={instantArea ? (instantAreaFromSpell ? 'spell' : 'own') : ''}
                    onChange={(e) => setInstantAreaMode(e.target.value as '' | 'own' | 'spell')}
                  >
                    <option value="">{t('ui.constructor.areaNone')}</option>
                    <option value="own">{t('ui.constructor.instantAreaOwn')}</option>
                    <option value="spell">{t('ui.constructor.instantAreaSpell')}</option>
                  </select>
                </Field>
                {instantAreaLiteral && (
                  <AreaFields
                    value={instantAreaLiteral}
                    onChange={setInstantAreaLiteral}
                    labels={{
                      shape: 'ui.constructor.instantAreaShape',
                      size: 'ui.constructor.instantAreaSize',
                      width: 'ui.constructor.instantAreaWidth',
                    }}
                  />
                )}
              </div>
            </>
          )}

          {showEffectsEditor ? (
            <>
              <div className="sheet-section-title">{t('ui.constructor.effects')}</div>
              <EffectListEditor effects={effects} onChange={setEffects} defaultName={record.name} />
            </>
          ) : effectsAllowed ? (
            <button type="button" onClick={addCarrierEffect}>
              {t('ui.constructor.addEffect')}
            </button>
          ) : null}

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
                {utility.kind === 'check' && (
                  <Field label={t('ui.constructor.utilityCheckAbility')}>
                    <select
                      value={utility.ability ?? ''}
                      onChange={(e) => patchUtility({ ability: (e.target.value || undefined) as AbilityKey | undefined })}
                    >
                      <option value="">{t('ui.constructor.areaNone')}</option>
                      {ABILITY_KEYS.map((key) => (
                        <option key={key} value={key}>
                          {abilityName(key)}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
                {UTILITY_MAXSIZE_KINDS.has(utility.kind) && (
                  <Field label={t('ui.constructor.topForceMaxSize')}>
                    <select
                      value={utility.maxSize ?? ''}
                      onChange={(e) =>
                        patchUtility({ maxSize: (e.target.value || undefined) as 'normal' | 'large' | 'huge' | undefined })
                      }
                    >
                      <option value="">{t('ui.constructor.areaNone')}</option>
                      <option value="normal">{t('ui.constructor.topForceSize.normal')}</option>
                      <option value="large">{t('ui.constructor.topForceSize.large')}</option>
                      <option value="huge">{t('ui.constructor.topForceSize.huge')}</option>
                    </select>
                  </Field>
                )}
                {utility.kind === 'scatter' && (
                  <>
                    <Field label={t('ui.constructor.utilityScatterTargets')}>
                      <input
                        type="number"
                        min={1}
                        value={utility.targets ?? ''}
                        onChange={(e) => patchUtility({ targets: Number(e.target.value) || undefined })}
                      />
                    </Field>
                    <Field label={t('ui.constructor.utilityDestinationFeet')}>
                      <input
                        type="number"
                        min={0}
                        value={utility.destinationFeet ?? ''}
                        onChange={(e) => patchUtility({ destinationFeet: Number(e.target.value) || undefined })}
                      />
                    </Field>
                  </>
                )}
              </div>
              {utility.kind === 'teleport' && (
                <>
                  <div className="constructor-checks">
                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={!!utility.passenger}
                        onChange={(e) =>
                          patchUtility({ passenger: e.target.checked ? { feet: 5, destFeet: 5 } : undefined })
                        }
                      />
                      <span>{t('ui.constructor.utilityPassenger')}</span>
                    </label>
                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={!!utility.fromBurst}
                        onChange={(e) =>
                          patchUtility({
                            fromBurst: e.target.checked ? { feet: 10, save: { ability: 'dex' } } : undefined,
                          })
                        }
                      />
                      <span>{t('ui.constructor.utilityFromBurst')}</span>
                    </label>
                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={!!utility.blockedDamage}
                        onChange={(e) =>
                          patchUtility({
                            blockedDamage: e.target.checked ? { dice: '4d6', types: ['force'] } : undefined,
                          })
                        }
                      />
                      <span>{t('ui.constructor.utilityBlockedDamage')}</span>
                    </label>
                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={utility.ignoreSight === true}
                        onChange={(e) => patchUtility({ ignoreSight: e.target.checked || undefined })}
                      />
                      <span>{t('ui.constructor.utilityIgnoreSight')}</span>
                    </label>
                  </div>
                  {utility.passenger && (
                    <div className="field-row">
                      <Field label={t('ui.constructor.utilityPassengerFeet')}>
                        <input
                          type="number"
                          min={0}
                          value={utility.passenger.feet}
                          onChange={(e) =>
                            patchUtility({ passenger: { ...utility.passenger!, feet: Number(e.target.value) || 0 } })
                          }
                        />
                      </Field>
                      <Field label={t('ui.constructor.utilityPassengerDest')}>
                        <input
                          type="number"
                          min={0}
                          value={utility.passenger.destFeet}
                          onChange={(e) =>
                            patchUtility({
                              passenger: { ...utility.passenger!, destFeet: Number(e.target.value) || 0 },
                            })
                          }
                        />
                      </Field>
                      <label className="checkbox-row">
                        <input
                          type="checkbox"
                          checked={utility.passenger.maxSize === true}
                          onChange={(e) =>
                            patchUtility({
                              passenger: { ...utility.passenger!, maxSize: e.target.checked || undefined },
                            })
                          }
                        />
                        <span>{t('ui.constructor.utilityPassengerMaxSize')}</span>
                      </label>
                    </div>
                  )}
                  {utility.fromBurst && (
                    <div className="field-row">
                      <Field label={t('ui.constructor.utilityBurstFeet')}>
                        <input
                          type="number"
                          min={0}
                          value={utility.fromBurst.feet}
                          onChange={(e) =>
                            patchUtility({ fromBurst: { ...utility.fromBurst!, feet: Number(e.target.value) || 0 } })
                          }
                        />
                      </Field>
                      <Field label={t('ui.constructor.save')}>
                        <select
                          value={utility.fromBurst.save.ability}
                          onChange={(e) =>
                            patchUtility({
                              fromBurst: {
                                ...utility.fromBurst!,
                                save: { ...utility.fromBurst!.save, ability: e.target.value as AbilityKey },
                              },
                            })
                          }
                        >
                          {ABILITY_KEYS.map((key) => (
                            <option key={key} value={key}>
                              {abilityName(key)}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <label className="checkbox-row">
                        <input
                          type="checkbox"
                          checked={utility.fromBurst.save.half === true}
                          onChange={(e) =>
                            patchUtility({
                              fromBurst: {
                                ...utility.fromBurst!,
                                save: { ...utility.fromBurst!.save, half: e.target.checked || undefined },
                              },
                            })
                          }
                        />
                        <span>{t('ui.constructor.saveHalf')}</span>
                      </label>
                      <DamageSpecFields
                        damage={utility.fromBurst.damage}
                        onChange={(damage) => patchUtility({ fromBurst: { ...utility.fromBurst!, damage } })}
                      />
                    </div>
                  )}
                  {utility.blockedDamage && (
                    <div className="field-row">
                      <DamageSpecFields
                        damage={utility.blockedDamage}
                        onChange={(damage) => patchUtility({ blockedDamage: damage })}
                      />
                    </div>
                  )}
                </>
              )}
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
              <div className="field-row">
                <Field label={t('ui.constructor.zoneKind')}>
                  <select
                    value={zoneKindOf(zone)}
                    onChange={(e) => setZoneKind(e.target.value as 'static' | 'movable' | 'aura')}
                  >
                    <option value="static">{t('ui.constructor.zoneKind.static')}</option>
                    <option value="movable">{t('ui.constructor.zoneKind.movable')}</option>
                    <option value="aura">{t('ui.constructor.zoneKind.aura')}</option>
                  </select>
                </Field>
              </div>
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
              <div className="field-row">
                <LightFields
                  value={zone.light}
                  onChange={(light) => setRecord((r) => patchZone(r, { light }))}
                />
              </div>
              {ZONE_SLOTS.map((slot) => {
                const payload = zone.triggers?.[slot];
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
                      <ZonePayloadFields
                        payload={payload}
                        parts={record.damage?.parts ?? []}
                        patch={(p) => setRecord((r) => withZonePayload(r, slot, p))}
                      />
                    )}
                  </div>
                );
              })}
              <div className="field-row">
                <Field label={t('ui.constructor.zoneCharges')}>
                  <ExprField
                    value={zone.charges}
                    onChange={(value) => setRecord((r) => patchZone(r, { charges: value }))}
                    placeholder="4"
                  />
                </Field>
                <Field label={t('ui.constructor.zoneDealtLimit')}>
                  <input
                    type="number"
                    min={0}
                    value={zone.dealtLimit ?? ''}
                    onChange={(e) =>
                      setRecord((r) => patchZone(r, { dealtLimit: Number(e.target.value) || undefined }))
                    }
                  />
                </Field>
                <Field label={t('ui.constructor.zoneAnchor')}>
                  <select
                    value={zone.anchor ?? ''}
                    onChange={(e) =>
                      setRecord((r) => patchZone(r, { anchor: (e.target.value || undefined) as 'source' | 'point' | undefined }))
                    }
                  >
                    <option value="">{t('ui.constructor.areaNone')}</option>
                    <option value="source">{t('ui.constructor.zoneAnchorSource')}</option>
                    <option value="point">{t('ui.constructor.zoneAnchorPoint')}</option>
                  </select>
                </Field>
                <Field label={t('ui.constructor.zoneMovementCost')}>
                  <input
                    type="number"
                    min={1}
                    value={zone.flags?.movementCost ?? ''}
                    onChange={(e) =>
                      setRecord((r) =>
                        patchZone(r, {
                          flags: { ...(zone.flags ?? {}), movementCost: Number(e.target.value) || undefined },
                        })
                      )
                    }
                  />
                </Field>
              </div>
              <div className="constructor-checks">
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={zone.excludeSource === true}
                    onChange={(e) => setRecord((r) => patchZone(r, { excludeSource: e.target.checked || undefined }))}
                  />
                  <span>{t('ui.constructor.zoneExcludeSource')}</span>
                </label>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={!!zone.onCreate}
                    onChange={(e) =>
                      setRecord((r) =>
                        patchZone(r, { onCreate: e.target.checked ? { containment: 'anyCell' } : undefined })
                      )
                    }
                  />
                  <span>{t('ui.constructor.zoneOnCreate')}</span>
                </label>
              </div>
              {zone.onCreate && (
                <ZonePayloadFields
                  payload={zone.onCreate}
                  parts={record.damage?.parts ?? []}
                  patch={(p) =>
                    setRecord((r) => patchZone(r, { onCreate: patchPayloadSpec(zone.onCreate ?? {}, p) }))
                  }
                />
              )}
              <div className="ability-types">
                <span className="constructor-chip-title">{t('ui.constructor.zoneExcludeTypes')}</span>
                {CREATURE_TYPES.map((type) => {
                  const checked = (zone.excludeCreatureTypes ?? []).includes(type.key);
                  return (
                    <button
                      type="button"
                      key={type.key}
                      className={`ability-type${checked ? ' on' : ''}`}
                      onClick={() =>
                        setRecord((r) =>
                          patchZone(r, {
                            excludeCreatureTypes: checked
                              ? (zone.excludeCreatureTypes ?? []).filter((key) => key !== type.key)
                              : [...(zone.excludeCreatureTypes ?? []), type.key],
                          })
                        )
                      }
                    >
                      {creatureTypeLabel(type.key)}
                    </button>
                  );
                })}
              </div>
              <div className="sheet-section-title">{t('ui.constructor.zoneActions')}</div>
              {zoneActions.map((action, index) => {
                const kind = zoneActionKind(action);
                return (
                  <div className="constructor-effect" key={`${action.id}-${index}`}>
                    <div className="field-row">
                      <Field label={t('ui.constructor.effectName')}>
                        <input
                          type="text"
                          value={action.name}
                          onChange={(e) => patchZoneAction(index, { name: e.target.value })}
                        />
                      </Field>
                      <Field label={t('ui.constructor.zoneActionCost')}>
                        <select
                          value={action.cost}
                          onChange={(e) => patchZoneAction(index, { cost: e.target.value as ActionSpec['cost'] })}
                        >
                          <option value="action">{t('ui.constructor.unit.action')}</option>
                          <option value="bonus">{t('ui.constructor.unit.bonus')}</option>
                          <option value="free">{t('ui.constructor.zoneActionFree')}</option>
                        </select>
                      </Field>
                      <button type="button" onClick={() => setZoneActions(zoneActions.filter((_, i) => i !== index))}>
                        {t('ui.constructor.remove')}
                      </button>
                    </div>
                    {kind === 'move' && (
                      <div className="field-row">
                        <Field label={t('ui.constructor.zoneActionAmount')}>
                          <input
                            type="number"
                            min={0}
                            value={action.utility?.amount ?? ''}
                            onChange={(e) =>
                              patchZoneAction(index, {
                                utility: { ...action.utility!, amount: Number(e.target.value) || undefined },
                              })
                            }
                          />
                        </Field>
                        <Field label={t('ui.constructor.targetingRange')}>
                          <input
                            type="number"
                            min={0}
                            value={zoneActionRange(action) ?? ''}
                            onChange={(e) => setZoneActionRange(index, Number(e.target.value) || undefined, 'point')}
                          />
                        </Field>
                      </div>
                    )}
                    {kind === 'attack' && (
                      <>
                        <div className="field-row">
                          <Field label={t('ui.constructor.attack')}>
                            <select
                              value={action.attack?.rangeType ?? 'melee'}
                              onChange={(e) =>
                                patchZoneAction(index, {
                                  attack: {
                                    ...(action.attack ?? { rangeType: 'melee' }),
                                    rangeType: e.target.value as 'melee' | 'ranged',
                                  },
                                })
                              }
                            >
                              <option value="melee">{t('ui.constructor.attackMelee')}</option>
                              <option value="ranged">{t('ui.constructor.attackRanged')}</option>
                            </select>
                          </Field>
                          <Field label={t('ui.constructor.targetingRange')}>
                            <input
                              type="number"
                              min={0}
                              value={zoneActionRange(action) ?? ''}
                            onChange={(e) => setZoneActionRange(index, Number(e.target.value) || undefined, 'creature')}
                            />
                          </Field>
                          <label className="checkbox-row">
                            <input
                              type="checkbox"
                              checked={action.damage !== undefined && 'dice' in action.damage && action.damage.abilityMod === true}
                              onChange={(e) =>
                                action.damage && 'dice' in action.damage
                                  ? patchZoneAction(index, {
                                      damage: { ...action.damage, abilityMod: e.target.checked || undefined },
                                    })
                                  : undefined
                              }
                            />
                            <span>{t('ui.constructor.zoneActionAbilityMod')}</span>
                          </label>
                          <Field label={t('ui.constructor.zoneActionShrink')}>
                            <input
                              type="number"
                              min={0}
                              value={action.shrinkFeet ?? ''}
                              onChange={(e) =>
                                patchZoneAction(index, { shrinkFeet: Number(e.target.value) || undefined })
                              }
                            />
                          </Field>
                        </div>
                        <div className="field-row">
                          <DamageSpecFields
                            damage={action.damage}
                            onChange={(damage) => patchZoneAction(index, { damage: damage as ActionSpec['damage'] })}
                          />
                        </div>
                      </>
                    )}
                    {kind === 'save' && (
                      <>
                        <div className="field-row">
                          <Field label={t('ui.constructor.save')}>
                            <select
                              value={action.save?.ability ?? 'dex'}
                              onChange={(e) =>
                                patchZoneAction(index, {
                                  save: { ...(action.save ?? { ability: 'dex' }), ability: e.target.value as AbilityKey },
                                })
                              }
                            >
                              {ABILITY_KEYS.map((key) => (
                                <option key={key} value={key}>
                                  {abilityName(key)}
                                </option>
                              ))}
                            </select>
                          </Field>
                          <label className="checkbox-row">
                            <input
                              type="checkbox"
                              checked={action.save?.half === true}
                              onChange={(e) =>
                                patchZoneAction(index, {
                                  save: {
                                    ...(action.save ?? { ability: 'dex' }),
                                    half: e.target.checked || undefined,
                                  },
                                })
                              }
                            />
                            <span>{t('ui.constructor.saveHalf')}</span>
                          </label>
                          <Field label={t('ui.constructor.targetingRange')}>
                            <input
                              type="number"
                              min={0}
                              value={zoneActionRange(action) ?? ''}
                            onChange={(e) => setZoneActionRange(index, Number(e.target.value) || undefined, 'area')}
                            />
                          </Field>
                        </div>
                        <div className="field-row">
                          <DamageSpecFields
                            damage={action.damage}
                            onChange={(damage) => patchZoneAction(index, { damage: damage as ActionSpec['damage'] })}
                          />
                          <AreaFields
                            value={action.area && 'shape' in action.area ? action.area : undefined}
                            onChange={(next) =>
                              patchZoneAction(index, {
                                area: next,
                                ...(action.targeting?.kind === 'area'
                                  ? {
                                      targeting: {
                                        ...action.targeting,
                                        area: next ?? { shape: 'sphere', size: 5 },
                                      },
                                    }
                                  : {}),
                              })
                            }
                            labels={{
                              shape: 'ui.constructor.zoneActionAreaShape',
                              size: 'ui.constructor.zoneActionAreaSize',
                              width: 'ui.constructor.zoneActionAreaWidth',
                            }}
                          />
                        </div>
                      </>
                    )}
                    {kind === 'other' && <p className="hint">{t('ui.constructor.fromData')}</p>}
                  </div>
                );
              })}
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) {
                    setZoneActions([...zoneActions, blankZoneAction(e.target.value as 'move' | 'attack' | 'save')]);
                  }
                }}
              >
                <option value="">{t('ui.constructor.zoneActionAdd')}</option>
                <option value="move">{t('ui.constructor.zoneActionMove')}</option>
                <option value="attack">{t('ui.constructor.zoneActionAttack')}</option>
                <option value="save">{t('ui.constructor.zoneActionSave')}</option>
              </select>
              <p className="hint">{t('ui.constructor.zoneHint')}</p>
              <button type="button" onClick={() => setRecord((r) => patchZone(r, null))}>
                {t('ui.constructor.zoneRemove')}
              </button>
            </>
          ) : showZoneAdd ? (
            <button type="button" onClick={() => setRecord((r) => patchZone(r, {}))}>
              {t('ui.constructor.zoneAdd')}
            </button>
          ) : null}

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

          {showChoices && (
            <>
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
            </>
          )}

          {showTop && (
            <>
          <div className="sheet-section-title">{t('ui.constructor.toplevel')}</div>
          {(automation.damage || automation.heal) && canConvertPayload(record) && (
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={!!automation.heal}
                onChange={(e) => setRecord((r) => withPayloadHeal(r, e.target.checked))}
              />
              <span>{t('ui.constructor.healPayload')}</span>
            </label>
          )}
          {showTargeting && (
            <div className="constructor-checks">
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={!!targeting}
                  onChange={(e) => patchTargeting(e.target.checked ? {} : null)}
                />
                <span>{t('ui.constructor.targeting')}</span>
              </label>
            </div>
          )}
          {showTargeting && targeting && (
            <>
              <div className="field-row">
                <Field label={t('ui.constructor.targetingKind')}>
                  <select
                    value={targeting.kind}
                    onChange={(e) => {
                      const kind = e.target.value as ActionTargeting['kind'];
                      patchTargeting({
                        kind,
                        ...(kind === 'area' ? { area: targeting.area ?? { shape: 'sphere', size: 15 } } : {}),
                      });
                    }}
                  >
                    {(['creature', 'point', 'area', 'self'] as const).map((kind) => (
                      <option key={kind} value={kind}>
                        {t(`ui.constructor.targetingKind.${kind}` as MessageKey)}
                      </option>
                    ))}
                  </select>
                </Field>
                {targeting.kind !== 'self' && (
                  <Field label={t('ui.constructor.targetingRange')}>
                    <input
                      type="number"
                      min={0}
                      value={targeting.range ?? ''}
                      onChange={(e) => patchTargeting({ range: Number(e.target.value) || undefined })}
                    />
                  </Field>
                )}
                {targeting.kind === 'creature' && (
                  <>
                    <Field label={t('ui.constructor.targetingTargets')}>
                      <input
                        type="number"
                        min={1}
                        value={targeting.targets ?? ''}
                        onChange={(e) => patchTargeting({ targets: Number(e.target.value) || undefined })}
                      />
                    </Field>
                    <Field label={t('ui.constructor.targetingFrom')}>
                      <select
                        value={targeting.from ?? ''}
                        onChange={(e) =>
                          patchTargeting({ from: (e.target.value || undefined) as ActionTargeting['from'] })
                        }
                      >
                        <option value="">{t('ui.constructor.targetingFrom.caster')}</option>
                        <option value="origin">{t('ui.constructor.targetingFrom.origin')}</option>
                      </select>
                    </Field>
                  </>
                )}
              </div>
              {targeting.kind === 'area' && (
                <div className="field-row">
                  <AreaFields
                    value={targeting.area}
                    none={false}
                    onChange={(next) => patchTargeting({ area: next ?? { shape: 'sphere', size: 15 } })}
                    labels={{
                      shape: 'ui.constructor.targetingAreaShape',
                      size: 'ui.constructor.targetingAreaSize',
                      width: 'ui.constructor.targetingAreaWidth',
                    }}
                  />
                </div>
              )}
            </>
          )}
          <div className="field-row">
            <Field label={t('ui.constructor.topTargets')}>
              <input
                type="number"
                min={0}
                value={automation.targets ?? ''}
                onChange={(e) => patchTop({ targets: Number(e.target.value) || undefined })}
              />
            </Field>
            <Field label={t('ui.constructor.topSide')}>
              <select
                value={automation.side ?? ''}
                onChange={(e) => patchTop({ side: (e.target.value || undefined) as 'hostile' | 'ally' | undefined })}
              >
                <option value="">{t('ui.constructor.areaNone')}</option>
                <option value="hostile">{t('ui.constructor.zoneSideHostile')}</option>
                <option value="ally">{t('ui.constructor.zoneSideAlly')}</option>
              </select>
            </Field>
            <Field label={t('ui.constructor.topAutoTargets')}>
              <input
                type="number"
                min={0}
                value={automation.autoTargets?.feet ?? ''}
                onChange={(e) =>
                  patchTop({
                    autoTargets: e.target.value
                      ? {
                          feet: Number(e.target.value) || 0,
                          side: automation.autoTargets?.side ?? 'ally',
                          ...(automation.autoTargets?.includeSelf ? { includeSelf: true } : {}),
                        }
                      : undefined,
                  })
                }
              />
            </Field>
            {automation.autoTargets && (
              <Field label={t('ui.constructor.topSide')}>
                <select
                  value={automation.autoTargets.side}
                  onChange={(e) =>
                    patchTop({ autoTargets: { ...automation.autoTargets!, side: e.target.value as 'hostile' | 'ally' | 'any' } })
                  }
                >
                  <option value="ally">{t('ui.constructor.zoneSideAlly')}</option>
                  <option value="hostile">{t('ui.constructor.zoneSideHostile')}</option>
                  <option value="any">{t('ui.constructor.topSideAny')}</option>
                </select>
              </Field>
            )}
          </div>
          <div className="constructor-checks">
            {(
              [
                ['halfOnMiss', 'ui.constructor.topHalfOnMiss'],
                ['lifesteal', 'ui.constructor.topLifesteal'],
                ['maxHpFromDamage', 'ui.constructor.topMaxHpFromDamage'],
                ['undeadTempHp', 'ui.constructor.topUndeadTempHp'],
              ] as const
            ).map(([key, label]) => (
              <label className="checkbox-row" key={key}>
                <input
                  type="checkbox"
                  checked={automation[key] === true}
                  onChange={(e) => patchTop({ [key]: e.target.checked || undefined })}
                />
                <span>{t(label)}</span>
              </label>
            ))}
            {automation.lifeTransfer && (
              <Field label={t('ui.constructor.topLifeTransfer')}>
                <input
                  type="number"
                  min={1}
                  value={automation.lifeTransfer.factor}
                  onChange={(e) => patchTop({ lifeTransfer: { factor: Math.max(1, Number(e.target.value) || 1) } })}
                />
              </Field>
            )}
          </div>
          {automation.successDamage && (
            <div className="field-row">
              <Field label={t('ui.constructor.topSuccessDamage')}>
                {automation.successDamage && 'dice' in automation.successDamage ? (
                  <ExprField
                    value={automation.successDamage.dice}
                    onChange={(value) => {
                      const current = automation.successDamage!;
                      if ('dice' in current) patchTop({ successDamage: { ...current, dice: value ?? '1d8' } });
                    }}
                  />
                ) : (
                  <span className="hint">{t('ui.constructor.triggerGated')}</span>
                )}
              </Field>
            </div>
          )}
          {payloadKind === 'damage' && kit?.resolution !== 'auto' && (
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={!!automation.burst}
                onChange={(e) =>
                  patchTop({ burst: e.target.checked ? { rangeFeet: 5, damageType: 'fire' } : undefined })
                }
              />
              <span>{t('ui.constructor.topBurst')}</span>
            </label>
          )}
          {automation.burst && (
            <div className="field-row">
              <Field label={t('ui.constructor.topBurstRange')}>
                <input
                  type="number"
                  min={0}
                  value={automation.burst.rangeFeet}
                  onChange={(e) => patchTop({ burst: { ...automation.burst!, rangeFeet: Number(e.target.value) || 0 } })}
                />
              </Field>
              <Field label={t('ui.constructor.damageDice')}>
                <ExprField
                  value={automation.burst.dice}
                  onChange={(value) => patchTop({ burst: { ...automation.burst!, dice: value } })}
                />
              </Field>
              <Field label={t('ui.constructor.partType')}>
                <select
                  value={typeof automation.burst.damageType === 'string' ? automation.burst.damageType : ''}
                  onChange={(e) => patchTop({ burst: { ...automation.burst!, damageType: e.target.value } })}
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
                  value={automation.burst.save?.ability ?? ''}
                  onChange={(e) => {
                    const ability = e.target.value as AbilityKey | '';
                    patchTop({
                      burst: {
                        ...automation.burst!,
                        save: ability ? { ability, ...(automation.burst!.save?.half ? { half: true } : {}) } : undefined,
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
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={automation.burst.includePrimary === true}
                  onChange={(e) => patchTop({ burst: { ...automation.burst!, includePrimary: e.target.checked || undefined } })}
                />
                <span>{t('ui.constructor.topBurstInclude')}</span>
              </label>
            </div>
          )}
          {automation.chain && (
            <div className="field-row">
              <Field label={t('ui.constructor.topChainJumps')}>
                <ExprField
                  value={automation.chain.jumps}
                  onChange={(value) => patchTop({ chain: { ...automation.chain!, jumps: value ?? 1 } })}
                />
              </Field>
              <Field label={t('ui.constructor.topChainFeet')}>
                <input
                  type="number"
                  min={0}
                  value={automation.chain.feet}
                  onChange={(e) => patchTop({ chain: { ...automation.chain!, feet: Number(e.target.value) || 0 } })}
                />
              </Field>
            </div>
          )}
          {automation.force && (
            <div className="field-row">
              <Field label={t('ui.constructor.topForce')}>
                <select
                  value={automation.force.kind}
                  onChange={(e) =>
                    patchTop({ force: { ...automation.force!, kind: e.target.value as 'push' | 'pull' } })
                  }
                >
                  <option value="push">{t('ui.constructor.topForcePush')}</option>
                  <option value="pull">{t('ui.constructor.topForcePull')}</option>
                </select>
              </Field>
              <Field label={t('ui.constructor.topForceFeet')}>
                <input
                  type="number"
                  min={0}
                  value={automation.force.feet}
                  onChange={(e) => patchTop({ force: { ...automation.force!, feet: Number(e.target.value) || 0 } })}
                />
              </Field>
              <Field label={t('ui.constructor.topForceMaxSize')}>
                <select
                  value={automation.force.maxSize ?? ''}
                  onChange={(e) =>
                    patchTop({
                      force: {
                        ...automation.force!,
                        maxSize: (e.target.value || undefined) as 'normal' | 'large' | 'huge' | undefined,
                      },
                    })
                  }
                >
                  <option value="">{t('ui.constructor.areaNone')}</option>
                  <option value="normal">{t('ui.constructor.topForceSize.normal')}</option>
                  <option value="large">{t('ui.constructor.topForceSize.large')}</option>
                  <option value="huge">{t('ui.constructor.topForceSize.huge')}</option>
                </select>
              </Field>
            </div>
          )}
            </>
          )}

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
