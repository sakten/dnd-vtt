import { describe, expect, it } from 'vitest';
import type { BestiaryEntry } from '../domain/bestiary';
import bestiaryRaw from '../data/bestiary.json';
import { bestiaryIconSvg, bestiaryIconUrl } from './bestiaryIcon';
import { creatureArchetype } from './creatureArt';

function entry(overrides: Partial<BestiaryEntry> = {}): BestiaryEntry {
  return {
    key: 'XMM:Wolf',
    name: 'Wolf',
    source: 'XMM',
    size: 'M',
    type: 'beast',
    cr: '1/4',
    ac: 14,
    hpAverage: 11,
    hpFormula: '2d8 + 2',
    abilities: { str: 14, dex: 15, con: 12, int: 3, wis: 12, cha: 6 },
    cells: 1,
    speed: 40,
    senses: [],
    immunities: [],
    resistances: [],
    vulnerabilities: [],
    conditionImmunities: [],
    attacks: [{ name: 'Bite', hit: '+4', damage: '1d6 + 2', rangeType: 'melee', rangeNormal: 5, rangeLong: 0, damageType: 'piercing' }],
    actions: [],
    description: '',
    appearance: 'A medium-sized four-legged wolf-like beast with sharp fangs and a bushy tail.',
    ...overrides,
  };
}

describe('силуэт существа по имени', () => {
  it('узнаёт архетипы по имени', () => {
    expect(creatureArchetype(entry())).toBe('wolf');
    expect(creatureArchetype(entry({ name: 'Adult Red Dragon', type: 'dragon' }))).toBe('dragon');
    expect(creatureArchetype(entry({ name: 'Imp', type: 'fiend' }))).toBe('demon');
    expect(creatureArchetype(entry({ name: 'Skeleton', type: 'undead' }))).toBe('skeleton');
    expect(creatureArchetype(entry({ name: 'Mage', type: 'humanoid' }))).toBe('humanoid');
    expect(creatureArchetype(entry({ name: 'Octopus', type: 'beast' }))).toBe('octopus');
    expect(creatureArchetype(entry({ name: 'Swarm of Bats', type: 'beast' }))).toBe('bat');
    expect(creatureArchetype(entry({ name: 'Giant Spider', type: 'beast' }))).toBe('spider');
    expect(creatureArchetype(entry({ name: 'Bestial Spirit', type: 'beast' }))).toBe('wolf');
  });

  it('неизвестное имя падает на тип', () => {
    expect(creatureArchetype(entry({ name: 'Zyx', type: 'ooze' }))).toBe('slime');
    expect(creatureArchetype(entry({ name: 'Zyx', type: 'celestial' }))).toBe('angel');
  });
});

describe('иконки бестиария', () => {
  it('детерминированы для одного ключа', () => {
    expect(bestiaryIconSvg(entry())).toBe(bestiaryIconSvg(entry()));
  });

  it('силуэты разных существ различаются', () => {
    const wolf = bestiaryIconSvg(entry());
    const dragon = bestiaryIconSvg(entry({ key: 'XMM:Adult Red Dragon', name: 'Adult Red Dragon', type: 'dragon' }));
    expect(wolf).not.toBe(dragon);
    expect(wolf).toContain('<path d="M24 46');
    expect(dragon).toContain('<ellipse cx="38" cy="56"');
  });

  it('акцент — от иммунитета/сопротивления/типа атаки', () => {
    const fire = bestiaryIconSvg(entry({ immunities: ['fire'] }));
    const cold = bestiaryIconSvg(entry({ resistances: ['cold'] }));
    const base = bestiaryIconSvg(entry({ attacks: [] }));
    expect(fire).not.toBe(base);
    expect(cold).not.toBe(base);
    expect(fire).not.toBe(cold);
  });

  it('метка типа — в бейдже, легендарные — с золотым кольцом', () => {
    const svg = bestiaryIconSvg(entry({ type: 'dragon', name: 'Adult Red Dragon', legendaryMax: 3 }));
    expect(svg).toContain('translate(70 2)');
    expect(svg).toContain('M10 38 L28 20'); // глиф дракона в бейдже
    expect(svg).toContain('#ffd98a');
    expect(bestiaryIconSvg(entry())).not.toContain('#ffd98a');
  });

  it('data-URL кодирует SVG', () => {
    const url = bestiaryIconUrl(entry());
    expect(url.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true);
    expect(url).not.toContain('<svg');
    expect(decodeURIComponent(url.split(',')[1]!)).toContain('<svg');
  });

  it('аксессуары берутся из описания внешности', () => {
    const horned = bestiaryIconSvg(
      entry({
        key: 'XMM:Minotaur',
        name: 'Minotaur',
        type: 'monstrosity',
        appearance: 'A large humanoid with long curved bull horns and a heavy axe.',
      })
    );
    expect(horned).toContain('M-10 3 C-18 -4');
    const winged = bestiaryIconSvg(
      entry({
        key: 'XMM:Pegasus',
        name: 'Pegasus',
        type: 'celestial',
        appearance: 'A large powerful equine with broad feathered wings.',
      })
    );
    expect(winged).toContain('M-8 -8 C-26 -20');
    const crowned = bestiaryIconSvg(
      entry({ key: 'XMM:King', name: 'King', type: 'humanoid', appearance: 'A medium-sized humanoid with a jeweled crown.' })
    );
    expect(crowned).toContain('M-11 3 L-11 -5');
  });

  it('все существа каталога получают свою иконку', () => {
    const data = bestiaryRaw as unknown as { entries: BestiaryEntry[] };
    const icons = data.entries.map((e) => bestiaryIconSvg(e));
    expect(icons.every((svg) => svg.includes('<svg'))).toBe(true);
    expect(new Set(icons).size).toBe(data.entries.length);
    expect(data.entries.every((e) => e.appearance.length > 10)).toBe(true);
  });
});
