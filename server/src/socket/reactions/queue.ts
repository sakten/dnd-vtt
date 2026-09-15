import { randomUUID } from 'node:crypto';
import { type ReactionOffer, type ReactionOption, type ReactionTriggerKind, type Token } from 'shared';
import type { Room } from '../../roomTypes';
import type { ConnCtx } from '../context';
import { findSpell } from '../../spells';
import { controllerIdOfToken, hasResourceFor } from '../../rooms';
import { reactionSlotFree, spellPayable, type ReactionChoice } from './internal';

/** Сколько ждём ответ на окно реакции (мс). */
export const REACTION_TIMEOUT_MS = 30_000;

interface PendingOfferState {
  id: string;
  tokenId: string;
  audience: string[];
  options: ReactionOption[];
  answered: boolean;
  choice: string | null;
}

interface Pending {
  id: string;
  roomCode: string;
  mapId: string;
  trigger: ReactionTriggerKind;
  sourceName?: string;
  offers: PendingOfferState[];
  resume: (choices: ReactionChoice[]) => void;
  timer: ReturnType<typeof setTimeout>;
}

/** Параметры открытия окна реакций (офферы + продолжение резолва). */
interface OpenWindowArgs {
  mapId: string;
  trigger: ReactionTriggerKind;
  sourceName?: string;
  offers: ReactionOfferInput[];
  resume: (choices: ReactionChoice[]) => void;
}

/** Больше пары окон в очереди комнаты не держим (защита от лавины триггеров). */
const MAX_WAITING = 16;

/** Одна пауза на комнату и её офферы; состояние — в инстансе на комнату, не в модуле. */
class ReactionQueue {
  private pending: Pending | null = null;
  private readonly waiting: { ctx: ConnCtx; room: Room; args: OpenWindowArgs }[] = [];
  private readonly offerIndex = new Map<string, { pendingId: string; tokenId: string }>();
  private ctx: ConnCtx | null = null;

  constructor(readonly roomCode: string) {}

  get isPending(): boolean {
    return this.pending !== null || this.waiting.length > 0;
  }

  get current(): Pending | null {
    return this.pending;
  }

  /** Активные офферы комнаты (тесты/диагностика). */
  offers(): ReactionOffer[] {
    const pending = this.pending;
    if (!pending) return [];
    return pending.offers.map((o) => ({
      id: o.id,
      mapId: pending.mapId,
      trigger: pending.trigger,
      tokenId: o.tokenId,
      tokenName: '',
      sourceName: pending.sourceName,
      options: o.options,
      expiresAt: 0,
    }));
  }

  /** Пауза и оффер по id оффера. */
  lookup(offerId: string): { pending: Pending; state: PendingOfferState } | null {
    const ref = this.offerIndex.get(offerId);
    if (!ref || !this.pending || this.pending.id !== ref.pendingId) return null;
    const state = this.pending.offers.find((o) => o.id === offerId);
    return state ? { pending: this.pending, state } : null;
  }

  /**
   * Открывает окно; false — офферов нет. Если пауза уже идёт, запрос встаёт в
   * очередь и откроется после неё (вызывающий всё равно ждёт resume).
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

  /** Создаёт паузу по (пере)проверенным офферам. */
  private start(ctx: ConnCtx, room: Room, args: OpenWindowArgs, offers: ReactionOfferInput[]) {
    const id = randomUUID();
    const expiresAt = Date.now() + REACTION_TIMEOUT_MS;
    const pending: Pending = {
      id,
      roomCode: room.code,
      mapId: args.mapId,
      trigger: args.trigger,
      sourceName: args.sourceName,
      offers: [],
      resume: args.resume,
      timer: setTimeout(() => this.finish(), REACTION_TIMEOUT_MS),
    };
    pending.timer.unref?.();

    for (const input of offers) {
      const offerId = `${id}:${input.token.id}`;
      pending.offers.push({
        id: offerId,
        tokenId: input.token.id,
        audience: input.audience,
        options: input.options,
        answered: false,
        choice: null,
      });
      this.offerIndex.set(offerId, { pendingId: id, tokenId: input.token.id });
      const offer: ReactionOffer = {
        id: offerId,
        mapId: args.mapId,
        trigger: args.trigger,
        tokenId: input.token.id,
        tokenName: input.token.name,
        sourceName: args.sourceName,
        options: input.options,
        expiresAt,
      };
      for (const pid of input.audience) ctx.emitTo(room, pid, 'reaction:offer', offer);
    }

    this.pending = pending;
    this.ctx = ctx;
  }

