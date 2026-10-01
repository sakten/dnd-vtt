import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ExprField } from './ExprField';

describe('ExprField (ссылки «Из данных» → «Свои»)', () => {
  it('ссылка с fallback показывает предпросмотр и переводится на литерал', () => {
    const onChange = vi.fn();
    render(<ExprField value={{ ref: 'cantrip', fallback: '2d8' }} onChange={onChange} />);
    expect(screen.getByText('Из данных: 2d8')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Свои' }));
    expect(onChange).toHaveBeenCalledWith('2d8');
  });

  it('ссылка без fallback и отсутствующее значение редактируются', () => {
    const onChange = vi.fn();
    const { rerender } = render(<ExprField value={{ ref: 'spellDamage' }} onChange={onChange} />);
    expect(screen.getByText('Из данных')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Свои' }));
    expect(onChange).toHaveBeenCalledWith(undefined);

    rerender(<ExprField value={undefined} onChange={onChange} placeholder="1d6" />);
    expect(screen.getByPlaceholderText('1d6')).toHaveValue('');
  });
});
