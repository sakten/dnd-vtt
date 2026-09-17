import { S } from './state.mjs';
import { check, sleep } from '../lib/check.mjs';
import { addLibrary, eventOnce, setCharacter, setSheet, spawnToken, waitFor, waitToken } from '../lib/smoke-helpers.mjs';

// Новая концентрация снимает прежнюю зону (Spirit Guardians → Hunger of Hadar).
S.dm.emit('map:bring', S.map1.id);
await waitFor(() => S.lastBring && S.lastBring.activeMapId === S.map1.id);
// Бой с прошлых сценариев не даст кастовать (действие — только в свой ход).
S.dm.emit('combat:end', { mapId: S.map1.id });

let zones = [];
S.player.on('zones:update', ({ mapId, zones: list }) => {
  if (mapId === S.map1.id) zones = list;
});

let latestResources = null;
S.player.on('resources:update', (r) => {
  latestResources = r;
});
// 05-persistence ждёт потраченную кость хитов из 09 — вернём её после смены листа.
const preHitDie = latestResources?.hitDice?.[0]?.current ?? 2;

const casterItem = await addLibrary(S, 'Концентратор-Тест', {
  imageUrl: '/x.png',
  cells: 1,
  round: false,
  description: '',
  initiativeBonus: '',
  isPlayerToken: true,
});
const setChar = await setCharacter(S, casterItem);
check('ok' in setChar, 'концентратор назначен текущим персонажем');
const caster = (await spawnToken(S, { libraryItemId: casterItem, x: 200, y: 200 })).token;

const targetItem = await addLibrary(S, 'Цель-Тест', {
  imageUrl: '/x.png',
  cells: 1,
  round: false,
  description: '',
  initiativeBonus: '',
  hpMax: '30',
  hpCurrent: 30,
  showStats: true,
});
const target = (await spawnToken(S, { libraryItemId: targetItem, x: 230, y: 200, by: 'dm' })).token;
const withTarget = (predicate) => waitToken(S, target.id, predicate, S.dm);
let casterState = caster;
S.dm.on('token:update', (p) => {
  if (p.mapId === S.map1.id && p.token.id === caster.id) casterState = p.token;
});

await setSheet(S, {
  name: 'Концентратор',
  abilities: { str: 8, dex: 14, con: 14, int: 10, wis: 16, cha: 16 },
  proficiencyBonus: '3',
  saves: {},
  skills: {},
  attacks: [],
  classes: [
    { className: 'cleric', level: 5 },
    { className: 'warlock', level: 5 },
  ],
  spells: [
    { key: 'XPHB:Spirit Guardians', className: 'cleric' },
    { key: 'XPHB:Hunger of Hadar', className: 'warlock' },
  ],
});
await waitFor(() => latestResources?.spellSlots?.some((s) => s.level >= 3));

const auraP = withTarget((t) => t.effects.some((e) => e.sourceKey === 'XPHB:Spirit Guardians'));
S.player.emit('spell:cast', {
  mapId: S.map1.id,
  tokenId: caster.id,
  spellKey: 'XPHB:Spirit Guardians',
  slotLevel: 3,
});
await waitFor(() => zones.some((z) => z.sourceKey === 'XPHB:Spirit Guardians'));
await auraP;
check(zones.map((z) => z.sourceKey).includes('XPHB:Spirit Guardians'), 'Spirit Guardians создал зону и ауру на цели');
check(
  !casterState.effects.some((e) => e.sourceKey === 'XPHB:Spirit Guardians' && e.zoneId),
  'аура Spirit Guardians не действует на самого кастера'
);

const auraGoneP = withTarget((t) => !t.effects.some((e) => e.sourceKey === 'XPHB:Spirit Guardians'));
S.player.emit('spell:cast', {
  mapId: S.map1.id,
  tokenId: caster.id,
  spellKey: 'XPHB:Hunger of Hadar',
  slotLevel: 3,
  origin: { x: caster.x + 100, y: caster.y },
});
await waitFor(() => zones.some((z) => z.sourceKey === 'XPHB:Hunger of Hadar'));
await auraGoneP;
const keys = zones.map((z) => z.sourceKey);
check(!keys.includes('XPHB:Spirit Guardians'), `зона Spirit Guardians снята (${keys.join(', ')})`);
check(keys.includes('XPHB:Hunger of Hadar'), 'зона Hunger of Hadar создана');

// Уборка: снять концентрацию, токены и предметы.
const endP = waitFor(() => !zones.some((z) => z.sourceKey === 'XPHB:Hunger of Hadar'));
S.player.emit('spell:endConcentration', { mapId: S.map1.id, tokenId: caster.id });
await endP;
check(true, 'концентрация Hunger of Hadar прекращена');
const casterRemoved = eventOnce(S.player, 'token:remove');
S.dm.emit('token:remove', { mapId: S.map1.id, id: caster.id });
await casterRemoved;
const targetRemoved = eventOnce(S.player, 'token:remove');
S.dm.emit('token:remove', { mapId: S.map1.id, id: target.id });
await targetRemoved;
const libP = eventOnce(S.player, 'library:update');
S.dm.emit('library:remove', casterItem);
await libP;
const libP2 = eventOnce(S.player, 'library:update');
S.dm.emit('library:remove', targetItem);
await libP2;

// Возвращаем лист игрока к состоянию, которое проверяет 05-persistence.
await setSheet(S, {
  name: 'Гоблин-игрок',
  abilities: { str: 8, dex: 14, con: 12, int: 18, wis: 10, cha: 10 },
  proficiencyBonus: '3',
  saves: {},
  skills: {},
  attacks: [],
  classes: [{ className: 'wizard', level: 5 }],
  spells: [{ key: 'XPHB:Fireball', className: 'wizard' }],
});
await waitFor(() => latestResources?.spellSlots?.some((s) => s.level === 1) && latestResources?.hitDice?.length);
S.player.emit('resources:update', {
  ...latestResources,
  hitDice: latestResources.hitDice.map((h, i) => (i === 0 ? { ...h, current: preHitDie } : h)),
});
await sleep(200);
