import { fireEvent, render, screen } from '@testing-library/react';
import { DEFAULT_SENSE_RANGES, MAX_SENSES, SENSE_NAMES, SENSE_TYPES, type Sense } from 'shared';
import { describe, expect, it, vi } from 'vitest';
import SensesForm from './SensesForm';

describe('SensesForm', () => {
  it('показывает существующие сенсы и меняет дистанцию', () => {
    const onChange = vi.fn();
    const value: Sense[] = [
      { type: 'darkvision', range: 60 },
      { type: 'blindsight', range: 10 },
    ];
    render(<SensesForm value={value} onChange={onChange} />);

    expect(screen.getByDisplayValue(String(DEFAULT_SENSE_RANGES.blindsight))).toBeInTheDocument();
    fireEvent.change(screen.getAllByRole('spinbutton')[0]!, { target: { value: '90' } });
    expect(onChange).toHaveBeenCalledWith([
      { type: 'darkvision', range: 90 },
      { type: 'blindsight', range: 10 },
    ]);
  });

  it('«Добавить зрение» берёт следующий свободный тип с дефолтной дистанцией', () => {
    const onChange = vi.fn();
    render(<SensesForm value={[{ type: 'darkvision', range: 60 }]} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Добавить зрение' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0]![0] as Sense[];
    expect(next).toHaveLength(2);
    const added = next[1]!;
    expect(added.type).not.toBe('darkvision');
    expect(added.range).toBe(DEFAULT_SENSE_RANGES[added.type]);
  });

  it('«Убрать» удаляет нужный сенс', () => {
    const onChange = vi.fn();
    render(
      <SensesForm
        value={[
          { type: 'darkvision', range: 60 },
          { type: 'blindsight', range: 10 },
        ]}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getAllByRole('button', { name: 'Убрать' })[0]!);
    expect(onChange).toHaveBeenCalledWith([{ type: 'blindsight', range: 10 }]);
  });

  it('кнопка добавления блокируется, когда заняты все типы', () => {
    const all: Sense[] = SENSE_TYPES.map((type) => ({ type, range: DEFAULT_SENSE_RANGES[type] }));
    expect(all.length).toBeLessThanOrEqual(MAX_SENSES);
    render(<SensesForm value={all} onChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Добавить зрение' })).toBeDisabled();
  });

  it('подписи типов в списке — человекочитаемые', () => {
    render(<SensesForm value={[{ type: 'devilsight', range: 120 }]} onChange={vi.fn()} />);
    expect(screen.getByRole('option', { name: SENSE_NAMES.devilsight })).toBeInTheDocument();
  });
});
