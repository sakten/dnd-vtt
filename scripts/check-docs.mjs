import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const ROOT = process.cwd();
const failures = [];

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile() && entry.name.endsWith('.md')) out.push(full);
  }
  return out;
}

function checkSize(file, limits) {
  const bytes = statSync(file).size;
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  const maxLine = Math.max(...lines.map((line) => line.length));
  const rel = file.startsWith(ROOT) ? file.slice(ROOT.length + 1) : file;
  if (limits.bytes && bytes > limits.bytes) failures.push(`${rel}: ${bytes} bytes > ${limits.bytes}`);
  if (limits.lines && lines.length > limits.lines) failures.push(`${rel}: ${lines.length} lines > ${limits.lines}`);
  if (limits.line && maxLine > limits.line) failures.push(`${rel}: line ${maxLine} > ${limits.line}`);
}

function checkLinks(file) {
  const body = readFileSync(file, 'utf8');
  for (const match of body.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
    const raw = match[1]?.trim().replace(/^<|>$/g, '');
    if (!raw || /^(https?:|mailto:|tel:|#)/.test(raw)) continue;
    const target = raw.split('#')[0]?.split('?')[0];
    if (!target) continue;
    const full = resolve(dirname(file), target);
    if (!existsSync(full)) failures.push(`${file.slice(ROOT.length + 1)}: missing link ${raw}`);
  }
}

const rootFiles = [
  ['README.md', { bytes: 8000, lines: 160, line: 500 }],
  ['ARCHITECTURE.md', { bytes: 10000, lines: 150, line: 300 }],
  ['AUTOMATION.md', { bytes: 12000, lines: 160, line: 500 }],
  ['REFACTOR.md', { bytes: 12000, lines: 160, line: 500 }],
  ['ROADMAP.md', { bytes: 12000, lines: 120, line: 300 }],
  ['TODO.md', { bytes: 8000, lines: 100, line: 300 }],
];
for (const [file, limits] of rootFiles) {
  const full = join(ROOT, file);
  checkSize(full, limits);
  checkLinks(full);
}

const todo = readFileSync(join(ROOT, 'TODO.md'), 'utf8');
const activeTodos = (todo.match(/^- \[ \]/gm) ?? []).length;
if (activeTodos > 10) failures.push(`TODO.md: ${activeTodos} active items > 10`);
if (/^- \[x\]/im.test(todo)) failures.push('TODO.md: completed items are not allowed');

const docsDir = join(ROOT, 'docs');
const docs = existsSync(docsDir) ? walk(docsDir) : [];
for (const file of docs) {
  const isBacklog = /[/\\]backlog[/\\]/.test(file);
  checkSize(file, isBacklog ? { bytes: 30000, lines: 200, line: 2000 } : { bytes: 20000, line: 500 });
  checkLinks(file);
}

if (failures.length) {
  console.error('docs check failed:');
  for (const failure of failures.slice(0, 20)) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`docs check OK (${docs.length + rootFiles.length} files)`);
