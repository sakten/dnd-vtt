import { S } from './state.mjs';
import { check, sleep } from '../lib/check.mjs';
import { findButton, waitFor } from '../lib/e2e-helpers.mjs';
import path from 'node:path';

  await S.page.keyboard.type('Конан', { delay: 30 });
const abilityInputs = await S.page.$$('[data-testid="sheet-modal"] [data-testid="ability-cell"] input');
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
const saveChecks = await S.page.$$('[data-testid="sheet-modal"] [data-testid="save-grid"] input');
await saveChecks[1].click();
const stealthRow = await findButton(S.page, '[data-testid="sheet-modal"] [data-testid="skill-row"]', 'Скрытность');
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
const saveSheetBtn = await findButton(S.page, '[data-testid="sheet-modal"] button', 'Сохранить');
await saveSheetBtn.click();
await S.page.waitForFunction(() => !document.querySelector('[data-testid="sheet-modal"]'));
await waitFor(S.page, () => window.__vtt.getState().sheet?.name === 'Конан', 8000);
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

// Атаки из ROLL-меню требуют клика по цели на карте. Ставим цели AC 1, чтобы
// попадание было почти гарантированным (нат. 1 всё равно промах — это допустимо).
const attackTarget = await S.page.evaluate(() => {
  const s = window.__vtt.getState();
  const t = s.scene.maps.find((m) => m.id === s.viewMapId)?.tokens[1];
  if (!t) return null;
  s.setTokenFields(t.id, { ac: 1 });
  return {
    id: t.id,
    prevAc: typeof t.ac === 'number' ? t.ac : 0,
    sx: t.x * s.view.scale + s.view.x,
    sy: t.y * s.view.scale + s.view.y,
  };
});
check(!!attackTarget, 'на карте есть цель для атаки из ROLL-меню');

await S.page.click('[data-testid="roll-button"]');
await S.page.waitForSelector('[data-testid="roll-menu"]');
const attackItem = await findButton(S.page, '[data-testid="roll-menu"] [data-testid="roll-menu-item"]', 'Attack');
await attackItem.click();
await S.page.waitForSelector('[data-testid="aim-panel"]');
await S.page.mouse.click(attackTarget.sx, attackTarget.sy);
await waitFor(S.page, () => [...document.querySelectorAll('[data-testid="chat-msg-roll"]')].some((el) => el.textContent?.includes('Атака: Меч')));
const attackLabels = await S.page.$$eval('[data-testid="chat-msg-roll"]', (els) => els.map((el) => el.textContent));
const attackHit = attackLabels.some((t) => t.includes('Атака: Меч') && t.includes('d20 + 5'));
const attackDamage = attackLabels.some((t) => t.includes('Урон: Меч') && t.includes('d8 + 3'));
const attackMiss = attackLabels.some((t) => t.includes('Атака: Меч') && t.includes('Промах'));
check(
  attackHit && (attackDamage || attackMiss),
  `Attack кинул попадание, урон при попадании (${attackLabels.join(' | ')})`
);

await S.page.click('[data-testid="roll-button"]');
await (await findButton(S.page, '[data-testid="roll-menu"] [data-testid="roll-menu-item"]', 'Save')).click();
await waitFor(S.page, () => [...document.querySelectorAll('[data-testid="roll-menu"] [data-testid="roll-menu-item"]')].some((el) => el.textContent?.includes('Ловкость')));
await (await findButton(S.page, '[data-testid="roll-menu"] [data-testid="roll-menu-item"]', 'Ловкость')).click();
await waitFor(S.page, () => [...document.querySelectorAll('[data-testid="chat-msg-roll"]')].some((el) => el.textContent?.includes('Спасбросок: Ловкость')));
const saveLabels = await S.page.$$eval('[data-testid="chat-msg-roll"]', (els) => els.map((el) => el.textContent));
check(
  saveLabels.some((t) => t.includes('Спасбросок: Ловкость') && t.includes('d20 + d4 + 3')),
  `Save кидает модификатор + ПБ-куб, кубы раньше чисел (${saveLabels[saveLabels.length - 1]})`
);

await S.page.click('[data-testid="roll-button"]');
await (await findButton(S.page, '[data-testid="roll-menu"] [data-testid="roll-menu-item"]', 'Check')).click();
await waitFor(S.page, () => [...document.querySelectorAll('[data-testid="roll-menu"] [data-testid="roll-menu-item"]')].some((el) => el.textContent?.includes('Ловкость')));
await (await findButton(S.page, '[data-testid="roll-menu"] [data-testid="roll-menu-item"]', 'Ловкость')).click();
await waitFor(S.page, () => [...document.querySelectorAll('[data-testid="roll-menu"] [data-testid="roll-menu-item"]')].some((el) => el.textContent?.includes('Скрытность')));
await (await findButton(S.page, '[data-testid="roll-menu"] [data-testid="roll-menu-item"]', 'Скрытность')).click();
await waitFor(S.page, () => [...document.querySelectorAll('[data-testid="chat-msg-roll"]')].some((el) => el.textContent?.includes('Проверка: Скрытность')));
const checkLabels = await S.page.$$eval('[data-testid="chat-msg-roll"]', (els) => els.map((el) => el.textContent));
check(
  checkLabels.some((t) => t.includes('Проверка: Скрытность') && t.includes('d20 + 2d4 + 3')),
  'Check кидает экспертизу как двойной ПБ-куб, кубы раньше чисел'
);

