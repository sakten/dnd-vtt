import type { ReactNode } from 'react';
import { emptyAttacks, statNumber, statsPaired, type Sense, type TokenFields } from 'shared';
import { t } from '../i18n';
import { senseLabel } from '../i18n/domain';
import { useIsDm } from '../lib/control';
import AttacksForm from './AttacksForm';
import DamageDefensesForm from './DamageDefensesForm';
import { CheckboxRow, Field, SizeRow } from './Field';
import SensesForm from './SensesForm';

type Patch = Partial<TokenFields>;
type Change = (patch: Patch) => void;

interface PassportProps {
  value: TokenFields;
  onChange: Change;
  speed?: number;
  onSpeedChange?: (value: number) => void;
  senses?: Sense[];
  onSensesChange?: (value: Sense[]) => void;
  /** Токен персонажа: статы приходят из листа — поля только для чтения. */
  readOnly?: boolean;
}

/** Паспорт токена/предмета: имя, инициатива, размер, круглость (скорость — токену). */
export function TokenPassportFields({
  value,
  onChange,
  speed,
  onSpeedChange,
  senses,
  onSensesChange,
  readOnly,
}: PassportProps) {
  return (
    <>
      <Field label={t('ui.common.name')}>
        <input
          type="text"
          value={value.name}
          maxLength={40}
          readOnly={readOnly}
          onChange={(e) => onChange({ name: e.target.value })}
        />
      </Field>
      <div className="field-row">
        <Field label={t('ui.tokenFields.initiative')}>
          <input
            type="text"
            value={value.initiativeBonus}
            maxLength={10}
            placeholder="+0"
            readOnly={readOnly}
            onChange={(e) => onChange({ initiativeBonus: e.target.value })}
          />
        </Field>
        {speed !== undefined && (
          <Field label={t('ui.common.speedFeet')}>
            <input
              type="number"
              min={0}
              max={1000}
              value={speed}
              readOnly={readOnly || !onSpeedChange}
              onChange={(e) => onSpeedChange?.(Math.max(0, Math.round(Number(e.target.value) || 0)))}
            />
          </Field>
        )}
      </div>
      {readOnly ? (
        (senses?.length ?? 0) > 0 && (
          <Field label={t('ui.tokenFields.senses')}>
            <span className="field-ro-text">
              {senses!
                .map((s) => t('ui.tokenFields.senseRange', { sense: senseLabel(s.type).toLowerCase(), range: s.range }))
                .join(', ')}
            </span>
          </Field>
        )
      ) : (
        onSensesChange && <SensesForm value={senses ?? []} onChange={onSensesChange} />
      )}
      <SizeRow
        cells={value.cells}
        round={value.round}
        onCells={(cells) => onChange({ cells })}
        onRound={(round) => onChange({ round })}
      />
    </>
  );
}

interface PlayerProps {
  value: TokenFields;
  onChange: Change;
  isDm: boolean;
}

/** Признак токена игрока, владелец и видимость статов. */
export function TokenPlayerFields({ value, onChange, isDm }: PlayerProps) {
  return (
    <>
      <CheckboxRow
        checked={value.isPlayerToken}
        onChange={(isPlayerToken) =>
          onChange({ isPlayerToken, ...(isPlayerToken ? {} : { owner: '' }) })
        }
      >
        {t('ui.tokenFields.isPlayerToken')}
      </CheckboxRow>
      {value.isPlayerToken && (
        <Field label={t('ui.tokenFields.owner')}>
          <input
            type="text"
            value={value.owner}
            maxLength={40}
            placeholder={t('ui.tokenFields.ownerPlaceholder')}
            onChange={(e) => onChange({ owner: e.target.value })}
          />
        </Field>
      )}
      {isDm && (
        <CheckboxRow checked={value.showStats ?? false} onChange={(showStats) => onChange({ showStats })}>
          {t('ui.tokenFields.showStats')}
        </CheckboxRow>
      )}
      {isDm && (
        <CheckboxRow checked={value.canInteract ?? false} onChange={(canInteract) => onChange({ canInteract })}>
          {t('ui.tokenFields.canInteract')}
        </CheckboxRow>
      )}
    </>
  );
}

