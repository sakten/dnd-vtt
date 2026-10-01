import type { ValueExpr } from 'shared';
import { t } from '../i18n';

/** Литеральный запас ссылки (`{ref, fallback}`) для предпросмотра и перевода на «свои». */
export function fallbackSeed(value: ValueExpr | undefined): string {
  if (!value || typeof value !== 'object') return '';
  const fallback = (value as { fallback?: unknown }).fallback;
  return typeof fallback === 'string' || typeof fallback === 'number' ? String(fallback) : '';
}

/**
 * Значение спека: литерал правится полем; ссылка (`{ref}`/`tiers`/`concat`)
 * показывается как «Из данных» с предпросмотром и кнопкой «Свои», которая
 * заменяет ссылку литералом.
 */
export function ExprField({
  value,
  onChange,
  placeholder,
  seed,
}: {
  value: ValueExpr | undefined;
  onChange: (value: ValueExpr | undefined) => void;
  placeholder?: string;
  /** Стартовое значение для кнопки «Свои», если у ссылки нет `fallback`. */
  seed?: string;
}) {
  if (value === undefined || typeof value === 'string' || typeof value === 'number') {
    return (
      <input
        type="text"
        placeholder={placeholder}
        value={value === undefined ? '' : String(value)}
        onChange={(e) => {
          const text = e.target.value.trim();
          if (!text) {
            onChange(undefined);
            return;
          }
          onChange(/^-?\d+$/.test(text) ? Number(text) : text);
        }}
      />
    );
  }
  const preview = seed || fallbackSeed(value);
  return (
    <span className="expr-ref">
      <span className="hint">
        {preview ? t('ui.constructor.fromDataValue', { value: preview }) : t('ui.constructor.fromData')}
      </span>
      <button type="button" aria-label={t('ui.constructor.ownValue')} onClick={() => onChange(preview || undefined)}>
        {t('ui.constructor.ownValue')}
      </button>
    </span>
  );
}
