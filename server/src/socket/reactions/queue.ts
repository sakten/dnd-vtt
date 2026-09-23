import { randomUUID } from 'node:crypto';
import { type ReactionOffer, type ReactionOption, type ReactionTriggerKind, type Token } from 'shared';
import type { Room } from '../../roomTypes';
import { isDmViewer, type ConnCtx } from '../context';
import { findSpell } from '../../spells';
import { controllerIdOfToken, hasResourceFor } from '../../rooms';
import { reactionSlotFree, spellPayable, type ReactionChoice } from './internal';

/** Сколько ждём ответ на один оффер (мс). */
export const REACTION_TIMEOUT_MS = 30_000;

/** Больше пары окон в очереди комнаты не держим (защита от лавины триггеров). */
const MAX_WAITING = 16;

/** Оффер одного токена: ответ применяется сразу, `apply` возвращает «продолжать ли очередь». */
export interface ReactionOfferInput {
  token: Token;
  audience: string[];
  options: ReactionOption[];
  /** false — прервать очередь оставшихся офферов (Counterspell сработал, цель повержена). */
  apply?: (choice: ReactionChoice) => boolean;
}

interface PendingOfferState {
  id: string;
  tokenId: string;
  tokenName: string;
  audience: string[];
  options: ReactionOption[];
  apply?: (choice: ReactionChoice) => boolean;
}

interface Pending {
  id: string;
  roomCode: string;
  mapId: string;
  trigger: ReactionTriggerKind;
  sourceName?: string;
  offers: PendingOfferState[];
  /** Колбэк после последнего оффера (или досрочного завершения). */
  done?: () => void;
  /** Индекс текущего оффера (-1 до первого). */
  index: number;
  /** Игроки, отключившиеся во время окна: их офферы пропускаем. */
  skipped: Set<string>;
}

/** Параметры открытия окна реакций (офферы + завершение резолва). */
interface OpenWindowArgs {
  mapId: string;
  trigger: ReactionTriggerKind;
  sourceName?: string;
  offers: ReactionOfferInput[];
  done?: () => void;
}

/** Офферы по одному токену: у него бывает несколько источников вариантов (черты + кости). */
function mergeOffers(offers: ReactionOfferInput[]): ReactionOfferInput[] {
  const merged: ReactionOfferInput[] = [];
  for (const input of offers) {
    const existing = merged.find((m) => m.token.id === input.token.id);
    if (!existing) {
      merged.push({ ...input, audience: [...input.audience], options: [...input.options] });
      continue;
    }
    for (const pid of input.audience) {
      if (!existing.audience.includes(pid)) existing.audience.push(pid);
    }
    const seen = new Set(existing.options.map((o) => o.id));
    for (const option of input.options) {
      if (seen.has(option.id)) continue;
      existing.options.push(option);
      seen.add(option.id);
    }
    existing.apply = existing.apply ?? input.apply;
  }
  return merged;
}

/** Порядок офферов — инициатива ↓; вне боя и для токенов без входа — порядок карты. */
function orderByInitiative(room: Room, mapId: string, offers: ReactionOfferInput[]): ReactionOfferInput[] {
  const map = room.scene.maps.find((m) => m.id === mapId);
  const rank = new Map<string, number>();
  for (const entry of map?.combat.entries ?? []) {
    if (!entry.tokenId) continue;
    const current = rank.get(entry.tokenId);
    if (current === undefined || entry.initiative > current) rank.set(entry.tokenId, entry.initiative);
  }
  return [...offers].sort((a, b) => {
    const ra = rank.get(a.token.id);
    const rb = rank.get(b.token.id);
    if (ra === undefined && rb === undefined) return 0;
    if (ra === undefined) return 1;
    if (rb === undefined) return -1;
    return rb - ra;
  });
}

/**
 * Окна реакций: строго по одному офферу, в порядке инициативы, с немедленным
 * применением ответа. Окно видно всем игрокам, но отвечают только реактор и DM.
 */
class ReactionQueue {
  private pending: Pending | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly waiting: { ctx: ConnCtx; room: Room; args: OpenWindowArgs }[] = [];
  private ctx: ConnCtx | null = null;

  constructor(readonly roomCode: string) {}

  get isPending(): boolean {
    return this.pending !== null || this.waiting.length > 0;
  }

  get current(): Pending | null {
    return this.pending;
  }

  /** Активный оффер комнаты (тесты/диагностика). */
  offers(): ReactionOffer[] {
    const pending = this.pending;
    if (!pending) return [];
    const state = pending.offers[pending.index];
    if (!state) return [];
    return [this.toOffer(pending, state, true)];
  }

  /** Активный оффер по id; ответ принимается только по нему. */
  lookup(offerId: string): { pending: Pending; state: PendingOfferState } | null {
    const pending = this.pending;
    if (!pending) return null;
    const state = pending.offers[pending.index];
    if (!state || state.id !== offerId) return null;
    return { pending, state };
  }

