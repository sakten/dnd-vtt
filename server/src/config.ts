const DEFAULT_ROOM_QUOTA_MB = 500;

function readPositiveNumber(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Лимит загрузок на комнату (МБ), env `VTT_ROOM_QUOTA_MB`, по умолчанию 500. */
export const ROOM_QUOTA_MB = readPositiveNumber(process.env.VTT_ROOM_QUOTA_MB, DEFAULT_ROOM_QUOTA_MB);
export const ROOM_QUOTA_BYTES = ROOM_QUOTA_MB * 1024 * 1024;
