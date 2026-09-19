import { S } from './state.mjs';
import { check, sleep } from '../lib/check.mjs';
import { eventOnce, waitFor, waitMsg, addLibrary, setCharacter, setSheet, spawnToken, waitToken } from '../lib/smoke-helpers.mjs';

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
const setChar = await setCharacter(S, casterItem);
check('ok' in setChar, 'кастер назначен текущим персонажем');
const caster = (await spawnToken(S, { libraryItemId: casterItem, x: 200, y: 200 })).token;

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
const zombie = (await spawnToken(S, { libraryItemId: zombieItem, x: 250, y: 200, by: 'dm' })).token;

let latestResources = null;
S.player.on('resources:update', (r) => {
  latestResources = r;
});
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
await waitFor(() => latestResources && latestResources.spellSlots.some((s) => s.level === 3 && s.max === 2));
const slot3 = latestResources.spellSlots.find((s) => s.level === 3);
check(slot3 && slot3.max === 2, 'у волшебника 5 есть ячейки 3 круга');

const saveMsgP = waitMsg(S.player, (m) => m.kind === 'roll' && m.rollKind === 'save');
const damageMsgP = waitMsg(S.player, (m) => m.kind === 'roll' && m.rollKind === 'damage');
const hpP = waitToken(S, zombie.id, (t) => t.hpCurrent < 30, S.dm);
const fxP = eventOnce(S.player, 'fx:play');
S.player.emit('spell:cast', {
  mapId: S.map1.id,
  tokenId: caster.id,
  spellKey: 'XPHB:Fireball',
  slotLevel: 3,
  origin: { x: zombie.x, y: zombie.y },
});
const fx = await fxP;
check(
  fx?.key === 'XPHB:Fireball' && fx?.area?.shape === 'sphere' && fx?.types?.includes('fire'),
  'fx:play: сфера Fireball с типом fire'
);
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
check(err?.code === 'spellNotPrepared', 'чужое заклинание не кастуется (не выбрано в листе)');

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
