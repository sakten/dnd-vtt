import type { AutomationSpec } from '../spec';

/** Призывы: шаблоны каталога бестиария (R16 шаг 4, блок `summon`). */
export const SUMMONS_SPECS: Record<string, AutomationSpec> = {
  'XPHB:Find Familiar': {
    key: 'XPHB:Find Familiar',
    name: 'Find Familiar',
    primary: 'summon',
    summon: { initiative: 'own', fromFamiliar: true, duration: { type: 'permanent' }, baseLevel: 1 },
  },
  'XPHB:Find Steed': {
    key: 'XPHB:Find Steed',
    name: 'Find Steed',
    primary: 'summon',
    summon: { initiative: 'afterCaster', creature: 'XPHB:Otherworldly Steed', baseLevel: 2 },
  },
  'XPHB:Summon Beast': {
    key: 'XPHB:Summon Beast',
    name: 'Summon Beast',
    primary: 'summon',
    concentration: true,
    summon: { initiative: 'afterCaster', creature: 'XPHB:Bestial Spirit', baseLevel: 2 },
  },
  'XPHB:Summon Fey': {
    key: 'XPHB:Summon Fey',
    name: 'Summon Fey',
    primary: 'summon',
    concentration: true,
    summon: { initiative: 'afterCaster', creature: 'XPHB:Fey Spirit', baseLevel: 3 },
  },
  'XPHB:Summon Undead': {
    key: 'XPHB:Summon Undead',
    name: 'Summon Undead',
    primary: 'summon',
    concentration: true,
    summon: { initiative: 'afterCaster', creature: 'XPHB:Undead Spirit', baseLevel: 3 },
  },
  'XPHB:Summon Aberration': {
    key: 'XPHB:Summon Aberration',
    name: 'Summon Aberration',
    primary: 'summon',
    concentration: true,
    summon: { initiative: 'afterCaster', creature: 'XPHB:Aberrant Spirit', baseLevel: 4 },
  },
  'XPHB:Summon Construct': {
    key: 'XPHB:Summon Construct',
    name: 'Summon Construct',
    primary: 'summon',
    concentration: true,
    summon: { initiative: 'afterCaster', creature: 'XPHB:Construct Spirit', baseLevel: 4 },
  },
  'XPHB:Summon Elemental': {
    key: 'XPHB:Summon Elemental',
    name: 'Summon Elemental',
    primary: 'summon',
    concentration: true,
    summon: { initiative: 'afterCaster', creature: 'XPHB:Elemental Spirit', baseLevel: 4 },
  },
  'XPHB:Giant Insect': {
    key: 'XPHB:Giant Insect',
    name: 'Giant Insect',
    primary: 'summon',
    concentration: true,
    summon: { initiative: 'afterCaster', creature: 'XPHB:Giant Insect', baseLevel: 4 },
  },
  'XPHB:Summon Celestial': {
    key: 'XPHB:Summon Celestial',
    name: 'Summon Celestial',
    primary: 'summon',
    concentration: true,
    summon: { initiative: 'afterCaster', creature: 'XPHB:Celestial Spirit', baseLevel: 5 },
  },
  'XPHB:Summon Dragon': {
    key: 'XPHB:Summon Dragon',
    name: 'Summon Dragon',
    primary: 'summon',
    concentration: true,
    summon: { initiative: 'afterCaster', creature: 'XPHB:Draconic Spirit', baseLevel: 5 },
  },
  'XPHB:Summon Fiend': {
    key: 'XPHB:Summon Fiend',
    name: 'Summon Fiend',
    primary: 'summon',
    concentration: true,
    summon: { initiative: 'afterCaster', creature: 'XPHB:Fiendish Spirit', baseLevel: 6 },
  },
};