  /** Открывает следующее окно из очереди; пустые (оплата кончилась) — пропускает. */
  private startNext() {
    while (this.waiting.length) {
      if (this.pending) return;
      const next = this.waiting.shift()!;
      const offers = this.revalidate(next.ctx, next.room, next.args.mapId, next.args.offers);
      if (!offers.length) {
        // Окно стало ненужным — сразу продолжаем резолв, чтобы вызывающий не завис.
        next.args.resume([]);
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

  /** Пропускает неотвеченные офферы игрока (дисконнект). */
  skipPlayer(playerId: string) {
    const pending = this.pending;
    if (!pending) return;
    let changed = false;
    for (const state of pending.offers) {
      if (!state.answered && state.audience.includes(playerId)) {
        state.answered = true;
        state.choice = null;
        changed = true;
      }
    }
    if (changed && pending.offers.every((o) => o.answered)) this.finish();
  }

  /** Закрывает текущую паузу, чистит состояние и продолжает резолв. */
  finish() {
    const pending = this.pending;
    if (!pending) return;
    const ctx = this.ctx;
    clearTimeout(pending.timer);
    this.pending = null;
    this.ctx = null;
    this.offerIndex.clear();

    const room = ctx ? ctx.getRoom() ?? ctx.manager.get(pending.roomCode) ?? null : null;
    for (const state of pending.offers) {
      if (ctx && room) closeOffer(ctx, room, state);
    }
    // Следующее окно открываем до resume: заморозка не прерывается, а новые
    // триггеры из resume встанут в очередь за ним.
    this.startNext();
    if (!this.isPending) queues.delete(this.roomCode);

    // Резолв продолжается вне try/catch сокет-хендлера (таймаут/DM-скип) — изолируем.
    try {
      pending.resume(
        pending.offers.map((s) => ({
          tokenId: s.tokenId,
          mapId: pending.mapId,
          optionId: s.choice,
        }))
      );
    } catch (err) {
      console.error(`reaction resume error (${pending.roomCode}):`, err);
    }
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

function queueByPending(id: string): ReactionQueue | null {
  for (const queue of queues.values()) {
    if (queue.current?.id === id) return queue;
  }
  return null;
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

/** Активные офферы комнаты (тесты/диагностика). */
export function pendingOffers(roomCode: string): ReactionOffer[] {
  return queues.get(roomCode)?.offers() ?? [];
}

export interface ReactionOfferInput {
  token: Token;
  audience: string[];
  options: ReactionOption[];
}

/** Открывает окно реакций; false — окно не нужно (нет офферов/уже есть пауза). */
export function openReactionWindow(
  ctx: ConnCtx,
  room: Room,
  args: {
    mapId: string;
    trigger: ReactionTriggerKind;
    sourceName?: string;
    offers: ReactionOfferInput[];
    resume: (choices: ReactionChoice[]) => void;
  }
): boolean {
  return queueFor(room.code).open(ctx, room, args);
}

function closeOffer(ctx: ConnCtx, room: Room, state: PendingOfferState) {
  for (const pid of state.audience) ctx.emitTo(room, pid, 'reaction:close', { id: state.id });
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
    if (state.answered || !state.audience.includes(ctx.playerId)) return;
    if (optionId !== null && !state.options.some((o) => o.id === optionId)) return;
    state.answered = true;
    state.choice = optionId ?? null;
    closeOffer(ctx, room, state);
    if (pending.offers.every((o) => o.answered)) queue.finish();
  });

  ctx.on('reaction:forceSkip', ({ id }) => {
    if (!isDm() || typeof id !== 'string') return;
    // Клиент шлёт id оффера; принимаем и id паузы (диагностика/тесты).
    const queue = queueByPending(id) ?? queueByOffer(id);
    if (!queue?.current) return;
    for (const state of queue.current.offers) state.answered = true;
    queue.finish();
  });

  // Отключился — все его неотвеченные окна автоматически пропускаются.
  ctx.onDisconnect(() => {
    if (!ctx.playerId) return;
    const pid = ctx.playerId;
    for (const queue of [...queues.values()]) queue.skipPlayer(pid);
  });
}
