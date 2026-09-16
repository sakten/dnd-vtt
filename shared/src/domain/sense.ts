/** Типы восприятия (зрения): значение — дистанция в футах. */
export const SENSE_TYPES = ['darkvision', 'blindsight', 'devilsight'] as const;

export type SenseType = (typeof SENSE_TYPES)[number];

export interface Sense {
  type: SenseType;
  range: number;
}

export const MAX_SENSES = 5;

/** Дистанция по умолчанию при добавлении типа в редакторе. */
export const DEFAULT_SENSE_RANGES: Record<SenseType, number> = {
  darkvision: 60,
  blindsight: 10,
  devilsight: 120,
};
