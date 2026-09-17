import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_GRID } from 'shared';
import { fakeSocket, makeMap, makeToken, type EmittedEvent } from '../test/fixtures';
import { useGameStore } from '../store/useGameStore';
import TokenMenu from './TokenMenu';

vi.mock('../lib/useSpells', () => ({ useSpellByKey: () => new Map(), useSpells: () => null }));

let emitted: EmittedEvent[] = [];

beforeEach(() => {
  const { socket, emitted: list } = fakeSocket();
  emitted = list;
  const map = makeMap('m1', [makeToken('t1', { name: 'Гоблин', hpMax: '30', hpCurrent: 30 })]);
  useGameStore.setState({
    socket,
    selfId: 'dm',
    role: 'dm',
    testMode: false,
    scene: { maps: [map], activeMapId: 'm1', grid: { ...DEFAULT_GRID } },
    viewMapId: 'm1',
    tokenMenuId: 't1',
    currentCharacterId: null,
    sheet: null,
  });
});

describe('TokenMenu', () => {
  it('«Готово» сохраняет черновик и закрывает меню', () => {
    render(<TokenMenu />);

    fireEvent.change(screen.getByLabelText('Название'), { target: { value: 'Гоблин-2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Готово' }));

    const update = emitted.find((e) => e.event === 'token:update');
    expect(update?.payload).toMatchObject({ mapId: 'm1', id: 't1', patch: { name: 'Гоблин-2' } });
    expect(useGameStore.getState().tokenMenuId).toBeNull();
  });

  it('закрытие без сохранения не отправляет token:update', () => {
    render(<TokenMenu />);

    fireEvent.change(screen.getByLabelText('Название'), { target: { value: 'Не сохранять' } });
    fireEvent.click(screen.getByRole('button', { name: 'Закрыть' }));

    expect(emitted.some((e) => e.event === 'token:update')).toBe(false);
    expect(useGameStore.getState().tokenMenuId).toBeNull();
  });

  it('правка полей черновика не отправляет события до «Готово»', () => {
    render(<TokenMenu />);

    fireEvent.change(screen.getByLabelText('Текущее ХП'), { target: { value: '10' } });
    expect(emitted.some((e) => e.event === 'token:update')).toBe(false);
    expect(useGameStore.getState().scene.maps[0]!.tokens[0]!.hpCurrent).toBe(30);
  });

  it('«Отвязать персонажа» снимает привязку игрока', () => {
    const { socket, emitted: list } = fakeSocket();
    emitted = list;
    const map = makeMap('m1', [
      makeToken('t1', { name: 'Гоблин', libraryItemId: 'lib1', isPlayerToken: true }),
    ]);
    useGameStore.setState({
      socket,
      selfId: 'p1',
      role: 'player',
      testMode: false,
      scene: { maps: [map], activeMapId: 'm1', grid: { ...DEFAULT_GRID } },
      viewMapId: 'm1',
      tokenMenuId: 't1',
      currentCharacterId: 'lib1',
      sheet: null,
    });
    render(<TokenMenu />);

    fireEvent.click(screen.getByRole('button', { name: 'Отвязать персонажа' }));

    expect(emitted.find((e) => e.event === 'player:setCharacter')?.payload).toEqual({ libraryItemId: null });
    expect(useGameStore.getState().tokenMenuId).toBeNull();
  });

  it('у токена персонажа статы read-only, статблок показывает данные листа', () => {
    const { socket, emitted: list } = fakeSocket();
    emitted = list;
    const map = makeMap('m1', [
      makeToken('t1', {
        name: 'Конан',
        libraryItemId: 'lib1',
        isPlayerToken: true,
        character: true,
        ac: '16',
        hpMax: '20',
        hpCurrent: 12,
        initiativeBonus: '+2',
        speed: 25,
        attacks: [{ name: 'Меч', hit: 'd20+5', damage: 'd8+3' } as never],
        statblock: {
          abilities: { str: 16, dex: 14, con: 12, int: 10, wis: 10, cha: 8 },
          saves: { str: 5 },
          multiattack: 2,
        },
      }),
    ]);
    useGameStore.setState({
      socket,
      selfId: 'dm',
      role: 'dm',
      testMode: false,
      scene: { maps: [map], activeMapId: 'm1', grid: { ...DEFAULT_GRID } },
      viewMapId: 'm1',
      tokenMenuId: 't1',
      currentCharacterId: null,
      sheet: null,
    });
    render(<TokenMenu />);

    expect(screen.getByLabelText('Название')).toHaveAttribute('readonly');
    expect(screen.getByLabelText('Бонус инициативы')).toHaveAttribute('readonly');
    expect(screen.getByLabelText('Класс брони (AC)')).toHaveAttribute('readonly');
    expect(screen.getByLabelText('Текущее ХП')).toHaveAttribute('readonly');

    fireEvent.click(screen.getByRole('button', { name: 'Статблок' }));
    expect(screen.getByDisplayValue('16')).toHaveAttribute('readonly');
    expect(screen.getByDisplayValue('5')).toHaveAttribute('readonly');
    expect(screen.getByDisplayValue('2')).toHaveAttribute('readonly');
    expect(screen.getByDisplayValue('d20+5')).toHaveAttribute('readonly');
    expect(screen.queryByRole('button', { name: '+ Добавить атаку' })).toBeNull();
  });
});
