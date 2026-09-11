import { S } from './state.mjs';
import { check, sleep } from '../lib/check.mjs';
import { findButton } from '../lib/e2e-helpers.mjs';
import path from 'node:path';


await S.page.goto(S.BASE, { waitUntil: 'networkidle0' });
await S.page.waitForSelector('.join-card');
await S.page.screenshot({ path: path.join(S.OUT, '01-join.png') });

const title = await S.page.title();
check(title.includes('local'), `локальная версия помечена в заголовке (${title})`);
const iconHref = await S.page.evaluate(
  () => document.querySelector("link[rel='icon']")?.getAttribute('href') ?? ''
);
check(iconHref.includes('ffb454'), 'локальная версия использует отдельную иконку');

const nameInputs = await S.page.$$('.join-card input');
await nameInputs[0].type('Мастер');

await S.page.goto(`${S.BASE}?admin=1`, { waitUntil: 'networkidle0' });
await S.page.waitForSelector('.admin-card');
const createBtn = await findButton(S.page, '.join-actions button', 'Создать новую игру');
await createBtn.click();
await S.page.waitForSelector('.table-screen');
await S.page.waitForSelector('canvas');
await sleep(800);
await S.page.screenshot({ path: path.join(S.OUT, '02-empty-table.png') });
check(S.page.url().includes('room='), 'ссылка после входа содержит код комнаты');

const upStatus = await S.page.evaluate(async () => {
  const r = await fetch('/api/upload', { method: 'POST', body: new FormData() });
  return r.status;
});
check(upStatus === 403, 'загрузка файлов без участия в комнате запрещена (403)');
const codeLength = await S.page.evaluate(() => window.__vtt.getState().roomCode?.length ?? 0);
check(codeLength >= 10, `длинный токен комнаты (${codeLength} символов)`);
