import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import spellsData from 'shared/spellsData';
import { useGameStore } from '../store/useGameStore';
import { fakeSocket, type EmittedEvent } from '../test/fixtures';
import { blankRecord, copyRecord } from '../lib/spellConstructor';
import SpellConstructorModal from './SpellConstructorModal';

vi.mock('../lib/useSpells', () => ({ useSpellByKey: () => new Map(), useSpells: () => null }));

let emitted: EmittedEvent[] = [];

/** JSON последнего импорта (в тесте может быть несколько сохранений). */
const lastImportJson = (): string =>
  (emitted.filter((e) => e.event === 'custom:import').at(-1)!.payload as { json: string }).json;

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

  it('мастер: две оси создают запись и открывают форму', () => {
    render(
      <SpellConstructorModal
        initial={blankRecord('attack', 'Новое заклинание')}
        lockedKey={false}
        start="wizard"
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Лечение/ }));
    // Сетка «как × куда»: у лечения доступен «Без броска»; выбираем цели.
    fireEvent.click(screen.getByRole('button', { name: 'Без броска: Цели' }));
    expect(screen.getByLabelText('Название')).toHaveValue('Новое заклинание');
    expect(screen.getByRole('button', { name: 'Сохранить' })).not.toBeDisabled();
    expect(screen.getByText('Это лечение')).toBeTruthy();
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
      lastImportJson()
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
      lastImportJson()
    );
    expect(saved.automation.effects[0].modifiers[0]).toMatchObject({ target: 'ac', mode: 'add', value: 3 });
  });

  it('состояние эффекта снимается чипом (Hold Person)', () => {
    const hold = copyRecord(spellsData.spells.find((s) => s.name === 'Hold Person')!, '(копия)');
    render(<SpellConstructorModal initial={hold} lockedKey={false} onClose={vi.fn()} />);

    // Чипы состояний идут последними (иммунитеты в блоке «Дополнительно» раньше).
    fireEvent.click(screen.getAllByRole('button', { name: 'Парализован' }).at(-1)!);
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    const saved = JSON.parse(
      lastImportJson()
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
      lastImportJson()
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
      lastImportJson()
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
      lastImportJson()
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
      lastImportJson()
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
    // Аура: снимаем ослепление (чипы состояний идут последними среди кнопок).
    fireEvent.click(screen.getAllByRole('button', { name: 'Ослеплён' }).at(-1)!);
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    const saved = JSON.parse(
      lastImportJson()
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
      lastImportJson()
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
      lastImportJson()
    );
    expect(saved.automation.choices).toHaveLength(1);
    expect(saved.automation.choices[0]).toMatchObject({ id: 'damageType', param: 'damageType', options: ['fire', 'cold'] });
  });

  it('реакции: ответ уроном (Armor of Agathys) — тип правится, amount сохраняется', () => {
    const armor = copyRecord(spellsData.spells.find((s) => s.name === 'Armor of Agathys')!, '(копия)');
    render(<SpellConstructorModal initial={armor} lockedKey={false} onClose={vi.fn()} />);

    expect(screen.getByRole('checkbox', { name: 'Получен урон' })).toBeChecked();
    expect(screen.getByDisplayValue('Ответ уроном')).toBeTruthy();
    fireEvent.change(screen.getByDisplayValue('Холод'), { target: { value: 'fire' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    const saved = JSON.parse(
      lastImportJson()
    );
    expect(saved.automation.effects[0].triggers.damaged.damage).toEqual({
      damageType: 'fire',
      amount: { sum: [5, { ref: 'upcastFlat' }] },
      to: 'source',
    });
  });

  it('реакции: Death Ward (выживание) и Sanctuary (спас + вложенная отмена)', () => {
    const ward = copyRecord(spellsData.spells.find((s) => s.name === 'Death Ward')!, '(копия)');
    const first = render(<SpellConstructorModal initial={ward} lockedKey={false} onClose={vi.fn()} />);
    expect(screen.getByRole('checkbox', { name: 'Падение до 0 HP' })).toBeChecked();
    expect(screen.getByDisplayValue('Выжить на 1 HP')).toBeTruthy();
    first.unmount();

    const sanctuary = copyRecord(spellsData.spells.find((s) => s.name === 'Sanctuary')!, '(копия)');
    render(<SpellConstructorModal initial={sanctuary} lockedKey={false} onClose={vi.fn()} />);
    expect(screen.getByRole('checkbox', { name: 'Цель атаки' })).toBeChecked();
    // Спас операции показан и сохраняется 1:1 (компилятор допускает только WIS + cancel).
    expect(screen.getAllByDisplayValue('Мудрость').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    const saved = JSON.parse(
      lastImportJson()
    );
    expect(saved.automation.effects[0].triggers.targetedByAttack).toEqual({
      save: { ability: 'wis', onFail: [{ cancel: true }] },
    });
  });

  it('лоадаут: Shillelagh (подмена) и Magic Weapon (усиление)', () => {
    const shillelagh = copyRecord(spellsData.spells.find((s) => s.name === 'Shillelagh')!, '(копия)');
    const first = render(<SpellConstructorModal initial={shillelagh} lockedKey={false} onClose={vi.fn()} />);
    expect(screen.getByDisplayValue('Подмена оружия')).toBeTruthy();
    fireEvent.change(screen.getByDisplayValue('XPHB:Club, XPHB:Quarterstaff'), { target: { value: 'XPHB:Club' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    const savedShillelagh = JSON.parse(
      lastImportJson()
    );
    expect(savedShillelagh.automation.effects[0].loadout.weapons).toEqual(['XPHB:Club']);
    expect(savedShillelagh.automation.effects[0].loadout.damageType).toEqual({ ref: 'type0', fallback: 'force' });
    first.unmount();

    const magic = copyRecord(spellsData.spells.find((s) => s.name === 'Magic Weapon')!, '(копия)');
    render(<SpellConstructorModal initial={magic} lockedKey={false} onClose={vi.fn()} />);
    const magicCheck = screen.getByRole('checkbox', { name: 'Атаки магические' });
    expect(magicCheck).toBeChecked();
    fireEvent.click(magicCheck);
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    const savedMagic = JSON.parse(
      lastImportJson()
    );
    expect(savedMagic.automation.effects[0].loadout.magic).toBeUndefined();
  });

  it('райдер оружия: GFB secondary правится, True Strike — флаги', () => {
    const gfb = copyRecord(spellsData.spells.find((s) => s.name === 'Green-Flame Blade')!, '(копия)');
    const first = render(<SpellConstructorModal initial={gfb} lockedKey={false} onClose={vi.fn()} />);
    expect(screen.getByRole('checkbox', { name: 'Вторичный урон вокруг' })).toBeChecked();
    fireEvent.change(screen.getByLabelText('Радиус, футы'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    const savedGfb = JSON.parse(
      lastImportJson()
    );
    expect(savedGfb.automation.weaponAttack.secondary).toMatchObject({ rangeFeet: 10, damageType: 'fire' });
    first.unmount();

    const trueStrike = copyRecord(spellsData.spells.find((s) => s.name === 'True Strike')!, '(копия)');
    render(<SpellConstructorModal initial={trueStrike} lockedKey={false} onClose={vi.fn()} />);
    expect(screen.getByRole('checkbox', { name: 'Любое оружие' })).toBeChecked();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Атака от характеристики заклинания' }));
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    const savedTs = JSON.parse(
      lastImportJson()
    );
    expect(savedTs.automation.weaponAttack.spellAbility).toBeUndefined();
    expect(savedTs.automation.weaponAttack.anyWeapon).toBe(true);
  });

  it('расходы: заряды Flame Arrows и подмена Mirror Image', () => {
    const arrows = copyRecord(spellsData.spells.find((s) => s.name === 'Flame Arrows')!, '(копия)');
    const first = render(<SpellConstructorModal initial={arrows} lockedKey={false} onClose={vi.fn()} />);
    expect(screen.getByDisplayValue('Заряды')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Зарядов'), { target: { value: '6' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    const savedArrows = JSON.parse(lastImportJson());
    expect(savedArrows.automation.effects[0].uses).toEqual({ kind: 'charges', count: 6, on: 'rangedWeaponAttack' });
    first.unmount();

    const mirror = copyRecord(spellsData.spells.find((s) => s.name === 'Mirror Image')!, '(копия)');
    render(<SpellConstructorModal initial={mirror} lockedKey={false} onClose={vi.fn()} />);
    expect(screen.getByDisplayValue('Подмена (Mirror Image)')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Порог'), { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    const savedMirror = JSON.parse(lastImportJson());
    expect(savedMirror.automation.effects[0].uses).toMatchObject({ kind: 'misdirect', threshold: 4, die: 'd6' });
  });

  it('особые поля: Darkvision (восприятие) и Web (выпутывание)', () => {
    const darkvision = copyRecord(spellsData.spells.find((s) => s.name === 'Darkvision')!, '(копия)');
    const first = render(<SpellConstructorModal initial={darkvision} lockedKey={false} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('Дополнительно'));
    fireEvent.click(screen.getByRole('button', { name: 'Тёмное зрение' }));
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    const savedVision = JSON.parse(lastImportJson());
    expect(savedVision.automation.effects[0].senses).toBeUndefined();
    first.unmount();

    const web = copyRecord(spellsData.spells.find((s) => s.name === 'Web')!, '(копия)');
    render(<SpellConstructorModal initial={web} lockedKey={false} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('Дополнительно'));
    fireEvent.change(screen.getByLabelText('СЛ'), { target: { value: '15' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    const savedWeb = JSON.parse(lastImportJson());
    expect(savedWeb.automation.effects[0].escape).toMatchObject({ ability: 'str', skill: 'athletics', dc: 15 });
  });

  it('свет: эффект Light и зона Moonbeam', () => {
    const light = copyRecord(spellsData.spells.find((s) => s.name === 'Light')!, '(копия)');
    const first = render(<SpellConstructorModal initial={light} lockedKey={false} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('Дополнительно'));
    const bright = screen.getByLabelText('Яркий, футы');
    expect(bright).toHaveValue(20);
    fireEvent.change(bright, { target: { value: '30' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Солнечный' }));
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    const savedLight = JSON.parse(lastImportJson());
    expect(savedLight.automation.effects[0].light).toEqual({ bright: 30, dim: 20, sunlight: true });
    first.unmount();

    const moonbeam = copyRecord(spellsData.spells.find((s) => s.name === 'Moonbeam')!, '(копия)');
    render(<SpellConstructorModal initial={moonbeam} lockedKey={false} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Сумерки, футы'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    const savedMoon = JSON.parse(lastImportJson());
    expect(savedMoon.automation.zone.light).toEqual({ bright: 0, dim: 10 });
  });

  it('restrictions Slow: чекбоксы и провал соматики', () => {
    const slow = copyRecord(spellsData.spells.find((s) => s.name === 'Slow')!, '(копия)');
    render(<SpellConstructorModal initial={slow} lockedKey={false} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('Дополнительно'));
    expect(screen.getByRole('checkbox', { name: 'Одна атака за ход' })).toBeChecked();
    expect(screen.getByLabelText('Провал соматики, %')).toHaveValue(25);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Одна атака за ход' }));
    fireEvent.change(screen.getByLabelText('Провал соматики, %'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    const saved = JSON.parse(lastImportJson());
    expect(saved.automation.effects[0].restrictions).toMatchObject({
      noReactions: true,
      actionOrBonusOnly: true,
      spellFailureChance: 10,
    });
    expect(saved.automation.effects[0].restrictions.oneAttackOnly).toBeUndefined();
  });

  it('лучи: meta-атаки правятся, count записи — «из данных»', () => {
    const rays = copyRecord(spellsData.spells.find((s) => s.name === 'Scorching Ray')!, '(копия)');
    render(<SpellConstructorModal initial={rays} lockedKey={false} onClose={vi.fn()} />);
    expect(screen.getAllByText('Из данных').length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText('Лучей/атак (карточка)'), { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    const saved = JSON.parse(lastImportJson());
    expect(saved.attacks).toBe(4);
    expect(saved.automation.count).toEqual({ ref: 'spellAttackCount' });
  });

  it('наведение: вид/дистанция/цели, включение с нуля', () => {
    const misty = copyRecord(spellsData.spells.find((s) => s.name === 'Misty Step')!, '(копия)');
    const first = render(<SpellConstructorModal initial={misty} lockedKey={false} onClose={vi.fn()} />);
    expect(screen.getByLabelText('Наводить')).toHaveValue('point');
    fireEvent.change(screen.getByLabelText('Наводить'), { target: { value: 'creature' } });
    fireEvent.change(screen.getByLabelText('Дистанция наведения, футы'), { target: { value: '60' } });
    fireEvent.change(screen.getByLabelText('Целей наведения'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(JSON.parse(lastImportJson()).automation.targeting).toEqual({ kind: 'creature', range: 60, targets: 2 });
    first.unmount();

    const shield = copyRecord(spellsData.spells.find((s) => s.name === 'Shield')!, '(копия)');
    render(<SpellConstructorModal initial={shield} lockedKey={false} onClose={vi.fn()} />);
    expect(screen.queryByLabelText('Наводить')).toBeNull();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Наведение' }));
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(JSON.parse(lastImportJson()).automation.targeting).toEqual({ kind: 'creature', range: 30 });
  });

  it('область каста: своя (Call Lightning) и из карточки (Sunbeam)', () => {
    const call = copyRecord(spellsData.spells.find((s) => s.name === 'Call Lightning')!, '(копия)');
    const first = render(<SpellConstructorModal initial={call} lockedKey={false} onClose={vi.fn()} />);
    expect(screen.getByLabelText('Источник')).toHaveValue('own');
    fireEvent.change(screen.getByLabelText('Размер области каста, футы'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(JSON.parse(lastImportJson()).automation.area).toEqual({ shape: 'sphere', size: 10 });
    first.unmount();

    const sun = copyRecord(spellsData.spells.find((s) => s.name === 'Sunbeam')!, '(копия)');
    render(<SpellConstructorModal initial={sun} lockedKey={false} onClose={vi.fn()} />);
    expect(screen.getByLabelText('Источник')).toHaveValue('spell');
    fireEvent.change(screen.getByLabelText('Размер области каста, футы'), { target: { value: '30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(JSON.parse(lastImportJson()).automation.area).toEqual({
      from: 'spell',
      fallback: { shape: 'line', size: 30, width: 5 },
    });
  });

  it('действия зоны: перемещение, спас+область и добавление пресета', () => {
    const sphere = copyRecord(spellsData.spells.find((s) => s.name === 'Flaming Sphere')!, '(копия)');
    const first = render(<SpellConstructorModal initial={sphere} lockedKey={false} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Перемещение, футы'), { target: { value: '60' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    const savedSphere = JSON.parse(lastImportJson());
    expect(savedSphere.automation.zone.actions[0].utility).toEqual({ kind: 'moveZone', amount: 60 });
    expect(savedSphere.automation.zone.actions[0].defKey).toBe('zone:move');
    first.unmount();

    const storm = copyRecord(spellsData.spells.find((s) => s.name === 'Call Lightning')!, '(копия)');
    const second = render(<SpellConstructorModal initial={storm} lockedKey={false} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Размер действия, футы'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    const savedStorm = JSON.parse(lastImportJson());
    expect(savedStorm.automation.zone.actions[0].area).toMatchObject({ shape: 'sphere', size: 10 });
    expect(savedStorm.automation.zone.actions[0].targeting.area).toMatchObject({ shape: 'sphere', size: 10 });
    second.unmount();

    const spirits = copyRecord(spellsData.spells.find((s) => s.name === 'Spirit Guardians')!, '(копия)');
    render(<SpellConstructorModal initial={spirits} lockedKey={false} onClose={vi.fn()} />);
    fireEvent.change(screen.getByDisplayValue('Добавить действие'), { target: { value: 'move' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    const savedSpirits = JSON.parse(lastImportJson());
    expect(savedSpirits.automation.zone.actions).toEqual([
      {
        id: 'move',
        name: 'Перемещение зоны',
        cost: 'bonus',
        defKey: 'zone:move',
        primary: 'utility',
        utility: { kind: 'moveZone', amount: 30 },
        targeting: { kind: 'point', range: 30 },
      },
    ]);
  });

  it('утилита-экстра: пассажир/вспышка, blockedDamage и Scatter', () => {
    const thunder = copyRecord(spellsData.spells.find((s) => s.name === 'Thunder Step')!, '(копия)');
    const first = render(<SpellConstructorModal initial={thunder} lockedKey={false} onClose={vi.fn()} />);
    expect(screen.getByRole('checkbox', { name: 'Пассажир' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Вспышка в покинутой точке' })).toBeChecked();
    fireEvent.change(screen.getByLabelText('Вспышка: радиус, футы'), { target: { value: '20' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    const savedThunder = JSON.parse(lastImportJson());
    expect(savedThunder.automation.utility.fromBurst.feet).toBe(20);
    expect(savedThunder.automation.utility.passenger).toEqual({ feet: 5, destFeet: 5, maxSize: true });
    first.unmount();

    const door = copyRecord(spellsData.spells.find((s) => s.name === 'Dimension Door')!, '(копия)');
    const second = render(<SpellConstructorModal initial={door} lockedKey={false} onClose={vi.fn()} />);
    expect(screen.getByRole('checkbox', { name: 'Сквозь стены (без линии видимости)' })).toBeChecked();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Урон провала телепорта' }));
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    const savedDoor = JSON.parse(lastImportJson());
    expect(savedDoor.automation.utility.blockedDamage).toBeUndefined();
    expect(savedDoor.automation.utility.ignoreSight).toBe(true);
    second.unmount();

    const scatter = copyRecord(spellsData.spells.find((s) => s.name === 'Scatter')!, '(копия)');
    render(<SpellConstructorModal initial={scatter} lockedKey={false} onClose={vi.fn()} />);
    expect(screen.getByLabelText('Целей (Scatter)')).toHaveValue(5);
    expect(screen.getByLabelText('Точка назначения, футы')).toHaveValue(120);
  });

  it('hitEffect: модификаторы и триггеры Booming Blade', () => {
    const boom = copyRecord(spellsData.spells.find((s) => s.name === 'Booming Blade')!, '(копия)');
    render(<SpellConstructorModal initial={boom} lockedKey={false} onClose={vi.fn()} />);
    expect(screen.getByRole('checkbox', { name: 'Добровольное движение' })).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Добавить модификатор' }));
    fireEvent.change(screen.getByPlaceholderText('Значение (число или кости)'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Добровольное движение' }));
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    const saved = JSON.parse(lastImportJson());
    expect(saved.automation.weaponAttack.hitEffect.modifiers[0]).toMatchObject({
      target: 'damage',
      mode: 'add',
      value: 2,
    });
    expect(saved.automation.weaponAttack.hitEffect.triggers).toBeUndefined();
  });

  it('Haste: эффект при снятии (onEnd) правится вложенным редактором', () => {
    const haste = copyRecord(spellsData.spells.find((s) => s.name === 'Haste')!, '(копия)');
    render(<SpellConstructorModal initial={haste} lockedKey={false} onClose={vi.fn()} />);
    // Вложенный onEnd рендерит свой блок «Дополнительно» — открываем внешний (первый).
    fireEvent.click(screen.getAllByText('Дополнительно')[0]!);
    expect(screen.getAllByRole('checkbox', { name: 'Эффект при снятии' })[0]).toBeChecked();
    fireEvent.change(screen.getByDisplayValue('Вялость'), { target: { value: 'Вялость+' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    const saved = JSON.parse(lastImportJson());
    expect(saved.automation.effects[0].onEnd.name).toBe('Вялость+');
  });

  it('продвинутая зона: предел урона, цена движения, excludeSource, onCreate', () => {
    const guardian = copyRecord(spellsData.spells.find((s) => s.name === 'Guardian of Faith')!, '(копия)');
    const first = render(<SpellConstructorModal initial={guardian} lockedKey={false} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Предел урона'), { target: { value: '50' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(JSON.parse(lastImportJson()).automation.zone.dealtLimit).toBe(50);
    first.unmount();

    const thorns = copyRecord(spellsData.spells.find((s) => s.name === 'Wall of Thorns')!, '(копия)');
    const second = render(<SpellConstructorModal initial={thorns} lockedKey={false} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Цена движения (×)'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(JSON.parse(lastImportJson()).automation.zone.flags.movementCost).toBe(2);
    second.unmount();

    const spirits = copyRecord(spellsData.spells.find((s) => s.name === 'Spirit Guardians')!, '(копия)');
    const third = render(<SpellConstructorModal initial={spirits} lockedKey={false} onClose={vi.fn()} />);
    expect(screen.getByRole('checkbox', { name: 'Не действует на источник' })).toBeChecked();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Не действует на источник' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Нежить' }).at(-1)!);
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    const savedSpirits = JSON.parse(lastImportJson());
    expect(savedSpirits.automation.zone.excludeSource).toBeUndefined();
    expect(savedSpirits.automation.zone.excludeCreatureTypes).toEqual(['undead']);
    third.unmount();

    const storm = copyRecord(spellsData.spells.find((s) => s.name === 'Storm Sphere')!, '(копия)');
    render(<SpellConstructorModal initial={storm} lockedKey={false} onClose={vi.fn()} />);
    const create = screen.getByRole('checkbox', { name: 'Эффект при создании' });
    expect(create).toBeChecked();
    fireEvent.click(create);
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(JSON.parse(lastImportJson()).automation.zone.onCreate).toBeUndefined();
  });

  it('верхнеуровневое: конверсия урон→лечение, burst/chain/force', () => {
    const fireball = copyRecord(spellsData.spells.find((s) => s.name === 'Fireball')!, '(копия)');
    const first = render(<SpellConstructorModal initial={fireball} lockedKey={false} onClose={vi.fn()} />);
    const heal = screen.getByRole('checkbox', { name: 'Это лечение' });
    expect(heal).not.toBeChecked();
    fireEvent.click(heal);
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    const savedFireball = JSON.parse(lastImportJson());
    expect(savedFireball.healing).toBe(true);
    expect(savedFireball.automation.heal).toBeTruthy();
    expect(savedFireball.automation.damage).toBeUndefined();
    first.unmount();

    const ice = copyRecord(spellsData.spells.find((s) => s.name === 'Ice Knife')!, '(копия)');
    const second = render(<SpellConstructorModal initial={ice} lockedKey={false} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Радиус всплеска, футы'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(JSON.parse(lastImportJson()).automation.burst.rangeFeet).toBe(10);
    second.unmount();

    const chain = copyRecord(spellsData.spells.find((s) => s.name === 'Chain Lightning')!, '(копия)');
    const third = render(<SpellConstructorModal initial={chain} lockedKey={false} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Дистанция скачка, футы'), { target: { value: '60' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(JSON.parse(lastImportJson()).automation.chain.feet).toBe(60);
    third.unmount();

    const smite = copyRecord(spellsData.spells.find((s) => s.name === 'Thunderous Smite')!, '(копия)');
    render(<SpellConstructorModal initial={smite} lockedKey={false} onClose={vi.fn()} />);
    expect(screen.getByDisplayValue('Толчок')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Футов'), { target: { value: '15' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(JSON.parse(lastImportJson()).automation.force.feet).toBe(15);
  });

  it('верхнеуровневое: lifesteal, сторона и авто-цели', () => {
    const vampiric = copyRecord(spellsData.spells.find((s) => s.name === 'Vampiric Touch')!, '(копия)');
    const first = render(<SpellConstructorModal initial={vampiric} lockedKey={false} onClose={vi.fn()} />);
    const lifesteal = screen.getByRole('checkbox', { name: 'Лечит кастера на половину урона' });
    expect(lifesteal).toBeChecked();
    fireEvent.click(lifesteal);
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(JSON.parse(lastImportJson()).automation.lifesteal).toBeUndefined();
    first.unmount();

    const spirits = copyRecord(spellsData.spells.find((s) => s.name === 'Spirit Guardians')!, '(копия)');
    const second = render(<SpellConstructorModal initial={spirits} lockedKey={false} onClose={vi.fn()} />);
    // Последний селект «Сторона» — верхнеуровневый (первый — у зоны).
    fireEvent.change(screen.getAllByLabelText('Сторона').at(-1)!, { target: { value: 'ally' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    const savedSpirits = JSON.parse(lastImportJson());
    expect(savedSpirits.automation.side).toBe('ally');
    expect(savedSpirits.automation.zone.side).toBe('hostile');
    second.unmount();

    const hope = copyRecord(spellsData.spells.find((s) => s.name === 'Beacon of Hope')!, '(копия)');
    render(<SpellConstructorModal initial={hope} lockedKey={false} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Авто-цели, футы'), { target: { value: '60' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(JSON.parse(lastImportJson()).automation.autoTargets).toMatchObject({ feet: 60, side: 'ally', includeSelf: true });
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
      lastImportJson()
    );
    expect(saved.concentration).toBeUndefined();
    expect(saved.duration[0].concentration).toBeUndefined();
  });
});
