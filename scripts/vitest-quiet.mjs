import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const cwd = process.cwd();
const dir = mkdtempSync(join(tmpdir(), 'vtt-vitest-'));
const report = join(dir, 'report.json');
const vitest = join(cwd, 'node_modules', 'vitest', 'vitest.mjs');
const result = spawnSync(
  process.execPath,
  [vitest, 'run', '--reporter=json', `--outputFile=${report}`, '--bail=1', ...process.argv.slice(2)],
  { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
);

let data;
try {
  data = JSON.parse(readFileSync(report, 'utf8'));
} catch {
  if (result.stdout) process.stdout.write(result.stdout.slice(-4000));
  if (result.stderr) process.stderr.write(result.stderr.slice(-4000));
  rmSync(dir, { recursive: true, force: true });
  process.exit(result.status ?? 1);
}

rmSync(dir, { recursive: true, force: true });
const files = data.testResults?.length ?? 0;
console.log(`vitest: ${data.numPassedTests} passed, ${data.numFailedTests} failed, ${data.numTotalTests} total, ${files} files`);
if (data.numFailedTests) {
  let shown = 0;
  for (const file of data.testResults ?? []) {
    for (const test of file.assertionResults ?? []) {
      if (test.status !== 'failed') continue;
      console.log(`FAIL ${test.fullName}`);
      const message = test.failureMessages?.join('\n').trim();
      if (message) console.log(message.slice(0, 1200));
      shown++;
      if (shown >= 10) break;
    }
    if (shown >= 10) break;
  }
}
process.exit(result.status ?? (data.numFailedTests ? 1 : 0));
