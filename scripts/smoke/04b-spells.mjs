import { S } from './state.mjs';
import { check, sleep } from '../lib/check.mjs';
import { eventOnce, waitFor, waitMsg, addLibrary } from '../lib/smoke-helpers.mjs';

// Карта 1 активна у всех после предыдущих сценариев.
S.dm.emit('map:bring', S.map1.id);
await waitFor(() => S.lastBring && S.lastBring.activeMapId === S.map1.id);

const casterItem = await addLibrary(S, 'Колдун-Тест', {
  imageUrl: '/x.png',
  cells: 1,
  round: false,
  description: '',
  initiativeBonus: '',
  isPlayerToken: true,
});
const setChar = await new Promise((resolve) =>
  S.player.emit('player:setCharacter', { libraryItemId: casterItem }, resolve)
);
check('ok' in setChar, 'кастер назначен текущим персонажем');
const casterAddP = eventOnce(S.player, 'token:add');
S.player.emit('token:add', { mapId: S.map1.id, libraryItemId: casterItem, x: 200, y: 200 });
const caster = (await casterAddP).token;

const zombieItem = await addLibrary(S, 'Зомби-Тест', {
  imageUrl: '/x.png',
  cells: 1,
  round: false,
  description: '',
  initiativeBonus: '',
  ac: '10',
  hpMax: '30',
  showStats: true,
});
const zombieAddP = eventOnce(S.player, 'token:add');
S.dm.emit('token:add', { mapId: S.map1.id, libraryItemId: zombieItem, x: 250, y: 200 });
const zombie = (await zombieAddP).token;

let latestResources = null;
S.player.on('resources:update', (r) => {
  latestResources = r;
});
const sheetP = eventOnce(S.player, 'sheet:update');
S.player.emit('sheet:update', {
  name: 'Гоблин-игрок',
  abilities: { str: 8, dex: 14, con: 12, int: 18, wis: 10, cha: 10 },
  proficiencyBonus: '3',
  saves: {},
  skills: {},
  attacks: [],
  classes: [{ className: 'wizard', level: 5 }],
  spells: [{ key: 'XPHB:Fireball', className: 'wizard' }],
});
await sheetP;
await waitFor(() => latestResources && latestResources.spellSlots.some((s) => s.level === 3 && s.max === 2));
const slot3 = latestResources.spellSlots.find((s) => s.level === 3);
check(slot3 && slot3.max === 2, 'у волшебника 5 есть ячейки 3 круга');

const saveMsgP = waitMsg(S.player, (m) => m.kind === 'roll' && m.rollKind === 'save');
const damageMsgP = waitMsg(S.player, (m) => m.kind === 'roll' && m.rollKind === 'damage');
const hpP = new Promise((resolve) => {
  const h = (p) => {
    if (p.token.id === zombie.id && p.token.hpCurrent < 30) {
      S.dm.off('token:update', h);
      resolve(p.token);
    }
  };
  S.dm.on('token:update', h);
});
S.player.emit('spell:cast', {
  mapId: S.map1.id,
  tokenId: caster.id,
  spellKey: 'XPHB:Fireball',
  slotLevel: 3,
  origin: { x: zombie.x, y: zombie.y },
});
const saveMsg = await saveMsgP;
check(saveMsg.labelParams?.saveOutcome === 'success' || saveMsg.labelParams?.saveOutcome === 'fail', 'кинут спасбросок');
const damageMsg = await damageMsgP;
check(damageMsg.roll.dice[0].sides === 6 && damageMsg.roll.dice[0].values.length === 8, 'урон 8d6');
const hitZombie = await hpP;
check(hitZombie.hpCurrent < 30, `урон нанесён (${hitZombie.hpCurrent}/30)`);
await waitFor(() => latestResources.spellSlots.find((s) => s.level === 3).current === 1);
check(latestResources.spellSlots.find((s) => s.level === 3).current === 1, 'ячейка 3 круга списана');

const errP = eventOnce(S.player, 'chat:error');
S.player.emit('spell:cast', {
  mapId: S.map1.id,
  tokenId: caster.id,
  spellKey: 'XPHB:Cure Wounds',
  slotLevel: 1,
});
const err = await errP;
check(/не выбрано/i.test(err), 'чужое заклинание не кастуется (не выбрано в листе)');

const casterRemoved = eventOnce(S.player, 'token:remove');
S.dm.emit('token:remove', { mapId: S.map1.id, id: caster.id });
await casterRemoved;
const zombieRemoved = eventOnce(S.player, 'token:remove');
S.dm.emit('token:remove', { mapId: S.map1.id, id: zombie.id });
await zombieRemoved;
const lib1P = eventOnce(S.player, 'library:update');
S.dm.emit('library:remove', casterItem);
await lib1P;
const lib2P = eventOnce(S.player, 'library:update');
S.dm.emit('library:remove', zombieItem);
await lib2P;
await sleep(200);
