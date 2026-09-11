export const VERBOSE = process.env.VTT_VERBOSE === '1';
let ok = true;
let passed = 0;
let failed = 0;

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const check = (cond, label) => {
  if (cond) {
    passed++;
    if (VERBOSE) console.log('PASS -', label);
  } else {
    failed++;
    ok = false;
    console.log('FAIL -', label);
  }
};

export function summarize() {
  return { ok, passed, failed };
}
