import type { ReactNode } from 'react';

interface FieldProps {
  label?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** Поле формы: label.field + подпись. */
export function Field({ label, className, children }: FieldProps) {
  return (
    <label className={`field${className ? ` ${className}` : ''}`}>
      {label !== undefined && <span>{label}</span>}
      {children}
    </label>
  );
}

interface CheckboxRowProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
  children: ReactNode;
}

export function CheckboxRow({ checked, onChange, className, children }: CheckboxRowProps) {
  return (
    <label className={`checkbox-row${className ? ` ${className}` : ''}`}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {children}
    </label>
  );
}

interface SizeRowProps {
  cells: number;
  round?: boolean;
  onCells: (cells: number) => void;
  onRound?: (round: boolean) => void;
}

/** Выбор размера токена 1×1…4×4; при наличии round — галка «Круглый» рядом. */
export function SizeRow({ cells, round, onCells, onRound }: SizeRowProps) {
  return (
    <div className="size-row">
      <span>Размер:</span>
      {[1, 2, 3, 4].map((n) => (
        <button type="button" key={n} className={cells === n ? 'active' : ''} onClick={() => onCells(n)}>
          {n}×{n}
        </button>
      ))}
      {round !== undefined && onRound && (
        <CheckboxRow className="inline" checked={round} onChange={onRound}>
          Круглый
        </CheckboxRow>
      )}
    </div>
  );
}
