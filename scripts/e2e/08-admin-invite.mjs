import { S } from './state.mjs';
import { check, sleep } from '../lib/check.mjs';
import { errors, attachErrorLog, findButton } from '../lib/e2e-helpers.mjs';

const n3 = await S.page3.$$('.admin-card input[type=text]');
await n3[0].type('Третий');
const createBtn3 = await findButton(S.page3, '.join-actions button', 'Создать новую игру');
await createBtn3.click();
await S.page3.waitForSelector('.table-screen');
const codeY = await S.page3.evaluate(() => window.__vtt.getState().roomCode);
const page3Role = await S.page3.evaluate(() => window.__vtt.getState().role);
check(page3Role === 'dm', 'создание из страницы ведущего даёт роль DM');
await S.ctx3.close();

await S.page2.goto(`${S.BASE}?room=${codeY}`, { waitUntil: 'networkidle0' });
await S.page2.waitForSelector('.room-badge strong');
const badge2 = await S.page2.evaluate(() => window.__vtt.getState().roomCode);
check(badge2 === codeY, `инвайт-ссылка приоритетнее сохранённой комнаты (перешёл в ${badge2})`);

await S.page2.goto(S.BASE, { waitUntil: 'networkidle0' });
await S.page2.waitForSelector('.join-card');

const deadImageUrl = await S.page.evaluate(() => {
  const s = window.__vtt.getState();
  return s.scene.maps.find((m) => m.id === s.viewMapId)?.url ?? '';
});
await S.page.evaluate(
  (imageUrl) =>
    window.__vtt.getState().addLibraryItem({
      name: 'Мертвец-Е2Е',
      imageUrl,
      cells: 1,
      round: false,
      description: '',
      initiativeBonus: '',
      ac: '10',
      hpMax: '10',
    }),
  deadImageUrl
);
await S.page.waitForFunction(() => window.__vtt.getState().library.some((i) => i.name === 'Мертвец-Е2Е'));
const deadLibId = await S.page.evaluate(
  () => window.__vtt.getState().library.find((i) => i.name === 'Мертвец-Е2Е').id
);
await S.page.evaluate((id) => window.__vtt.getState().addTokenAt(id, 120, 120), deadLibId);
await S.page.waitForFunction(
  (id) => window.__vtt.getState().scene.maps.some((m) => m.tokens.some((t) => t.libraryItemId === id)),
  {},
  deadLibId
);
const deadTokenId = await S.page.evaluate((id) => {
  for (const m of window.__vtt.getState().scene.maps) {
    for (const t of m.tokens) if (t.libraryItemId === id) return t.id;
  }
  return null;
}, deadLibId);
await S.page.evaluate((id) => window.__vtt.getState().setTokenFields(id, { hpCurrent: 0 }), deadTokenId);
await S.page.waitForFunction(
  (id) => window.__vtt.getState().scene.maps.some((m) => m.tokens.some((t) => t.id === id && t.hpCurrent === 0)),
  {},
  deadTokenId
);

const dmPlayerId = await S.page.evaluate(() => localStorage.getItem('vtt-player'));
const dmName = await S.page.evaluate(() => localStorage.getItem('vtt-name'));
const ctx5 = await S.browser.createBrowserContext();
const page5 = await ctx5.newPage();
await page5.setViewport({ width: 1200, height: 800 });
await attachErrorLog(page5, 'INVITE');
await page5.evaluateOnNewDocument(
  ({ id, name }) => {
    localStorage.setItem('vtt-player', id);
    localStorage.setItem('vtt-name', name);
  },
  { id: dmPlayerId, name: dmName }
);
await page5.goto(`${S.BASE}?room=${S.code}`, { waitUntil: 'networkidle0' });
await page5.waitForSelector('.table-screen');
await sleep(800);
const inviteState = await page5.evaluate(() => ({
  role: window.__vtt.getState().role,
  hasDead: window.__vtt.getState().scene.maps.some((m) => m.tokens.some((t) => t.hpCurrent === 0)),
}));
const inviteCanvases = await page5.$$eval('canvas', (els) => els.length);
check(inviteState.role === 'dm', 'автовход по инвайт-ссылке с сохранённым именем даёт роль DM');
check(inviteState.hasDead && inviteCanvases > 0, 'стол с мёртвым токеном отрисовался при автовходе');
await ctx5.close();

const ctx4 = await S.browser.createBrowserContext();
const page4 = await ctx4.newPage();
await page4.setViewport({ width: 1200, height: 800 });
await page4.goto(`${S.BASE}?admin=1`, { waitUntil: 'networkidle0' });
await page4.waitForSelector('.admin-room');
const roomsBefore = await page4.$$eval('.admin-room', (els) => els.length);
let targetRow = null;
for (const row of await page4.$$('.admin-room')) {
  const t = await row.$eval('.admin-room-code', (el) => el.textContent);
  if (t === codeY) {
    targetRow = row;
    break;
  }
}
check(!!targetRow, 'нашлась строка собственной тестовой комнаты для проверки удаления');
const nameEl = await targetRow.$('.admin-room-name');
await nameEl.evaluate((el) => el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true })));
await page4.waitForSelector('.admin-room-name-input');
await page4.evaluate(() => {
  const el = document.querySelector('.admin-room-name-input');
  el.focus();
  el.value = '';
});
await page4.keyboard.type('Переименовано', { delay: 30 });
await page4.keyboard.press('Enter');
await sleep(500);
const renamedList = await page4.evaluate(
  () =>
    new Promise((resolve) =>
      window.__vtt.getState().socket.emit('admin:list', { adminToken: '' }, (res) => resolve(res))
    )
);
check(
  renamedList.rooms.some((r) => r.code === codeY && r.name === 'Переименовано'),
  'двойной клик по имени переименовывает комнату'
);
await targetRow.$eval('button.danger', (el) => el.click());
await page4.waitForSelector('.modal');
const confirmDeleteBtn = await findButton(page4, '.modal button', 'Удалить');
await confirmDeleteBtn.click();
await sleep(1000);
const roomsAfter = await page4.$$eval('.admin-room', (els) => els.length);
check(roomsAfter === roomsBefore - 1, `удаление комнаты с подтверждением работает (${roomsBefore} -> ${roomsAfter})`);

await page4.evaluate(
  (c) =>
    new Promise((resolve) =>
      window.__vtt.getState().socket.emit('admin:delete', { adminToken: '', code: c }, () => resolve(true))
    ),
  S.code
);
await sleep(1000);
const refreshBtn = await findButton(page4, '.join-actions button', 'Обновить');
await refreshBtn.click();
await sleep(800);
const roomsFinal = await page4.$$eval('.admin-room', (els) => els.length);
check(roomsFinal === roomsBefore - 2, `тестовые комнаты удалены после теста (${roomsBefore} -> ${roomsFinal})`);
await ctx4.close();

const realErrors = errors.filter((e) => !e.includes('403'));
check(realErrors.length === 0, `нет ошибок в консоли браузера${realErrors.length ? ': ' + realErrors.join(' | ') : ''}`);

