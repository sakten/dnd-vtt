import { S } from './state.mjs';
import { check } from '../lib/check.mjs';
import { waitFor } from '../lib/e2e-helpers.mjs';
import path from 'node:path';

const chatInput = await S.page.$('.chat-input input[type=text]');
await chatInput.type('d20+3');
await chatInput.press('Enter');
await waitFor(S.page, () => document.querySelectorAll('.chat-msg.roll').length >= 1);
await chatInput.type('Всем привет!');
await chatInput.press('Enter');
await waitFor(S.page, () => [...document.querySelectorAll('.chat-msg')].some((el) => el.textContent?.includes('Всем привет!')));
const dmRolls = await S.page.$$eval('.chat-msg.roll .roll-total-big', (els) => els.map((el) => el.textContent));
const dmTotal = Number(dmRolls[0]);
check(
  dmRolls.length === 1 && Number.isInteger(dmTotal) && dmTotal >= 4 && dmTotal <= 23,
  `бросок в чате DM отрисован: ${dmRolls[0] ?? 'нет'}`
);

await chatInput.focus();
await chatInput.press('ArrowUp');
await waitFor(S.page, () => document.querySelector('.chat-input input[type=text]').value === 'Всем привет!');
const hist1 = await chatInput.evaluate((el) => el.value);
await chatInput.press('ArrowUp');
await waitFor(S.page, () => document.querySelector('.chat-input input[type=text]').value === 'd20+3');
const hist2 = await chatInput.evaluate((el) => el.value);
await chatInput.press('ArrowDown');
await waitFor(S.page, () => document.querySelector('.chat-input input[type=text]').value === 'Всем привет!');
const hist3 = await chatInput.evaluate((el) => el.value);
await chatInput.press('ArrowDown');
await waitFor(S.page, () => document.querySelector('.chat-input input[type=text]').value === '');
const hist4 = await chatInput.evaluate((el) => el.value);
check(
  hist1 === 'Всем привет!' && hist2 === 'd20+3' && hist3 === 'Всем привет!' && hist4 === '',
  `стрелки вверх/вниз листают историю сообщений (${hist1} / ${hist2} / ${hist4})`
);
await chatInput.type('');

await chatInput.type('d4+d20+2');
await chatInput.press('Enter');
await waitFor(S.page, () => [...document.querySelectorAll('.chat-msg.roll')].some((el) => el.textContent?.includes('d20 + d4 + 2')));
const mixedLabels = await S.page.$$eval('.chat-msg.roll', (els) => els.map((el) => el.textContent));
check(
  mixedLabels.some((t) => t.includes('d20 + d4 + 2')),
  'кубы в формуле сортируются по убыванию сторон'
);

await S.page.click('.sheet-button');
await S.page.waitForSelector('.sheet-modal');
await S.page.screenshot({ path: path.join(S.OUT, '10b-sheet.png') });
  S.sheetInputs = await S.page.$$('.sheet-modal input[type=text]');
  await S.sheetInputs[0].click();
  await S.page.keyboard.down('Control');
  await S.page.keyboard.press('KeyA');
  await S.page.keyboard.up('Control');