const rollCountBefore = await S.page.$$eval('[data-testid="chat-msg-roll"]', (els) => els.length);
const firstRoll = await S.page.$('[data-testid="chat-msg-roll"]');
await firstRoll.click();
await S.page.waitForFunction((n) => document.querySelectorAll('[data-testid="chat-msg-roll"]').length > n, {}, rollCountBefore);
const rollCountAfter = await S.page.$$eval('[data-testid="chat-msg-roll"]', (els) => els.length);
check(rollCountAfter === rollCountBefore + 1, 'клик по броску повторяет его');

const advChecks = await S.page.$$('[data-testid="adv-check"] input');
await advChecks[0].click();
await waitFor(S.page, () => document.querySelectorAll('[data-testid="adv-check"] input')[0]?.checked === true);
await advChecks[1].click();
await waitFor(S.page, () => document.querySelectorAll('[data-testid="adv-check"] input')[1]?.checked === true);
const bothChecked = await S.page.$$eval('[data-testid="adv-check"] input', (els) => els.map((el) => el.checked));
check(bothChecked[0] === false && bothChecked[1] === true, 'Adv и Dis не могут быть выбраны одновременно');
await advChecks[1].click();
await waitFor(S.page, () => document.querySelectorAll('[data-testid="adv-check"] input')[1]?.checked === false);
await advChecks[0].click();
await waitFor(S.page, () => document.querySelectorAll('[data-testid="adv-check"] input')[0]?.checked === true);
const advOnly = await S.page.$$eval('[data-testid="adv-check"] input', (els) => els.map((el) => el.checked));
check(advOnly[0] === true && advOnly[1] === false, 'выбор Adv снимает Dis');
await S.page.click('[data-testid="roll-button"]');
await (await findButton(S.page, '[data-testid="roll-menu"] [data-testid="roll-menu-item"]', 'Attack')).click();
await S.page.waitForSelector('[data-testid="aim-panel"]');
await S.page.mouse.click(attackTarget.sx, attackTarget.sy);
await waitFor(S.page, () => [...document.querySelectorAll('[data-testid="chat-msg-roll"]')].some((el) => el.textContent?.includes('d20a')));
const advLabels = await S.page.$$eval('[data-testid="chat-msg-roll"]', (els) => els.map((el) => el.textContent));
const advHit = advLabels.some((t) => t.includes('Атака: Меч') && t.includes('d20a'));
const advDamage = advLabels.some((t) => t.includes('Урон: Меч') && t.includes('d8 + 3'));
const advMiss = advLabels.some((t) => t.includes('Атака: Меч') && t.includes('Промах'));
check(
  advHit && (advDamage || advMiss),
  'Adv: попадание кидается с преимуществом, урон без изменений'
);
await S.page.evaluate(
  ({ id, ac }) => window.__vtt.getState().setTokenFields(id, { ac }),
  { id: attackTarget.id, ac: attackTarget.prevAc }
);
const advState = await S.page.$$eval('[data-testid="adv-check"] input', (els) => els.map((el) => el.checked));
check(advState[0] === false && advState[1] === false, 'галочки Adv/Dis сбрасываются после броска');

const disChecks = await S.page.$$('[data-testid="adv-check"] input');
await disChecks[1].click();
await waitFor(S.page, () => document.querySelectorAll('[data-testid="adv-check"] input')[1]?.checked === true);
await S.page.click('[data-testid="roll-button"]');
await (await findButton(S.page, '[data-testid="roll-menu"] [data-testid="roll-menu-item"]', 'Save')).click();
await waitFor(S.page, () => [...document.querySelectorAll('[data-testid="roll-menu"] [data-testid="roll-menu-item"]')].some((el) => el.textContent?.includes('Ловкость')));
await (await findButton(S.page, '[data-testid="roll-menu"] [data-testid="roll-menu-item"]', 'Ловкость')).click();
await waitFor(S.page, () => [...document.querySelectorAll('[data-testid="chat-msg-roll"]')].some((el) => el.textContent?.includes('d20d')));
const disLabels = await S.page.$$eval('[data-testid="chat-msg-roll"]', (els) => els.map((el) => el.textContent));
check(
  disLabels.some((t) => t.includes('Спасбросок: Ловкость') && t.includes('d20d')),
  'Dis: спасбросок кидается с помехой'
);

await S.page.click('[data-testid="sheet-button"]');
await S.page.waitForSelector('[data-testid="sheet-modal"]');
const weaponsBefore = await S.page.$$eval('[data-testid="sheet-modal"] [data-testid="weapon-block"]', (els) => els.length);
await (await findButton(S.page, '[data-testid="sheet-modal"] button', 'Добавить атаку')).click();
await S.page.waitForFunction((n) => document.querySelectorAll('[data-testid="sheet-modal"] [data-testid="weapon-block"]').length > n, {}, weaponsBefore);
const weaponsAdded = await S.page.$$eval('[data-testid="sheet-modal"] [data-testid="weapon-block"]', (els) => els.length);
await (await S.page.$('[data-testid="sheet-modal"] [data-testid="weapon-remove"]')).click();
await S.page.waitForFunction(() => document.querySelectorAll('[data-testid="sheet-modal"] [data-testid="weapon-block"]').length === 1);
const weaponsRemoved = await S.page.$$eval('[data-testid="sheet-modal"] [data-testid="weapon-block"]', (els) => els.length);
check(
  weaponsBefore === 1 && weaponsAdded === 2 && weaponsRemoved === 1,
  `оружие добавляется и удаляется (${weaponsBefore} -> ${weaponsAdded} -> ${weaponsRemoved})`
);
await S.page.keyboard.press('Escape');
await S.page.waitForFunction(() => !document.querySelector('[data-testid="sheet-modal"]'));

await S.fileInputs[0].uploadFile(S.map2Path);
await waitFor(S.page, () => window.__vtt.getState().scene.maps.length >= 2, 8000);
