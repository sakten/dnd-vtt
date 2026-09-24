import { summarize } from './lib/check.mjs';
import { S } from './smoke/state.mjs';
import { deleteNewRooms, snapshotRoomCodes } from './lib/rooms-cleanup.mjs';

S.URL = process.env.VTT_URL ?? 'http://localhost:3001';
const baseline = await snapshotRoomCodes(S.URL);
S.cleanup = () => deleteNewRooms(S.URL, baseline);

// Реестр сценариев: код (для SMOKE_ONLY) и файл. Порядок = порядок прогона.
const SCENARIOS = [
  ['00', './smoke/00-setup.mjs'],
  ['01', './smoke/01-maps-library.mjs'],
  ['02', './smoke/02-combat.mjs'],
  ['03', './smoke/03-fog.mjs'],
  ['04', './smoke/04-attacks.mjs'],
  ['04b', './smoke/04b-spells.mjs'],
  ['08', './smoke/08-conditions.mjs'],
  ['09', './smoke/09-effects.mjs'],
  ['10', './smoke/10-test-mode.mjs'],
  ['11', './smoke/11-concentration.mjs'],
  ['12', './smoke/12-roll-anim.mjs'],
  ['13', './smoke/13-summons.mjs'],
  ['14', './smoke/14-shapes.mjs'],
  ['15', './smoke/15-masteries.mjs'],
  ['16', './smoke/16-shillelagh.mjs'],
  ['05', './smoke/05-admin-persistence.mjs'],
  ['06', './smoke/06-robustness.mjs'],
];

// SMOKE_ONLY=09,10 — дебаг-прогон: 00-setup + выбранные сценарии (зависимости
// от предыдущих сценариев не подтягиваются, выбирайте самодостаточные).
const only = (process.env.SMOKE_ONLY ?? '')
  .split(/[\s,]+/)
  .filter(Boolean);
const known = SCENARIOS.map(([code]) => code).join(', ');
const unknown = only.filter((code) => !SCENARIOS.some(([c]) => c === code));
if (unknown.length) {
  console.error(`SMOKE_ONLY: неизвестный сценарий «${unknown.join(', ')}». Доступно: ${known}`);
  process.exit(1);
}
const selected = only.length
  ? SCENARIOS.filter(([code]) => code === '00' || only.includes(code))
  : SCENARIOS;
if (only.length) console.log(`SMOKE_ONLY: ${selected.map(([code]) => code).join(', ')}`);

try {
  for (const [, file] of selected) {
    await import(file);
  }
} finally {
  clearTimeout(S.watchdog);
  await S.browser?.close();
  await S.cleanup();
}

const { ok, passed, failed } = summarize();
console.log(`${ok ? 'SMOKE OK' : 'SMOKE FAILED'} (проверок: ${passed + failed}, провалов: ${failed})`);
process.exit(ok ? 0 : 1);