  /**
   * Открывает окно; false — офферов нет. Если пауза уже идёт, запрос встаёт в
   * очередь и откроется после неё (вызывающий всё равно ждёт `done`).
   */
  open(ctx: ConnCtx, room: Room, args: OpenWindowArgs): boolean {
    if (!args.offers.length) return false;
    if (this.pending) {
      if (this.waiting.length >= MAX_WAITING) return false;
      this.waiting.push({ ctx, room, args });
      return true;
    }
    this.start(ctx, room, args, args.offers);
    return true;
  }

  /** Создаёт окно и спрашивает первый оффер. */
  private start(ctx: ConnCtx, room: Room, args: OpenWindowArgs, offers: ReactionOfferInput[]) {
    const id = randomUUID();
    const ordered = orderByInitiative(room, args.mapId, mergeOffers(offers));
    this.pending = {
      id,
      roomCode: room.code,
      mapId: args.mapId,
      trigger: args.trigger,
      sourceName: args.sourceName,
      offers: ordered.map((input) => ({
        id: `${id}:${input.token.id}`,
        tokenId: input.token.id,
        tokenName: input.token.name,
        audience: input.audience,
        options: input.options,
        apply: input.apply,
      })),
      done: args.done,
      index: -1,
      skipped: new Set(),
    };
    this.ctx = ctx;
    this.askNext();
  }

  /** Спрашивает следующий оффер; офферы отключившихся пропускает. */
  private askNext() {
    const pending = this.pending;
    const ctx = this.ctx;
    if (!pending || !ctx) return;
    for (;;) {
      pending.index += 1;
      const state = pending.offers[pending.index];
      if (!state) {
        this.finish();
        return;
      }
      if (state.audience.every((pid) => pending.skipped.has(pid))) continue;
      const room = ctx.getRoom() ?? ctx.manager.get(pending.roomCode);
      if (!room) {
        this.finish();
        return;
      }
      this.emitOffer(ctx, room, pending, state);
      return;
    }
  }

  /** Рассылка оффера: реактору и DM — с вариантами, остальным — только наблюдение. */
  private emitOffer(ctx: ConnCtx, room: Room, pending: Pending, state: PendingOfferState) {
    for (const player of room.players) {
      const active = state.audience.includes(player.id) || isDmViewer(room, player.id);
      ctx.emitTo(room, player.id, 'reaction:offer', this.toOffer(pending, state, active));
    }
    this.timer = setTimeout(() => this.skipCurrent(), REACTION_TIMEOUT_MS);
    this.timer.unref?.();
  }

  private toOffer(pending: Pending, state: PendingOfferState, active: boolean): ReactionOffer {
    return {
      id: state.id,
      mapId: pending.mapId,
      trigger: pending.trigger,
      tokenId: state.tokenId,
      tokenName: state.tokenName,
      sourceName: pending.sourceName,
      options: active ? state.options : [],
      active,
      expiresAt: Date.now() + REACTION_TIMEOUT_MS,
    };
  }

  /** Ответ реактора (провалидирован): применяем и идём дальше. */
  respond(choice: ReactionChoice) {
    const pending = this.pending;
    const ctx = this.ctx;
    if (!pending || !ctx) return;
    const state = pending.offers[pending.index];
    if (!state) return;
    this.clearTimer();
    this.closeCurrent();
    let cont = true;
    try {
      cont = state.apply?.(choice) ?? true;
    } catch (err) {
      // Ошибка применения не должна подвешивать окно: логируем и спрашиваем дальше.
      console.error(`reaction apply error (${pending.roomCode}):`, err);
    }
    if (!cont) {
      this.finish();
      return;
    }
    this.askNext();
  }

  /** Таймаут/скип/DM: текущий оффер остаётся без ответа. */
  private skipCurrent() {
    if (!this.pending) return;
    this.clearTimer();
    this.closeCurrent();
    this.askNext();
  }

  /** Пропускает офферы отключившегося игрока (текущий — сразу, будущие — при подходе). */
  skipPlayer(playerId: string) {
    const pending = this.pending;
    if (!pending) return;
    pending.skipped.add(playerId);
    const state = pending.offers[pending.index];
    if (state?.audience.includes(playerId)) this.skipCurrent();
  }

  /** DM-скип текущего оффера. */
  forceSkip(): void {
    this.skipCurrent();
  }

  /** Закрывает окно, запускает следующее и вызывает `done` (вне try/catch сокет-хендлера). */
  finish() {
    const pending = this.pending;
    if (!pending) return;
    this.clearTimer();
    this.pending = null;
    this.ctx = null;

    // Следующее окно открываем до done: заморозка не прерывается, а новые
    // триггеры из done встанут в очередь за ним.
    this.startNext();
    if (!this.isPending) queues.delete(this.roomCode);

    try {
      pending.done?.();
    } catch (err) {
      console.error(`reaction done error (${pending.roomCode}):`, err);
    }
  }

  /** Открывает следующее окно из очереди; пустые (оплата кончилась) — пропускает. */
  private startNext() {
    while (this.waiting.length) {
      if (this.pending) return;
      const next = this.waiting.shift()!;
      const offers = this.revalidate(next.ctx, next.room, next.args.mapId, next.args.offers);
      if (!offers.length) {
        // Окно стало ненужным — сразу продолжаем резолв, чтобы вызывающий не завис.
        next.args.done?.();
        continue;
      }
      this.start(next.ctx, next.room, next.args, offers);
      return;
    }
  }

