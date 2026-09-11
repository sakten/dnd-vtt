import { summarize } from './lib/check.mjs';
import { S } from './e2e/state.mjs';
import { deleteNewRooms, snapshotRoomCodes } from './lib/rooms-cleanup.mjs';

try {
  await import('./e2e/00-setup.mjs');
  const baseline = await snapshotRoomCodes(S.BASE);
  S.cleanup = () => deleteNewRooms(S.BASE, baseline);
  await import('./e2e/01-join.mjs');
  await import('./e2e/02-map-grid.mjs');
  await import('./e2e/03-tokens.mjs');
  await import('./e2e/04-chat.mjs');
  await import('./e2e/05-sheet-rolls.mjs');
  await import('./e2e/06-maps2.mjs');
  await import('./e2e/07-player-fog.mjs');
  await import('./e2e/08-admin-invite.mjs');
} finally {
  clearTimeout(S.watchdog);
  await S.browser?.close();
  await S.cleanup?.();
}

const { ok, passed, failed } = summarize();
console.log(`${ok ? 'E2E OK' : 'E2E FAILED'} (проверок: ${passed + failed}, провалов: ${failed})`);
process.exit(ok ? 0 : 1);
