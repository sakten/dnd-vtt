import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { emptyResources, normalizeSheet, type AttackEntry } from 'shared';
import { fakeSocket, makeMap, makeScene, makeToken } from '../test/fixtures';
import { useGameStore } from '../store/useGameStore';
import ActionPanel from './ActionPanel';

beforeEach(() => {
  const { socket } = fakeSocket();
  const token = makeToken('t1', { name: 'Бард', libraryItemId: 'lib1', isPlayerToken: true, x: 50, y: 75 });
  const map = makeMap('m1', [token]);
  const sheet = normalizeSheet({
    name: 'Бард',
    abilities: { str: 10, dex: 12, con: 12, int: 10, wis: 10, cha: 16 },
    classes: [{ className: 'bard', level: 3, subclass: 'glamour' }],
  });
  useGameStore.setState({
    socket,
    selfId: 'p1',
    role: 'player',
    testMode: false,
    scene: makeScene([map], 'm1'),
    viewMapId: 'm1',
    selectedTokenId: 't1',
    currentCharacterId: 'lib1',
    sheet,
    resources: {
      ...emptyResources(),
      resources: [
        { id: 'r1', key: 'bard.glamour:beguilingMagic', name: 'Обольщающая магия', current: 1, max: 1, reset: 'long' },
      ],
    },
  });
});

describe('Обольщающая магия: выбор эффекта', () => {
  it('сначала спрашивает Очарован/Испуган и передаёт выбор в прицел', () => {
    render(<ActionPanel />);

    fireEvent.click(screen.getByRole('button', { name: 'Обольщающая магия (1)' }));
    expect(screen.getByTestId('feature-choice')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Испуган' }));

    const interaction = useGameStore.getState().interaction;
    expect(interaction?.mode).toBe('target');
    if (interaction?.mode === 'target' && interaction.target.kind === 'action') {
      expect(interaction.target.actionId).toBe('class:bard.glamour:beguilingMagic');
      expect(interaction.target.variant).toBe('frightened');
    }
  });
});

describe('бейдж атаки: меч или стрела', () => {
  it('у дальней атаки — стрела, у ближней — меч', () => {
    const sheet = useGameStore.getState().sheet!;
    const melee: AttackEntry = {
      id: 'sword',
      name: 'Longsword',
      hit: 'd20+5',
      damage: '1d8+3',
      damageType: 'slashing',
      rangeType: 'melee',
      rangeNormal: 5,
      rangeLong: 0,
      weaponKey: 'XPHB:Longsword',
    };
    const ranged: AttackEntry = {
      id: 'bow',
      name: 'Shortbow',
      hit: 'd20+5',
      damage: '1d6+3',
      damageType: 'piercing',
      rangeType: 'ranged',
      rangeNormal: 80,
      rangeLong: 320,
      weaponKey: 'XPHB:Shortbow',
    };
    useGameStore.setState({ sheet: { ...sheet, attacks: [melee, ranged], hands: { right: 'sword' } } });
    render(<ActionPanel />);

    expect(
      screen.getByRole('button', { name: 'Атака: Shortbow' }).querySelector('.ap-badge-icon')?.getAttribute('data-icon')
    ).toBe('arrow');
    expect(
      screen.getByRole('button', { name: 'Атака: Longsword' }).querySelector('.ap-badge-icon')?.getAttribute('data-icon')
    ).toBe('sword');
  });
});
