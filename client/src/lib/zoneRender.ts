import { zoneVisionKind, type ZoneInstance } from 'shared';

const COLORS = ['#8b5cf6', '#ef4444', '#22c55e', '#eab308', '#06b6d4', '#f97316'];

/** Цвет зоны по её ключу-источнику (стабильный для всех клиентов). */
export function zoneColor(sourceKey: string): string {
  let hash = 0;
  for (let i = 0; i < sourceKey.length; i++) hash = (hash * 31 + sourceKey.charCodeAt(i)) | 0;
  return COLORS[Math.abs(hash) % COLORS.length]!;
}

export interface ZoneStyle {
  kind: 'magical-darkness' | 'obscured' | 'effect';
  fill: string;
  fillAlpha: number;
  stripe: string | null;
  stripeAlpha: number;
  labelColor: string;
}

/** Затухание крупных зон: чем больше область, тем прозрачнее заливка и штриховка. */
function sizeAttenuation(size: number): number {
  if (!Number.isFinite(size) || size <= 20) return 1;
  return Math.max(0.2, 20 / size);
}

/** Стиль заливки зоны: вижн-зоны отличаются от обычных эффектов и друг от друга. */
export function zoneStyle(zone: ZoneInstance): ZoneStyle {
  const vision = zoneVisionKind(zone);
  if (vision === 'magical') {
    return {
      kind: 'magical-darkness',
      fill: '#0b0b16',
      fillAlpha: 0.65,
      stripe: '#a78bfa',
      stripeAlpha: 0.18,
      labelColor: '#c4b5fd',
    };
  }
  if (vision === 'obscured') {
    return {
      kind: 'obscured',
      fill: '#cbd5e1',
      fillAlpha: 0.4,
      stripe: '#f8fafc',
      stripeAlpha: 0.25,
      labelColor: '#e5e7eb',
    };
  }
  const color = zoneColor(zone.sourceKey);
  // Крупные зоны (туча Call Lightning, Daylight) — без штриховки и почти прозрачные.
  const scale = sizeAttenuation(zone.area.size);
  const compact = zone.area.size <= 30;
  return {
    kind: 'effect',
    fill: color,
    fillAlpha: 0.1 * scale,
    stripe: compact ? color : null,
    stripeAlpha: 0.4 * scale,
    labelColor: color,
  };
}
