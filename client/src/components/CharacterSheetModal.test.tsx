import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CharacterSheet } from 'shared';
import { fakeSocket, makeMap, makeScene, makeToken, type EmittedEvent } from '../test/fixtures';
import { useGameStore } from '../store/useGameStore';
import { defaultSheet } from '../lib/sheet';
import CharacterSheetModal from './CharacterSheetModal';

let emitted: EmittedEvent[] = [];

beforeEach(() => {
  const { socket, emitted: list } = fakeSocket();
  emitted = list;
  useGameStore.setState({
    socket,
    selfId: 'p1',
    players: [{ id: 'p1', name: 'Игрок', role: 'player', isConnected: true }],
    sheet: { ...defaultSheet(), name: 'Тест' },
  });
});

describe('CharacterSheetModal', () => {
  it('«Сохранить» отправляет sheet:update с черновиком и закрывает окно', () => {
    const onClose = vi.fn();
    render(<CharacterSheetModal open onClose={onClose} />);

    fireEvent.change(screen.getByRole('spinbutton', { name: 'Сила' }), { target: { value: '18' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    const update = emitted.find((e) => e.event === 'sheet:update');
    expect(update).toBeTruthy();
    expect((update!.payload as CharacterSheet).abilities.str).toBe(18);
  });

  it('Escape закрывает окно, не применяя черновик', () => {
    const onClose = vi.fn();
    render(<CharacterSheetModal open onClose={onClose} />);

    fireEvent.change(screen.getByRole('spinbutton', { name: 'Сила' }), { target: { value: '20' } });
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(emitted.some((e) => e.event === 'sheet:update')).toBe(false);
    expect(useGameStore.getState().sheet?.abilities.str).not.toBe(20);
  });

  it('без open ничего не рендерит', () => {
    const { container } = render(<CharacterSheetModal open={false} onClose={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('поле «Попадание» атаки редактируется и уходит в sheet:update (кэнсэй-монах)', () => {
    useGameStore.setState({
      sheet: {
        ...defaultSheet(),
        name: 'Тест',
        classes: [{ className: 'monk', level: 5, subclass: 'kensei' }],
        attacks: [
          {
            id: 'a1',
            name: 'Длинный меч',
            hit: 'd20+5',
            damage: '1d8+3',
            rangeType: 'melee',
            rangeNormal: 5,
            rangeLong: 0,
            weaponKey: 'XPHB:Longsword',
          },
        ],
      },
    });
    render(<CharacterSheetModal open onClose={vi.fn()} />);

    const hit = screen.getByDisplayValue('d20+5') as HTMLInputElement;
    expect(hit.readOnly).toBe(false);
    fireEvent.change(hit, { target: { value: 'd20+7' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    const update = emitted.find((e) => e.event === 'sheet:update');
    const saved = (update!.payload as CharacterSheet).attacks[0]!;
    expect(saved.hit).toBe('d20+7');
    expect(saved.manualHit).toBe(true);
  });

  it('показывает иммунитеты к состояниям от эффектов', () => {
    useGameStore.setState({
      scene: makeScene([
        makeMap('m1', [
          makeToken('t1', {
            libraryItemId: 'lib1',
            effects: [
              {
                id: 'ef1',
                name: "Heroes' Feast",
                duration: { type: 'permanent' },
                modifiers: [],
                conditionImmunities: ['frightened', 'poisoned'],
              },
            ],
          }),
        ]),
      ]),
      viewMapId: 'm1',
      currentCharacterId: 'lib1',
    });
    render(<CharacterSheetModal open onClose={vi.fn()} />);

    expect(screen.getByText('Иммунитеты к состояниям')).toBeTruthy();
    expect(screen.getByText('Испуган')).toBeTruthy();
    expect(screen.getByText('Отравлен')).toBeTruthy();
  });
});
