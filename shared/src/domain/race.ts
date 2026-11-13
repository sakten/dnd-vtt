/** Выбранный вид персонажа (PHB 2024): ключ `XPHB:<имя>` и выборы линий/наследий. */
export interface RaceSelection {
  key: string;
  /** Выборы внутри вида: lineage, ancestry, legacy, skill, size и т.п. */
  choices?: Record<string, string>;
}

/** Черта вида из каталога 5e.tools. */
export interface RaceTraitDef {
  name: string;
  description: string;
}

/** Вид персонажа из каталога `shared/src/data/races.json`. */
export interface RaceDef {
  key: string;
  name: string;
  source: string;
  speed: number;
  /** Коды размеров 5e.tools: S/M/L. */
  sizes: string[];
  darkvision?: number;
  resist?: string[];
  /** Выбор сопротивления (драконье наследие, наследие тифлинга). */
  resistChoice?: string[];
  traits: RaceTraitDef[];
  additionalSpells?: unknown;
}
