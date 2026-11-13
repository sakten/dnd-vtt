import { describe, expect, it } from 'vitest';
import type { RaceSelection } from '../domain/race';
import {
  RACES,
  raceActionAutomation,
  raceActionChoiceOptions,
  raceActionStats,
  raceActions,
  raceByKey,
  raceDarkvision,
  raceHpBonus,
  racePassiveEffects,
  raceResistances,
  raceResourceDefs,
  raceSkill,
  raceSpeed,
} from './races';

const effectsOf = (race: RaceSelection) => racePassiveEffects(race).flatMap((feature) => feature.effects);

const hasResistance = (effects: ReturnType<typeof effectsOf>, type: string) =>
  effects.some((effect) => effect.modifiers.some((m) => m.mode === 'resistance' && m.filter?.damageType === type));

describe('виды PHB 2024', () => {
  it('каталог: 10 видов XPHB', () => {
    expect(RACES).toHaveLength(10);
    expect(RACES.map((race) => race.key)).toContain('XPHB:Aasimar');
    expect(raceByKey('XPHB:Elf')?.speed).toBe(30);
  });

  it('тёмное зрение и сопротивления асасимара', () => {
    const effects = effectsOf({ key: 'XPHB:Aasimar' });
    expect(effects.some((effect) => effect.senses?.some((s) => s.type === 'darkvision' && s.range === 60))).toBe(true);
    expect(hasResistance(effects, 'necrotic')).toBe(true);
    expect(hasResistance(effects, 'radiant')).toBe(true);
  });

  it('драконорождённый: сопротивление зависит от наследия', () => {
    expect(raceResistances({ key: 'XPHB:Dragonborn' })).toEqual([]);
    expect(raceResistances({ key: 'XPHB:Dragonborn', choices: { ancestry: 'red' } })).toEqual(['fire']);
    expect(raceResistances({ key: 'XPHB:Dragonborn', choices: { ancestry: 'white' } })).toEqual(['cold']);
  });

  it('тифлинг: сопротивление зависит от наследия', () => {
    expect(raceResistances({ key: 'XPHB:Tiefling', choices: { legacy: 'abyssal' } })).toEqual(['poison']);
    expect(raceResistances({ key: 'XPHB:Tiefling', choices: { legacy: 'infernal' } })).toEqual(['fire']);
  });

  it('дварф: тёмное зрение 120, яд и +1 HP за уровень', () => {
    const effects = effectsOf({ key: 'XPHB:Dwarf' });
    expect(raceDarkvision({ key: 'XPHB:Dwarf' })).toBe(120);
    expect(hasResistance(effects, 'poison')).toBe(true);
    expect(
      effects.some((effect) =>
        effect.modifiers.some((m) => m.target === 'save' && m.mode === 'advantage' && m.filter?.conditions?.includes('poisoned'))
      )
    ).toBe(true);
    expect(raceHpBonus({ key: 'XPHB:Dwarf' }, [{ level: 6 }])).toBe(6);
    expect(raceHpBonus({ key: 'XPHB:Elf' }, [{ level: 6 }])).toBe(0);
  });

  it('эльф: дроу — 120 фт, лесной — скорость 35; навык из выбора', () => {
    expect(raceDarkvision({ key: 'XPHB:Elf', choices: { lineage: 'drow' } })).toBe(120);
    expect(raceSpeed({ key: 'XPHB:Elf', choices: { lineage: 'wood' } })).toBe(35);
    expect(raceSkill({ key: 'XPHB:Elf', choices: { skill: 'perception' } })).toBe('perception');
    expect(raceSkill({ key: 'XPHB:Elf', choices: { skill: 'athletics' } })).toBeUndefined();
    expect(raceSkill({ key: 'XPHB:Human', choices: { skill: 'athletics' } })).toBe('athletics');
  });

  it('гном: преимущество на спасброски INT/WIS/CHA', () => {
    const effects = effectsOf({ key: 'XPHB:Gnome' });
    const abilities = effects
      .flatMap((effect) => effect.modifiers)
      .filter((m) => m.target === 'save' && m.mode === 'advantage')
      .map((m) => m.filter?.ability);
    expect(abilities).toEqual(['int', 'wis', 'cha']);
  });
});

