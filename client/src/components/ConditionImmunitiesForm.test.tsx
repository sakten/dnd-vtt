import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ConditionImmunitiesForm from './ConditionImmunitiesForm';

describe('ConditionImmunitiesForm', () => {
  it('отмечает иммунитеты из статблока', () => {
    render(<ConditionImmunitiesForm value={['charmed', 'poisoned']} onChange={vi.fn()} />);
    expect(screen.getByRole('checkbox', { name: /Очарован/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Отравлен/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Испуган/ })).not.toBeChecked();
  });

  it('включение состояния отдаёт список в порядке каталога', () => {
    const onChange = vi.fn();
    render(<ConditionImmunitiesForm value={['poisoned']} onChange={onChange} />);
    fireEvent.click(screen.getByRole('checkbox', { name: /Очарован/ }));
    expect(onChange).toHaveBeenCalledWith(['charmed', 'poisoned']);
  });

  it('снятие состояния убирает его из списка', () => {
    const onChange = vi.fn();
    render(<ConditionImmunitiesForm value={['charmed']} onChange={onChange} />);
    fireEvent.click(screen.getByRole('checkbox', { name: /Очарован/ }));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('readOnly блокирует чекбоксы', () => {
    render(<ConditionImmunitiesForm value={['charmed']} onChange={vi.fn()} readOnly />);
    expect(screen.getByRole('checkbox', { name: /Очарован/ })).toBeDisabled();
  });
});
