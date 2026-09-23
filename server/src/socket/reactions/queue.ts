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
  /** Прервать окно до следующего оффера (цель уже повержена и подобное). */
  stop?: () => boolean;
  /** Индекс текущего оффера (-1 до первого). */
  index: number;
  /** Игроки, отключившиеся во время окна: их офферы пропускаем. */
  skipped: Set<string>;
  /** Ответ на текущий оффер: null — ждём ответа, true/false — продолжать ли. */
  cont: boolean | null;
  /** `done` уже вызван; окно снимается со стека после дочерних. */
  finished: boolean;
}

/** Параметры открытия окна реакций (офферы + завершение резолва). */
interface OpenWindowArgs {
  mapId: string;
  trigger: ReactionTriggerKind;
  sourceName?: string;
  offers: ReactionOfferInput[];
  done?: () => void;
  stop?: () => boolean;
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
 *
 * Окна образуют стек: если резолв ответа (или `done`) сам порождает реакцию
 * (например, OA-бросок открывает окно промаха), дочернее окно отыграет первым,
 * а родительское продолжится после него — порядок как за столом.
 */
class ReactionQueue {
  /** Стек окон: верхнее — активное, ниже — приостановленные родители. */
  private readonly stack: Pending[] = [];
  /** Независимые триггеры (вне резолва окна) — откроются после текущего стека. */
  private readonly waiting: { ctx: ConnCtx; room: Room; args: OpenWindowArgs }[] = [];
  /** Отключившиеся: их офферы в текущей цепочке окон не спрашиваем. */
  private readonly gone = new Set<string>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private ctx: ConnCtx | null = null;
  /** Окно, чей `apply`/`done` сейчас исполняется: новые окна — его дети. */
  private resolving: Pending | null = null;

  constructor(readonly roomCode: string) {}

  get isPending(): boolean {
    return this.stack.length > 0 || this.waiting.length > 0;
  }

  get current(): Pending | null {
    return this.top;
  }

  private get top(): Pending | null {
    return this.stack[this.stack.length - 1] ?? null;
  }

  /** Активный оффер комнаты (тесты/диагностика). */
  offers(): ReactionOffer[] {
    const window = this.top;
    const state = window?.offers[window.index];
    if (!window || !state) return [];
    return [this.toOffer(window, state, true)];
  }

  /** Активный оффер по id; ответ принимается только по нему. */
  lookup(offerId: string): { pending: Pending; state: PendingOfferState } | null {
    const window = this.top;
    if (!window) return null;
    const state = window.offers[window.index];
    if (!state || state.id !== offerId) return null;
    return { pending: window, state };
  }

  /**
   * Открывает окно; false — офферов нет. Во время резолва другого окна новое
   * становится дочерним и спрашивается сразу; вне резолва — встаёт в очередь.
   */
  open(ctx: ConnCtx, room: Room, args: OpenWindowArgs): boolean {
    if (!args.offers.length) return false;
    if (this.resolving && this.stack.includes(this.resolving)) {
      this.start(ctx, room, args, args.offers);
      this.pump();
      return true;
    }
    if (this.stack.length || this.waiting.length) {
      if (this.waiting.length >= MAX_WAITING) return false;
      this.waiting.push({ ctx, room, args });
      return true;
    }
    this.gone.clear();
    this.start(ctx, room, args, args.offers);
    this.pump();
    return true;
  }

  /** Создаёт окно поверх стека и спрашивает первый оффер. */
  private start(ctx: ConnCtx, room: Room, args: OpenWindowArgs, offers: ReactionOfferInput[]) {
    const id = randomUUID();
    const ordered = orderByInitiative(room, args.mapId, mergeOffers(offers));
    const window: Pending = {
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
      stop: args.stop,
      index: -1,
      skipped: new Set(),
      cont: null,
      finished: false,
    };
    this.ctx = ctx;
    this.stack.push(window);
    this.advance(window);
  }

  /** Двигает очередь: снимает завершённые, продолжает приостановленные, открывает ожидающие. */
  private pump() {
    for (;;) {
      let window = this.top;
      while (window?.finished) {
        this.stack.pop();
        window = this.top;
      }
      if (!window) {
        if (this.startNext()) continue;
        if (!this.isPending) {
          queues.delete(this.roomCode);
          this.gone.clear();
        }
        return;
      }
      if (window.cont !== null) {
        const cont = window.cont;
        window.cont = null;
        if (cont) this.advance(window);
        else this.complete(window);
        continue;
      }
      return;
    }
  }

  /** Следующий оффер окна (или завершение); отключившихся пропускает. */
  private advance(window: Pending) {
    if (window.stop?.()) {
      this.complete(window);
      return;
    }
    window.index += 1;
    const state = window.offers[window.index];
    if (!state) {
      this.complete(window);
      return;
    }
    if (state.audience.every((pid) => window.skipped.has(pid))) {
      this.advance(window);
      return;
    }
    const room = this.room();
    if (!room) {
      this.complete(window);
      return;
    }
    this.emitOffer(room, window, state);
  }

