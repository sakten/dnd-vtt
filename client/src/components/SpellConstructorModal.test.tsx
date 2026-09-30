import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useGameStore } from '../store/useGameStore';
import { fakeSocket, type EmittedEvent } from '../test/fixtures';
import { blankRecord } from '../lib/spellConstructor';
import SpellConstructorModal from './SpellConstructorModal';

vi.mock('../lib/useSpells', () => ({ useSpellByKey: () => new Map(), useSpells: () => null }));

let emitted: EmittedEvent[] = [];

beforeEach(() => {
  const { socket, emitted: list } = fakeSocket();
  emitted = list;
  useGameStore.setState({ socket, role: 'dm', selfId: 'dm', testMode: false });
});

describe('SpellConstructorModal (R16 К1)', () => {
  it('форма собирает запись и сохраняет её через custom:import', () => {
    const onClose = vi.fn();
    render(
      <SpellConstructorModal
        initial={blankRecord('attack', 'Новое заклинание')}
        lockedKey={false}
        onClose={onClose}
      />
    );

    fireEvent.change(screen.getByLabelText('Название'), { target: { value: 'Ледяное копьё' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    const sent = emitted.find((e) => e.event === 'custom:import');
    expect(sent).toBeTruthy();
    const record = JSON.parse((sent!.payload as { json: string }).json);
    expect(record.key).toBe('CUSTOM:Ледяное копьё');
    expect(record.automation.primary).toBe('attack');
    expect(onClose).toHaveBeenCalled();
  });

  it('битые кости блокируют сохранение и показывают ошибку', () => {
    const onClose = vi.fn();
    render(
      <SpellConstructorModal
        initial={blankRecord('attack', 'Тест')}
        lockedKey={false}
        onClose={onClose}
      />
    );

    fireEvent.change(screen.getByLabelText('Кости (например 3d6)'), { target: { value: 'abc' } });
    expect(screen.getByText('Проверка не пройдена')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Сохранить' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(emitted.some((e) => e.event === 'custom:import')).toBe(false);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('ключ фиксирован при редактировании, имя меняется свободно', () => {
    const record = blankRecord('save', 'Старое имя');
    render(<SpellConstructorModal initial={record} lockedKey start="form" onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Название'), { target: { value: 'Новое имя' } });
    expect(screen.getByLabelText('Ключ')).toHaveValue('CUSTOM:Старое имя');
  });

  it('мастер: профиль создаёт запись и открывает форму', () => {
    render(
      <SpellConstructorModal
        initial={blankRecord('attack', 'Новое заклинание')}
        lockedKey={false}
        start="wizard"
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Лечение/ }));
    expect(screen.getByLabelText('Название')).toHaveValue('Новое заклинание');
    expect(screen.getByRole('button', { name: 'Сохранить' })).not.toBeDisabled();
  });
});
