import type { AutomationDef, AutomationEffect, AutomationPayload, ZoneDef } from '../../domain/automation';
import { CHILL_TOUCH, CONCENTRATION, EVIL_GOOD_TYPES, PERMANENT, chipSpell, directionAction, manualSpell, spellEffect } from './header';

export const AUTOMATION_SPELLS: Record<string, AutomationDef> = {
  /** Polymorph (XPHB 2024): спас WIS, форма-зверь с CR ≤ CR/уровня цели, концентрация. */
  'XPHB:Polymorph': {
    key: 'XPHB:Polymorph',
    name: 'Polymorph',
    resolution: 'save',
    concentration: true,
    save: { ability: 'wis' },
    shape: { kind: 'polymorph', crByTarget: true },
  },
  /** Lesser Restoration и Protection from Poison — спеки (батч `endConditions`). */
  /** Freedom of Movement: иммунитет к параличу/опутыванию, скорость и местность (1 час). */
  'XPHB:Freedom of Movement': spellEffect('XPHB:Freedom of Movement', 'Freedom of Movement', [
    {
      name: 'Freedom of Movement',
      duration: { type: 'rounds', rounds: 600 },
      to: 'targets',
      modifiers: [],
      conditionImmunities: ['paralyzed', 'restrained'],
      immuneToSpeedReduction: true,
      ignoresDifficultTerrain: true,
    },
  ]),
  // Daylight/Moonbeam/Flaming Sphere/Faithful Hound — спеки (батч `zone`-локаций):
  // свет, перемещаемые сферы и пёс-страж с действием «Переместить».
  // Sleep и Web — спеки (батч `escape`/`escalate`): эскалация сна и выпутывание.
  // Контроль (спас → состояние); «до конца следующего хода» трактуется движком
  // как до начала следующего хода источника.
  // Charm Person/Charm Monster/Animal Friendship/Suggestion — manual: «очарован»
  // в движке не имеет авто-эффектов, поведение (не атаковать очаровавшего,
  // выполнять внушение) не автоматизировано. Вернуться, когда будет механика
  // charmed/отношений.
  /**
   * Banishment (XPHB 2024): спас CHA; провал — изгнание на 10 раундов (1 мин,
   * концентрация). Возврат при снятии эффекта; экстрапланетные по истечении
   * полного срока не возвращаются (удаляются) — решает исполнение тика.
   */
  /** Irresistible Dance (XPHB): танец на месте; провал — Charmed и повторный спас действием «Собраться». */
  "XPHB:Otto's Irresistible Dance": {
    key: "XPHB:Otto's Irresistible Dance",
    name: 'Irresistible Dance',
    resolution: 'effect',
    concentration: true,
    save: { ability: 'wis' },
    targeting: { kind: 'creature', range: 30 },
    saveSuccess: [
      {
        name: 'Irresistible Dance',
        duration: { type: 'endOfTurn', of: 'target' },
        to: 'targets',
        modifiers: [{ target: 'speed', mode: 'multiply', value: 0 }],
      },
    ],
    effects: [
      {
        name: 'Irresistible Dance',
        duration: CONCENTRATION,
        concentration: true,
        to: 'targets',
        // Чип `charmed` не ставим: у состояния нет движковой механики (deploy-инвариант),
        // эффект целиком выражен модификаторами ниже + действие «Собраться».
        modifiers: [
          { target: 'speed', mode: 'multiply', value: 0 },
          { target: 'save', mode: 'disadvantage', filter: { ability: 'dex' } },
          { target: 'attack', mode: 'disadvantage', filter: { direction: 'self' } },
          { target: 'attack', mode: 'advantage', filter: { direction: 'against' } },
        ],
        escape: {
          kind: 'save',
          ability: 'wis',
          dc: 10,
          label: 'Собраться',
          iconKey: "XPHB:Otto's Irresistible Dance:stopDancing",
        },
      },
    ],
  },
  // Protection from Poison — спек (батч `endConditions`): снятие отравления при касте.
  /** Protection from Evil and Good (XPHB): помеха атакам шести типов, иммунитет к charmed/frightened от них. */
  'XPHB:Protection from Evil and Good': {
    key: 'XPHB:Protection from Evil and Good',
    name: 'Protection from Evil and Good',
    resolution: 'effect',
    concentration: true,
    targeting: { kind: 'creature', range: 5 },
    effects: [
      {
        name: 'Protection from Evil and Good',
        duration: CONCENTRATION,
        concentration: true,
        to: 'targets',
        modifiers: [
          {
            target: 'attack',
            mode: 'disadvantage',
            filter: { direction: 'against', creatureTypes: EVIL_GOOD_TYPES },
          },
          { target: 'save', mode: 'advantage', filter: { conditions: ['charmed', 'frightened'] } },
        ],
        conditionImmunitiesFrom: { conditions: ['charmed', 'frightened'], types: EVIL_GOOD_TYPES },
      },
    ],
  },
  // Primordial Ward (XGE): сопротивления 5 типам; реакцией на урон типа — иммунитет к нему
  // (движок `ward` + `offerDamageReactions`, включая спровоцировавший урон).
  'XGE:Primordial Ward': {
    key: 'XGE:Primordial Ward',
    name: 'Primordial Ward',
    resolution: 'effect',
    concentration: true,
    effects: [
      {
        name: 'Primordial Ward',
        duration: PERMANENT,
        concentration: true,
        to: 'self',
        modifiers: ['acid', 'cold', 'fire', 'lightning', 'thunder'].map((type) => ({
          target: 'damage' as const,
          mode: 'resistance' as const,
          value: 0,
          filter: { damageType: type },
        })),
        ward: ['acid', 'cold', 'fire', 'lightning', 'thunder'],
      },
    ],
  },
  // Darkness/Fog Cloud/Darkvision — спеки (батч `vision`): флаги зон и сенсы эффекта.
  // Crusader's Mantle и Holy Weapon — спеки (батч `zone`-локаций): аура союзникам и
  // носитель с выданным бонусным действием «Разряд».
  /**
   * Fount of Moonlight (XPHB): сияние 20/20, сопротивление излучению, +2d6 излучением
   * ближним атакам (в т.ч. заклинательным — контекст урона с `attackType`) и реакция
   * «вспышка» на урон от видимого существа в 60 фт (CON-спас, слепота до след. хода).
   */
  'XPHB:Fount of Moonlight': {
    key: 'XPHB:Fount of Moonlight',
    name: 'Fount of Moonlight',
    resolution: 'effect',
    concentration: true,
    effects: [
      {
        name: 'Fount of Moonlight',
        duration: CONCENTRATION,
        concentration: true,
        to: 'self',
        modifiers: [
          { target: 'damage', mode: 'add', value: '2d6radiant', filter: { attackType: 'melee' } },
          { target: 'damage', mode: 'resistance', value: 0, filter: { damageType: 'radiant' } },
        ],
        light: { bright: 20, dim: 20 },
        damageReaction: { ability: 'con', feet: 60, condition: 'blinded' },
      },
    ],
  },
  // Animate Objects: до 10 предметов со своими статблоками — механика отдельным
  // срезом. Без записи деривация из данных давала ложный авто-урон 1d4 по цели.
  'XPHB:Animate Objects': {
    key: 'XPHB:Animate Objects',
    name: 'Animate Objects',
    resolution: 'manual',
    concentration: true,
  },
  // Класс H аудита: «нет типа» (решение владельца, сессия 13) — не автоматизируем.
  // В данных у всех `automation: 'full'`, но механики нет — без явной записи деривация
  // давала ложный спас/авто-урон. Ray of Enfeeblement отложен, но выключен так же;
  // «почти выразимо» (Bestow Curse, Arcane Hand, Heroes' Feast) остаются в TODO.
  'XPHB:Phantasmal Force': manualSpell('XPHB:Phantasmal Force', 'Phantasmal Force', true),
  'XPHB:Control Water': manualSpell('XPHB:Control Water', 'Control Water', true),
  'XGE:Transmute Rock': manualSpell('XGE:Transmute Rock', 'Transmute Rock'),
  'XPHB:Ray of Enfeeblement': manualSpell('XPHB:Ray of Enfeeblement', 'Ray of Enfeeblement', true),
  'XPHB:Meld into Stone': manualSpell('XPHB:Meld into Stone', 'Meld into Stone'),
  'XPHB:Forbiddance': manualSpell('XPHB:Forbiddance', 'Forbiddance'),
  'XGE:Create Homunculus': manualSpell('XGE:Create Homunculus', 'Create Homunculus'),
  'XPHB:Dream': manualSpell('XPHB:Dream', 'Dream'),
  'XPHB:Contact Other Plane': manualSpell('XPHB:Contact Other Plane', 'Contact Other Plane'),
  'XPHB:Geas': manualSpell('XPHB:Geas', 'Geas'),
  'XGE:Soul Cage': manualSpell('XGE:Soul Cage', 'Soul Cage'),
  // Класс B4/C/F/G аудита (сессия 14): данные давали ложную деривацию —
  // Tenser's — спасом 2d12 (это добавка к оружию), Investitures/Guardian of Nature/
  // Alter Self/Enlarge-Reduce — «уроном» из тегов, стены шли generic-спасом без
  // геометрии, Glyph — спасом без триггера. Лочим до реализации
  // механик (TODO_SPELLS B4/C/F/G), чтобы «зелёный» не врал.
  // Реализованы билдерами: Dimension Door/Thunder Step, Healing Spirit/Cordon of Arrows/
  // Storm Sphere, Wall of Thorns/Wall of Fire/Blade Barrier/Wall of Sand/Wall of Ice.
  "XGE:Tenser's Transformation": manualSpell("XGE:Tenser's Transformation", "Tenser's Transformation", true),
  'XGE:Investiture of Flame': manualSpell('XGE:Investiture of Flame', 'Investiture of Flame', true),
  'XGE:Investiture of Ice': manualSpell('XGE:Investiture of Ice', 'Investiture of Ice', true),
  'XGE:Investiture of Wind': manualSpell('XGE:Investiture of Wind', 'Investiture of Wind', true),
  'XGE:Guardian of Nature': manualSpell('XGE:Guardian of Nature', 'Guardian of Nature', true),
  'XPHB:Alter Self': manualSpell('XPHB:Alter Self', 'Alter Self', true),
  'XPHB:Enlarge/Reduce': manualSpell('XPHB:Enlarge/Reduce', 'Enlarge/Reduce', true),
  'XPHB:Conjure Elemental': manualSpell('XPHB:Conjure Elemental', 'Conjure Elemental', true),
  // Wind Wall: стена 50×15 без геометрии и блокировок (туман/дым, стрелы, мелкие
  // летуны, газообразные) — generic-спас 4к8 по одной цели врал; лочим до реализации.
  'XPHB:Wind Wall': manualSpell('XPHB:Wind Wall', 'Wind Wall', true),
  'XPHB:Glyph of Warding': manualSpell('XPHB:Glyph of Warding', 'Glyph of Warding'),
  // Решение владельца (сессия 14): очарование — ручная механика, каст вешает только
  // плашку «Очарован»; поведение/перемещение ведёт мастер, красный маркер не рисуется.
  'XPHB:Charm Monster': chipSpell('XPHB:Charm Monster', 'Charm Monster', 'charmed'),
  // Crown of Madness: очарование, вынужденные атаки ведёт мастер; Enemies Abound:
  // в RAW состояния нет — плашка без глифа (решение владельца, сессия 18).
  'XPHB:Crown of Madness': chipSpell('XPHB:Crown of Madness', 'Crown of Madness', 'charmed', {
    concentration: true,
    range: 120,
  }),
  'XGE:Enemies Abound': chipSpell('XGE:Enemies Abound', 'Enemies Abound', null, {
    concentration: true,
    range: 120,
  }),
  'XPHB:Compulsion': chipSpell('XPHB:Compulsion', 'Compulsion', 'charmed', {
    concentration: true,
    actions: [
      directionAction('Вверх', 'up'),
      directionAction('Вниз', 'down'),
      directionAction('Влево', 'left'),
      directionAction('Вправо', 'right'),
    ],
  }),
};

