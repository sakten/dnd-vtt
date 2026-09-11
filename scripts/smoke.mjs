import { summarize } from './lib/check.mjs';
import { S } from './smoke/state.mjs';

await import('./smoke/00-setup.mjs');
await import('./smoke/01-maps-library.mjs');
await import('./smoke/02-combat.mjs');
await import('./smoke/03-fog.mjs');
await import('./smoke/04-attacks.mjs');
await import('./smoke/05-admin-persistence.mjs');
await import('./smoke/06-robustness.mjs');

clearTimeout(S.watchdog);
await S.browser?.close();
const { ok, passed, failed } = summarize();
console.log(`${ok ? 'SMOKE OK' : 'SMOKE FAILED'} (проверок: ${passed + failed}, провалов: ${failed})`);
process.exit(ok ? 0 : 1);
