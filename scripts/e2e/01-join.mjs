import { S } from './state.mjs';
import { check } from '../lib/check.mjs';
import { findButton, waitFor } from '../lib/e2e-helpers.mjs';
import path from 'node:path';


await S.page.goto(S.BASE, { waitUntil: 'networkidle0' });
await S.page.waitForSelector('[data-testid="join-card"]');
await S.page.screenshot({ path: path.join(S.OUT, '01-join.png') });

const title = await S.page.title();
check(title.includes('local'), `локальная версия помечена в заголовке (${title})`);
const iconHref = await S.page.evaluate(
  () => document.querySelector("link[rel='icon']")?.getAttribute('href') ?? ''
);
check(iconHref.includes('ffb454'), 'локальная версия использует отдельную иконку');

const nameInputs = await S.page.$$('[data-testid="join-card"] input');
await nameInputs[0].type('Мастер');

await S.page.goto(`${S.BASE}?admin=1`, { waitUntil: 'networkidle0' });
await S.page.waitForSelector('[data-testid="admin-card"]');
const createBtn = await findButton(S.page, '[data-testid="join-actions"] button', 'Создать новую игру');
await createBtn.click();
await S.page.waitForSelector('[data-testid="table-screen"]');
await S.page.waitForSelector('canvas');
await waitFor(S.page, () => !!(window.__vtt && window.__vtt.getState().roomCode));
await S.page.screenshot({ path: path.join(S.OUT, '02-empty-table.png') });
check(S.page.url().includes('room='), 'ссылка после входа содержит код комнаты');

const upStatus = await S.page.evaluate(async () => {
  const r = await fetch('/api/upload', { method: 'POST', body: new FormData() });
  return r.status;
});
check(upStatus === 403, 'загрузка файлов без участия в комнате запрещена (403)');
const codeLength = await S.page.evaluate(() => window.__vtt.getState().roomCode?.length ?? 0);
check(codeLength >= 10, `длинный токен комнаты (${codeLength} символов)`);

const langBefore = await S.page.evaluate(() => document.documentElement.lang);
const labelBefore = await S.page.$eval('[data-testid="lang-toggle"]', (el) => el.textContent);
await S.page.click('[data-testid="lang-toggle"]');
const langAfter = await S.page.evaluate(() => ({
  html: document.documentElement.lang,
  stored: localStorage.getItem('vtt-lang'),
  state: window.__vtt.getState().lang,
}));
const labelAfter = await S.page.$eval('[data-testid="lang-toggle"]', (el) => el.textContent);
check(langBefore === 'ru', `стартовый язык RU (${langBefore})`);
check(
  langAfter.html === 'en' && langAfter.stored === 'en' && langAfter.state === 'en',
  'переключатель включает EN и сохраняет выбор'
);
check(labelBefore === 'EN' && labelAfter === 'RU', `метка кнопки EN → RU (${labelBefore} → ${labelAfter})`);
const toolbarEn = await S.page.$eval('[data-testid="toolbar"]', (el) => el.textContent ?? '');
check(toolbarEn.includes('Grid') && toolbarEn.includes('Combat'), `интерфейс переключился без перезагрузки (${toolbarEn})`);
await S.page.click('[data-testid="lang-toggle"]');
const langBack = await S.page.evaluate(() => document.documentElement.lang);
const labelBack = await S.page.$eval('[data-testid="lang-toggle"]', (el) => el.textContent);
check(langBack === 'ru' && labelBack === 'EN', 'переключатель возвращает RU');
const toolbarRu = await S.page.$eval('[data-testid="toolbar"]', (el) => el.textContent ?? '');
check(toolbarRu.includes('Сетка'), 'RU возвращается без перезагрузки');
