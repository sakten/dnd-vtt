import { S } from './state.mjs';
import { check, sleep } from '../lib/check.mjs';
import { findButton } from '../lib/e2e-helpers.mjs';
import path from 'node:path';

  await S.page.keyboard.type('Конан', { delay: 30 });
const abilityInputs = await S.page.$$('.sheet-modal .ability-cell input');
await abilityInputs[0].click();
await S.page.keyboard.down('Control');
await S.page.keyboard.press('KeyA');
await S.page.keyboard.up('Control');
await S.page.keyboard.type('45', { delay: 30 });
await abilityInputs[1].click();
await S.page.keyboard.down('Control');
await S.page.keyboard.press('KeyA');
await S.page.keyboard.up('Control');
await S.page.keyboard.type('16', { delay: 30 });
await abilityInputs[2].evaluate((el) => {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(el, '-5');
  el.dispatchEvent(new Event('input', { bubbles: true }));
});
await S.sheetInputs[2].click();
await S.page.keyboard.down('Control');
await S.page.keyboard.press('KeyA');
await S.page.keyboard.up('Control');
await S.page.keyboard.type('d4', { delay: 30 });
const saveChecks = await S.page.$$('.sheet-modal .save-grid input');
await saveChecks[1].click();
const stealthRow = await findButton(S.page, '.sheet-modal .skill-row', 'Скрытность');
await stealthRow.click();
await sleep(150);
await stealthRow.click();
await S.sheetInputs[3].click();
await S.page.keyboard.type('Меч', { delay: 30 });
await S.sheetInputs[4].click();
await S.page.keyboard.down('Control');
await S.page.keyboard.press('KeyA');
await S.page.keyboard.up('Control');
await S.page.keyboard.type('d20+5', { delay: 30 });
await S.sheetInputs[5].click();
await S.page.keyboard.down('Control');
await S.page.keyboard.press('KeyA');
await S.page.keyboard.up('Control');
await S.page.keyboard.type('d8+3', { delay: 30 });
await S.page.screenshot({ path: path.join(S.OUT, '10c-sheet-filled.png') });
const saveSheetBtn = await findButton(S.page, '.sheet-modal button', 'Сохранить');
await saveSheetBtn.click();
await sleep(500);
const sheetState = await S.page.evaluate(() => window.__vtt.getState().sheet);
check(
  sheetState &&
    sheetState.name === 'Конан' &&
    sheetState.abilities.str === 30 &&
    sheetState.abilities.dex === 16 &&
    sheetState.abilities.con === 0 &&
    sheetState.proficiencyBonus === 'd4' &&
    sheetState.saves.dex === true &&
    sheetState.skills.stealth === 2 &&
    sheetState.attacks[0].hit === 'd20+5' &&
    sheetState.attacks[0].damage === 'd8+3',
  `карточка персонажа сохранилась (статы с клампом до 30) — ${JSON.stringify(sheetState?.abilities)}`
);

await S.page.click('.roll-button');
await S.page.waitForSelector('.roll-menu');
const attackItem = await findButton(S.page, '.roll-menu .roll-menu-item', 'Attack');
await attackItem.click();
await sleep(900);
const attackLabels = await S.page.$$eval('.chat-msg.roll', (els) => els.map((el) => el.textContent));
check(
  attackLabels.some((t) => t.includes('Атака: Меч') && t.includes('d20 + 5')) &&
    attackLabels.some((t) => t.includes('Урон: Меч') && t.includes('d8 + 3')),
  `Attack кинул попадание и урон в чат (${attackLabels.join(' | ')})`
);

await S.page.click('.roll-button');
await (await findButton(S.page, '.roll-menu .roll-menu-item', 'Save')).click();
await sleep(200);
await (await findButton(S.page, '.roll-menu .roll-menu-item', 'Ловкость')).click();
await sleep(800);
const saveLabels = await S.page.$$eval('.chat-msg.roll', (els) => els.map((el) => el.textContent));
check(
  saveLabels.some((t) => t.includes('Спасбросок: Ловкость') && t.includes('d20 + d4 + 3')),
  `Save кидает модификатор + ПБ-куб, кубы раньше чисел (${saveLabels[saveLabels.length - 1]})`
);

await S.page.click('.roll-button');
await (await findButton(S.page, '.roll-menu .roll-menu-item', 'Check')).click();
await sleep(200);
await (await findButton(S.page, '.roll-menu .roll-menu-item', 'Ловкость')).click();
await sleep(200);
await (await findButton(S.page, '.roll-menu .roll-menu-item', 'Скрытность')).click();
await sleep(800);
const checkLabels = await S.page.$$eval('.chat-msg.roll', (els) => els.map((el) => el.textContent));
check(
  checkLabels.some((t) => t.includes('Проверка: Скрытность') && t.includes('d20 + 2d4 + 3')),
  'Check кидает экспертизу как двойной ПБ-куб, кубы раньше чисел'
);

const rollCountBefore = await S.page.$$eval('.chat-msg.roll', (els) => els.length);
const firstRoll = await S.page.$('.chat-msg.roll');
await firstRoll.click();
await sleep(800);
const rollCountAfter = await S.page.$$eval('.chat-msg.roll', (els) => els.length);
check(rollCountAfter === rollCountBefore + 1, 'клик по броску повторяет его');

const advChecks = await S.page.$$('.adv-check input');
await advChecks[0].click();
await sleep(200);
await advChecks[1].click();
await sleep(200);
const bothChecked = await S.page.$$eval('.adv-check input', (els) => els.map((el) => el.checked));
check(bothChecked[0] === false && bothChecked[1] === true, 'Adv и Dis не могут быть выбраны одновременно');
await advChecks[1].click();
await sleep(200);
await advChecks[0].click();
await sleep(200);
const advOnly = await S.page.$$eval('.adv-check input', (els) => els.map((el) => el.checked));
check(advOnly[0] === true && advOnly[1] === false, 'выбор Adv снимает Dis');
await S.page.click('.roll-button');
await (await findButton(S.page, '.roll-menu .roll-menu-item', 'Attack')).click();
await sleep(900);
const advLabels = await S.page.$$eval('.chat-msg.roll', (els) => els.map((el) => el.textContent));
check(
  advLabels.some((t) => t.includes('Атака: Меч') && t.includes('d20a')) &&
    advLabels.some((t) => t.includes('Урон: Меч') && t.includes('d8 + 3')),
  'Adv: попадание кидается с преимуществом, урон без изменений'
);
const advState = await S.page.$$eval('.adv-check input', (els) => els.map((el) => el.checked));
check(advState[0] === false && advState[1] === false, 'галочки Adv/Dis сбрасываются после броска');

const disChecks = await S.page.$$('.adv-check input');
await disChecks[1].click();
await sleep(200);
await S.page.click('.roll-button');
await (await findButton(S.page, '.roll-menu .roll-menu-item', 'Save')).click();
await sleep(200);
await (await findButton(S.page, '.roll-menu .roll-menu-item', 'Ловкость')).click();
await sleep(800);
const disLabels = await S.page.$$eval('.chat-msg.roll', (els) => els.map((el) => el.textContent));
check(
  disLabels.some((t) => t.includes('Спасбросок: Ловкость') && t.includes('d20d')),
  'Dis: спасбросок кидается с помехой'
);

await S.fileInputs[0].uploadFile(S.map2Path);
await sleep(1200);
