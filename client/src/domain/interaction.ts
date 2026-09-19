import type { ActionCost, AreaSpec, Token } from 'shared';

/** Точка в мировых координатах карты. */
export interface Point {
  x: number;
  y: number;
}

/** Режим прицеливания заклинания или способности с областью (Ф7). */
export interface AimState {
  tokenId: string;
  spellKey?: string;
  actionId?: string;
  slot?: ActionCost;
  slotLevel?: number;
  advantage?: 'a' | 'd';
  spec: AreaSpec;
  originKind: 'self' | 'point';
  /** Дистанция накладывания, футы; null — без ограничения (точка не тащится дальше). */
  rangeFeet: number | null;
  origin: Point | null;
  direction: Point | null;
  /** Путь до точки перекрыт стеной/закрытой дверью — применять нельзя. */
  blocked?: boolean;
}

/** Режим выбора цели на каждый луч/снаряд (Scorching Ray, Eldritch Blast, Magic Missile). */
export interface MultiTargetState {
  tokenId: string;
  /** Заклинание; при `actionId` — классовая черта (Мантия вдохновения). */
  spellKey?: string;
  actionId?: string;
  slot?: ActionCost;
  slotLevel?: number;
  advantage?: 'a' | 'd';
  count: number;
  targets: string[];
  /** Существа-цели: без повторов, можно применить, выбрав меньше максимума. */
  distinct?: boolean;
}

/** Режим выбора цели: после клика по способности ждём клик по токену на карте. */
export type TargetingState =
  | {
      kind: 'action';
      tokenId: string;
      actionId: string;
      slot: ActionCost;
      attackIndex?: number;
      advantage?: 'a' | 'd';
      label: string;
    }
  | {
      kind: 'spell';
      tokenId: string;
      spellKey: string;
      slotLevel?: number;
      advantage?: 'a' | 'd';
      label: string;
    }
  | {
      kind: 'rollAttack';
      tokenId?: string;
      attackIndex: number;
      advantage?: 'a' | 'd';
      label: string;
    };

/** Активное взаимодействие с картой: не более одного режима одновременно. */
export type Interaction =
  | { mode: 'target'; target: TargetingState }
  | { mode: 'aim'; aim: AimState }
  | { mode: 'multi'; multi: MultiTargetState };

/** Параметры входа в режим области (без вычисленного origin). */
export type StartAimPayload = Omit<AimState, 'origin' | 'direction'>;

/** Параметры накладывания заклинания (после выбора цели/области/снарядов). */
export interface SpellCastPayload {
  tokenId: string;
  spellKey: string;
  slotLevel?: number;
  targetIds?: string[];
  advantage?: 'a' | 'd';
  origin?: Point;
  direction?: Point;
}

/** Команда, которую стор исполняет после перехода машины. */
export type InteractionCommand =
  | {
      type: 'runAction';
      tokenId: string;
      actionId: string;
      extra: {
        targetIds: string[];
        attackIndex?: number;
        slot: ActionCost;
        origin?: Point;
        direction?: Point;
        advantage?: 'a' | 'd';
      };
    }
  | { type: 'castSpell'; payload: SpellCastPayload }
  | {
      type: 'rollAttack';
      payload: { tokenId?: string; targetId: string; attackIndex: number; advantage?: 'a' | 'd' };
    };

/** Результат перехода: новое состояние + необязательная команда. */
export interface InteractionResult {
  next: Interaction | null;
  command?: InteractionCommand;
}

export function startTargeting(target: TargetingState): Interaction {
  return { mode: 'target', target };
}

export function startMulti(payload: Omit<MultiTargetState, 'targets'>): Interaction {
  return { mode: 'multi', multi: { ...payload, targets: [] } };
}

/** Область: self — origin от кастера, point — ждём курсор; direction пуст. */
export function startAim(payload: StartAimPayload, caster: Token | null): Interaction {
  const origin = payload.originKind === 'self' && caster ? { x: caster.x, y: caster.y } : null;
  return { mode: 'aim', aim: { ...payload, origin, direction: null } };
}

/** Ведение области за курсором (с клампом по дистанции накладывания). */
export function aimToCursor(
  interaction: Interaction | null,
  cursor: Point,
  caster: Token | null,
  gridSize: number
): Interaction | null {
  if (interaction?.mode !== 'aim' || !caster) return interaction;
  const aim = interaction.aim;
  if (aim.originKind === 'self') {
    const needsDirection = aim.spec.shape === 'cone' || aim.spec.shape === 'line';
    return { mode: 'aim', aim: { ...aim, direction: needsDirection ? cursor : null } };
  }
  let origin = cursor;
  if (aim.rangeFeet !== null) {
    const dx = cursor.x - caster.x;
    const dy = cursor.y - caster.y;
    const dist = Math.hypot(dx, dy);
    const maxPx = (aim.rangeFeet / 5) * gridSize;
    if (dist > maxPx && dist > 0) {
      origin = { x: caster.x + (dx / dist) * maxPx, y: caster.y + (dy / dist) * maxPx };
    }
  }
  return { mode: 'aim', aim: { ...aim, origin, direction: origin } };
}

