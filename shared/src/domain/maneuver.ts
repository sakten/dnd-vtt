/** Боевой мастер (XPHB 2024): приём из каталога 5e.tools (`featureType: MV:B`). */
export interface ManeuverEntry {
  /** `XPHB:<имя>` — ключ выбора в `CharacterSheet.choices` (`kind: 'maneuver'`). */
  key: string;
  name: string;
  source: 'XPHB';
  description: string;
  /** SRD 5.2 (CC-BY-4.0) — дословное описание; иначе краткая выжимка. */
  srd?: boolean;
  nonSrd?: boolean;
}

export interface ManeuversData {
  attribution: string;
  count: number;
  maneuvers: ManeuverEntry[];
}
