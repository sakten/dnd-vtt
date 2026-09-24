import { spellCastDirection, type ActionCost, type AreaSpec, type ConditionKey, type Token } from 'shared';

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
  /** Якорь клампа для перемещения зон: центр зоны вместо кастера. */
  anchor?: Point;
  origin: Point | null;
  direction: Point | null;
  /** Путь до точки перекрыт стеной/закрытой дверью — применять нельзя. */
  blocked?: boolean;
  /** Призыв: выбранная форма (Find Familiar). */
  summonKey?: string;
  /** Вариант каста (Dragon's Breath: тип урона выдоха). */
  variant?: string;
  /** Призыв: точка под курсором (подсветка одной клетки, без риски origin). */
  summon?: boolean;
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

/** Scatter: до N целей, затем точка назначения на каждую (последний клик кастует). */
export interface ScatterState {
  tokenId: string;
  spellKey: string;
  slotLevel?: number;
  advantage?: 'a' | 'd';
  maxTargets: number;
  /** `targets` — набор целей, `places` — по очереди ставим точки назначения. */
  phase: 'targets' | 'places';
  targets: string[];
  placements: { targetId: string; x: number; y: number }[];
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
      /** Атака второй рукой (Light/Nick). */
      offhand?: boolean;
      /** Прорубающее (Cleave): вторая цель. */
      cleave?: boolean;
      label: string;
    }
  | {
      kind: 'spell';
      tokenId: string;
      spellKey: string;
      slotLevel?: number;
      advantage?: 'a' | 'd';
      label: string;
      /** Polymorph: выбранная форма-зверь (ключ каталога). */
      summonKey?: string;
      /** Вариант каста (Dragon's Breath: тип урона выдоха). */
      variant?: string;
      /** Lesser/Greater Restoration: снимаемые состояния — после цели показываем выбор. */
      endConditionKeys?: ConditionKey[];
    }
  | {
      kind: 'rollAttack';
      tokenId?: string;
      attackIndex: number;
      advantage?: 'a' | 'd';
      label: string;
    };

/** Выбор одного состояния для снятия (Lesser/Greater Restoration) после клика по цели. */
export interface ConditionChoiceState {
  tokenId: string;
  targetId: string;
  spellKey: string;
  slotLevel?: number;
  advantage?: 'a' | 'd';
  /** Подходящие состояния цели (из permitted-списка заклинания). */
  options: ConditionKey[];
  label: string;
}

/** Активное взаимодействие с картой: не более одного режима одновременно. */
export type Interaction =
  | { mode: 'target'; target: TargetingState }
  | { mode: 'aim'; aim: AimState }
  | { mode: 'multi'; multi: MultiTargetState }
  | { mode: 'scatter'; scatter: ScatterState }
  | { mode: 'condition'; condition: ConditionChoiceState };

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
  /** Призыв: выбранная форма (Find Familiar). */
  summonKey?: string;
  /** Вариант каста (Dragon's Breath: тип урона выдоха). */
  variant?: string;
  /** Выбор состояния для снятия (Lesser/Greater Restoration). */
  condition?: string;
  /** Scatter: точка назначения на каждую цель. */
  placements?: { targetId: string; x: number; y: number }[];
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
        offhand?: boolean;
        cleave?: boolean;
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

/** Scatter: вход в режим выбора целей (до `maxTargets` существ). */
export function startScatter(payload: Omit<ScatterState, 'phase' | 'targets' | 'placements'>): Interaction {
  return { mode: 'scatter', scatter: { ...payload, phase: 'targets', targets: [], placements: [] } };
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
  const directional = aim.spec.shape === 'cone' || aim.spec.shape === 'line';
  if (aim.originKind === 'self') {
    if (!directional) return { mode: 'aim', aim: { ...aim, direction: null } };
    // Конус/линия: направление от вершины к курсору; вплотную к вершине угол
    // скачет на каждый пиксель — держим последнее устойчивое направление.
    const origin = aim.origin ?? { x: caster.x, y: caster.y };
    if (Math.hypot(cursor.x - origin.x, cursor.y - origin.y) < gridSize) return { mode: 'aim', aim };
    return { mode: 'aim', aim: { ...aim, direction: cursor } };
  }
  // Линия от точки (Wall of Thorns): ось стены задаёт вариант каста.
  let origin = cursor;
  if (aim.rangeFeet !== null) {
    const anchor = aim.anchor ?? { x: caster.x, y: caster.y };
    const dx = cursor.x - anchor.x;
    const dy = cursor.y - anchor.y;
    const dist = Math.hypot(dx, dy);
    const maxPx = (aim.rangeFeet / 5) * gridSize;
    if (dist > maxPx && dist > 0) {
      origin = { x: anchor.x + (dx / dist) * maxPx, y: anchor.y + (dy / dist) * maxPx };
    }
  }
  // Линия/конус от точки: направление-заготовка от варианта (стена), иначе — как раньше.
  const fixed = directional && aim.spellKey ? spellCastDirection(aim.spellKey, aim.variant, origin) : null;
  return { mode: 'aim', aim: { ...aim, origin, direction: directional ? fixed : origin } };
}

