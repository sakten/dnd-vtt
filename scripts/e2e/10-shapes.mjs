import { S } from './state.mjs';
import { check } from '../lib/check.mjs';
import { findButton, waitFor } from '../lib/e2e-helpers.mjs';
import path from 'node:path';

// С5: превращение через UI (меню токена), витрина формы, Large-форма + RAM,
// возврат по урону. Проверяем реальный клиент: DOM + стор (`window.__vtt`).

const mapState = () =>
  S.page.evaluate(() => {
    const s = window.__vtt.getState();
    const map = s.scene.maps.find((m) => m.id === s.viewMapId) ?? s.scene.maps[0];
    return {
      mapId: map?.id ?? null,
      tokens: (map?.tokens ?? []).map((t) => ({
        id: t.id,
        libraryItemId: t.libraryItemId,
        name: t.name,
        cells: t.cells,
        w: t.w,
        x: t.x,
        y: t.y,
        shape: t.shape?.key ?? null,
      })),
    };
  });

const tokenScreen = (id) =>
  S.page.evaluate((tid) => {
    const s = window.__vtt.getState();
    const map = s.scene.maps.find((m) => m.id === s.viewMapId) ?? s.scene.maps[0];
    const t = map.tokens.find((x) => x.id === tid);
    return t ? { sx: t.x * s.view.scale + s.view.x, sy: t.y * s.view.scale + s.view.y } : null;
  }, id);

const tokenById = (id) =>
  S.page.evaluate((tid) => {
    const s = window.__vtt.getState();
    const map = s.scene.maps.find((m) => m.id === s.viewMapId) ?? s.scene.maps[0];
    const t = map?.tokens.find((x) => x.id === tid);
    return t ? { name: t.name, cells: t.cells, w: t.w, shape: t.shape?.key ?? null } : null;
  }, id);

// Подготовка: персонаж-друид (назначаем странице), токен, лист, полные HP.
const setup = await S.page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const waitState = async (fn, ms = 6000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      if (fn()) return;
      await sleep(50);
    }
    throw new Error('timeout setup');
  };
  const s0 = window.__vtt.getState();
  const socket = s0.socket;
  const ack = (ev, payload) => new Promise((res) => socket.emit(ev, payload, res));
  const mapId = s0.viewMapId ?? s0.scene.maps[0].id;
  socket.emit('library:add', {
    name: 'Друид-Э2Э',
    imageUrl: '',
    cells: 1,
    round: false,
    description: '',
    initiativeBonus: '',
    isPlayerToken: true,
  });
  await waitState(() => window.__vtt.getState().library.some((i) => i.name === 'Друид-Э2Э'));
  const item = window.__vtt.getState().library.find((i) => i.name === 'Друид-Э2Э');
  const set = await ack('player:setCharacter', { libraryItemId: item.id });
  const before = window.__vtt.getState().scene.maps.find((m) => m.id === mapId).tokens.length;
  // Ставим токен в безопасную точку экрана (центр стола, не под панелями).
  const spot = { x: (720 - s0.view.x) / s0.view.scale, y: (320 - s0.view.y) / s0.view.scale };
  socket.emit('token:add', { mapId, libraryItemId: item.id, x: spot.x, y: spot.y });
  await waitState(
    () => window.__vtt.getState().scene.maps.find((m) => m.id === mapId).tokens.length > before
  );
  const token = window.__vtt
    .getState()
    .scene.maps.find((m) => m.id === mapId)
    .tokens.find((t) => t.libraryItemId === item.id);
  socket.emit('sheet:update', {
    name: 'Друид-Э2Э',
    abilities: { str: 10, dex: 14, con: 14, int: 10, wis: 16, cha: 10 },
    proficiencyBonus: '3',
    saves: {},
    skills: {},
    attacks: [],
    classes: [{ className: 'druid', level: 6 }],
    spells: [],
    wildShape: { known: ['XMM:Wolf', 'XMM:Giant Goat'] },
  });
  await waitState(() =>
    window.__vtt.getState().resources?.resources?.some((r) => r.key === 'druid:wildShape' && r.current === 3)
  );
  const res = window.__vtt.getState().resources;
  socket.emit('resources:update', { ...res, hp: { ...res.hp, current: res.hp.max, temp: 0 } });
  await waitState(() => (window.__vtt.getState().resources?.hp?.current ?? 0) > 0);
  return { mapId, tokenId: token.id, ok: !!set && !('error' in set) };
});
check(setup.ok, 'друид создан и назначен, токен на столе');

