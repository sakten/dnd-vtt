import { S } from './state.mjs';
import { check, sleep } from '../lib/check.mjs';
import { eventOnce, waitFor, waitMsg, addLibrary } from '../lib/smoke-helpers.mjs';


S.dm.emit('library:add', {
  name: 'Гоблин',
  imageUrl: '/uploads/goblin.png',
  cells: 2,
  round: true,
  description: 'Зелёный',
  initiativeBonus: '+2',
});
await waitFor(() => S.lastLibrary && S.lastLibrary.length === 1);
check(
  S.lastLibrary[0].name === 'Гоблин' &&
    S.lastLibrary[0].cells === 2 &&
    S.lastLibrary[0].description === 'Зелёный' &&
    S.lastLibrary[0].round === true &&
    S.lastLibrary[0].initiativeBonus === '+2',
  'библиотека общая: игрок получил токен от DM (со свойствами)'
);
S.player.emit('library:update', { id: S.lastLibrary[0].id, patch: { cells: 3 } });
await waitFor(() => S.lastLibrary && S.lastLibrary[0]?.cells === 3);
check(S.lastLibrary[0].cells === 3, 'игрок может менять свойства предмета в общей библиотеке');

const goblinItem = await addLibrary(S, 'Гоблин-воин', {
  imageUrl: '/uploads/fake.png',
  cells: 1,
  round: false,
  description: '',
  initiativeBonus: '',
});
S.dm.emit('token:add', { mapId: S.map1.id, libraryItemId: goblinItem, x: 100, y: 100 });
const tokenAdd = await eventOnce(S.player, 'token:add');
check(tokenAdd.token.name === 'Гоблин-воин', 'token add broadcast');
check(tokenAdd.mapId === S.map1.id, 'токен попал на нужную карту');
check(tokenAdd.token.cells === 1 && tokenAdd.token.w === 50, 'токен по умолчанию 1x1 (50px)');
S.token = tokenAdd.token;

const dragonItem = await addLibrary(S, 'Дракон', {
  imageUrl: '/uploads/fake.png',
  cells: 3,
  round: true,
  description: 'Большой',
  initiativeBonus: '',
});
S.dm.emit('token:add', { mapId: S.map1.id, libraryItemId: dragonItem, x: 300, y: 300 });
const bigAdd = await eventOnce(S.player, 'token:add');
check(
  bigAdd.token.cells === 3 && bigAdd.token.w === 150 && bigAdd.token.round === true && bigAdd.token.description === 'Большой',
  'свойства перетащенного токена наследуются из библиотеки'
);

S.dm.emit('token:move', { mapId: S.map1.id, id: S.token.id, x: 250, y: 300 });
const moved = await eventOnce(S.dm, 'token:update');
check(moved.token.id === S.token.id && moved.token.x === 250 && moved.token.y === 300, 'token move broadcast');

const heroItem = await addLibrary(S, 'Герой-Тест', {
  imageUrl: '/uploads/hero.png',
  cells: 1,
  round: false,
  description: '',
  initiativeBonus: '',
  isPlayerToken: true,
  owner: '',
});
const badSet = await new Promise((resolve) =>
  S.player.emit('player:setCharacter', { libraryItemId: goblinItem }, resolve)
);
check('error' in badSet, 'нельзя назначить персонажем обычный токен');
const setChar = await new Promise((resolve) =>
  S.player.emit('player:setCharacter', { libraryItemId: heroItem }, resolve)
);
check('ok' in setChar, 'игрок назначает текущего персонажа');
const heroAddPromise = eventOnce(S.player, 'token:add');
S.player.emit('token:add', { mapId: S.map1.id, libraryItemId: heroItem, x: 500, y: 500 });
const heroAdd = await heroAddPromise;
check(heroAdd.token.libraryItemId === heroItem && heroAdd.token.isPlayerToken === true, 'игрок ставит своего персонажа на карту');
S.player.emit('token:move', { mapId: S.map1.id, id: heroAdd.token.id, x: 550, y: 550 });
const heroMoved = await eventOnce(S.dm, 'token:update');
check(heroMoved.token.id === heroAdd.token.id && heroMoved.token.x === 550, 'игрок двигает своего персонажа');

let leaked = false;
const onLeak = (p) => {
  if (p.token.id === S.token.id) leaked = true;
};
S.dm.on('token:update', onLeak);
S.player.emit('token:move', { mapId: S.map1.id, id: S.token.id, x: 900, y: 900 });
await sleep(400);
S.dm.off('token:update', onLeak);
check(!leaked, 'игрок не двигает чужой токен');

const summonItem = await addLibrary(S, 'Волк', {
  imageUrl: '/uploads/wolf.png',
  cells: 1,
  round: false,
  description: '',
  initiativeBonus: '',
  isPlayerToken: true,
  owner: 'Герой-Тест',
  attacks: [
    { name: 'Коготь', hit: 'd20+4', damage: 'd6+2' },
    { name: 'Яд', hit: '', damage: '1d4', rangeType: 'none', rangeNormal: 0, rangeLong: 0 },
    { name: '', hit: '', damage: '' },
  ],
});
const summonAddPromise = eventOnce(S.player, 'token:add');
S.player.emit('token:add', { mapId: S.map1.id, libraryItemId: summonItem, x: 600, y: 600 });
const summonAdd = await summonAddPromise;
check(summonAdd.token.owner === 'Герой-Тест', 'игрок ставит призыв со владельцем-персонажем');
const summonHitP = waitMsg(S.player, (m) => m.kind === 'roll' && m.label === 'Атака: Волк — Коготь');
S.player.emit('dice:attack', { tokenId: summonAdd.token.id, attackIndex: 0 });
const summonHit = await summonHitP;
check(summonHit.roll.dice[0].sides === 20, 'призыв атакует своим модификатором');

