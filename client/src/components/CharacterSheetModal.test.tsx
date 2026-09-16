import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CharacterSheet } from 'shared';
import { fakeSocket, type EmittedEvent } from '../test/fixtures';
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
});