/** Клик по карте в режиме области: каст или применение способности с origin/direction. */
export function confirmArea(interaction: Interaction | null): InteractionResult {
  if (interaction?.mode !== 'aim') return { next: interaction };
  const aim = interaction.aim;
  if (aim.actionId) {
    return {
      next: null,
      command: {
        type: 'runAction',
        tokenId: aim.tokenId,
        actionId: aim.actionId,
        extra: {
          targetIds: [],
          slot: aim.slot ?? 'action',
          advantage: aim.advantage,
          origin: aim.origin ?? undefined,
          direction: aim.direction ?? undefined,
        },
      },
    };
  }
  return {
    next: null,
    command: {
      type: 'castSpell',
      payload: {
        tokenId: aim.tokenId,
        spellKey: aim.spellKey ?? '',
        slotLevel: aim.slotLevel,
        advantage: aim.advantage,
        origin: aim.origin ?? undefined,
        direction: aim.direction ?? undefined,
      },
    },
  };
}

/** Клик по токену в режиме выбора цели. */
export function pickTarget(interaction: Interaction | null, targetId: string): InteractionResult {
  if (interaction?.mode !== 'target') return { next: interaction };
  const t = interaction.target;
  if (t.kind === 'action') {
    return {
      next: null,
      command: {
        type: 'runAction',
        tokenId: t.tokenId,
        actionId: t.actionId,
        extra: { targetIds: [targetId], attackIndex: t.attackIndex, slot: t.slot, advantage: t.advantage },
      },
    };
  }
  if (t.kind === 'spell') {
    return {
      next: null,
      command: {
        type: 'castSpell',
        payload: {
          tokenId: t.tokenId,
          spellKey: t.spellKey,
          slotLevel: t.slotLevel,
          advantage: t.advantage,
          targetIds: [targetId],
        },
      },
    };
  }
  return {
    next: null,
    command: {
      type: 'rollAttack',
      payload: { tokenId: t.tokenId, targetId, attackIndex: t.attackIndex, advantage: t.advantage },
    },
  };
}

/** Клик по токену в режиме мульти-цели; последний выбор запускает каст. */
export function pickMultiTarget(interaction: Interaction | null, targetId: string): InteractionResult {
  if (interaction?.mode !== 'multi') return { next: interaction };
  const mt = interaction.multi;
  // Существа-цели не дублируются (одно существо — один раз); снаряды могут бить в одну цель.
  if (mt.distinct && mt.targets.includes(targetId)) return { next: interaction };
  const targets = [...mt.targets, targetId];
  if (targets.length >= mt.count) {
    return { next: null, command: multiCommand(mt, targets) };
  }
  return { next: { mode: 'multi', multi: { ...mt, targets } } };
}

/** Команда применения мульти-цели: заклинание или классовая черта. */
function multiCommand(mt: MultiTargetState, targets: string[]): InteractionCommand {
  if (mt.actionId) {
    return {
      type: 'runAction',
      tokenId: mt.tokenId,
      actionId: mt.actionId,
      extra: { targetIds: targets, slot: mt.slot ?? 'bonus' },
    };
  }
  return {
    type: 'castSpell',
    payload: {
      tokenId: mt.tokenId,
      spellKey: mt.spellKey ?? '',
      slotLevel: mt.slotLevel,
      advantage: mt.advantage,
      targetIds: targets,
    },
  };
}

/** Досрочное применение мульти-цели: выбранных меньше максимума (Mass Healing Word). */
export function finishMulti(interaction: Interaction | null): InteractionResult {
  if (interaction?.mode !== 'multi') return { next: interaction };
  const mt = interaction.multi;
  if (!mt.targets.length) return { next: interaction };
  return { next: null, command: multiCommand(mt, mt.targets) };
}

/** Токен-владелец активного режима (для сброса UI при удалении токена). */
export function interactionTokenId(interaction: Interaction | null): string | null {
  if (!interaction) return null;
  return interaction.mode === 'target' ? interaction.target.tokenId ?? null : interaction.mode === 'aim' ? interaction.aim.tokenId : interaction.multi.tokenId;
}
