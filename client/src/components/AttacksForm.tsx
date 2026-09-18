import {
  DAMAGE_TYPES,
  MAX_ATTACKS,
  WEAPONS,
  emptyAttack,
  isUnarmedAttack,
  weaponAttackEntry,
  type AttackEntry,
  type WeaponContext,
  type WeaponDef,
} from 'shared';
import { t } from '../i18n';
import { damageLabel, masteryLabel } from '../i18n/domain';
import { weaponDisplayName } from '../i18n/names';
import { Field } from './Field';

interface Props {
  attacks: AttackEntry[];
  onChange: (attacks: AttackEntry[]) => void;
  title?: string;
  itemLabel?: string;
  namePlaceholder?: string;
  /** Контекст листа: включает выбор оружия из списка с автоподстановкой формул. */
  weaponContext?: WeaponContext;
  /** Данные из листа персонажа: только просмотр. */
  readOnly?: boolean;
}

/** Редактор атак/оружия (общий для токена и карточки персонажа). */
export default function AttacksForm({
  attacks,
  onChange,
  title = t('ui.attacks.title'),
  itemLabel = t('ui.attacks.item'),
  namePlaceholder = t('ui.attacks.namePlaceholder'),
  weaponContext,
  readOnly,
}: Props) {
  const setAttack = (index: number, patch: Partial<AttackEntry>) =>
    onChange(attacks.map((a, i) => (i === index ? { ...a, ...patch } : a)));
  const addAttack = () => {
    if (attacks.length < MAX_ATTACKS) onChange([...attacks, emptyAttack()]);
  };
  const removeAttack = (index: number) => {
    if (attacks.length > 1) onChange(attacks.filter((_, i) => i !== index));
  };
  const addFromList = (weapon: WeaponDef) => {
    if (!weaponContext) return;
    const entry = { ...weaponAttackEntry(weapon, weaponContext), name: weaponDisplayName(weapon.key, weapon.name) };
    if (weapon.unarmed) {
      const index = attacks.findIndex(isUnarmedAttack);
      if (index >= 0) {
        onChange(attacks.map((a, i) => (i === index ? entry : a)));
        return;
      }
    }
    if (attacks.length < MAX_ATTACKS) onChange([...attacks, entry]);
  };

  return (
    <div className="attacks-form">
      <div className="sheet-section-title">
        {title} ({attacks.length}/{MAX_ATTACKS})
      </div>
      {attacks.map((attack, i) => (
        <div className="weapon-block" data-testid="weapon-block" key={i}>
          <div className="weapon-head">
            <span>{itemLabel} {i + 1}</span>
            {!readOnly && attacks.length > 1 && (
              <button type="button" className="weapon-remove" data-testid="weapon-remove" onClick={() => removeAttack(i)}>
                {t('ui.common.delete')}
              </button>
            )}
          </div>
          <Field label={t('ui.common.name')}>
            <input
              type="text"
              value={attack.name}
              maxLength={40}
              placeholder={namePlaceholder}
              readOnly={readOnly}
              onChange={(e) => setAttack(i, { name: e.target.value })}
            />
          </Field>
          <div className="field-row">
            <Field label={t('ui.attacks.hit')}>
              <input
                type="text"
                value={attack.hit}
                placeholder="d20+str+pb"
                title={t('ui.attacks.formulaTitle')}
                readOnly={readOnly}
                onChange={(e) => setAttack(i, { hit: e.target.value })}
              />
            </Field>
            <Field label={t('ui.attacks.damage')}>
              <input
                type="text"
                value={attack.damage}
                placeholder="1d8+str"
                title={t('ui.attacks.formulaTitle')}
                readOnly={readOnly}
                onChange={(e) => setAttack(i, { damage: e.target.value })}
              />
            </Field>
            <Field label={t('ui.attacks.damageType')}>
              <select
                value={attack.damageType ?? ''}
                disabled={readOnly}
                onChange={(e) => setAttack(i, { damageType: e.target.value || undefined })}
              >
                <option value="">—</option>
                {DAMAGE_TYPES.map((dt) => (
                  <option key={dt.key} value={dt.key}>
                    {damageLabel(dt.key)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="field-row">
            <Field label={t('ui.attacks.range')}>
              <select
                value={attack.rangeType}
                disabled={readOnly}
                onChange={(e) => setAttack(i, { rangeType: e.target.value as AttackEntry['rangeType'] })}
              >
                <option value="melee">{t('ui.attacks.melee')}</option>
                <option value="ranged">{t('ui.attacks.ranged')}</option>
                <option value="none">{t('ui.attacks.noRange')}</option>
              </select>
            </Field>
            {attack.rangeType === 'melee' && (
              <Field label={t('ui.attacks.reach')}>
                <input
                  type="number"
                  min={0}
                  value={attack.rangeNormal}
                  readOnly={readOnly}
                  onChange={(e) => setAttack(i, { rangeNormal: Number(e.target.value) })}
                />
              </Field>
            )}
            {attack.rangeType === 'ranged' && (
              <>
                <Field label={t('ui.attacks.rangeNormal')}>
                  <input
                    type="number"
                    min={0}
                    value={attack.rangeNormal}
                    readOnly={readOnly}
                    onChange={(e) => setAttack(i, { rangeNormal: Number(e.target.value) })}
                  />
                </Field>
                <Field label={t('ui.attacks.rangeLong')}>
                  <input
                    type="number"
                    min={0}
                    value={attack.rangeLong}
                    readOnly={readOnly}
                    onChange={(e) => setAttack(i, { rangeLong: Number(e.target.value) })}
                  />
                </Field>
              </>
            )}
          </div>
        </div>
      ))}
      {!readOnly && weaponContext && (
        <Field label={t('ui.attacks.addFromList')}>
          <select
            value=""
            onChange={(e) => {
              const weapon = WEAPONS.find((w) => w.key === e.target.value);
              if (weapon) addFromList(weapon);
            }}
          >
            <option value="">{t('ui.attacks.pickWeapon')}</option>
            {WEAPONS.map((w) => (
              <option key={w.key} value={w.key}>
                {weaponDisplayName(w.key, w.name)}
                {w.mastery.length ? ` · ${w.mastery.filter(Boolean).map(masteryLabel).join(', ')}` : ''}
              </option>
            ))}
          </select>
        </Field>
      )}
      {!readOnly && (
        <button type="button" className="weapon-add" onClick={addAttack} disabled={attacks.length >= MAX_ATTACKS}>
          {t('ui.attacks.add')}
        </button>
      )}
    </div>
  );
}