  /** Отбрасывает офферы/варианты, которые больше не оплачиваются (слот реакции/ячейка/ресурс). */
  private revalidate(ctx: ConnCtx, room: Room, mapId: string, offers: ReactionOfferInput[]): ReactionOfferInput[] {
    const out: ReactionOfferInput[] = [];
    for (const input of offers) {
      const options = input.options.filter((o) => this.optionPayable(ctx, room, mapId, input.token, o));
      if (options.length) out.push({ ...input, options });
    }
    return out;
  }

  private optionPayable(ctx: ConnCtx, room: Room, mapId: string, token: Token, option: ReactionOption): boolean {
    // Кости вдохновения — без слота реакции; вариант на AC (Боевое вдохновение) — реакция носителя.
    if (option.kind === 'feature' && option.id.startsWith('bonusdie:')) {
      if (!option.id.endsWith(':ac')) return true;
      return reactionSlotFree(ctx.manager, room, mapId, token);
    }
    if (option.kind === 'feature' && option.id.endsWith(':self')) {
      if (!option.resourceKey) return true;
      const cid = controllerIdOfToken(room, token);
      return !!cid && hasResourceFor(room, cid, option.resourceKey, option.resourceAmount ?? 1);
    }
    if (!reactionSlotFree(ctx.manager, room, mapId, token)) return false;
    if (option.kind === 'opportunity') return true;
    if (option.kind === 'spell') {
      const spell = option.spellKey ? findSpell(option.spellKey) : null;
      return !!spell && spellPayable(room, token, spell.level, spell.key);
    }
    if (!option.resourceKey) return false;
    const controllerId = controllerIdOfToken(room, token);
    return !!controllerId && hasResourceFor(room, controllerId, option.resourceKey, option.resourceAmount ?? 1);
  }

  /** Закрывает текущий оффер у всех игроков (в т.ч. у зрителей). */
  private closeCurrent() {
    const pending = this.pending;
    const ctx = this.ctx;
    if (!pending || !ctx) return;
    const state = pending.offers[pending.index];
    if (!state) return;
    const room = ctx.getRoom() ?? ctx.manager.get(pending.roomCode);
    if (!room) return;
    for (const player of room.players) ctx.emitTo(room, player.id, 'reaction:close', { id: state.id });
  }

  private clearTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}

const queues = new Map<string, ReactionQueue>();

function queueFor(roomCode: string): ReactionQueue {
  let queue = queues.get(roomCode);
  if (!queue) {
    queue = new ReactionQueue(roomCode);
    queues.set(roomCode, queue);
  }
  return queue;
}

function queueByOffer(offerId: string): ReactionQueue | null {
  for (const queue of queues.values()) {
    if (queue.lookup(offerId)) return queue;
  }
  return null;
}

export function isReactionPending(roomCode: string): boolean {
  return queues.get(roomCode)?.isPending === true;
}

/** Активные офферы комнаты (тесты/диагностика): только текущий. */
export function pendingOffers(roomCode: string): ReactionOffer[] {
  return queues.get(roomCode)?.offers() ?? [];
}

/**
 * Открывает окно реакций; false — окно не нужно (нет офферов/очередь переполнена).
 * Офферы обрабатываются по одному в порядке инициативы; `apply` вызывается при
 * ответе реактора (false — оставшиеся офферы не спрашиваем), `done` — в конце окна.
 */
export function openReactionWindow(ctx: ConnCtx, room: Room, args: OpenWindowArgs): boolean {
  return queueFor(room.code).open(ctx, room, args);
}

export function registerReactionHandlers(ctx: ConnCtx) {
  const { getRoom, isDm } = ctx;

  ctx.on('reaction:respond', ({ id, optionId }) => {
    if (!ctx.playerId || typeof id !== 'string') return;
    const queue = queueByOffer(id);
    const found = queue?.lookup(id);
    const room = getRoom();
    if (!queue || !found || !room) return;
    const { pending, state } = found;
    // Отвечают только реактор (его аудитория) и DM; зрительское окно неактивно.
    if (!state.audience.includes(ctx.playerId) && !isDmViewer(room, ctx.playerId)) return;
    if (optionId !== null && !state.options.some((o) => o.id === optionId)) return;
    queue.respond({ tokenId: state.tokenId, mapId: pending.mapId, optionId: optionId ?? null });
  });

  ctx.on('reaction:forceSkip', ({ id }) => {
    if (!isDm() || typeof id !== 'string') return;
    const queue = queueByOffer(id);
    if (!queue?.current) return;
    queue.forceSkip();
  });

  // Отключился — его текущий и будущие офферы пропускаются.
  ctx.onDisconnect(() => {
    if (!ctx.playerId) return;
    const pid = ctx.playerId;
    for (const queue of [...queues.values()]) queue.skipPlayer(pid);
  });
}
