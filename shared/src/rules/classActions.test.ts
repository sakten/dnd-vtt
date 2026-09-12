import { describe, expect, it } from 'vitest';
import { classFeatures } from './classActions';

const find = (classes: Parameters<typeof classFeatures>[0], id: string) =>
  classFeatures(classes).find((f) => f.id === id);

describe('classFeatures', () => {
  it('базовое действие класса: Ярость варвара', () => {
    const rage = find([{ className: 'barbarian', level: 1 }], 'class:barbarian:rage');
    expect(rage).toBeDefined();
    expect(rage?.costs).toEqual(['bonus']);
    expect(rage?.resourceKey).toBe('barbarian:rage');
    expect(rage?.source).toBe('class');
  });

  it('черты подкласса появляются на нужном уровне и префиксуют ресурс', () => {
    expect(find([{ className: 'barbarian', level: 13, subclass: 'berserker' }], 'class:barbarian.berserker:intimidatingPresence')).toBeUndefined();
    const f = find([{ className: 'barbarian', level: 14, subclass: 'berserker' }], 'class:barbarian.berserker:intimidatingPresence');
    expect(f?.resourceKey).toBe('barbarian.berserker:intimidatingPresence');
    expect(f?.source).toBe('subclass');
  });

  it('подкласс без черты не даёт способностей', () => {
    const ids = classFeatures([{ className: 'barbarian', level: 14, subclass: 'wildHeart' }]).map((f) => f.id);
    expect(ids).not.toContain('class:barbarian.berserker:intimidatingPresence');
  });

  it('ресурс-пул не становится кнопкой, но его именованные черты есть', () => {
    const monk = classFeatures([{ className: 'monk', level: 2 }]);
    expect(monk.some((f) => f.resourceKey === 'monk:focus' && f.name === 'Очки сосредоточения')).toBe(false);
    expect(monk.map((f) => f.id)).toEqual(
      expect.arrayContaining(['class:monk:focus/flurryOfBlows', 'class:monk:focus/patientDefense', 'class:monk:focus/stepOfTheWind'])
    );
    expect(monk.find((f) => f.id === 'class:monk:focus/flurryOfBlows')?.resourceKey).toBe('monk:focus');
  });

  it('пул мастера боевых искусств заменён именованным Манёвром', () => {
    const ids = classFeatures([{ className: 'fighter', level: 3, subclass: 'battleMaster' }]).map((f) => f.id);
    expect(ids).not.toContain('class:fighter.battleMaster:superiorityDice');
    expect(ids).toContain('class:fighter.battleMaster:superiorityDice/maneuver');
  });

  it('пассивки/отдых кнопкой не становятся', () => {
    expect(find([{ className: 'wizard', level: 20 }], 'class:wizard:arcaneRecovery')).toBeUndefined();
  });

  it('уровневое гейтирование ресурса: Всплеск действия со 2 уровня', () => {
    expect(find([{ className: 'fighter', level: 1 }], 'class:fighter:actionSurge')).toBeUndefined();
    const surge = find([{ className: 'fighter', level: 2 }], 'class:fighter:actionSurge');
    expect(surge?.costs).toEqual(['free']);
    expect(surge?.resourceKey).toBe('fighter:actionSurge');
  });

  it('мультикласс объединяет черты, id уникальны', () => {
    const features = classFeatures([
      { className: 'fighter', level: 2 },
      { className: 'wizard', level: 10, subclass: 'diviner' },
    ]);
    const ids = features.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('class:fighter:secondWind');
    expect(ids).toContain('class:wizard.diviner:portent');
    expect(ids).toContain('class:wizard.diviner:thirdEye');
  });

  it('неизвестный класс игнорируется', () => {
    expect(classFeatures([{ className: 'nope', level: 5 }])).toEqual([]);
  });
});
