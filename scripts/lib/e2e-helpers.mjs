export const errors = [];

/** Ждёт выполнения условия в браузере: fn(state-условие), arg — аргумент для fn. */
export async function waitFor(page, fn, timeout = 5000, arg) {
  const t0 = Date.now();
  for (;;) {
    if (await page.evaluate(fn, arg)) return;
    if (Date.now() - t0 > timeout) throw new Error('waitFor timeout');
    await new Promise((r) => setTimeout(r, 40));
  }
}

/** Ждёт перерисовки кадра (двойной requestAnimationFrame). */
export async function nextFrame(page) {
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
}

export async function findButton(page, selector, text) {
  const handles = await page.$$(selector);
  for (const h of handles) {
    const t = await h.evaluate((el) => el.textContent ?? '');
    if (t.includes(text)) return h;
  }
  return null;
}

export function attachErrorLog(page, label) {
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`${label} console: ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`${label} pageerror: ${e.message}`));
}