interface HealthProps {
  value: TokenFields;
  onChange: Change;
  current: number;
  onCurrentChange?: (value: number) => void;
  temp?: number;
  onTempChange?: (value: number) => void;
  currentMin?: number;
  quick?: ReactNode;
  /** Токен персонажа: AC/HP приходят из листа и ресурсов — поля только для чтения. */
  readOnly?: boolean;
}

/** AC, хиты и (для токена на карте) текущие/временные ХП с быстрым уроном. */
export function TokenHealthFields({
  value,
  onChange,
  current,
  onCurrentChange,
  temp,
  onTempChange,
  currentMin = 0,
  quick,
  readOnly,
}: HealthProps) {
  const clampCurrent = (raw: number) => Math.max(currentMin, Math.round(raw || 0));
  return (
    <>
      <div className="field-row">
        <Field label={t('ui.common.ac')}>
          <input
            type="text"
            value={value.ac ?? ''}
            maxLength={10}
            placeholder="13"
            readOnly={readOnly}
            onChange={(e) => onChange({ ac: e.target.value })}
          />
        </Field>
        <Field label={t('ui.tokenFields.hpMax')}>
          <input
            type="text"
            value={value.hpMax ?? ''}
            maxLength={10}
            placeholder="20"
            readOnly={readOnly}
            onChange={(e) => onChange({ hpMax: e.target.value })}
          />
        </Field>
      </div>

      {!readOnly && !statsPaired(value.ac ?? '', value.hpMax ?? '') && (
        <div className="field-warning">{t('ui.tokenFields.statsPairedWarning')}</div>
      )}

      {onCurrentChange &&
        (onTempChange ? (
          <div className="field-row">
            <Field label={t('ui.tokenFields.hpCurrent')}>
              <input
                type="number"
                value={current}
                readOnly={readOnly}
                onChange={(e) => onCurrentChange(clampCurrent(e.target.valueAsNumber))}
              />
            </Field>
            <Field label={t('ui.tokenFields.hpTemp')}>
              <input
                type="number"
                min={0}
                value={temp ?? 0}
                readOnly={readOnly}
                onChange={(e) => onTempChange(Math.max(0, Math.round(e.target.valueAsNumber || 0)))}
              />
            </Field>
          </div>
        ) : (
          <Field
            label={
              statNumber(value.hpMax) > 0
                ? t('ui.tokenFields.hpCurrentOf', { max: statNumber(value.hpMax) })
                : t('ui.tokenFields.hpCurrent')
            }
          >
            <input
              type="number"
              min={0}
              value={current}
              readOnly={readOnly}
              onChange={(e) => onCurrentChange(Math.max(0, Math.round(e.target.valueAsNumber || 0)))}
            />
          </Field>
        ))}

      {quick}
    </>
  );
}

/** Описание токена/предмета. */
export function DescriptionField({ value, onChange }: { value: TokenFields; onChange: Change }) {
  return (
    <Field label={t('ui.common.description')}>
      <textarea
        value={value.description}
        rows={3}
        maxLength={200}
        onChange={(e) => onChange({ description: e.target.value })}
      />
    </Field>
  );
}

interface Props {
  value: TokenFields;
  onChange: Change;
  hpCurrent?: number;
  onHpCurrentChange?: (value: number) => void;
}

/** Редактор полей токена/предмета библиотеки (используется в панели библиотеки). */
export default function TokenFieldsForm({ value, onChange, hpCurrent, onHpCurrentChange }: Props) {
  const isDm = useIsDm();
  const attacks = value.attacks ?? emptyAttacks();

  return (
    <>
      <TokenPassportFields value={value} onChange={onChange} />
      <DescriptionField value={value} onChange={onChange} />
      <TokenPlayerFields value={value} onChange={onChange} isDm={isDm} />
      <TokenHealthFields value={value} onChange={onChange} current={hpCurrent ?? 0} onCurrentChange={onHpCurrentChange} />
      <AttacksForm attacks={attacks} onChange={(list) => onChange({ attacks: list })} />
      <DamageDefensesForm
        value={value.damageDefenses ?? []}
        onChange={(damageDefenses) => onChange({ damageDefenses })}
      />
    </>
  );
}
