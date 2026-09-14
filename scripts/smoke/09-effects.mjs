import { S } from './state.mjs';
import { check, sleep } from '../lib/check.mjs';
import { eventOnce, waitFor, addLibrary, setCharacter, setSheet, spawnToken, waitToken } from '../lib/smoke-helpers.mjs';

// Карта 1 активна у всех после предыдущих сценариев.
S.dm.emit('map:bring', S.map1.id);
await waitFor(() => S.lastBring && S.lastBring.activeMapId === S.map1.id);

const withToken = (id, predicate) => waitToken(S, id, predicate, S.dm);

const mageItem = await addLibrary(S, 'Магистр-Тест', {
  imageUrl: '/x.png',
  cells: 1,
  round: false,
  description: '',
  initiativeBonus: '',
  isPlayerToken: true,
});
const setChar = await setCharacter(S, mageItem);
check('ok' in setChar, 'магистр назначен текущим персонажем');
const mage = (await spawnToken(S, { libraryItemId: mageItem, x: 300, y: 300 })).token;

const allyItem = await addLibrary(S, 'Союзник-Тест', {
  imageUrl: '/x.png',
  cells: 1,
  round: false,
  description: '',
  initiativeBonus: '',
  ac: '13',
  hpMax: '20',
  showStats: true,
});
const ally = (await spawnToken(S, { libraryItemId: allyItem, x: 350, y: 300, by: 'dm' })).token;

let latestResources = null;
S.player.on('resources:update', (r) => {
  latestResources = r;
});
await setSheet(S, {
  name: 'Магистр',
  abilities: { str: 8, dex: 14, con: 12, int: 18, wis: 10, cha: 10 },
  proficiencyBonus: '3',
  saves: {},
  skills: {},
  attacks: [],
  classes: [{ className: 'wizard', level: 5 }],
  spells: [
    { key: 'XPHB:Shield', className: 'wizard' },
    { key: 'XPHB:Bless', className: 'wizard' },
    { key: 'XPHB:Aid', className: 'wizard' },
    { key: 'XPHB:Hex', className: 'wizard' },
  ],
});
await waitFor(() => latestResources && latestResources.spellSlots.some((s) => s.level === 1));

// Shield: self-эффект +5 AC.
const shieldP = withToken(mage.id, (t) => t.effects.length > 0);
S.player.emit('spell:cast', { mapId: S.map1.id, tokenId: mage.id, spellKey: 'XPHB:Shield', slotLevel: 1 });
const shielded = await shieldP;
const shieldMod = shielded.effects[0]?.modifiers[0];
check(
  shieldMod?.target === 'ac' && shieldMod?.mode === 'add' && shieldMod?.value === 5,
  'Shield накладывает +5 AC'
);

// Bless: концентрация на союзнике.
const blessP = withToken(ally.id, (t) => t.effects.length > 0);
const blessAnchorP = withToken(mage.id, (t) => t.effects.some((e) => e.sourceKey === 'XPHB:Bless'));
S.player.emit('spell:cast', {
  mapId: S.map1.id,
  tokenId: mage.id,
  spellKey: 'XPHB:Bless',
  slotLevel: 1,
  targetIds: [ally.id],
});
const blessed = await blessP;
await blessAnchorP;
check(true, 'концентрация Bless помечена на кастере');
const bless = blessed.effects.find((e) => e.sourceKey === 'XPHB:Bless');
check(!!bless && bless.concentration === true && bless.sourceId === mage.id, 'Bless — концентрация мага на союзнике');
check(
  bless?.modifiers.some((m) => m.target === 'attack' && m.mode === 'add' && m.value === '1d4'),
  'Bless даёт +1d4 к атакам'
);

// Досрочное прекращение концентрации снимает эффект.
const endP = withToken(ally.id, (t) => t.effects.length === 0);
S.player.emit('spell:endConcentration', { mapId: S.map1.id, tokenId: mage.id });
await endP;
check(true, 'концентрация прекращена, эффект снят');

// Aid: +5 к максимуму и текущим HP цели.
const aidP = withToken(ally.id, (t) => t.hpMax === '25');
S.player.emit('spell:cast', {
  mapId: S.map1.id,
  tokenId: mage.id,
  spellKey: 'XPHB:Aid',
  slotLevel: 2,
  targetIds: [ally.id],
});
const aided = await aidP;
check(aided.hpCurrent === 25, 'Aid поднял максимум и текущие HP (+5)');

// Hex: бонус урона привязан к метке, метка видна на цели.
const hexTargetP = withToken(ally.id, (t) => t.effects.some((e) => e.sourceKey === 'XPHB:Hex'));
const hexMageP = withToken(mage.id, (t) => t.effects.some((e) => e.sourceKey === 'XPHB:Hex'));
S.player.emit('spell:cast', {
  mapId: S.map1.id,
  tokenId: mage.id,
  spellKey: 'XPHB:Hex',
  slotLevel: 1,
  targetIds: [ally.id],
});
const hexed = await hexTargetP;
const mageHexed = await hexMageP;
const targetHex = hexed.effects.find((e) => e.sourceKey === 'XPHB:Hex');
const markMod = mageHexed.effects.find((e) => e.sourceKey === 'XPHB:Hex')?.modifiers?.[0];
check(!!targetHex && targetHex.concentration === true, 'метка Hex наложена на цель');
check(markMod?.filter?.targetId === ally.id, 'Hex на кастере привязан к метке');

// Снятие Aid возвращает максимум HP.
const aidRemovedP = withToken(ally.id, (t) => !t.effects.some((e) => e.sourceKey === 'XPHB:Aid') && t.hpMax === '20');
S.dm.emit('token:update', {
  mapId: S.map1.id,
  id: ally.id,
  patch: { effects: hexed.effects.filter((e) => e.sourceKey !== 'XPHB:Aid') },
});
await aidRemovedP;
check(true, 'снятие Aid откатывает максимум HP');

// Долгий отдых снимает эффекты и концентрацию с персонажа и его целей.
const preRestHitDie = latestResources?.hitDice?.[0]?.current ?? 2;
const mageClearedP = withToken(mage.id, (t) => t.effects.length === 0);
const allyHexClearedP = withToken(ally.id, (t) => !t.effects.some((e) => e.sourceKey === 'XPHB:Hex'));
S.player.emit('resources:rest', { type: 'long' });
await mageClearedP;
await allyHexClearedP;
check(true, 'долгий отдых снял эффекты и метку');

// Возвращаем потраченные кости хитов: их проверяет 05-persistence.
await waitFor(() => latestResources && latestResources.hp.current === latestResources.hp.max);
S.player.emit('resources:update', {
  ...latestResources,
  hitDice: latestResources.hitDice.map((h, i) => (i === 0 ? { ...h, current: preRestHitDie } : h)),
});
await sleep(200);

const mageRemoved = eventOnce(S.player, 'token:remove');
S.dm.emit('token:remove', { mapId: S.map1.id, id: mage.id });
await mageRemoved;
const allyRemoved = eventOnce(S.player, 'token:remove');
S.dm.emit('token:remove', { mapId: S.map1.id, id: ally.id });
await allyRemoved;
const lib1P = eventOnce(S.player, 'library:update');
S.dm.emit('library:remove', mageItem);
await lib1P;
const lib2P = eventOnce(S.player, 'library:update');
S.dm.emit('library:remove', allyItem);
await lib2P;

// Возвращаем лист игрока к состоянию после 04b (его проверяет 05-persistence).
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
await sleep(200);
