import { describe, expect, it } from 'vitest';
import { attackRidersFor } from './attackRiders';
import { classFeatures } from './classActions';
import { BAIT_AND_SWITCH_ACTION, KNOW_YOUR_ENEMY_ACTION, maneuverActions, maneuverLimit, maneuverSaveDc, SUPERIORITY_RESOURCE } from './maneuvers';
import { featureChoiceOptions } from './featureAutomation';
import { collectAttackSources } from './attackSources';
import type { EffectInstance } from '../domain/effects';
import type { FeatureChoice } from '../domain/feature';

const battleMaster = (level: number) => [{ className: 'fighter', level, subclass: 'battleMaster' }];
const pick = (...keys: string[]): FeatureChoice[] => keys.map((key) => ({ kind: 'maneuver' as const, key }));

describe('манёвры боевого мастера (XPHB)', () => {
  it('лимит известных манёвров: 3/5/7/9 на 3/7/10/15', () => {
    expect(maneuverLimit(2)).toBe(0);
    expect(maneuverLimit(3)).toBe(3);
    expect(maneuverLimit(6)).toBe(3);
    expect(maneuverLimit(7)).toBe(5);
    expect(maneuverLimit(10)).toBe(7);
    expect(maneuverLimit(15)).toBe(9);
    expect(maneuverLimit(20)).toBe(9);
  });

  it('кнопки манёвров заменяют заглушку «Манёвр»', () => {
    const generic = classFeatures(battleMaster(5)).map((a) => a.id);
    expect(generic).toContain('class:fighter.battleMaster:superiorityDice/maneuver');

    const chosen = pick('XPHB:Precision Attack', 'XPHB:Bait and Switch', 'XPHB:Distracting Strike');
    const ids = classFeatures(battleMaster(5), chosen).map((a) => a.id);
    expect(ids).not.toContain('class:fighter.battleMaster:superiorityDice/maneuver');
    expect(ids).toContain(BAIT_AND_SWITCH_ACTION);
    // Оконные манёвры (промах/попадание-авто/реакция) кнопок не дают.
    expect(ids).not.toContain('class:fighter.battleMaster:maneuver:precision-attack');
    expect(ids).not.toContain('class:fighter.battleMaster:maneuver:distracting-strike');
  });

  it('даже выбор только оконных манёвров убирает заглушку', () => {
    const ids = classFeatures(battleMaster(5), pick('XPHB:Precision Attack', 'XPHB:Parry', 'XPHB:Riposte')).map(
      (a) => a.id
    );
    expect(ids).not.toContain('class:fighter.battleMaster:superiorityDice/maneuver');
  });

  it('ручные манёвры: бонусные действия и «специальные» кнопки', () => {
    const actions = maneuverActions(battleMaster(5), pick('XPHB:Rally', 'XPHB:Trip Attack', 'XPHB:Ambush'));
    expect(actions.map((a) => a.id)).toEqual([
      'class:fighter.battleMaster:maneuver:rally',
      'class:fighter.battleMaster:maneuver:trip-attack',
      'class:fighter.battleMaster:maneuver:ambush',
    ]);
    expect(actions[0]?.costs).toEqual(['bonus']);
    expect(actions[1]?.costs).toEqual(['special']);
    expect(actions[2]?.costs).toEqual(['special']);
    expect(actions[0]?.resourceKey).toBe('fighter.battleMaster:superiorityDice');
  });

  it('Приманка и подмена: бонусное действие, цель в 5 фт, выбор получателя AC', () => {
    const action = classFeatures(battleMaster(3), pick('XPHB:Bait and Switch')).find(
      (a) => a.id === BAIT_AND_SWITCH_ACTION
    );
    expect(action?.costs).toEqual(['bonus']);
    expect(action?.targeting).toEqual({ kind: 'creature', range: 5 });
    expect(featureChoiceOptions(BAIT_AND_SWITCH_ACTION)).toEqual(['self', 'ally']);
  });

  it('Знай врага: запасная оплата — кость превосходства', () => {
    const action = classFeatures(battleMaster(7)).find((a) => a.id === KNOW_YOUR_ENEMY_ACTION);
    expect(action?.resourceKey).toBe('fighter.battleMaster:knowYourEnemy');
    expect(action?.fallbackResourceKey).toBe(SUPERIORITY_RESOURCE);
  });

  it('Отвлекающий удар доступен только при выбранном манёвре', () => {
    const classes = battleMaster(3);
    expect(attackRidersFor(classes).map((r) => r.id)).not.toContain('fighter.battleMaster:distractingStrike');
    const chosen = attackRidersFor(classes, undefined, pick('XPHB:Distracting Strike'));
    const rider = chosen.find((r) => r.id === 'fighter.battleMaster:distractingStrike');
    expect(rider?.superiorityDice).toBe(true);
    expect(rider?.noTurnLimit).toBe(true);
    expect(rider?.targetEffect?.consumeOnIncomingAttack).toBe(true);
  });

  it('преимущество Отвлекающего удара — только для атак не-источника', () => {
    const effect: EffectInstance = {
      id: 'e1',
      name: 'Отвлекающий удар',
      sourceKey: 'rider:fighter.battleMaster:distractingStrike',
      sourceId: 'fighter',
      duration: { type: 'endOfTurn', of: 'source' },
      modifiers: [
        {
          id: 'm1',
          target: 'attack',
          mode: 'advantage',
          filter: { direction: 'against', otherThanSource: true },
        },
      ],
    };
    const ctx = { direction: 'against' as const, targetId: 'target' };
    const own = collectAttackSources({
      targetEffects: [effect],
      effectContext: { ...ctx, attackerId: 'fighter' },
    });
    expect(own.some((s) => s.side === 'advantage')).toBe(false);
    const ally = collectAttackSources({
      targetEffects: [effect],
      effectContext: { ...ctx, attackerId: 'ally' },
    });
    expect(ally.some((s) => s.side === 'advantage')).toBe(true);
  });

  it('СЛ манёвра: 8 + ПБ + больший мод Силы/Ловкости', () => {
    const sheet = {
      abilities: { str: 16, dex: 14, con: 12, int: 10, wis: 10, cha: 8 },
      classes: battleMaster(5),
    };
    expect(maneuverSaveDc(sheet)).toBe(14); // 8 + 3 + 3
  });
});