// Меню токена → «Принять форму» → Wolf (реальные клики: выделить → второй клик открывает меню).
const openMenu = async (id) => {
  const pos = await tokenScreen(id);
  await S.page.mouse.click(pos.sx, pos.sy);
  await waitFor(S.page, (tid) => window.__vtt.getState().selectedTokenId === tid, 5000, id);
  await new Promise((r) => setTimeout(r, 120));
  await S.page.mouse.click(pos.sx, pos.sy);
  await S.page.waitForSelector('[data-testid="modal"]', { timeout: 8000 });
};
await openMenu(setup.tokenId);
const take = await findButton(S.page, '[data-testid="modal"] button', 'Принять форму');
check(!!take, 'в меню токена есть «Принять форму»');
await take.click();
// Список форм подгружается лениво (чанк бестиария) — ждём строку.
await waitFor(
  S.page,
  () =>
    [...document.querySelectorAll('[data-testid="modal"] button')].some((b) =>
      (b.textContent ?? '').includes('Wolf')
    ),
  8000
);
const wolfBtn = await findButton(S.page, '[data-testid="modal"] button', 'Wolf');
check(!!wolfBtn, 'в пикере известных форм есть Wolf');
await wolfBtn.click();
await waitFor(
  S.page,
  (tid) => {
    const s = window.__vtt.getState();
    const map = s.scene.maps.find((m) => m.id === s.viewMapId) ?? s.scene.maps[0];
    return map?.tokens.find((t) => t.id === tid)?.shape?.key === 'XMM:Wolf';
  },
  6000,
  setup.tokenId
);
const afterWolf = await mapState();
const wolf = afterWolf.tokens.find((t) => t.id === setup.tokenId);
check(wolf?.name === 'Wolf' && wolf?.shape === 'XMM:Wolf', `витрина формы: Wolf (${wolf?.name})`);
await S.page.keyboard.press('Escape');
await waitFor(S.page, () => !document.querySelector('[data-testid="modal"]'), 5000);

// Панель действий в форме: есть возврат, нет безоружного удара.
const revertBtn = await S.page.$('[aria-label="Вернуться в свою форму"]');
check(!!revertBtn, 'в панели действий есть кнопка возврата из формы');
check((await S.page.$('[aria-label="Безоружный удар"]')) === null, 'в форме нет безоружного удара');

