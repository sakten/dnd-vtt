import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { normalizeSheet, type FeatureChoice } from 'shared';
import ManeuversForm from './ManeuversForm';

function sheet(choices: FeatureChoice[] = []) {
  return normalizeSheet({
    name: 'Мастер',
    abilities: { str: 16, dex: 14, con: 12, int: 10, wis: 10, cha: 8 },
    classes: [{ className: 'fighter', level: 7, subclass: 'battleMaster' }],
    choices,
  });
}

describe('пикер манёвров боевого мастера', () => {
  it('показывает лимит уровня и добавляет выбранный манёвр', async () => {
    const onChange = vi.fn();
    render(<ManeuversForm sheet={sheet()} onChange={onChange} />);

    expect(screen.getByText(/Выбрано 0 из 5/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Добавить манёвр' }));
    fireEvent.click(await screen.findByText('Засада'));
    expect(onChange).toHaveBeenCalledWith([{ kind: 'maneuver', key: 'XPHB:Ambush' }]);
  });

  it('не показывается не-боевому мастеру', () => {
    const plain = normalizeSheet({ name: 'Воин', classes: [{ className: 'fighter', level: 7 }] });
    const { container } = render(<ManeuversForm sheet={plain} onChange={() => void 0} />);
    expect(container.firstChild).toBeNull();
  });
});
