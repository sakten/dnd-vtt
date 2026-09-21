import type { ActionDef } from './actions';
import type { AbilityKey } from './core';
import type { Sense } from './sense';
import type { AttackEntry, TokenStatblock } from './token';

/** Размер существа (5e.tools: T/S/M/L/H/G). */
export type MonsterSize = 'T' | 'S' | 'M' | 'L' | 'H' | 'G';

/**
 * Профиль шаблона призыва (XPHB): что достраивается от круга ячейки и кастера
 * при спавне. Базовая запись (`ac`/`hpAverage`/`attacks`) — значения на `baseLevel`.
 */
export interface BestiarySummonProfile {
  /** Круг заклинания, на который рассчитаны HP (текст «above N»). */
  baseLevel?: number;
  /** HP: +N за каждый круг выше `baseLevel`. */
  hpPerLevel?: number;
  /** AC: +N за каждый круг выше `baseLevel`. */
  acPerLevel?: number;
  /** Атаки шаблона бьют модификатором атаки заклинанием кастера. */
  spellAttack?: boolean;
  /** Спасброски шаблона — СЛ заклинаний кастера. */
  spellDc?: boolean;
  /** Мультиатака = половина круга ячейки (округление вниз), как у Summon-*. */
  multiattackHalfLevel?: boolean;
}

/** Сжатая запись бестиария: готовые к выставлению поля токена + мета для фильтров. */
export interface BestiaryEntry {
  /** `XMM:Wolf` / `XPHB:Bestial Spirit`. */
  key: string;
  name: string;
  source: string;
  size: MonsterSize;
  /** Тип существа (beast/fiend/dragon/…). */
  type: string;
  /** CR строкой: `0`, `1/8`, `13`. */
  cr: string;
  /** Существо входит в списки фамильяров (Find Familiar / Pact of the Chain). */
  familiar?: boolean;
  /** Иммунитеты к типам урона (ключи). */
  immunities: string[];
  /** Сопротивления к типам урона (ключи). */
  resistances: string[];
  /** Уязвимости к типам урона (ключи). */
  vulnerabilities: string[];
  ac: number;
  hpAverage: number;
  hpFormula: string;
  /** Характеристики существа (для статблока при выставлении). */
  abilities: Record<AbilityKey, number>;
  /** Явные бонусы спасбросков (если отличаются от характеристик). */
  saves?: Partial<Record<AbilityKey, number>>;
  /** Клетки токена: T/S/M → 1, L → 2, H → 3, G → 4. */
  cells: number;
  /** Скорость ходьбы (или максимальная из прочих), футы. */
  speed: number;
  /** Есть Fly Speed (лимит Wild Shape до 8 уровня). */
  fly?: boolean;
  senses: Sense[];
  /** Число атак за действие (Мультиатака). */
  multiattack?: number;
  /** Быстрые атаки токена (`token.attacks`). */
  attacks: AttackEntry[];
  /** Особые действия: сейв/перезарядка/легендарные/ручные. */
  actions: ActionDef[];
  /** Пул легендарных действий за раунд. */
  legendaryMax?: number;
  spellcasting?: TokenStatblock['spellcasting'];
  /** Полный текст трейтов и неавтоматизированных действий (для каталога). */
  description: string;
  /** Короткое описание внешности (EN): источник для иконок и будущих портретов. */
  appearance: string;
  /** Профиль призыва: скейл от круга ячейки и атака/СЛ кастера (у шаблонов XPHB). */
  summon?: BestiarySummonProfile;
}

/** Сырая запись 5e.tools (`bestiary-xmm.json`/`xphb.json`), читаем только нужное. */
export interface RawBestiaryMonster {
  name?: unknown;
  source?: unknown;
  srd52?: unknown;
  size?: unknown;
  type?: unknown;
  cr?: unknown;
  familiar?: unknown;
  ac?: unknown;
  hp?: unknown;
  speed?: unknown;
  str?: unknown;
  dex?: unknown;
  con?: unknown;
  int?: unknown;
  wis?: unknown;
  cha?: unknown;
  save?: unknown;
  senses?: unknown;
  trait?: unknown;
  action?: unknown;
  bonus?: unknown;
  reaction?: unknown;
  legendary?: unknown;
  spellcasting?: unknown;
  [key: string]: unknown;
}