const statueItem = await addLibrary(S, 'Статуя', {
  imageUrl: '/uploads/statue.png',
  cells: 1,
  round: false,
  description: '',
  initiativeBonus: '',
});
const statueAddP = eventOnce(S.player, 'token:add');
S.dm.emit('token:add', { mapId: S.map1.id, libraryItemId: statueItem, x: 1100, y: 600 });
const statueAdd = await statueAddP;
const rangeErrP = eventOnce(S.player, 'chat:error');
S.player.emit('dice:attack', { tokenId: summonAdd.token.id, targetId: statueAdd.token.id, attackIndex: 0 });
const rangeErr = await rangeErrP;
check(/Вне досягаемости/.test(rangeErr), 'ближняя атака вне досягаемости запрещена');
const statueRemoved = eventOnce(S.player, 'token:remove');
S.dm.emit('token:remove', { mapId: S.map1.id, id: statueAdd.token.id });
await statueRemoved;
const statueLibRemoved = eventOnce(S.player, 'library:update');
S.dm.emit('library:remove', statueItem);
await statueLibRemoved;

const targetItem = await addLibrary(S, 'Мишень', {
  imageUrl: '/uploads/target.png',
  cells: 1,
  round: false,
  description: '',
  initiativeBonus: '',
  ac: '10',
  hpMax: '20',
});
const targetAddP = eventOnce(S.player, 'token:add');
S.dm.emit('token:add', { mapId: S.map1.id, libraryItemId: targetItem, x: 650, y: 600 });
const targetAdd = await targetAddP;
check(targetAdd.token.ac === '' && targetAdd.token.hpMax === '', 'AC/HP врага скрыты от игрока');
const dmgMsgP = waitMsg(S.player, (m) => m.kind === 'roll' && (m.label ?? '').startsWith('Урон') && m.label.includes('Яд'));
const hpUpdateP = new Promise((resolve) => {
  const h = (p) => {
    if (p.token.id === targetAdd.token.id && p.token.hpCurrent < 20) {
      S.dm.off('token:update', h);
      resolve(p);
    }
  };
  S.dm.on('token:update', h);
});
S.player.emit('dice:attack', { tokenId: summonAdd.token.id, targetId: targetAdd.token.id, attackIndex: 1 });
await dmgMsgP;
const hpUpdate = await hpUpdateP;
check(hpUpdate.token.hpCurrent < 20, `урон вычтен из HP цели (${hpUpdate.token.hpCurrent}/20)`);
const revealP = new Promise((resolve) => {
  const h = (p) => {
    if (p.token.id === targetAdd.token.id && p.token.ac === '10' && p.token.hpMax === '20') {
      S.player.off('token:update', h);
      resolve(p);
    }
  };
  S.player.on('token:update', h);
});
S.dm.emit('token:update', { mapId: S.map1.id, id: targetAdd.token.id, patch: { showStats: true } });
const revealed = await revealP;
check(revealed.token.hpMax === '20', 'DM-галка раскрывает AC/HP игроку');
const pairGuard = await new Promise((resolve) => {
  const h = (p) => {
    if (p.token.id === targetAdd.token.id) {
      S.dm.off('token:update', h);
      resolve(p.token);
    }
  };
  S.dm.on('token:update', h);
  S.dm.emit('token:update', { mapId: S.map1.id, id: targetAdd.token.id, patch: { hpMax: '' } });
});
check(pairGuard.hpMax === '20' && pairGuard.ac === '10', 'нельзя оставить Макс. ХП без AC (сервер игнорирует)');
const targetRemoved = eventOnce(S.player, 'token:remove');
S.dm.emit('token:remove', { mapId: S.map1.id, id: targetAdd.token.id });
await targetRemoved;
const targetLibRemoved = eventOnce(S.player, 'library:update');
S.dm.emit('library:remove', targetItem);
await targetLibRemoved;

const summonRemoved = eventOnce(S.player, 'token:remove');
S.dm.emit('token:remove', { mapId: S.map1.id, id: summonAdd.token.id });
await summonRemoved;
const summonLibRemoved = eventOnce(S.player, 'library:update');
S.dm.emit('library:remove', summonItem);
await summonLibRemoved;

const heroRemoved = eventOnce(S.player, 'token:remove');
S.dm.emit('token:remove', { mapId: S.map1.id, id: heroAdd.token.id });
await heroRemoved;
const heroLibRemoved = eventOnce(S.player, 'library:update');
S.dm.emit('library:remove', heroItem);
await heroLibRemoved;

S.dm.emit('map:add', { name: 'Лес', url: '/uploads/m2.png', width: 640, height: 480 });
