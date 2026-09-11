import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

import { S } from './state.mjs';
import { attachErrorLog } from '../lib/e2e-helpers.mjs';
import { makePng } from '../lib/png.mjs';

S.watchdog = setTimeout(() => {
  console.log('E2E TIMEOUT');
  process.exit(1);
}, 300000);
S.watchdog.unref();


const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
S.BASE = 'http://localhost:3001';
S.OUT = path.resolve('artifacts/e2e');
fs.mkdirSync(S.OUT, { recursive: true });

S.mapPath = path.resolve(S.OUT, 'test-map.png');
fs.writeFileSync(
  S.mapPath,
  makePng(1000, 800, (x, y) => {
    const border = x < 4 || y < 4 || x >= 996 || y >= 796;
    if (border) return [90, 160, 90, 255];
    const onLine = x % 100 === 0 || y % 100 === 0;
    if (onLine) return [70, 78, 92, 255];
    return [46, 52, 64, 255];
  })
);

S.map2Path = path.resolve(S.OUT, 'test-map2.png');
fs.writeFileSync(
  S.map2Path,
  makePng(800, 600, (x, y) => {
    const border = x < 4 || y < 4 || x >= 796 || y >= 596;
    if (border) return [160, 120, 60, 255];
    const onLine = x % 80 === 0 || y % 80 === 0;
    if (onLine) return [110, 88, 55, 255];
    return [70, 60, 44, 255];
  })
);

S.tokenPath = path.resolve(S.OUT, 'test-token.png');
fs.writeFileSync(
  S.tokenPath,
  makePng(200, 200, (x, y) => {
    const d = Math.sqrt((x - 100) ** 2 + (y - 100) ** 2);
    if (d < 90) return [220, 66, 66, 255];
    if (d < 96) return [120, 30, 30, 255];
    return [0, 0, 0, 0];
  })
);

S.tokenSquarePath = path.resolve(S.OUT, 'test-token-square.png');
fs.writeFileSync(S.tokenSquarePath, makePng(200, 200, () => [220, 66, 66, 255]));


S.browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'],
});

S.page = await (await S.browser.createBrowserContext()).newPage();
await S.page.setViewport({ width: 1440, height: 900 });
await attachErrorLog(S.page, 'DM');
