import { io } from 'socket.io-client';
import { S } from './state.mjs';
import { check, sleep } from '../lib/check.mjs';
import { eventOnce, waitFor, waitMsg, joinAndAck, addLibrary, setCharacter, setSheet, spawnToken, waitToken } from '../lib/smoke-helpers.mjs';

// Свой игрок на сценарий: не трогаем лист/персонажа smoke-p1 (его проверяет 05-persistence).
const p3 = io(S.URL);
await waitFor(() => p3.connected);
await joinAndAck(p3, (cb) =>
  p3.emit('room:join', { code: S.created.room.code, name: 'Игрок-16', clientId: 'smoke-p3' }, cb)
);

S.dm.emit('map:bring', S.map1.id);
await waitFor(() => S.lastBring && S.lastBring.activeMapId === S.map1.id);

const druidItem = await addLibrary(S, 'Друид-Тест', {
  imageUrl: '/x.png',
  cells: 1,
  round: false,
  description: '',
  initiativeBonus: '',
  isPlayerToken: true,
});
const setChar = await setCharacter(S, druidItem, p3);
check('ok' in setChar, 'друид назначен текущим персонажем');
const druid = (await spawnToken(S, { libraryItemId: druidItem, x: 200, y: 200, by: 'dm', observe: 'dm' })).token;

const dummyItem = await addLibrary(S, 'Манекен-Шиллела', {
  imageUrl: '/x.png',
  cells: 1,
  round: false,
  description: '',
  initiativeBonus: '',
  ac: '5',
  hpMax: '30',
  showStats: true,
});
const dummy = (await spawnToken(S, { libraryItemId: dummyItem, x: 250, y: 200, by: 'dm', observe: 'dm' })).token;

const sheet = (attacks, hands) => ({
  name: 'Друид',
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 18, cha: 10 },
  proficiencyBonus: '2',
  saves: {},
  skills: {},
  attacks,
  hands,
  classes: [{ className: 'druid', level: 1 }],
  spells: [{ key: 'XPHB:Shillelagh', className: 'druid' }],
});

// Без дубинки/посоха (в руке скимитар) каст отклоняется с понятной ошибкой.
await setSheet(
  S,
  sheet(
    [
      {
        id: 'scimitar',
        name: 'Скимитар',
        hit: 'd20+2',
        damage: '1d6',
        damageType: 'slashing',
        rangeType: 'melee',
        rangeNormal: 5,
        rangeLong: 0,
        weaponKey: 'XPHB:Scimitar',
      },
    ],
    { right: 'scimitar' }
  ),
  p3
);
const clubErrP = eventOnce(p3, 'chat:error');
p3.emit('spell:cast', { mapId: S.map1.id, tokenId: druid.id, spellKey: 'XPHB:Shillelagh' });
const clubErr = await clubErrP;
check(clubErr?.code === 'noClubOrStaff', 'без дубинки/посоха каст отклонён (noClubOrStaff)');

await setSheet(
  S,
  sheet(
    [
      {
        id: 'club',
        name: 'Дубинка',
        hit: 'd20+2',
        damage: '1d4',
        damageType: 'bludgeoning',
        rangeType: 'melee',
        rangeNormal: 5,
        rangeLong: 0,
        weaponKey: 'XPHB:Club',
      },
    ],
    { right: 'club' }
  ),
  p3
);

// Каст: эффект на себе с weaponOverride (кость кантрипа, характеристика, силовой тип).
const effectP = waitToken(S, druid.id, (t) => t.effects.some((e) => e.sourceKey === 'XPHB:Shillelagh'), S.dm);
p3.emit('spell:cast', { mapId: S.map1.id, tokenId: druid.id, spellKey: 'XPHB:Shillelagh' });
const withEffect = await effectP;
const effect = withEffect.effects.find((e) => e.sourceKey === 'XPHB:Shillelagh');
check(
  JSON.stringify(effect?.weaponOverride) ===
    JSON.stringify({ weapons: ['XPHB:Club', 'XPHB:Quarterstaff'], dice: 'd8', damageType: 'force', abilityMod: 4 }),
  `Shillelagh: weaponOverride дубинки d8 + Мдр 4 силовым (${JSON.stringify(effect?.weaponOverride)})`
);
check(effect?.maxRounds === 10, 'Shillelagh ограничен 10 раундами (1 минута)');

// Атака из панели действий (action:use): урон d8+4 силовым, попадание d20+6.
const hitMsgP = waitMsg(p3, (m) => m.kind === 'roll' && m.rollKind === 'attack');
const dmgMsgP = waitMsg(p3, (m) => m.kind === 'roll' && m.rollKind === 'damage');
const hitDummyP = waitToken(S, dummy.id, (t) => t.hpCurrent < 30, S.dm);
p3.emit('action:use', {
  mapId: S.map1.id,
  tokenId: druid.id,
  actionId: 'attack',
  attackIndex: 0,
  targetIds: [dummy.id],
});
const hitMsg = await hitMsgP;
check(hitMsg.roll.expression === 'd20+6', `попадание дубинкой — ПБ 2 + Мдр 4 (${hitMsg.roll.expression})`);
check(hitMsg.labelParams?.damageType === 'force', 'атака дубинкой помечена силовым типом');
const dmgMsg = await dmgMsgP;
check(dmgMsg.roll.expression === 'd8+4', `урон дубинки после Shillelagh — d8+4 (${dmgMsg.roll.expression})`);
const hitDummy = await hitDummyP;
check(30 - hitDummy.hpCurrent === dmgMsg.roll.total, 'HP манекена уменьшились ровно на бросок урона');

// Атака из ROLL-меню (dice:attack): та же производная формула.
const dmg2P = waitMsg(p3, (m) => m.kind === 'roll' && m.rollKind === 'damage');
p3.emit('dice:attack', { tokenId: druid.id, targetId: dummy.id, attackIndex: 0 });
const dmg2 = await dmg2P;
check(dmg2.roll.expression === 'd8+4', `ROLL-меню тоже бьёт d8+4 (${dmg2.roll.expression})`);

// Убираем зверинец сцены (05-persistence проверяет состав карты/библиотеки).
const druidRemoved = eventOnce(S.dm, 'token:remove');
S.dm.emit('token:remove', { mapId: S.map1.id, id: druid.id });
await druidRemoved;
const dummyRemoved = eventOnce(S.dm, 'token:remove');
S.dm.emit('token:remove', { mapId: S.map1.id, id: dummy.id });
await dummyRemoved;
const lib1P = eventOnce(S.dm, 'library:update');
S.dm.emit('library:remove', druidItem);
await lib1P;
const lib2P = eventOnce(S.dm, 'library:update');
S.dm.emit('library:remove', dummyItem);
await lib2P;
await sleep(200);
p3.close();
