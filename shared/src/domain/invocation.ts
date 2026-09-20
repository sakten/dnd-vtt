/** Пакт-инвокации, от которых зависят другие (и особая механика фамильяра). */
export type InvocationPact = 'blade' | 'chain' | 'tome';

/** Условия выбора инвокации (XPHB). */
export interface InvocationPrereq {
  /** Требуемый уровень варлока. */
  level?: number;
  /** Требуется соответствующая пакт-инвокация. */
  pact?: InvocationPact;
  /** Ключ другой инвокации-предпосылки (`XPHB:Thirsting Blade`). */
  requires?: string;
  /** Нужен кантрип варлока: наносящий урон или с атакой. */
  cantrip?: 'damage' | 'spellAttack';
}

/** Инвокация воззваний (Eldritch Invocation) XPHB. */
export interface InvocationEntry {
  /** `XPHB:Agonizing Blast`. */
  key: string;
  name: string;
  /** Минимальный уровень варлока (1 — без требований). */
  level: number;
  prereq?: InvocationPrereq;
  /** Нет в SRD 5.2 — вопрос лицензии до публичного релиза. */
  nonSrd?: boolean;
  /** Текст (EN), разметка 5e.tools снята. */
  description: string;
}

export interface InvocationsData {
  attribution: string;
  count: number;
  /** Сколько инвокаций известно на уровнях варлока 1–20. */
  limits: number[];
  invocations: InvocationEntry[];
}
