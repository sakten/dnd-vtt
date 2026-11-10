import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { emptyAttack, WEAPONS, type AttackEntry, type WeaponContext } from 'shared';
import AttacksForm from './AttacksForm';

const ctx: WeaponContext = { abilities: { str: 14, dex: 12 }, classes: [] };

describe('AttacksForm: оружие из списка', () => {
  it('метательное (javelin) добавляет ближнюю атаку и бросок', () => {
    const onChange = vi.fn();
    const attacks: AttackEntry[] = [emptyAttack()];
    const { getByLabelText } = render(
      <AttacksForm attacks={attacks} onChange={onChange} weaponContext={ctx} />
    );
    const javelin = WEAPONS.find((w) => w.name === 'Javelin')!;

    fireEvent.change(getByLabelText('Добавить из списка'), { target: { value: javelin.key } });

    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0]![0] as AttackEntry[];
    expect(next).toHaveLength(3);
    expect(next[1]).toMatchObject({ name: 'Javelin', rangeType: 'melee', rangeNormal: 5, rangeLong: 0 });
    expect(next[2]).toMatchObject({
      name: 'Javelin (бросок)',
      rangeType: 'ranged',
      rangeNormal: 30,
      rangeLong: 120,
    });
  });
});
