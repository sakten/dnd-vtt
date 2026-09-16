import { render, screen } from '@testing-library/react';
import { CONDITION_NAMES, type ConditionInstance } from 'shared';
import { describe, expect, it } from 'vitest';
import ConditionChips from './ConditionChips';

const cond = (key: ConditionInstance['key'], extra: Partial<ConditionInstance> = {}): ConditionInstance => ({
  key,
  name: CONDITION_NAMES[key],
  ...extra,
});

describe('ConditionChips', () => {
  it('обрезает список по max и показывает «+N» с подсказкой', () => {
    const conditions = [
      cond('prone'),
      cond('charmed'),
      cond('frightened'),
      cond('grappled'),
      cond('restrained'),
      cond('stunned'),
    ];
    const { container } = render(<ConditionChips conditions={conditions} />);

    expect(container.querySelectorAll('.cond-chip')).toHaveLength(5); // 4 чипа + «+2»
    const more = screen.getByText('+2');
    expect(more.getAttribute('title')).toContain(CONDITION_NAMES.restrained);
    expect(more.getAttribute('title')).toContain(CONDITION_NAMES.stunned);
  });

  it('max=null показывает все состояния', () => {
    const conditions = [cond('prone'), cond('charmed'), cond('frightened'), cond('grappled'), cond('restrained')];
    const { container } = render(<ConditionChips conditions={conditions} max={null} />);

    expect(container.querySelectorAll('.cond-chip')).toHaveLength(5);
    expect(container.querySelector('.cond-more')).toBeNull();
  });

  it('показывает число раундов и уровень истощения', () => {
    const { container } = render(
      <ConditionChips conditions={[cond('prone', { rounds: 3 }), cond('exhaustion', { level: 2 })]} max={null} />
    );

    const nums = [...container.querySelectorAll('.cond-chip-num')].map((el) => el.textContent);
    expect(nums).toEqual(['3', '2']);
  });

  it('без состояний ничего не рисует', () => {
    const { container } = render(<ConditionChips conditions={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