  /** Рассылка оффера: реактору и DM — с вариантами, остальным — только наблюдение. */
  private emitOffer(room: Room, window: Pending, state: PendingOfferState) {
    const ctx = this.ctx;
    if (!ctx) return;
    for (const player of room.players) {
      const active = state.audience.includes(player.id) || isDmViewer(room, player.id);
      ctx.emitTo(room, player.id, 'reaction:offer', this.toOffer(window, state, active));
    }
    this.timer = setTimeout(() => this.skipCurrent(), REACTION_TIMEOUT_MS);
    this.timer.unref?.();
  }

  private toOffer(window: Pending, state: PendingOfferState, active: boolean): ReactionOffer {
    return {
      id: state.id,
      mapId: window.mapId,
      trigger: window.trigger,
      tokenId: state.tokenId,
      tokenName: state.tokenName,
      sourceName: window.sourceName,
      options: active ? state.options : [],
      active,
      expiresAt: Date.now() + REACTION_TIMEOUT_MS,
    };
  }

  /** Ответ реактора (провалидирован): применяем; дочерние окна отыграют до продолжения. */
  respond(choice: ReactionChoice) {
    const window = this.top;
    const state = window?.offers[window.index];
    if (!window || !state) return;
    this.clearTimer();
    this.closeOffer(window, state);
    const prevResolving = this.resolving;
    this.resolving = window;
    let cont: boolean;
    try {
      cont = state.apply?.(choice) ?? true;
    } catch (err) {
      // Ошибка применения не должна подвешивать окно: логируем и спрашиваем дальше.
      console.error(`reaction apply error (${window.roomCode}):`, err);
      cont = true;
    }
    this.resolving = prevResolving;
    window.cont = cont;
    this.pump();
  }

  /** Таймаут/скип/DM: текущий оффер остаётся без ответа. */
  private skipCurrent() {
    const window = this.top;
    const state = window?.offers[window.index];
    if (!window || !state) return;
    this.clearTimer();
    this.closeOffer(window, state);
    window.cont = true;
    this.pump();
  }

  /** Пропускает офферы отключившегося игрока (текущий — сразу, будущие — при подходе). */
  skipPlayer(playerId: string) {
    this.gone.add(playerId);
    for (const window of this.stack) window.skipped.add(playerId);
    const state = this.top?.offers[this.top.index];
    if (state?.audience.includes(playerId)) this.skipCurrent();
  }

  /** DM-скип текущего оффера. */
  forceSkip(): void {
    this.skipCurrent();
  }

  /** Завершает окно: вызывает `done`; окно снимется после дочерних, порождённых `done`. */
  private complete(window: Pending) {
    if (window.finished) return;
    window.finished = true;
    this.clearTimer();
    const prevResolving = this.resolving;
    this.resolving = window;
    try {
      window.done?.();
    } catch (err) {
      console.error(`reaction done error (${window.roomCode}):`, err);
    }
    this.resolving = prevResolving;
  }

  /** Открывает следующее окно из очереди; пустые (оплата кончилась) — пропускает. */
  private startNext(): boolean {
    while (this.waiting.length) {
      const next = this.waiting.shift()!;
      const offers = this.revalidate(next.ctx, next.room, next.args.mapId, next.args.offers);
      if (!offers.length) {
        // Окно стало ненужным — сразу продолжаем резолв, чтобы вызывающий не завис.
        try {
          next.args.done?.();
        } catch (err) {
          console.error(`reaction done error (${next.room.code}):`, err);
        }
        continue;
      }
      this.start(next.ctx, next.room, next.args, offers);
      return true;
    }
    return false;
  }

  /** Отбрасывает офферы/варианты, которые больше не оплачиваются (слот реакции/ячейка/ресурс). */
  private revalidate(ctx: ConnCtx, room: Room, mapId: string, offers: ReactionOfferInput[]): ReactionOfferInput[] {
    const out: ReactionOfferInput[] = [];
    for (const input of offers) {
      if (input.audience.every((pid) => this.gone.has(pid))) continue;
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

  /** Закрывает оффер у всех игроков (в т.ч. у зрителей). */
  private closeOffer(window: Pending, state: PendingOfferState) {
    const ctx = this.ctx;
    const room = this.room();
    if (!ctx || !room) return;
    for (const player of room.players) ctx.emitTo(room, player.id, 'reaction:close', { id: state.id });
  }

  private room(): Room | null {
    const ctx = this.ctx;
    if (!ctx) return null;
    return ctx.getRoom() ?? ctx.manager.get(this.roomCode) ?? null;
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
