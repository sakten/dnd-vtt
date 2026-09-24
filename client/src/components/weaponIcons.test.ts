import { describe, expect, it } from 'vitest';
import weaponsRaw from '../../../shared/src/data/weapons.json';
import { weaponIconId } from './WeaponIcon';

const weapons = (weaponsRaw as unknown as { weapons: { name: string }[] }).weapons;

describe('иконки оружия', () => {
  it('каждое оружие каталога получает свою иконку', () => {
    const undetected = weapons.filter((w) => weaponIconId(w.name) === 'default');
    expect(undetected.map((w) => w.name)).toEqual([]);
  });

  it('тип определяется по названию (EN)', () => {
    expect(weaponIconId('Longsword')).toBe('longsword');
    expect(weaponIconId('Greatsword')).toBe('greatsword');
    expect(weaponIconId('Shortsword')).toBe('shortsword');
    expect(weaponIconId('Rapier')).toBe('rapier');
    expect(weaponIconId('Scimitar')).toBe('scimitar');
    expect(weaponIconId('Sickle')).toBe('sickle');
    expect(weaponIconId('Dagger')).toBe('dagger');
    expect(weaponIconId('Greataxe')).toBe('greataxe');
    expect(weaponIconId('Battleaxe')).toBe('battleaxe');
    expect(weaponIconId('Handaxe')).toBe('handaxe');
    expect(weaponIconId('Halberd')).toBe('halberd');
    expect(weaponIconId('Glaive')).toBe('glaive');
    expect(weaponIconId('Pike')).toBe('pike');
    expect(weaponIconId('Spear')).toBe('spear');
    expect(weaponIconId('Javelin')).toBe('javelin');
    expect(weaponIconId('Lance')).toBe('lance');
    expect(weaponIconId('Trident')).toBe('trident');
    expect(weaponIconId('Mace')).toBe('mace');
    expect(weaponIconId('Morningstar')).toBe('morningstar');
    expect(weaponIconId('Club')).toBe('club');
    expect(weaponIconId('Greatclub')).toBe('greatclub');
    expect(weaponIconId('Quarterstaff')).toBe('quarterstaff');
    expect(weaponIconId('Warhammer')).toBe('warhammer');
    expect(weaponIconId('Maul')).toBe('maul');
    expect(weaponIconId('Flail')).toBe('flail');
    expect(weaponIconId('War Pick')).toBe('warpick');
    expect(weaponIconId('Whip')).toBe('whip');
    expect(weaponIconId('Net')).toBe('net');
    expect(weaponIconId('Sling')).toBe('sling');
    expect(weaponIconId('Dart')).toBe('dart');
    expect(weaponIconId('Blowgun')).toBe('blowgun');
    expect(weaponIconId('Longbow')).toBe('longbow');
    expect(weaponIconId('Shortbow')).toBe('shortbow');
    expect(weaponIconId('Light Crossbow')).toBe('crossbow');
    expect(weaponIconId('Heavy Crossbow')).toBe('crossbow');
    expect(weaponIconId('Hand Crossbow')).toBe('handcrossbow');
    expect(weaponIconId('Unarmed Strike')).toBe('fist');
  });

  it('понимает русские названия и природные атаки', () => {
    expect(weaponIconId('Длинный меч')).toBe('longsword');
    expect(weaponIconId('Боевой топор')).toBe('battleaxe');
    expect(weaponIconId('Кинжал')).toBe('dagger');
    expect(weaponIconId('Метательное копьё')).toBe('javelin');
    expect(weaponIconId('Короткий лук')).toBe('shortbow');
    expect(weaponIconId('Укус')).toBe('bite');
    expect(weaponIconId('Когти')).toBe('claws');
    expect(weaponIconId('Жало')).toBe('sting');
    expect(weaponIconId('Rend')).toBe('rend');
    expect(weaponIconId('Claw')).toBe('claws');
    expect(weaponIconId('Slam')).toBe('slam');
    expect(weaponIconId('Раздирание')).toBe('rend');
    expect(weaponIconId('Хвост')).toBe('tail');
    expect(weaponIconId('Щупальца')).toBe('tentacle');
    expect(weaponIconId('Разряд')).toBe('default');
    expect(weaponIconId('Клинок тени')).toBe('default');
    expect(weaponIconId('Клинок тени (метание)')).toBe('dart');
  });
});
