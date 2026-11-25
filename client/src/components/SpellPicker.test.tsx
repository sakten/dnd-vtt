import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Spell } from 'shared';
import SpellPicker from './SpellPicker';

vi.mock('./SpellIcon', () => ({
  default: () => <span data-testid="spell-icon" />,
}));

const spell = (key: string, name: string, level: number): Spell =>
  ({
    key,
    name,
    level,
    school: 'evocation',
    description: [],
    components: { v: true, s: false, m: false },
    concentration: false,
    ritual: false,
  }) as unknown as Spell;

const fire = spell('XPHB:Fire Bolt', 'Fire Bolt', 0);
const shield = spell('XPHB:Shield', 'Shield', 1);

function setup(overrides: { disabledShield?: boolean } = {}) {
  const onToggle = vi.fn();
  const onClose = vi.fn();
  render(
    <SpellPicker
      candidates={[fire, shield]}
      title="Выбор заклинаний"
      levels={['all', 0, 1]}
      stateOf={(s) => ({ added: s.key === fire.key, disabled: overrides.disabledShield && s.key === shield.key })}
      onToggle={onToggle}
      onClose={onClose}
    />
  );
  return { onToggle, onClose };
}

describe('SpellPicker', () => {
  it('фильтрует по поиску и кругу, клик отдаёт заклинание', () => {
    const { onToggle } = setup();
    expect(screen.getByText('Fire Bolt')).toBeInTheDocument();
    expect(screen.getByText('Shield')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'shield' } });
    expect(screen.queryByText('Fire Bolt')).not.toBeInTheDocument();
    expect(screen.getByText('Shield')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox'), { target: { value: '1' } });
    expect(screen.getByText('Shield')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '' } });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'all' } });
    fireEvent.click(screen.getByRole('button', { name: /Fire Bolt/ }));
    expect(onToggle).toHaveBeenCalledWith(fire);
  });

  it('не отдаёт заблокированное заклинание', () => {
    const { onToggle } = setup({ disabledShield: true });
    fireEvent.click(screen.getByRole('button', { name: /Shield/ }));
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('закрывается кнопкой «Готово»', () => {
    const { onClose } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Готово' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
