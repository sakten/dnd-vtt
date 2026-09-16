import type { ReactNode } from 'react';
import { emptyAttacks, statNumber, statsPaired, type TokenFields } from 'shared';
import { useIsDm } from '../lib/control';
import AttacksForm from './AttacksForm';
import DamageDefensesForm from './DamageDefensesForm';
import { CheckboxRow, Field, SizeRow } from './Field';

type Patch = Partial<TokenFields>;
type Change = (patch: Patch) => void;

interface PassportProps {
  value: TokenFields;
  onChange: Change;
  speed?: number;
  onSpeedChange?: (value: number) => void;
  darkvision?: number;
  onDarkvisionChange?: (value: number) => void;
}

/** Паспорт токена/предмета: имя, инициатива, размер, круглость (скорость — токену). */
export function TokenPassportFields({ value, onChange, speed, onSpeedChange, darkvision, onDarkvisionChange }: PassportProps) {
  return (
    <>
      <Field label="Название">
        <input
          type="text"
          value={value.name}
          maxLength={40}
          onChange={(e) => onChange({ name: e.target.value })}
        />
      </Field>
      <div className="field-row">
        <Field label="Бонус инициативы">
          <input
            type="text"
            value={value.initiativeBonus}
            maxLength={10}
            placeholder="+0"
            onChange={(e) => onChange({ initiativeBonus: e.target.value })}
          />
        </Field>
        {onSpeedChange && (
          <Field label="Скорость, фт">
            <input
              type="number"
              min={0}
              max={1000}
              value={speed ?? 0}
              onChange={(e) => onSpeedChange(Math.max(0, Math.round(Number(e.target.value) || 0)))}
            />
          </Field>
        )}
        {onDarkvisionChange && (
          <Field label="Тёмное зрение, фт">
            <input
              type="number"
              min={0}
              max={1000}
              value={darkvision ?? 0}
              onChange={(e) => onDarkvisionChange(Math.max(0, Math.round(Number(e.target.value) || 0)))}
            />
          </Field>
        )}
      </div>
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
        Это токен игрока
      </CheckboxRow>
      {value.isPlayerToken && (
        <Field label="Владелец (имя персонажа; пусто — сам персонаж)">
          <input
            type="text"
            value={value.owner}
            maxLength={40}
            placeholder="Например: Гэндальф"
            onChange={(e) => onChange({ owner: e.target.value })}
          />
        </Field>
      )}
      {isDm && (
        <CheckboxRow checked={value.showStats ?? false} onChange={(showStats) => onChange({ showStats })}>
          Показывать статы игрокам
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
}: HealthProps) {
  const clampCurrent = (raw: number) => Math.max(currentMin, Math.round(raw || 0));
  return (
    <>
      <div className="field-row">
        <Field label="Класс брони (AC)">
          <input
            type="text"
            value={value.ac ?? ''}
            maxLength={10}
            placeholder="13"
            onChange={(e) => onChange({ ac: e.target.value })}
          />
        </Field>
        <Field label="Макс. ХП">
          <input
            type="text"
            value={value.hpMax ?? ''}
            maxLength={10}
            placeholder="20"
            onChange={(e) => onChange({ hpMax: e.target.value })}
          />
        </Field>
      </div>

      {!statsPaired(value.ac ?? '', value.hpMax ?? '') && (
        <div className="field-warning">Укажите и AC, и Макс. ХП — или оставьте оба пустыми.</div>
      )}

      {onCurrentChange &&
        (onTempChange ? (
          <div className="field-row">
            <Field label="Текущее ХП">
              <input
                type="number"
                value={current}
                onChange={(e) => onCurrentChange(clampCurrent(e.target.valueAsNumber))}
              />
            </Field>
            <Field label="Временные ХП">
              <input
                type="number"
                min={0}
                value={temp ?? 0}
                onChange={(e) => onTempChange(Math.max(0, Math.round(e.target.valueAsNumber || 0)))}
              />
            </Field>
          </div>
        ) : (
          <Field label={`Текущее ХП${statNumber(value.hpMax) > 0 ? ` из ${statNumber(value.hpMax)}` : ''}`}>
            <input
              type="number"
              min={0}
              value={current}
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
    <Field label="Описание">
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
