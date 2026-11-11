/**
 * Производные загруженных картинок: сервер рядом с оригиналом кладёт
 * `<url>.thumb.webp` (128), `<url>.token.webp` (256) и `<url>.screen.webp`
 * (до 4096 — превью карты для стола). Сами карты на столе — исходный файл,
 * старые загрузки сервер досоздаёт при первом запросе. Внешние URL не трогаем.
 */
const UPLOAD_IMAGE_RE = /^\/uploads\/.+\.(png|jpe?g|webp|gif)$/i;
const VARIANT_RE = /\.(thumb|token|screen)\.webp$/i;

function variant(url: string | null | undefined, kind: 'thumb' | 'token' | 'screen'): string | undefined {
  if (!url) return undefined;
  if (VARIANT_RE.test(url) || !UPLOAD_IMAGE_RE.test(url)) return url;
  return `${url}.${kind}.webp`;
}

/** Миниатюра для списков и панелей (128 px). */
export function thumbUrl(url: string | null | undefined): string | undefined {
  return variant(url, 'thumb');
}

/** Облегчённая картинка токена для стола (256 px). */
export function tokenImageUrl(url: string | null | undefined): string | undefined {
  return variant(url, 'token');
}

/** Превью карты для стола (до 4096 px): чёткое сразу, оригинал догружается фоном. */
export function screenUrl(url: string | null | undefined): string | undefined {
  return variant(url, 'screen');
}
