const DEFAULT_ROOM_QUOTA_MB = 500;
const DEFAULT_SAVE_DEBOUNCE_MS = 120000;
const DEFAULT_CHAT_SAVE_DEBOUNCE_MS = 120000;

function readPositiveNumber(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Лимит загрузок на комнату (МБ), env `VTT_ROOM_QUOTA_MB`, по умолчанию 500. */
export const ROOM_QUOTA_MB = readPositiveNumber(process.env.VTT_ROOM_QUOTA_MB, DEFAULT_ROOM_QUOTA_MB);
export const ROOM_QUOTA_BYTES = ROOM_QUOTA_MB * 1024 * 1024;

/** Дебаунс записи комнаты (мс), env `VTT_SAVE_DEBOUNCE_MS`, по умолчанию 2 мин. */
export const SAVE_DEBOUNCE_MS = readPositiveNumber(process.env.VTT_SAVE_DEBOUNCE_MS, DEFAULT_SAVE_DEBOUNCE_MS);
/** Дебаунс записи чата (мс), env `VTT_CHAT_SAVE_DEBOUNCE_MS`, по умолчанию 2 мин (только при изменении). */
export const CHAT_SAVE_DEBOUNCE_MS = readPositiveNumber(
  process.env.VTT_CHAT_SAVE_DEBOUNCE_MS,
  DEFAULT_CHAT_SAVE_DEBOUNCE_MS
);
