import type { ManeuverEntry, ManeuversData } from './domain/maneuver';
import raw from './data/maneuvers.json';

/** Каталог манёвров боевого мастера (XPHB). Ленивая загрузка: `import('shared/maneuversData')`. */
const maneuversData = raw as unknown as ManeuversData;

export type { ManeuverEntry, ManeuversData };
export default maneuversData;
