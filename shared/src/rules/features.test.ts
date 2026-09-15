import { describe, expect, it } from 'vitest';
import { attackRidersFor } from './attackRiders';
import { classFeatures } from './classActions';
import { CLASSES, martialArtsDie } from './classes';
import { featureActionAutomation, passiveFeatures } from './featureAutomation';
import { FEATURES, featureByKey, featuresFor } from './features';
import { reactionFeatures } from './reactions';

/** Ресурсы, у которых нет пары в каталоге: кастомные ветки/подопции ядра. */
const CUSTOM_RESOURCE_KEYS = new Set(['wizard.scribes:ritualMastery', 'wizard.scribes:manifestMindConjure']);

/** Ресурсы-пулы (fuel): отдельной чертой не являются. */
const POOL_LIKE = /:(focus|sorceryPoints|superiorityDice|psionicEnergyDice)$/;

describe('каталог черт (features.json)', () => {
  it('ключи уникальны, классы/подклассы/уровни валидны', () => {
    const keys = new Set<string>();
    const bad: string[] = [];
    for (const f of FEATURES) {
      if (keys.has(f.key)) bad.push(`${f.key}: дубль`);
      keys.add(f.key);
      if (!(f.className in CLASSES)) bad.push(`${f.key}: класс ${f.className}`);
      if (f.subclass && !CLASSES[f.className]?.subclasses[f.subclass]) bad.push(`${f.key}: подкласс ${f.subclass}`);
      if (!Number.isInteger(f.level) || f.level < 1 || f.level > 20) bad.push(`${f.key}: уровень ${f.level}`);
      if (!f.name || !f.source) bad.push(`${f.key}: имя/источник`);
    }
    expect(bad).toEqual([]);
  });

  it('у каждого ресурса CLASSES есть пара в каталоге', () => {
    const bad: string[] = [];
    for (const [classKey, def] of Object.entries(CLASSES)) {
      for (const r of def.resources) if (!featureByKey(`${classKey}:${r.key}`)) bad.push(`${classKey}:${r.key}`);
      for (const [subKey, sub] of Object.entries(def.subclasses)) {
        for (const r of sub.resources ?? []) {
          if (!featureByKey(`${classKey}.${subKey}:${r.key}`)) bad.push(`${classKey}.${subKey}:${r.key}`);
        }
      }
    }
    expect(bad.filter((key) => !CUSTOM_RESOURCE_KEYS.has(key) && !POOL_LIKE.test(key))).toEqual([]);
  });

  it('featuresFor учитывает уровень и подкласс', () => {
    const diviner = featuresFor([{ className: 'wizard', subclass: 'diviner', level: 6 }]);
    expect(diviner.some((f) => f.key === 'wizard.diviner:portent')).toBe(true);
    expect(diviner.some((f) => f.key === 'wizard.diviner:expertDivination')).toBe(true);
    expect(diviner.some((f) => f.key === 'wizard.diviner:theThirdEye')).toBe(false);
    expect(diviner.some((f) => f.key === 'wizard:arcaneRecovery')).toBe(true);

    const evoker = featuresFor([{ className: 'wizard', subclass: 'evoker', level: 10 }]);
    expect(evoker.some((f) => f.key.startsWith('wizard.diviner:'))).toBe(false);
  });

  it('пассивки варвара дают постоянные эффекты, уровневые — не дают', () => {
    const classes = [{ className: 'barbarian', level: 7 }];
    const passives = passiveFeatures(classes).map((f) => f.key);
    expect(passives).toContain('barbarian:unarmoredDefense');
    expect(passives).toContain('barbarian:fastMovement');
    expect(passives).toContain('barbarian:dangerSense');
    expect(passives).toContain('barbarian:feralInstinct');
    expect(passives).not.toContain('barbarian:extraAttack');
    expect(passives).not.toContain('barbarian:rage');
  });

  it('Ярость масштабирует урон по уровню, Безрассудная атака разделяет направления', () => {
    const at1 = featureActionAutomation('class:barbarian:rage', [{ className: 'barbarian', level: 1 }]);
    const at12 = featureActionAutomation('class:barbarian:rage', [{ className: 'barbarian', level: 12 }]);
    const rageDamage = (def: ReturnType<typeof featureActionAutomation>) =>
      def?.effects?.[0]?.modifiers.find((m) => m.target === 'damage' && m.mode === 'add')?.value;
    expect(rageDamage(at1)).toBe(2);
    expect(rageDamage(at12)).toBe(3);

    const reckless = featureActionAutomation('class:barbarian:recklessAttack', [{ className: 'barbarian', level: 2 }]);
    const directions = reckless?.effects?.[0]?.modifiers.map((m) => m.filter?.direction);
    expect(directions).toEqual(['self', 'against']);
  });

  it('attackRidersFor фильтрует по подклассу и уровню', () => {
    const zealot = attackRidersFor([{ className: 'barbarian', subclass: 'zealot', level: 3 }]).map((r) => r.id);
    expect(zealot).toEqual(['barbarian.zealot:divineFury']);
    const berserker = attackRidersFor([{ className: 'barbarian', subclass: 'berserker', level: 2 }]).map((r) => r.id);
    expect(berserker).toEqual([]);
    const psi = attackRidersFor([{ className: 'fighter', subclass: 'psiWarrior', level: 12 }]).map((r) => r.id);
    expect(psi).toEqual(['fighter.psiWarrior:psionicStrike']);
    const psiRider = attackRidersFor([{ className: 'fighter', subclass: 'psiWarrior', level: 12 }]).find(
      (r) => r.id === 'fighter.psiWarrior:psionicStrike'
    );
    expect(psiRider?.choiceOnHit).toBe(true);
  });

  it('Терпеливая оборона/Шаг ветра: база бесплатна (Отход/Рывок)', () => {
    const monk = [{ className: 'monk', level: 2 }];
    expect(featureActionAutomation('class:monk:patientDefense', monk)?.utility).toEqual({ kind: 'disengage' });
    expect(featureActionAutomation('class:monk:stepOfTheWind', monk)?.utility).toEqual({ kind: 'extraMovement' });
    const patient = classFeatures(monk).find((a) => a.id === 'class:monk:patientDefense');
    expect(patient?.costs).toEqual(['bonus']);
    expect(patient?.resourceKey).toBeUndefined();
    expect(classFeatures(monk).map((a) => a.id)).toContain('class:monk:stepOfTheWind');
  });

  it('Боевой дух: 5/10/15 временных HP, преимущество только на оружие', () => {
    const at3 = featureActionAutomation('class:fighter.samurai:fightingSpirit', [
      { className: 'fighter', subclass: 'samurai', level: 3 },
    ]);
    const effect = at3?.effects?.[0];
    expect(effect?.tempHp).toBe(5);
    expect(effect?.modifiers[0]?.filter).toEqual({ direction: 'self', weapon: true });
    const at10 = featureActionAutomation('class:fighter.samurai:fightingSpirit', [
      { className: 'fighter', subclass: 'samurai', level: 10 },
    ]);
    expect(at10?.effects?.[0]?.tempHp).toBe(10);
  });

  it('Ярость мирового древа даёт временные HP по уровню варвара', () => {
    const tree = featureActionAutomation('class:barbarian:rage', [
      { className: 'barbarian', subclass: 'worldTree', level: 6 },
    ]);
    expect(tree?.effects?.[0]?.tempHp).toBe(6);
    const plain = featureActionAutomation('class:barbarian:rage', [{ className: 'barbarian', level: 6 }]);
    expect(plain?.effects?.[0]?.tempHp).toBeUndefined();
  });

  it('Фанатичное присутствие: бафф союзников в 30 фт до начала своего следующего хода', () => {
    const def = featureActionAutomation('class:barbarian.zealot:zealousPresence', [
      { className: 'barbarian', subclass: 'zealot', level: 10 },
    ]);
    const effect = def?.effects?.[0];
    expect(effect?.radiusFeet).toBe(30);
    expect(effect?.duration).toEqual({ type: 'endOfTurn', of: 'source' });
    expect(effect?.modifiers.map((m) => m.target)).toEqual(['attack', 'save']);
    expect(effect?.modifiers[0]?.filter).toEqual({ direction: 'self' });
  });

  it('Battering Roots — пассивная досягаемость +10 фт', () => {
    const passives = passiveFeatures([{ className: 'barbarian', subclass: 'worldTree', level: 10 }]);
    const roots = passives.find((p) => p.key === 'barbarian.worldTree:batteringRoots');
    expect(roots?.effects[0]?.modifiers[0]).toMatchObject({ target: 'reach', mode: 'add', value: 10 });
  });

  it('Шквал ударов: 2 доп. удара, с 10 уровня — 3', () => {
    const at2 = featureActionAutomation('class:monk:focus/flurryOfBlows', [{ className: 'monk', level: 2 }]);
    expect(at2?.utility).toEqual({ kind: 'extraAttacks', amount: 2 });
    const at10 = featureActionAutomation('class:monk:focus/flurryOfBlows', [{ className: 'monk', level: 10 }]);
    expect(at10?.utility?.amount).toBe(3);
  });

  it('Бонусный безоружный удар: бесплатно, +1 атака за бонусное действие', () => {
    const strike = featureActionAutomation('class:monk:bonusUnarmedStrike', [{ className: 'monk', level: 1 }]);
    expect(strike?.utility).toEqual({ kind: 'extraAttacks', amount: 1 });
    const button = classFeatures([{ className: 'monk', level: 1 }]).find((a) => a.id === 'class:monk:bonusUnarmedStrike');
    expect(button?.costs).toEqual(['bonus']);
    expect(button?.resourceKey).toBeUndefined();
  });

  it('Ошеломляющий удар: доступен с 5 уровня, CON-спас и stunned', () => {
    expect(attackRidersFor([{ className: 'monk', level: 4 }]).map((r) => r.id)).not.toContain('monk:stunningStrike');
    const rider = attackRidersFor([{ className: 'monk', level: 5 }]).find((r) => r.id === 'monk:stunningStrike');
    expect(rider?.save).toEqual({ ability: 'con', condition: 'stunned', halfSpeedOnSuccess: true });
    expect(rider?.resourceKey).toBe('monk:focus');
    expect(rider?.choiceOnHit).toBe(true);
  });

  it('Кость боевых искусств растёт по уровню', () => {
    expect(martialArtsDie(1)).toBe(6);
    expect(martialArtsDie(5)).toBe(8);
    expect(martialArtsDie(11)).toBe(10);
    expect(martialArtsDie(17)).toBe(12);
  });

  it('Бард: кость вдохновения d6→d10, Всезнайка — половина бонуса владения', () => {
    const at1 = featureActionAutomation('class:bard:bardicInspiration', [{ className: 'bard', level: 1 }]);
    expect(at1?.effects?.[0]?.bonusDie).toBe('1d6');
    const at10 = featureActionAutomation('class:bard:bardicInspiration', [{ className: 'bard', level: 10 }]);
    expect(at10?.effects?.[0]?.bonusDie).toBe('1d10');
    const button = classFeatures([{ className: 'bard', level: 1 }]).find(
      (a) => a.id === 'class:bard:bardicInspiration'
    );
    expect(button?.costs).toEqual(['bonus']);
    expect(button?.targeting).toEqual({ kind: 'creature', range: 60 });
    expect(button?.resourceKey).toBe('bard:bardicInspiration');
    const passives = passiveFeatures([{ className: 'bard', level: 2 }]);
    expect(passives.some((p) => p.key === 'bard:jackOfAllTrades')).toBe(true);
    expect(passiveFeatures([{ className: 'bard', level: 1 }]).some((p) => p.key === 'bard:jackOfAllTrades')).toBe(false);
  });

  it('Божественная искра: лечение/урон по Мдр, 2d8 с 7 уровня, тратит Проведение', () => {
    const at2 = featureActionAutomation('class:cleric:divineSpark', [{ className: 'cleric', level: 2 }]);
    expect(at2?.heal).toEqual({ dice: '1d8+wis' });
    expect(at2?.damage?.dice).toBe('1d8+wis');
    expect(at2?.save).toEqual({ ability: 'con', half: true });
    const at7 = featureActionAutomation('class:cleric:divineSpark', [{ className: 'cleric', level: 7 }]);
    expect(at7?.heal?.dice).toBe('2d8+wis');
    const button = classFeatures([{ className: 'cleric', level: 2 }]).find((a) => a.id === 'class:cleric:divineSpark');
    expect(button?.costs).toEqual(['action']);
    expect(button?.targeting).toEqual({ kind: 'creature', range: 30 });
    expect(button?.resourceKey).toBe('cleric:channelDivinity');
  });

  it('Изгнание нежити: автоцели врагов в 30 фт, испуг+недееспособность, Карающая с 5 ур.', () => {
    expect(featureActionAutomation('class:cleric:turnUndead', [{ className: 'cleric', level: 4 }])?.damage).toBeUndefined();
    const def = featureActionAutomation('class:cleric:turnUndead', [{ className: 'cleric', level: 5 }]);
    expect(def?.autoTargets).toEqual({ feet: 30, side: 'hostile' });
    expect(def?.damage).toEqual({ dice: '1d8', types: ['radiant'], abilityDice: { ability: 'wis', min: 1 } });
    expect(def?.effects?.[0]?.conditions).toEqual(['frightened', 'incapacitated']);
    expect(def?.effects?.[0]?.wakeOnDamage).toBe(true);
    const ids = classFeatures([{ className: 'cleric', level: 5 }]).map((a) => a.id);
    expect(ids).toContain('class:cleric:turnUndead');
    expect(ids).not.toContain('class:cleric:channelDivinity');
  });

  it('Божественное вмешательство: кнопка с 10 ур., ресурс 1/долгий отдых', () => {
    const ids = classFeatures([{ className: 'cleric', level: 9 }]).map((a) => a.id);
    expect(ids).not.toContain('class:cleric:divineIntervention');
    const at10 = featureActionAutomation('class:cleric:divineIntervention', [{ className: 'cleric', level: 10 }]);
    expect(at10?.resolution).toBe('manual');
    const button = classFeatures([{ className: 'cleric', level: 10 }]).find((a) => a.id === 'class:cleric:divineIntervention');
    expect(button?.resourceKey).toBe('cleric:divineIntervention');
    expect(button?.costs).toEqual(['action']);
  });

  it('Поддержание жизни: пул 5×уровень по раненым союзникам в 30 фт', () => {
    const def = featureActionAutomation('class:cleric.life:preserveLife', [
      { className: 'cleric', level: 6, subclass: 'life' },
    ]);
    expect(def?.utility).toEqual({ kind: 'healPool', amount: 30 });
    expect(def?.autoTargets).toEqual({ feet: 30, side: 'ally' });
    expect(def?.resolution).toBe('utility');
  });

  it('Сияние рассвета: 2d10 + уровень жреца радиантом, CON-спас пополам', () => {
    const def = featureActionAutomation('class:cleric.light:radianceOfTheDawn', [
      { className: 'cleric', level: 3, subclass: 'light' },
    ]);
    expect(def?.damage).toEqual({ dice: '2d10+3', types: ['radiant'] });
    expect(def?.save).toEqual({ ability: 'con', half: true });
    expect(def?.autoTargets).toEqual({ feet: 30, side: 'hostile' });
  });

  it('Военный жрец: бонусная атака оружием; кнопки Ослепляющей вспышки нет (реакция)', () => {
    const def = featureActionAutomation('class:cleric.war:warPriest', [
      { className: 'cleric', level: 3, subclass: 'war' },
    ]);
    expect(def?.utility).toEqual({ kind: 'weaponAttack', amount: 1 });
    const ids = classFeatures([{ className: 'cleric', level: 3, subclass: 'light' }]).map((a) => a.id);
    expect(ids).not.toContain('class:cleric.light:wardingFlare');
    expect(ids).toContain('class:cleric.light:radianceOfTheDawn');
  });

  it('Направленный удар: реакция +10 к промаху в 30 фт', () => {
    const def = reactionFeatures([{ className: 'cleric', level: 3, subclass: 'war' }]).find(
      (d) => d.id === 'cleric.war:guidedStrike'
    );
    expect(def).toMatchObject({ kind: 'rollBonus', amount: 10, trigger: 'attackMiss', rangeFeet: 30 });
    expect(def?.resourceKey).toBe('cleric:channelDivinity');
  });

  it('Монах: в названиях бонусных действий видно, что они дают', () => {
    const at2 = classFeatures([{ className: 'monk', level: 2 }]);
    expect(at2.find((a) => a.id === 'class:monk:patientDefense')?.name).toBe('Терпеливая оборона (Отход)');
    expect(at2.find((a) => a.id === 'class:monk:stepOfTheWind')?.name).toBe('Шаг ветра (Рывок)');
    expect(at2.find((a) => a.id === 'class:monk:focus/patientDefense')?.name).toBe('Терпеливая оборона (Отход + Уклонение)');
    expect(at2.find((a) => a.id === 'class:monk:focus/stepOfTheWind')?.name).toBe('Шаг ветра (Отход + Рывок)');
  });
});
