import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import spellsData from 'shared/spellsData';
import { useGameStore } from '../store/useGameStore';
import { fakeSocket, type EmittedEvent } from '../test/fixtures';
import { blankRecord, copyRecord } from '../lib/spellConstructor';
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

  it('копия Fireball: дистанция в футах, смена на касание сохраняется', () => {
    const record = blankRecord('save', 'Огненный шар');
    record.range = { type: 'point', distance: { type: 'feet', amount: 150 } };
    render(<SpellConstructorModal initial={record} lockedKey={false} onClose={vi.fn()} />);

    expect(screen.getByLabelText('Дистанция')).toHaveValue('feet');
    expect(screen.getByLabelText('Дистанция, футы')).toHaveValue(150);

    fireEvent.change(screen.getByLabelText('Дистанция'), { target: { value: 'touch' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    const saved = JSON.parse(
      (emitted.find((e) => e.event === 'custom:import')!.payload as { json: string }).json
    );
    expect(saved.range).toEqual({ type: 'point', distance: { type: 'touch' } });
  });

  it('составной урон: части с типами и слотами, простого редактора нет', () => {
    const hoh = spellsData.spells.find((s) => s.name === 'Hunger of Hadar')!;
    render(<SpellConstructorModal initial={copyRecord(hoh, '(копия)')} lockedKey={false} onClose={vi.fn()} />);

    expect(screen.queryByLabelText('Кости (например 3d6)')).toBeNull();
    expect(screen.getAllByText('Срабатывание')).toHaveLength(2);
    expect(screen.getByText('начало хода')).toBeTruthy();
    expect(screen.getByText('конец хода')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Сохранить' })).not.toBeDisabled();
  });

  it('эффекты: модификатор правится, состояния снимаются чипом', () => {
    const faith = copyRecord(spellsData.spells.find((s) => s.name === 'Shield of Faith')!, '(копия)');
    render(<SpellConstructorModal initial={faith} lockedKey={false} onClose={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText('Значение (число или кости)'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    const saved = JSON.parse(
      (emitted.find((e) => e.event === 'custom:import')!.payload as { json: string }).json
    );
    expect(saved.automation.effects[0].modifiers[0]).toMatchObject({ target: 'ac', mode: 'add', value: 3 });
  });

  it('состояние эффекта снимается чипом (Hold Person)', () => {
    const hold = copyRecord(spellsData.spells.find((s) => s.name === 'Hold Person')!, '(копия)');
    render(<SpellConstructorModal initial={hold} lockedKey={false} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Парализован' }));
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    const saved = JSON.parse(
      (emitted.find((e) => e.event === 'custom:import')!.payload as { json: string }).json
    );
    expect(saved.automation.effects[0].conditions).toBeUndefined();
  });

  it('переключение ветки: attack → save синхронит блок спасброска', () => {
    render(
      <SpellConstructorModal initial={blankRecord('attack', 'Тест')} lockedKey={false} onClose={vi.fn()} />
    );

    fireEvent.change(screen.getByLabelText('Ветка'), { target: { value: 'save' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    const saved = JSON.parse(
      (emitted.find((e) => e.event === 'custom:import')!.payload as { json: string }).json
    );
    expect(saved.automation.primary).toBe('save');
    expect(saved.automation.save).toEqual({ ability: 'dex' });
    expect(saved.automation.attack).toBeUndefined();
  });

  it('ручная ветка: byDesign включается', () => {
    const bladeWard = copyRecord(spellsData.spells.find((s) => s.name === 'Blade Ward')!, '(копия)');
    render(<SpellConstructorModal initial={bladeWard} lockedKey={false} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('checkbox', { name: 'Ведёт мастер (byDesign)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    const saved = JSON.parse(
      (emitted.find((e) => e.event === 'custom:import')!.payload as { json: string }).json
    );
    expect(saved.automation.manual.byDesign).toBe(true);
  });

  it('концентрация синхронит длительность и флаг записи', () => {
    const record = blankRecord('buff', 'Благословение');
    record.duration = [{ type: 'timed', concentration: true, duration: { type: 'minute', amount: 1 } }];
    record.concentration = true;
    render(<SpellConstructorModal initial={record} lockedKey={false} onClose={vi.fn()} />);

    const conc = screen.getByRole('checkbox', { name: 'Концентрация' });
    expect(conc).toBeChecked();
    fireEvent.click(conc);
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    const saved = JSON.parse(
      (emitted.find((e) => e.event === 'custom:import')!.payload as { json: string }).json
    );
    expect(saved.concentration).toBeUndefined();
    expect(saved.duration[0].concentration).toBeUndefined();
  });
});
