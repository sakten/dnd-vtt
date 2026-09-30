import { io } from 'socket.io-client';
import { S } from './state.mjs';
import { check, sleep } from '../lib/check.mjs';
import { eventOnce, waitFor, waitMsg, joinAndAck, addLibrary, setCharacter, setSheet, spawnToken, waitToken } from '../lib/smoke-helpers.mjs';

// Свой игрок: не трогаем лист/кастомы smoke-p1 (05-persistence проверяет состав комнаты).
const p4 = io(S.URL);
await waitFor(() => p4.connected);
await joinAndAck(p4, (cb) =>
  p4.emit('room:join', { code: S.created.room.code, name: 'Игрок-19', clientId: 'smoke-p4' }, cb)
);

S.dm.emit('map:bring', S.map1.id);
await waitFor(() => S.lastBring && S.lastBring.activeMapId === S.map1.id);

const casterItem = await addLibrary(S, 'Каст-Кастом', {
  imageUrl: '/x.png',
  cells: 1,
  round: false,
  description: '',
  initiativeBonus: '',
  isPlayerToken: true,
});
const setChar = await setCharacter(S, casterItem, p4);
check('ok' in setChar, 'кастер кастомного сценария назначен');
const caster = (await spawnToken(S, { libraryItemId: casterItem, x: 200, y: 200, by: 'dm', observe: 'dm' })).token;

const dummyItem = await addLibrary(S, 'Манекен-Кастом', {
  imageUrl: '/x.png',
  cells: 1,
  round: false,
  description: '',
  initiativeBonus: '',
  ac: '10',
  hpMax: '30',
  showStats: true,
});
const dummy = (await spawnToken(S, { libraryItemId: dummyItem, x: 250, y: 200, by: 'dm', observe: 'dm' })).token;

// Импорт копии Fireball: огонь → холод (extends+patch), запись уходит в комнату всем.
const CUSTOM_KEY = 'CUSTOM:Ледяной шар';
const customP = eventOnce(p4, 'room:customSpecs');
S.dm.emit('custom:import', {
  json: JSON.stringify({
    extends: 'XPHB:Fireball',
    key: CUSTOM_KEY,
    name: 'Ледяной шар',
    patch: { 'damage.types': ['cold'] },
  }),
});
const customSpecs = await customP;
check(
  customSpecs.filter((s) => s.key === CUSTOM_KEY).length === 1,
  'импорт кастома разослан комнате (room:customSpecs)'
);

await setSheet(
  S,
  {
    name: 'Каст',
    abilities: { str: 10, dex: 10, con: 10, int: 18, wis: 10, cha: 10 },
    proficiencyBonus: '3',
    saves: {},
    skills: {},
    attacks: [],
    classes: [{ className: 'wizard', level: 5 }],
    spells: [{ key: CUSTOM_KEY, className: 'wizard' }],
  },
  p4
);

// Каст кастома: сервер находит запись в комнате, урон помечен холодом.
const dmgMsgP = waitMsg(p4, (m) => m.kind === 'roll' && m.rollKind === 'damage');
const hurtP = waitToken(S, dummy.id, (t) => t.hpCurrent < 30, S.dm);
p4.emit('spell:cast', {
  mapId: S.map1.id,
  tokenId: caster.id,
  spellKey: CUSTOM_KEY,
  slotLevel: 3,
  origin: { x: dummy.x, y: dummy.y },
});
const dmgMsg = await dmgMsgP;
check(dmgMsg.labelParams?.damageType === 'cold', `урон кастома типизирован холодом (${dmgMsg.labelParams?.damageType})`);
const hurt = await hurtP;
check(hurt.hpCurrent < 30, `манекен получил урон кастомом (${hurt.hpCurrent}/30)`);

// Каст после удаления кастома — явная ошибка, не тихий выход.
const removedP = eventOnce(S.dm, 'room:customSpecs');
S.dm.emit('custom:remove', CUSTOM_KEY);
const afterRemove = await removedP;
check(afterRemove.every((s) => s.key !== CUSTOM_KEY), 'кастом удалён из комнаты (room:customSpecs)');
const errP = eventOnce(p4, 'chat:error');
p4.emit('spell:cast', { mapId: S.map1.id, tokenId: caster.id, spellKey: CUSTOM_KEY, slotLevel: 3, origin: { x: dummy.x, y: dummy.y } });
const err = await errP;
check(err?.code === 'spellNotFound', 'каст удалённого кастома отклонён (spellNotFound)');

// Уборка сцены: 05-persistence проверяет состав карты/библиотеки.
const casterRemoved = eventOnce(S.dm, 'token:remove');
S.dm.emit('token:remove', { mapId: S.map1.id, id: caster.id });
await casterRemoved;
const dummyRemoved = eventOnce(S.dm, 'token:remove');
S.dm.emit('token:remove', { mapId: S.map1.id, id: dummy.id });
await dummyRemoved;
const lib1P = eventOnce(S.dm, 'library:update');
S.dm.emit('library:remove', casterItem);
await lib1P;
const lib2P = eventOnce(S.dm, 'library:update');
S.dm.emit('library:remove', dummyItem);
await lib2P;
await sleep(200);
p4.close();
