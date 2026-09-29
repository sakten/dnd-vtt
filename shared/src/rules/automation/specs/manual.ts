import type { AutomationSpec } from '../spec';

/** Ручные заклинания (`primary: 'manual'`): плашка/действия мастера, авто-механики нет. */
export const MANUAL_SPECS: Record<string, AutomationSpec> = {
  // Animate Objects: до 10 предметов со своими статблоками — механика отдельным срезом.
  // Без спека деривация из данных давала ложный авто-урон 1d4 по цели.
  'XPHB:Animate Objects': {
    key: 'XPHB:Animate Objects',
    name: 'Animate Objects',
    primary: 'manual',
    concentration: true,
  },

  // Класс H аудита: «нет типа» (решение владельца, сессия 13) — не автоматизируем.
  // В данных у всех `automation: 'full'`, но механики нет — без явного спека деривация
  // давала ложный спас/авто-урон. Ray of Enfeeblement отложен, но выключен так же;
  // «почти выразимо» (Bestow Curse, Arcane Hand, Heroes' Feast) остаются в TODO.
  'XPHB:Phantasmal Force': { key: 'XPHB:Phantasmal Force', name: 'Phantasmal Force', primary: 'manual', concentration: true },
  'XPHB:Control Water': { key: 'XPHB:Control Water', name: 'Control Water', primary: 'manual', concentration: true },
  'XGE:Transmute Rock': { key: 'XGE:Transmute Rock', name: 'Transmute Rock', primary: 'manual' },
  'XPHB:Ray of Enfeeblement': { key: 'XPHB:Ray of Enfeeblement', name: 'Ray of Enfeeblement', primary: 'manual', concentration: true },
  'XPHB:Meld into Stone': { key: 'XPHB:Meld into Stone', name: 'Meld into Stone', primary: 'manual' },
  'XPHB:Forbiddance': { key: 'XPHB:Forbiddance', name: 'Forbiddance', primary: 'manual' },
  'XGE:Create Homunculus': { key: 'XGE:Create Homunculus', name: 'Create Homunculus', primary: 'manual' },
  'XPHB:Dream': { key: 'XPHB:Dream', name: 'Dream', primary: 'manual' },
  'XPHB:Contact Other Plane': { key: 'XPHB:Contact Other Plane', name: 'Contact Other Plane', primary: 'manual' },
  'XPHB:Geas': { key: 'XPHB:Geas', name: 'Geas', primary: 'manual' },
  'XGE:Soul Cage': { key: 'XGE:Soul Cage', name: 'Soul Cage', primary: 'manual' },

  // Класс B4/C/F/G аудита (сессия 14): данные давали ложную деривацию —
  // Tenser's — спасом 2d12 (это добавка к оружию), Investitures/Guardian of Nature/
  // Alter Self/Enlarge-Reduce — «уроном» из тегов, стены шли generic-спасом без
  // геометрии, Glyph — спасом без триггера. Лочим до реализации механик
  // (TODO_SPELLS B4/C/F/G), чтобы «зелёный» не врал.
  "XGE:Tenser's Transformation": { key: "XGE:Tenser's Transformation", name: 'Transformation', primary: 'manual', concentration: true },
  'XGE:Investiture of Flame': { key: 'XGE:Investiture of Flame', name: 'Investiture of Flame', primary: 'manual', concentration: true },
  'XGE:Investiture of Ice': { key: 'XGE:Investiture of Ice', name: 'Investiture of Ice', primary: 'manual', concentration: true },
  'XGE:Investiture of Wind': { key: 'XGE:Investiture of Wind', name: 'Investiture of Wind', primary: 'manual', concentration: true },
  'XGE:Guardian of Nature': { key: 'XGE:Guardian of Nature', name: 'Guardian of Nature', primary: 'manual', concentration: true },
  'XPHB:Alter Self': { key: 'XPHB:Alter Self', name: 'Alter Self', primary: 'manual', concentration: true },
  'XPHB:Enlarge/Reduce': { key: 'XPHB:Enlarge/Reduce', name: 'Enlarge/Reduce', primary: 'manual', concentration: true },
  'XPHB:Conjure Elemental': { key: 'XPHB:Conjure Elemental', name: 'Conjure Elemental', primary: 'manual', concentration: true },
  // Wind Wall: стена 50×15 без геометрии и блокировок (туман/дым, стрелы, мелкие
  // летуны, газообразные) — generic-спас 4к8 по одной цели врал; лочим до реализации.
  'XPHB:Wind Wall': { key: 'XPHB:Wind Wall', name: 'Wind Wall', primary: 'manual', concentration: true },
  'XPHB:Glyph of Warding': { key: 'XPHB:Glyph of Warding', name: 'Glyph of Warding', primary: 'manual' },

  // Решение владельца (сессия 14): очарование — ручная механика, каст вешает только
  // плашку «Очарован»; поведение/перемещение ведёт мастер, красный маркер не рисуется.
  'XPHB:Charm Monster': {
    key: 'XPHB:Charm Monster',
    name: 'Charm Monster',
    primary: 'manual',
    manual: { byDesign: true, chip: 'charmed' },
    targeting: { kind: 'creature', range: 30 },
  },
  // Crown of Madness: очарование, вынужденные атаки ведёт мастер; Enemies Abound:
  // в RAW состояния нет — плашка без глифа (решение владельца, сессия 18).
  'XPHB:Crown of Madness': {
    key: 'XPHB:Crown of Madness',
    name: 'Crown of Madness',
    primary: 'manual',
    concentration: true,
    manual: { byDesign: true, chip: 'charmed' },
    targeting: { kind: 'creature', range: 120 },
  },
  'XGE:Enemies Abound': {
    key: 'XGE:Enemies Abound',
    name: 'Enemies Abound',
    primary: 'manual',
    concentration: true,
    manual: { byDesign: true },
    targeting: { kind: 'creature', range: 120 },
  },
  'XPHB:Compulsion': {
    key: 'XPHB:Compulsion',
    name: 'Compulsion',
    primary: 'manual',
    concentration: true,
    manual: {
      byDesign: true,
      chip: 'charmed',
      chipActions: [
        { id: 'direction-up', name: 'Вверх', cost: 'bonus', primary: 'utility', utility: { kind: 'direction', direction: 'up' } },
        { id: 'direction-down', name: 'Вниз', cost: 'bonus', primary: 'utility', utility: { kind: 'direction', direction: 'down' } },
        { id: 'direction-left', name: 'Влево', cost: 'bonus', primary: 'utility', utility: { kind: 'direction', direction: 'left' } },
        { id: 'direction-right', name: 'Вправо', cost: 'bonus', primary: 'utility', utility: { kind: 'direction', direction: 'right' } },
      ],
    },
    targeting: { kind: 'creature', range: 30 },
  },
};
