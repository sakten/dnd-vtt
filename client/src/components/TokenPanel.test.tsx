import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type LibraryItem } from 'shared';
import { fakeSocket, makeScene, type EmittedEvent } from '../test/fixtures';
import { useGameStore } from '../store/useGameStore';
import TokenPanel from './TokenPanel';

vi.mock('../lib/api', () => ({ uploadImage: vi.fn() }));

function item(id: string, overrides: Partial<LibraryItem> = {}): LibraryItem {
  return {
    id,
    name: id,
    description: '',
    imageUrl: '',
    cells: 1,
    round: false,
    initiativeBonus: '',
    isPlayerToken: true,
    owner: '',
    attacks: [],
    ac: '',
    hpMax: '',
    showStats: false,
    canInteract: false,
    damageDefenses: [],
    ...overrides,
  };
}

let emitted: EmittedEvent[] = [];

beforeEach(() => {
  const { socket, emitted: list } = fakeSocket();
  emitted = list;
  useGameStore.setState({
    socket,
    selfId: 'p1',
    role: 'player',
    testMode: false,
    scene: makeScene(),
    viewMapId: 'm1',
    library: [item('libA'), item('libB', { isPlayerToken: false })],
    currentCharacterId: null,
  });
  localStorage.clear();
});

describe('TokenPanel: звезда «мой персонаж»', () => {
  it('звезда есть только у подходящего предмета и привязывает игрока', () => {
    render(<TokenPanel />);

    const stars = screen.getAllByTestId('token-star');
    expect(stars).toHaveLength(1);
    fireEvent.click(stars[0]!);

    expect(emitted.find((e) => e.event === 'player:setCharacter')?.payload).toEqual({ libraryItemId: 'libA' });
  });

  it('у текущего персонажа звезда закрашена и снимает привязку', () => {
    useGameStore.setState({ currentCharacterId: 'libA' });
    render(<TokenPanel />);

    const star = screen.getByTestId('token-star');
    expect(star.textContent).toBe('★');
    fireEvent.click(star);

    expect(emitted.find((e) => e.event === 'player:setCharacter')?.payload).toEqual({ libraryItemId: null });
  });

  it('у DM звёзд нет', () => {
    useGameStore.setState({ role: 'dm' });
    render(<TokenPanel />);

    expect(screen.queryAllByTestId('token-star')).toHaveLength(0);
  });

  it('в окне предмета кнопка «Это мой персонаж» привязывает игрока', () => {
    render(<TokenPanel />);

    const img = screen.getAllByRole('img')[0]!;
    fireEvent.click(img);
    fireEvent.click(img);
    fireEvent.click(screen.getByTestId('token-set-character'));

    expect(emitted.find((e) => e.event === 'player:setCharacter')?.payload).toEqual({ libraryItemId: 'libA' });
    expect(screen.queryByTestId('token-set-character')).toBeNull();
  });
});