/**
 * Дополнения к деривации данных: эффекты/зона поверх «атака/спасбросок/автоурон»
 * (Shocking Grasp). Для manual-спеллов не применяются. В зоне кости `'$spell'`
 * подставляются выражением урона заклинания (апкаст/кантрип).
 */
export interface AutomationAddition {
  effects?: AutomationEffect[];
  zone?: ZoneDef;
  /** Массовая цель без области (Mass Healing Word/Prayer of Healing/Mass Cure Wounds). */
  targets?: number;
  /** Прибавить модификатор заклинательной характеристики к лечению (Cure Wounds и др.). */
  healAbilityMod?: boolean;
  /** Harm: снижение максимума HP цели на фактически полученный ею урон. */
  maxHpFromDamage?: boolean;
}

export const AUTOMATION_ADDITIONS: Record<string, AutomationAddition> = {
  'XPHB:Shocking Grasp': {
    effects: [
      {
        name: 'Shocking Grasp',
        duration: { type: 'endOfTurn', of: 'target' },
        to: 'targets',
        modifiers: [],
        restrictions: { noOpportunityAttacks: true },
      },
    ],
  },
  'XPHB:Cure Wounds': { healAbilityMod: true },
  'XPHB:Healing Word': { healAbilityMod: true },
  'XPHB:Mass Healing Word': { targets: 6, healAbilityMod: true },
  'XPHB:Prayer of Healing': { targets: 5 },
  'XPHB:Mass Cure Wounds': { targets: 6, healAbilityMod: true },
  'XPHB:Chill Touch': { effects: [CHILL_TOUCH] },
  'XPHB:Harm': { maxHpFromDamage: true },
};

/** Подстановка выражения урона заклинания в кости триггеров зоны (`'$spell'`). */
export function resolveZoneDice(zone: ZoneDef, expression: string): ZoneDef {
  const triggers = zone.triggers;
  if (!triggers) return zone;
  const sub = (payload: AutomationPayload | undefined): AutomationPayload | undefined =>
    payload?.damage?.dice === '$spell' ? { ...payload, damage: { ...payload.damage, dice: expression } } : payload;
  return {
    ...zone,
    triggers: {
      ...triggers,
      enter: sub(triggers.enter),
      exit: sub(triggers.exit),
      startOfTurn: sub(triggers.startOfTurn),
      endOfTurn: sub(triggers.endOfTurn),
    },
  };
}