// Large-форма: выходим из Wolf через меню («Вернуться»), затем Giant Goat.
await openMenu(setup.tokenId);
const backBtn = await findButton(S.page, '[data-testid="modal"] button', 'Вернуться');
check(!!backBtn, 'в меню формы есть «Вернуться»');
await backBtn.click();
await waitFor(S.page, () => !document.querySelector('[data-testid="modal"]'), 5000);
await waitFor(
  S.page,
  (tid) => {
    const s = window.__vtt.getState();
    const map = s.scene.maps.find((m) => m.id === s.viewMapId) ?? s.scene.maps[0];
    return !map?.tokens.find((t) => t.id === tid)?.shape;
  },
  5000,
  setup.tokenId
);
await openMenu(setup.tokenId);
// Пикер мог остаться открытым с прошлого раза (локальный стейт меню) — тогда сразу строка формы.
let goatBtn = await findButton(S.page, '[data-testid="modal"] button', 'Giant Goat');
if (!goatBtn) {
  const take2 = await findButton(S.page, '[data-testid="modal"] button', 'Принять форму');
  check(!!take2, 'в меню токена есть «Принять форму» (повторно)');
  await take2.click();
  await waitFor(
    S.page,
    () =>
      [...document.querySelectorAll('[data-testid="modal"] button')].some((b) =>
        (b.textContent ?? '').includes('Giant Goat')
      ),
    8000
  );
  goatBtn = await findButton(S.page, '[data-testid="modal"] button', 'Giant Goat');
}
check(!!goatBtn, 'в пикере есть Giant Goat');
await goatBtn.click();
await waitFor(
  S.page,
  (tid) => {
    const s = window.__vtt.getState();
    const map = s.scene.maps.find((m) => m.id === s.viewMapId) ?? s.scene.maps[0];
    const t = map?.tokens.find((x) => x.id === tid);
    return t?.shape?.key === 'XMM:Giant Goat' && t.cells === 2 && t.w === 100;
  },
  6000,
  setup.tokenId
);
const goat = await tokenById(setup.tokenId);
check(
  goat?.shape === 'XMM:Giant Goat' && goat.cells === 2 && goat.w === 100,
  `Large-форма: Giant Goat 2×2 (cells=${goat?.cells}, w=${goat?.w})`
);
await S.page.keyboard.press('Escape');
// RAM: цель рядом, способность в панели (клик по цели — через сокет, канвас тут нестабилен).
const goatWorld = await S.page.evaluate(
  (tid) => {
    const s = window.__vtt.getState();
    const map = s.scene.maps.find((m) => m.id === s.viewMapId) ?? s.scene.maps[0];
    const t = map.tokens.find((x) => x.id === tid);
    return t ? { x: t.x, y: t.y } : null;
  },
  setup.tokenId
);
const dummyId = await S.page.evaluate(
  async ({ mapId, x, y }) => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const socket = window.__vtt.getState().socket;
    socket.emit('library:add', {
      name: 'Манекен-Э2Э',
      imageUrl: '',
      cells: 1,
      round: false,
      description: '',
      initiativeBonus: '',
      isPlayerToken: false,
    });
    for (let i = 0; i < 120; i++) {
      const item = window.__vtt.getState().library.find((it) => it.name === 'Манекен-Э2Э');
      if (item) {
        const before = window.__vtt.getState().scene.maps.find((m) => m.id === mapId).tokens.length;
        socket.emit('token:add', { mapId, libraryItemId: item.id, x, y });
        for (let j = 0; j < 120; j++) {
          const tokens = window.__vtt.getState().scene.maps.find((m) => m.id === mapId).tokens;
          if (tokens.length > before) return tokens[tokens.length - 1].id;
          await sleep(50);
        }
      }
      await sleep(50);
    }
    return null;
  },
  { mapId: setup.mapId, x: goatWorld.x + 25, y: goatWorld.y + 25 }
);
check(!!dummyId, 'манекен выставлен рядом');
const ramBtn = await S.page.$('[aria-label="Ram"]');
check(!!ramBtn, 'в панели формы есть способность Ram');
// Клик по способности должен войти в режим выбора цели (раньше сразу тратил действие).
await ramBtn.click();
await new Promise((r) => setTimeout(r, 500));
const mode = await S.page.evaluate(() => window.__vtt.getState().interaction?.mode ?? null);
check(mode === 'target', `RAM входит в режим выбора цели (mode=${mode})`);
const dummyScreen = await S.page.evaluate(
  (tid) => {
    const s = window.__vtt.getState();
    const map = s.scene.maps.find((m) => m.id === s.viewMapId) ?? s.scene.maps[0];
    const t = map.tokens.find((x) => x.id === tid);
    return t ? { sx: t.x * s.view.scale + s.view.x, sy: t.y * s.view.scale + s.view.y } : null;
  },
  dummyId
);
await S.page.mouse.click(dummyScreen.sx, dummyScreen.sy);
await new Promise((r) => setTimeout(r, 900));
const ram = await S.page.evaluate(() => {
  const s = window.__vtt.getState();
  return {
    err: s.chatError,
    roll: s.chat.some((m) => !!m.roll && JSON.stringify(m.labelParams ?? m.label ?? '').includes('Ram')),
  };
});
check(ram.roll && !ram.err, `RAM бросает d20 в чат (ошибка: ${ram.err ?? 'нет'})`);

// Урон по пулу → возврат, размер снова 1×1.
await S.page.evaluate(
  ({ mapId, id }) => window.__vtt.getState().socket.emit('token:hp', { mapId, id, delta: -6 }),
  { mapId: setup.mapId, id: setup.tokenId }
);
await waitFor(
  S.page,
  (tid) => {
    const s = window.__vtt.getState();
    const map = s.scene.maps.find((m) => m.id === s.viewMapId) ?? s.scene.maps[0];
    const t = map?.tokens.find((x) => x.id === tid);
    return !!t && !t.shape && t.cells === 1 && t.w === 50;
  },
  6000,
  setup.tokenId
);
const back = await tokenById(setup.tokenId);
check(!back?.shape && back?.cells === 1 && back?.w === 50, `возврат по урону: cells=${back?.cells}, w=${back?.w}`);
await S.page.screenshot({ path: path.join(S.OUT, '10-shapes.png') });

// Уборка: токены и предметы не должны мешать другим сценариям/скриншотам.
await S.page.evaluate(
  ({ mapId, ids }) => {
    const socket = window.__vtt.getState().socket;
    for (const id of ids) socket.emit('token:remove', { mapId, id });
    const lib = window.__vtt.getState().library;
    for (const name of ['Друид-Э2Э', 'Манекен-Э2Э']) {
      const item = lib.find((i) => i.name === name);
      if (item) socket.emit('library:remove', item.id);
    }
  },
  { mapId: setup.mapId, ids: [setup.tokenId, dummyId] }
);
await new Promise((r) => setTimeout(r, 300));
