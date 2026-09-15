import raw from '../data/features.json';
import type { FeatureDef } from '../domain/feature';
import type { ClassLevel } from '../domain/sheet';
import { clampLevel } from './classes';

/**
 * Каталог черт классов/подклассов, сгенерированный из 5e.tools (`npm run features`).
 * Ключи совпадают с ключами ресурсов `CLASSES`, поэтому ресурсы и каталог сходятся
 * без маппинга; ручной слой механик — в `featureAutomation.ts`.
 */

interface FeatureData {
  attribution: string;
  count: number;
  features: FeatureDef[];
}

const data = raw as unknown as FeatureData;

export const FEATURES: FeatureDef[] = data.features;

const byKey = new Map(FEATURES.map((f) => [f.key, f]));

export function featureByKey(key: string): FeatureDef | undefined {
  return byKey.get(key);
}

/** Черты, доступные персонажу: по классам/подклассам и уровням, без дублей (мультикласс). */
export function featuresFor(classes: ClassLevel[]): FeatureDef[] {
  const out: FeatureDef[] = [];
  const seen = new Set<string>();
  for (const entry of classes) {
    const level = clampLevel(entry.level);
    for (const feature of FEATURES) {
      if (feature.className !== entry.className || feature.level > level) continue;
      if (feature.subclass && feature.subclass !== entry.subclass) continue;
      if (seen.has(feature.key)) continue;
      seen.add(feature.key);
      out.push(feature);
    }
  }
  return out;
}
