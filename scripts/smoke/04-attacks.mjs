import { S } from './state.mjs';
import { check, sleep } from '../lib/check.mjs';
import { eventOnce, joinAndAck, waitMsg, addLibrary } from '../lib/smoke-helpers.mjs';

const dummyItem = await addLibrary(S, 'Манекен', {
  imageUrl: '/uploads/dummy.png',
  cells: 1,
  round: false,
  description: '',
  initiativeBonus: '',
  hpMax: '15',
  ac: '10',
});
const dummyAddP = eventOnce(S.player, 'token:add');
S.dm.emit('token:add', { mapId: S.map1.id, libraryItemId: dummyItem, x: 300, y: 300 });
const dummyAdd = await dummyAddP;
const dummyHpP = new Promise((resolve) => {
  const h = (p) => {
    if (p.token.id === dummyAdd.token.id && p.token.hpCurrent < 15) {
      S.dm.off('token:update', h);
      resolve(p);
    }
  };
  S.dm.on('token:update', h);
});
S.player.emit('dice:attack', { targetId: dummyAdd.token.id, attackIndex: 1 });
await dummyHpP;
const dummyRemoved = eventOnce(S.player, 'token:remove');
S.dm.emit('token:remove', { mapId: S.map1.id, id: dummyAdd.token.id });
await dummyRemoved;
const dummyLibRemoved = eventOnce(S.player, 'library:update');
S.dm.emit('library:remove', dummyItem);
await dummyLibRemoved;

const testSheet = {
  name: 'Гоблин-игрок',
  abilities: { str: 16, dex: 12, con: 14, int: 8, wis: 13, cha: 10 },
  proficiencyBonus: 'd4',
  saves: { dex: true },
  skills: { stealth: 2 },
  attacks: [
    { name: 'Кинжал', hit: 'd20+5', damage: 'd4+3' },
    { name: '', hit: '', damage: '' },
    { name: '', hit: '', damage: '' },
  ],
  classes: [{ className: 'wizard', level: 3 }],
};
let dmGotSheet = false;
S.dm.once('sheet:update', () => {
  dmGotSheet = true;
});
let dmGotResources = false;
S.dm.once('resources:update', () => {
  dmGotResources = true;
});
const sheetEchoPromise = eventOnce(S.player, 'sheet:update');
const resourcesPromise = eventOnce(S.player, 'resources:update');
S.player.emit('sheet:update', testSheet);
const sheetEcho = await sheetEchoPromise;
check(sheetEcho.sheet.name === 'Гоблин-игрок', 'лист сохраняется и возвращается владельцу');
check(sheetEcho.sheet.attacks?.[0]?.name === 'Кинжал', 'в листе три поля оружия');
check(sheetEcho.sheet.classes?.[0]?.className === 'wizard', 'классы сохраняются в листе');
const playerResources = await resourcesPromise;
check(playerResources.spellSlots.map((s) => s.max).join(',') === '4,2', 'ячейки рассчитаны по классу/уровню');
check(playerResources.hp.max === 20, 'авто max HP по классу и Телосложению');
check(
  playerResources.resources.some((r) => r.key === 'wizard:arcaneRecovery'),
  'авто-ресурсы класса рассчитаны'
);
await sleep(600);
check(!dmGotSheet, 'лист игрока невидим другим игрокам');
check(!dmGotResources, 'ресурсы игрока невидимы другим игрокам');

const resourcesEditPromise = eventOnce(S.player, 'resources:update');
S.player.emit('resources:update', {
  ...playerResources,
  hp: { ...playerResources.hp, current: 7, max: 20 },
});
const editedResources = await resourcesEditPromise;
check(editedResources.hp.current === 7 && editedResources.hp.max === 20, 'изменение HP сохраняется');

const hitDiePromise = eventOnce(S.player, 'resources:update');
S.player.emit('resources:hitDie', { die: 6 });
const afterHit = await hitDiePromise;
check(afterHit.hitDice[0].current === 2, 'бросок кости хитов тратит кость');
check(afterHit.hp.current > 7 && afterHit.hp.current <= 20, 'хит дайс восстанавливает здоровье');

S.dm.emit('chat:send', 'Всем привет');
const textMsg = await waitMsg(S.player, (m) => m.kind === 'text' && m.text === 'Всем привет');
check(textMsg.author === 'Мастер', 'text message author');

const pongPromise = eventOnce(S.player, 'pong');
S.player.emit('ping');
await pongPromise;

const reconnected = eventOnce(S.player, 'connect');
S.player.disconnect();
S.player.connect();
await reconnected;
await joinAndAck(S.player, (cb) =>
  S.player.emit('room:join', { code: S.created.room.code, name: 'Игрок', clientId: 'smoke-p1' }, cb)
);