/** Область-конус/линия всегда исходит от кастера; остальные — от выбранной точки. */
export function aimOriginKind(shape: AreaSpec['shape']): 'self' | 'point' {
  return shape === 'cone' || shape === 'line' ? 'self' : 'point';
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
        ...(aim.summonKey ? { summonKey: aim.summonKey } : {}),
        ...(aim.variant ? { variant: aim.variant } : {}),
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
        extra: {
          targetIds: [targetId],
          attackIndex: t.attackIndex,
          slot: t.slot,
          advantage: t.advantage,
          ...(t.offhand ? { offhand: true } : {}),
          ...(t.cleave ? { cleave: true } : {}),
        },
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
          ...(t.summonKey ? { summonKey: t.summonKey } : {}),
          ...(t.variant ? { variant: t.variant } : {}),
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

/** Выбор состояния в режиме `condition`: каст с целью и выбранным состоянием. */
export function pickCondition(interaction: Interaction | null, key: string): InteractionResult {
  if (interaction?.mode !== 'condition') return { next: interaction };
  const c = interaction.condition;
  if (!c.options.includes(key as ConditionKey)) return { next: interaction };
  return {
    next: null,
    command: {
      type: 'castSpell',
      payload: {
        tokenId: c.tokenId,
        spellKey: c.spellKey,
        slotLevel: c.slotLevel,
        advantage: c.advantage,
        targetIds: [c.targetId],
        condition: key,
      },
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

/** Клик по токену в фазе целей Scatter: тумблер; на лимите — сразу фаза точек. */
export function toggleScatterTarget(interaction: Interaction | null, targetId: string): Interaction | null {
  if (interaction?.mode !== 'scatter') return interaction;
  const s = interaction.scatter;
  if (s.phase !== 'targets') return interaction;
  const picked = s.targets.includes(targetId)
    ? s.targets.filter((id) => id !== targetId)
    : [...s.targets, targetId].slice(0, s.maxTargets);
  const phase = picked.length >= s.maxTargets ? 'places' : 'targets';
  return { mode: 'scatter', scatter: { ...s, targets: picked, placements: [], phase } };
}

/** «Далее»: от выбора целей к расстановке точек (хотя бы одна цель). */
export function scatterToPlaces(interaction: Interaction | null): Interaction | null {
  if (interaction?.mode !== 'scatter' || interaction.scatter.phase !== 'targets') return interaction;
  if (!interaction.scatter.targets.length) return interaction;
  return { mode: 'scatter', scatter: { ...interaction.scatter, phase: 'places', placements: [] } };
}

/** «Назад»: возврат к выбору целей, расставленные точки сбрасываются. */
export function scatterBack(interaction: Interaction | null): Interaction | null {
  if (interaction?.mode !== 'scatter' || interaction.scatter.phase !== 'places') return interaction;
  return { mode: 'scatter', scatter: { ...interaction.scatter, phase: 'targets', placements: [] } };
}

/** Клик по карте в фазе точек: точка текущей цели; после последней — каст. */
export function placeScatterPoint(interaction: Interaction | null, point: Point): InteractionResult {
  if (interaction?.mode !== 'scatter' || interaction.scatter.phase !== 'places') return { next: interaction };
  const s = interaction.scatter;
  const targetId = s.targets[s.placements.length];
  if (!targetId) return { next: interaction };
  const placements = [...s.placements, { targetId, x: point.x, y: point.y }];
  if (placements.length >= s.targets.length) {
    return { next: null, command: scatterCommand(s, placements) };
  }
  return { next: { mode: 'scatter', scatter: { ...s, placements } } };
}

function scatterCommand(
  s: ScatterState,
  placements: { targetId: string; x: number; y: number }[]
): InteractionCommand {
  return {
    type: 'castSpell',
    payload: {
      tokenId: s.tokenId,
      spellKey: s.spellKey,
      slotLevel: s.slotLevel,
      advantage: s.advantage,
      placements,
    },
  };
}

/** Токен-владелец активного режима (для сброса UI при удалении токена). */
export function interactionTokenId(interaction: Interaction | null): string | null {
  if (!interaction) return null;
  if (interaction.mode === 'target') return interaction.target.tokenId ?? null;
  if (interaction.mode === 'aim') return interaction.aim.tokenId;
  if (interaction.mode === 'scatter') return interaction.scatter.tokenId;
  if (interaction.mode === 'condition') return interaction.condition.tokenId;
  return interaction.multi.tokenId;
}
