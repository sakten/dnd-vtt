import type { RollMessage } from 'shared';

/** Исход атаки/спасброска/проверки для галочки-крестика (в прочих бросках исхода нет). */
export function rollOutcome(
  message: Pick<RollMessage, 'rollKind' | 'labelParams'>
): 'success' | 'fail' | null {
  const params = message.labelParams;
  switch (message.rollKind) {
    case 'attack':
      return params?.hit === 'hit' ? 'success' : params?.hit === 'miss' ? 'fail' : null;
    case 'save':
      return params?.saveOutcome === 'success' ? 'success' : params?.saveOutcome === 'fail' ? 'fail' : null;
    case 'check':
      return params?.checkOutcome === 'success' ? 'success' : params?.checkOutcome === 'fail' ? 'fail' : null;
    default:
      return null;
  }
}
