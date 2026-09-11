const lastSent = new Map<string, number>();

export function throttled(key: string, ms: number, fn: () => void) {
  const now = Date.now();
  const prev = lastSent.get(key) ?? -Infinity;
  if (now - prev >= ms) {
    lastSent.set(key, now);
    fn();
  }
}
