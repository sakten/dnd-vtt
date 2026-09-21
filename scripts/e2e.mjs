import { summarize } from './lib/check.mjs';
import { S } from './e2e/state.mjs';
import { deleteNewRooms, snapshotRoomCodes } from './lib/rooms-cleanup.mjs';

// Реестр сценариев: код (для E2E_ONLY) и файл. Порядок = порядок прогона.
// 08 (админка) удаляет основную комнату — он всегда последний.
const SCENARIOS = [
  ['01', './e2e/01-join.mjs'],
  ['02', './e2e/02-map-grid.mjs'],
  ['03', './e2e/03-tokens.mjs'],
  ['04', './e2e/04-chat.mjs'],
  ['05', './e2e/05-sheet-rolls.mjs'],
  ['06', './e2e/06-maps2.mjs'],
  ['07', './e2e/07-player-fog.mjs'],
  ['09', './e2e/09-walls.mjs'],
  ['10', './e2e/10-shapes.mjs'],
  ['08', './e2e/08-admin-invite.mjs'],
];

// Опциональные сценарии: в полный прогон не входят, запуск — только через E2E_ONLY.
const OPTIONAL = [['11', './e2e/11-action-economy.mjs']];
const ALL = [...SCENARIOS, ...OPTIONAL];

// E2E_ONLY=02,09 — дебаг-прогон: 00-setup + выбранные сценарии. Зависимости от
// предыдущих сценариев не подтягиваются (выбирайте пары вида «подготовка+цель»).
const only = (process.env.E2E_ONLY ?? '')
  .split(/[\s,]+/)
  .filter(Boolean);
const known = ALL.map(([code]) => code).join(', ');
const unknown = only.filter((code) => !ALL.some(([c]) => c === code));
if (unknown.length) {
  console.error(`E2E_ONLY: неизвестный сценарий «${unknown.join(', ')}». Доступно: ${known}`);
  process.exit(1);
}
const selected = only.length ? ALL.filter(([code]) => only.includes(code)) : SCENARIOS;
if (only.length) console.log(`E2E_ONLY: 00, ${selected.map(([code]) => code).join(', ')}`);

try {
  await import('./e2e/00-setup.mjs');
  const baseline = await snapshotRoomCodes(S.BASE);
  S.cleanup = () => deleteNewRooms(S.BASE, baseline);
  for (const [, file] of selected) {
    await import(file);
  }
} finally {
  clearTimeout(S.watchdog);
  await S.browser?.close();
  await S.cleanup?.();
}

const { ok, passed, failed } = summarize();
console.log(`${ok ? 'E2E OK' : 'E2E FAILED'} (проверок: ${passed + failed}, провалов: ${failed})`);
process.exit(ok ? 0 : 1);
