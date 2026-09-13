import { summarize } from './lib/check.mjs';
import { S } from './smoke/state.mjs';
import { deleteNewRooms, snapshotRoomCodes } from './lib/rooms-cleanup.mjs';

S.URL = process.env.VTT_URL ?? 'http://localhost:3001';
const baseline = await snapshotRoomCodes(S.URL);
S.cleanup = () => deleteNewRooms(S.URL, baseline);

try {
  await import('./smoke/00-setup.mjs');
  await import('./smoke/01-maps-library.mjs');
  await import('./smoke/02-combat.mjs');
  await import('./smoke/03-fog.mjs');
  await import('./smoke/04-attacks.mjs');
  await import('./smoke/04b-spells.mjs');
  await import('./smoke/08-conditions.mjs');
  await import('./smoke/05-admin-persistence.mjs');
  await import('./smoke/06-robustness.mjs');
} finally {
  clearTimeout(S.watchdog);
  await S.browser?.close();
  await S.cleanup();
}

const { ok, passed, failed } = summarize();
console.log(`${ok ? 'SMOKE OK' : 'SMOKE FAILED'} (проверок: ${passed + failed}, провалов: ${failed})`);
process.exit(ok ? 0 : 1);
