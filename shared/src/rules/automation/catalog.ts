import type { AutomationDef } from '../../domain/automation';
import { chipSpell, directionAction, manualSpell } from './header';

export const AUTOMATION_SPELLS: Record<string, AutomationDef> = {
  // Polymorph, Freedom of Movement, Protection from Evil and Good и Otto's Irresistible
  // Dance — спеки (батч Е): shape, флаги движения, conditionImmunitiesFrom, saveSuccess.
  // Lesser Restoration и Protection from Poison — спеки (батч `endConditions`).
  // Daylight/Moonbeam/Flaming Sphere/Faithful Hound — спеки (батч `zone`-локаций):
  // свет, перемещаемые сферы и пёс-страж с действием «Переместить».
  // Sleep и Web — спеки (батч `escape`/`escalate`): эскалация сна и выпутывание.
  // Контроль (спас → состояние); «до конца следующего хода» трактуется движком
  // как до начала следующего хода источника.
  // Charm Person/Charm Monster/Animal Friendship/Suggestion — manual: «очарован»
  // в движке не имеет авто-эффектов, поведение (не атаковать очаровавшего,
  // выполнять внушение) не автоматизировано. Вернуться, когда будет механика
  // charmed/отношений.
  // Protection from Poison — спек (батч `endConditions`); Otto's и Protection from
  // Evil and Good — спеки (батч Е). Primordial Ward и Fount of Moonlight — тоже спеки:
  // боевых записей в каталоге не осталось, только manual/chip-замки.
  // Darkness/Fog Cloud/Darkvision — спеки (батч `vision`): флаги зон и сенсы эффекта.
  // Crusader's Mantle и Holy Weapon — спеки (батч `zone`-локаций): аура союзникам и
  // носитель с выданным бонусным действием «Разряд».
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