describe('активные черты видов', () => {
  it('авто-ресурсы вида попадают в общий список ресурсов', async () => {
    const { autoResourceDefs } = await import('./resources');
    const mods = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
    const defs = autoResourceDefs([{ className: 'fighter', level: 5 }], mods, undefined, { key: 'XPHB:Aasimar' });
    expect(defs.some((d) => d.key === 'race:XPHB:Aasimar:healingHands')).toBe(true);
    expect(defs.some((d) => d.key === 'race:XPHB:Aasimar:celestialRevelation')).toBe(true);
  });

  it('ресурсы: дыхание — ПБ, полёт — с 5 уровня', () => {
    const dragon = raceResourceDefs({ key: 'XPHB:Dragonborn' }, [{ level: 5 }]);
    expect(dragon.find((r) => r.key.endsWith(':breathWeapon'))?.max).toBe(3);
    expect(dragon.find((r) => r.key.endsWith(':draconicFlight'))?.max).toBe(1);
    expect(raceResourceDefs({ key: 'XPHB:Dragonborn' }, [{ level: 4 }]).some((r) => r.key.endsWith(':draconicFlight'))).toBe(
      false
    );
    expect(raceResourceDefs({ key: 'XPHB:Aasimar' }, [{ level: 2 }]).some((r) => r.key.endsWith(':celestialRevelation'))).toBe(
      false
    );
    expect(raceResourceDefs({ key: 'XPHB:Aasimar' }, [{ level: 3 }]).some((r) => r.key.endsWith(':celestialRevelation'))).toBe(
      true
    );
  });

  it('кнопки: дыхание появляется после выбора наследия, асасимар — руки и откровение', () => {
    expect(raceActions({ key: 'XPHB:Dragonborn' }, [{ level: 1 }])).toEqual([]);
    const dragon = raceActions({ key: 'XPHB:Dragonborn', choices: { ancestry: 'red' } }, [{ level: 5 }]);
    expect(dragon.map((a) => a.id)).toEqual([
      'race:XPHB:Dragonborn:breathWeaponCone',
      'race:XPHB:Dragonborn:breathWeaponLine',
      'race:XPHB:Dragonborn:draconicFlight',
    ]);
    const aasimar = raceActions({ key: 'XPHB:Aasimar' }, [{ level: 3 }]);
    expect(aasimar.map((a) => a.id)).toContain('race:XPHB:Aasimar:healingHands');
    expect(aasimar.map((a) => a.id)).toContain('race:XPHB:Aasimar:celestialRevelation');
    expect(raceActionChoiceOptions('race:XPHB:Aasimar:celestialRevelation')).toEqual(['wings', 'radiance', 'shroud']);
  });

  it('автоматика: лечение, дыхание, полёт и откровение', () => {
    const classes = [{ level: 5 }];
    const heal = raceActionAutomation('race:XPHB:Aasimar:healingHands', { key: 'XPHB:Aasimar' }, classes);
    expect(heal?.heal?.dice).toBe('3d4');
    const breath = raceActionAutomation(
      'race:XPHB:Dragonborn:breathWeaponCone',
      { key: 'XPHB:Dragonborn', choices: { ancestry: 'silver' } },
      classes
    );
    expect(breath?.save).toEqual({ ability: 'dex', half: true });
    expect(breath?.damage).toEqual({ dice: '2d10', types: ['cold'] });
    const flight = raceActionAutomation('race:XPHB:Dragonborn:draconicFlight', { key: 'XPHB:Dragonborn' }, classes);
    expect(flight?.effects?.[0]?.conditions).toEqual(['flying']);
    const shroud = raceActionAutomation(
      'race:XPHB:Aasimar:celestialRevelation',
      { key: 'XPHB:Aasimar' },
      classes,
      'shroud'
    );
    expect(shroud?.save).toEqual({ ability: 'cha' });
    expect(shroud?.effects?.[0]?.conditions).toEqual(['frightened']);
  });

  it('СЛ дыхания — Телосложение + ПБ', () => {
    const sheet = {
      abilities: { str: 10, dex: 10, con: 16, int: 10, wis: 10, cha: 10 },
      proficiencyBonus: '2',
      classes: [],
    } as unknown as Parameters<typeof raceActionStats>[1];
    expect(raceActionStats('race:XPHB:Dragonborn:breathWeaponCone', sheet)?.dc).toBe(13);
    expect(raceActionStats('race:XPHB:Aasimar:healingHands', sheet)).toBeNull();
  });
});
