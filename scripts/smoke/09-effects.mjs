import { S } from './state.mjs';
import { check, sleep } from '../lib/check.mjs';
import { eventOnce, waitFor, addLibrary } from '../lib/smoke-helpers.mjs';

// Карта 1 активна у всех после предыдущих сценариев.
S.dm.emit('map:bring', S.map1.id);
await waitFor(() => S.lastBring && S.lastBring.activeMapId === S.map1.id);

const withToken = (id, predicate) =>
  new Promise((resolve) => {
    const h = (p) => {
      if (p.token.id === id && predicate(p.token)) {
        S.dm.off('token:update', h);
        resolve(p.token);
      }
    };
    S.dm.on('token:update', h);
  });

const mageItem = await addLibrary(S, 'Магистр-Тест', {
  imageUrl: '/x.png',
  cells: 1,
  round: false,
  description: '',
  initiativeBonus: '',
  isPlayerToken: true,
});
const setChar = await new Promise((resolve) =>
  S.player.emit('player:setCharacter', { libraryItemId: mageItem }, resolve)
);
check('ok' in setChar, 'магистр назначен текущим персонажем');
const mageAddP = eventOnce(S.player, 'token:add');
S.player.emit('token:add', { mapId: S.map1.id, libraryItemId: mageItem, x: 300, y: 300 });
const mage = (await mageAddP).token;

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
const allyAddP = eventOnce(S.player, 'token:add');
S.dm.emit('token:add', { mapId: S.map1.id, libraryItemId: allyItem, x: 350, y: 300 });
const ally = (await allyAddP).token;

let latestResources = null;
S.player.on('resources:update', (r) => {
  latestResources = r;
});
const sheetP = eventOnce(S.player, 'sheet:update');
S.player.emit('sheet:update', {
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
  ],
});
await sheetP;
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
S.player.emit('spell:cast', {
  mapId: S.map1.id,
  tokenId: mage.id,
  spellKey: 'XPHB:Bless',
  slotLevel: 1,
  targetIds: [ally.id],
});
const blessed = await blessP;
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
const restoreP = eventOnce(S.player, 'sheet:update');
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
await restoreP;
await sleep(200);
