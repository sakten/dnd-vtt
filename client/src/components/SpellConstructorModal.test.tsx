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

    expect(screen.getAllByText('Срабатывание')).toHaveLength(2);
    expect(screen.getAllByLabelText('Кости (например 3d6)')).toHaveLength(2);
    expect(screen.getAllByText(/начало хода/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/конец хода/).length).toBeGreaterThan(0);
    // Сводка записи: аура зоны (ослепление) и разница сейвов частей.
    expect(screen.getAllByText(/Ослеплён/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/спас Ловкость/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/без спасброска/).length).toBeGreaterThan(0);
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

  it('утилита: кости tempHp правятся', () => {
    render(
      <SpellConstructorModal initial={blankRecord('utility', 'Щит')} lockedKey={false} onClose={vi.fn()} />
    );
    fireEvent.change(screen.getByLabelText('Кости'), { target: { value: '2d4 + 4' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    const saved = JSON.parse(
      (emitted.find((e) => e.event === 'custom:import')!.payload as { json: string }).json
    );
    expect(saved.automation.utility).toMatchObject({ kind: 'tempHp', dice: '2d4 + 4' });
  });

  it('призыв: без существа сохранить нельзя, выбор существа разблокирует', async () => {
    render(
      <SpellConstructorModal initial={blankRecord('summon', 'Зов')} lockedKey={false} onClose={vi.fn()} />
    );
    expect(screen.getByText('Выберите существо призыва')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Сохранить' })).toBeDisabled();

    const option = await screen.findByRole('option', { name: /Fey Spirit · XPHB/ });
    fireEvent.change(screen.getByLabelText('Существо'), { target: { value: option.getAttribute('value') } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    const saved = JSON.parse(
      (emitted.find((e) => e.event === 'custom:import')!.payload as { json: string }).json
    );
    expect(saved.automation.summon).toMatchObject({ creature: 'XPHB:Fey Spirit' });
  });

  it('зона HoH редактируется: тип части, сейв слота, аура', () => {
    const hoh = copyRecord(spellsData.spells.find((s) => s.name === 'Hunger of Hadar')!, '(копия)');
    render(<SpellConstructorModal initial={hoh} lockedKey={false} onClose={vi.fn()} />);

    expect(screen.getAllByLabelText('Кости (например 3d6)')).toHaveLength(2);
    fireEvent.change(screen.getAllByLabelText('Тип')[0]!, { target: { value: 'fire' } });
    // Слот начала хода привязан к части 1, конца хода — к части 2.
    const slotDamage = screen.getAllByLabelText('Урон');
    expect(slotDamage[0]).toHaveValue('part:0');
    expect(slotDamage[1]).toHaveValue('part:1');
    // Аура: снимаем ослепление.
    fireEvent.click(screen.getAllByRole('button', { name: 'Ослеплён' })[0]!);
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    const saved = JSON.parse(
      (emitted.find((e) => e.event === 'custom:import')!.payload as { json: string }).json
    );
    expect(saved.damage.parts[0].types).toEqual(['fire']);
    expect(saved.damage.types).toContain('fire');
    expect(saved.automation.zone.aura.effects[0].conditions).toBeUndefined();
  });

  it('зона добавляется к эффекту и сохраняется', () => {
    render(
      <SpellConstructorModal initial={blankRecord('buff', 'Тест')} lockedKey={false} onClose={vi.fn()} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Добавить зону' }));
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    const saved = JSON.parse(
      (emitted.find((e) => e.event === 'custom:import')!.payload as { json: string }).json
    );
    expect(saved.automation.zone).toMatchObject({ area: { shape: 'sphere', size: 10 }, origin: 'point' });
  });

  it('выборы при касте добавляются и сохраняются', () => {
    render(
      <SpellConstructorModal initial={blankRecord('attack', 'Тест')} lockedKey={false} onClose={vi.fn()} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Добавить выбор' }));
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    const saved = JSON.parse(
      (emitted.find((e) => e.event === 'custom:import')!.payload as { json: string }).json
    );
    expect(saved.automation.choices).toHaveLength(1);
    expect(saved.automation.choices[0]).toMatchObject({ id: 'damageType', param: 'damageType', options: ['fire', 'cold'] });
  });

  it('JSON-вкладка: ошибка при битом JSON, «Применить» пересобирает форму', () => {    render(
      <SpellConstructorModal initial={blankRecord('attack', 'Тест')} lockedKey={false} onClose={vi.fn()} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'JSON' }));
    const area = screen.getByRole('textbox');

    fireEvent.change(area, { target: { value: 'не json' } });
    fireEvent.click(screen.getByRole('button', { name: 'Применить' }));
    expect(screen.getByText(/Некорректный JSON/)).toBeTruthy();

    const record = blankRecord('attack', 'Тест');
    record.name = 'Из JSON';
    fireEvent.change(area, { target: { value: JSON.stringify(record) } });
    fireEvent.click(screen.getByRole('button', { name: 'Применить' }));
    expect(screen.getByLabelText('Название')).toHaveValue('Из JSON');
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
