import type { InvocationEntry, InvocationsData } from './domain/invocation';
import raw from './data/invocations.json';

/** Каталог воззваний варлока (XPHB). Ленивая загрузка: `import('shared/invocationsData')`. */
const invocationsData = raw as unknown as InvocationsData;

export type { InvocationEntry, InvocationsData };
export default invocationsData;
