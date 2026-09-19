import type { BestiaryEntry } from './domain/bestiary';
import raw from './data/bestiary.json';

export interface BestiaryData {
  attribution: string;
  count: number;
  entries: BestiaryEntry[];
}

/** Каталог монстров (SRD 5.2). Ленивая загрузка на клиенте: `import('shared/bestiaryData')`. */
const bestiaryData = raw as unknown as BestiaryData;

export default bestiaryData;
