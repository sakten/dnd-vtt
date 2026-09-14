import { randomUUID } from 'node:crypto';
import {
  abilityMod,
  absorbTypesOf,
  casterStats,
  characterLevel,
  grantedSpells,
  gridDistanceFeet,
  isIncapacitated,
  maxCastableLevel,
  reactionFeatures,
  reactionSpellTrigger,
  rollDice,
  spellEffectDefs,
  superiorityDie,
  type AttackEntry,
  type EffectInstance,
  type ReactionFeatureDef,
  type ReactionOffer,
  type ReactionOption,
  type ReactionTriggerKind,
  type Token,
} from 'shared';
import type { Room } from '../roomTypes';
import { isDmViewer, type ConnCtx } from './context';
import { findSpell } from '../spells';
import { controllerIdOfToken, hasResourceFor } from '../rooms';
import { pushRollMessage } from './messages';
import { applySpellEffects, resolveSpellCast, type SpellCastInput } from './spellResolve';
import {
  applyWeaponAttackDamage,
  prepareWeaponAttack,
  resolveWeaponAttack,
  rollPreparedAttack,
  type AttackResolveInput,
  type AttackResolveResult,
  type WeaponAttackPlan,
  type WeaponAttackPrep,
  type WeaponDamageMods,
} from './attackResolve';

/** Сколько ждём ответ на окно реакции (мс). */
export const REACTION_TIMEOUT_MS = 30_000;

export interface ReactionChoice {
  tokenId: string;
  mapId: string;
  optionId: string | null;
}

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

/** Кто контролирует токен (игроки), иначе — все DM-зрители (в тестовом режиме все). */
function audienceOf(ctx: ConnCtx, room: Room, mapId: string, token: Token): string[] {
  const byControl = room.players
    .filter((p) => ctx.manager.controlsToken(room, mapId, p.id, token))
    .map((p) => p.id);
  if (byControl.length) return byControl;
  return room.players.filter((p) => isDmViewer(room, p.id)).map((p) => p.id);
}

function reactionSlotFree(manager: ConnCtx['manager'], room: Room, mapId: string, token: Token): boolean {
  const turn = manager.turnStateFor(room, mapId, token);
  return !turn || !turn.reactionUsed;
}

/** Заклинания токена: лист персонажа/выданные или список статблока. */
function knownSpellKeys(room: Room, token: Token): string[] {
  const cid = controllerIdOfToken(room, token);
  const sheet = cid ? room.sheets[cid] : undefined;
  if (sheet) {
    const keys = new Set<string>();
    for (const s of sheet.spells) keys.add(s.key);
    for (const g of grantedSpells(sheet.classes)) keys.add(g.key);
    return [...keys];
  }
  return token.statblock?.spellcasting?.spells ?? [];
}

function spellPayable(room: Room, token: Token, spellLevel: number, spellKey: string): boolean {
  const cid = controllerIdOfToken(room, token);
  if (cid) {
    const spell = findSpell(spellKey);
    if (!spell) return false;
    return maxCastableLevel(spell, room.resources[cid] ?? null) >= spellLevel;
  }
  const spell = findSpell(spellKey);
  if (!spell) return false;
  return maxCastableLevel(spell, null, token.statblock?.spellcasting?.slots) >= spellLevel;
}

/** Есть ли у токена оплачиваемый спец-вариант реакции (для решения «окно или авто-OA»). */
function hasPayableSpecial(manager: ConnCtx['manager'], room: Room, mapId: string, token: Token): boolean {
  if (!reactionSlotFree(manager, room, mapId, token)) return false;
  for (const key of knownSpellKeys(room, token)) {
    const trigger = reactionSpellTrigger(key);
    const spell = findSpell(key);
    if (trigger && spell && spellPayable(room, token, spell.level, key)) return true;
  }
  return false;
}

/** Применимые к триггеру оплачиваемые варианты-заклинания. */
function reactionSpellOptions(room: Room, token: Token, trigger: ReactionTriggerKind): ReactionOption[] {
  const out: ReactionOption[] = [];
  for (const key of knownSpellKeys(room, token)) {
    if (reactionSpellTrigger(key) !== trigger) continue;
    const spell = findSpell(key);
    if (!spell || !spellPayable(room, token, spell.level, key)) continue;
    out.push({ id: `spell:${key}`, name: spell.name, kind: 'spell', spellKey: key });
  }
  return out;
}

/** Боевые характеристики кастера для эффектов реакции. */
function statsForCaster(room: Room, token: Token, spellKey: string) {
  const cid = controllerIdOfToken(room, token);
  const sheet = cid ? room.sheets[cid] : undefined;
  if (sheet) {
    const own = sheet.spells.find((s) => s.key === spellKey);
    const className = own?.className ?? grantedSpells(sheet.classes).find((g) => g.key === spellKey)?.className;
    if (className) return casterStats(sheet, className);
  }
  const sc = token.statblock?.spellcasting;
  if (sc) {
    const mod = abilityMod(token.statblock?.abilities[sc.ability] ?? 10);
    return { ability: sc.ability, mod, dc: sc.dc ?? 8 + mod, attack: sc.attack ?? mod };
  }
  return null;
}

/** Бонус к AC от эффектов варианта (Shield +5); 0 — если неизвестно. */
function acBonusOf(option: ReactionOption): number {
  if (!option.spellKey) return 0;
  let bonus = 0;
  for (const def of spellEffectDefs(option.spellKey) ?? []) {
    for (const mod of def.modifiers) {
      if (mod.target === 'ac' && mod.mode === 'add' && typeof mod.value === 'number') bonus += mod.value;
    }
  }
  return bonus;
}

/** Применяет выбранную в окне реакцию (Shield, Absorb Elements, Hellish Rebuke и т.п.). */
function applyReactionChoice(
  ctx: ConnCtx,
  room: Room,
  choice: ReactionChoice,
  targets: Token[],
  damageType?: string
): void {
  const optionId = choice.optionId;
  if (!optionId?.startsWith('spell:')) return;
  const key = optionId.slice('spell:'.length);
  const spell = findSpell(key);
  const token = ctx.manager.findToken(room, choice.mapId, choice.tokenId);
  if (!spell || !token) return;

  const cid = controllerIdOfToken(room, token);
  if (spell.level > 0) {
    if (cid) {
      if (!ctx.manager.spendSpellSlot(room, cid, spell.level)) return;
      ctx.emitResources(room, cid);
    } else if (!ctx.manager.spendTokenSpellSlot(room, token, spell.level)) {
      return;
    }
  }
  if (!ctx.manager.spendSlot(room, choice.mapId, token, 'reaction')) return;

  const stats = statsForCaster(room, token, key);

  // Absorb Elements: сопротивление типу сработавшего урона до следующего хода.
  const absorb = absorbTypesOf(key);
  if (absorb.length && damageType && absorb.includes(damageType)) {
    const effect: EffectInstance = {
      id: randomUUID(),
      name: spell.name,
      sourceKey: key,
      sourceId: token.id,
      duration: { type: 'rounds', rounds: 1 },
      modifiers: [
        {
          id: `${randomUUID()}:r`,
          target: 'damage',
          mode: 'resistance',
          filter: { damageType },
        },
      ],
    };
    ctx.manager.applyEffect(room, token, effect);
    ctx.emitToken(room, 'token:update', choice.mapId, token);
    ctx.systemMessage(room, `${token.name}: ${spell.name} — сопротивление (${damageType})`);
    ctx.syncCombat(room, choice.mapId);
    return;
  }

  if (spellEffectDefs(key)?.length) {
    applySpellEffects(ctx, {
      caster: token,
      spell,
      mapId: choice.mapId,
      targets: [token],
      stats,
      author: token.name,
    });
  } else {
    const sheet = cid ? room.sheets[cid] : undefined;
    resolveSpellCast(ctx, {
      caster: token,
      mapId: choice.mapId,
      spell,
      castLevel: spell.level,
      characterLevel: sheet ? characterLevel(sheet.classes) : 1,
      stats,
      targets,
      author: token.name,
    });
  }
  ctx.syncCombat(room, choice.mapId);
}

/** Доступные персонажу реакционные черты под триггер (с оплатой ресурсов). */
function availableFeatureReactions(
  room: Room,
  token: Token,
  trigger: ReactionTriggerKind
): ReactionFeatureDef[] {
  const cid = controllerIdOfToken(room, token);
  const sheet = cid ? room.sheets[cid] : undefined;
  if (!cid || !sheet) return [];
  return reactionFeatures(sheet.classes).filter((def) => {
    if (def.trigger !== trigger) return false;
    if (!def.resourceKey) return true;
    return hasResourceFor(room, cid, def.resourceKey, def.resourceAmount ?? 1);
  });
}

function classLevelOf(room: Room, token: Token, className: string): number {
  const cid = controllerIdOfToken(room, token);
  const sheet = cid ? room.sheets[cid] : undefined;
  return sheet?.classes.find((c) => c.className === className)?.level ?? 0;
}

/** Вариант-черта с остатком ресурса в названии. */
function featureOption(def: ReactionFeatureDef, room: Room, token: Token): ReactionOption {
  let name = def.name;
  if (def.resourceKey) {
    const cid = controllerIdOfToken(room, token);
    const item = cid ? room.resources[cid]?.resources.find((r) => r.key === def.resourceKey) : undefined;
    if (item) name = `${def.name} (${item.current})`;
  }
  return {
    id: `feature:${def.id}`,
    name,
    kind: 'feature',
    resourceKey: def.resourceKey,
    resourceAmount: def.resourceAmount,
  };
}

/** Тратит реакцию и ресурс черты (сначала проверка обоих). */
function spendFeatureCost(ctx: ConnCtx, room: Room, token: Token, mapId: string, def: ReactionFeatureDef): boolean {
  const cid = controllerIdOfToken(room, token);
  if (def.resourceKey) {
    if (!cid || !hasResourceFor(room, cid, def.resourceKey, def.resourceAmount ?? 1)) return false;
  }
  if (!ctx.manager.spendSlot(room, mapId, token, 'reaction')) return false;
  if (def.resourceKey && cid) {
    ctx.manager.spendResource(room, cid, def.resourceKey, def.resourceAmount ?? 1);
    ctx.emitResources(room, cid);
  }
  return true;
}

/** Выбранные в окне до броска черты: возвращает true, если наложена помеха. */
function applyAttackRollChoices(
  ctx: ConnCtx,
  room: Room,
  prep: WeaponAttackPrep,
  choices: ReactionChoice[],
  mapId: string
): boolean {
  const target = prep.input.target;
  if (!target) return false;
  let imposed = false;
  for (const choice of choices) {
    if (choice.optionId?.startsWith('feature:')) {
      const id = choice.optionId.slice('feature:'.length);
      const def = availableFeatureReactions(room, target, 'attackRoll').find((d) => d.id === id);
      if (!def || def.kind !== 'disadvantage') continue;
      if (imposed) continue; // помеха не складывается — остальным ресурс не тратим
      if (!spendFeatureCost(ctx, room, target, choice.mapId, def)) continue;
      imposed = true;
      ctx.systemMessage(room, `${target.name}: ${def.name} — помеха на атаку`);
    }
  }
  if (imposed) ctx.syncCombat(room, mapId);
  return imposed;
}

/** Ответный удар (Riposte): атака реактора по промахнувшемуся + кость к урону. */
function applyRiposte(ctx: ConnCtx, room: Room, choice: ReactionChoice, attacker: Token | null | undefined): void {
  if (!attacker) return;
  const id = choice.optionId?.startsWith('feature:') ? choice.optionId.slice('feature:'.length) : '';
  const reactor = ctx.manager.findToken(room, choice.mapId, choice.tokenId);
  if (!reactor) return;
  const def = availableFeatureReactions(room, reactor, 'attackMiss').find((d) => d.id === id);
  if (!def || def.kind !== 'counterAttack') return;
  if (!spendFeatureCost(ctx, room, reactor, choice.mapId, def)) return;
  const attack = opportunityAttack(ctx, room, reactor);
  if (!attack) return;
  const die = superiorityDie(classLevelOf(room, reactor, def.className) || 1);
  const dieExpr = `1d${die}`;
  const boosted: AttackEntry = { ...attack, damage: attack.damage ? `${attack.damage} + ${dieExpr}` : dieExpr };
  ctx.systemMessage(room, `${reactor.name}: ${def.name} (+${dieExpr}) по ${attacker.name}`);
  resolveWeaponAttack(ctx, {
    attacker: reactor,
    attackerMapId: choice.mapId,
    target: attacker,
    targetMapId: choice.mapId,
    attack: boosted,
    prefix: reactor.name,
    author: reactor.name,
    ignoreRange: true,
  });
  ctx.syncCombat(room, choice.mapId);
}

/** Офферы окна до броска (attackRoll): Warding Flare и подобные. */
function preRollOffers(ctx: ConnCtx, room: Room, prep: WeaponAttackPrep): ReactionOfferInput[] {
  const input = prep.input;
  const target = input.target;
  if (!target || !input.targetMapId || !input.attacker || target.id === input.attacker.id) return [];
  if (!input.targetMapId) return [];
  if (!reactionSlotFree(ctx.manager, room, input.targetMapId, target)) return [];
  const size = room.scene.grid.size || 50;
  const features = availableFeatureReactions(room, target, 'attackRoll').filter((def) => {
    if (def.kind !== 'disadvantage') return false;
    return gridDistanceFeet(target, input.attacker!, size) <= 30;
  });
  if (!features.length) return [];
  return [
    {
      token: target,
      audience: audienceOf(ctx, room, input.targetMapId, target),
      options: features.map((def) => featureOption(def, room, target)),
    },
  ];
}

/** Выбранные в окне попадания черты → модификаторы урона (половина/AC). */
function attackWindowMods(ctx: ConnCtx, room: Room, target: Token, choices: ReactionChoice[]): WeaponDamageMods {
  const mods: WeaponDamageMods = {};
  for (const choice of choices) {
    if (!choice.optionId?.startsWith('feature:')) continue;
    const id = choice.optionId.slice('feature:'.length);
    const def = availableFeatureReactions(room, target, 'attackHit').find((d) => d.id === id);
    if (!def) continue;
    if (!spendFeatureCost(ctx, room, target, choice.mapId, def)) continue;
    if (def.kind === 'halveDamage') {
      mods.halveDamage = true;
      continue;
    }
    if (def.kind === 'acBonus') {
      const die = superiorityDie(classLevelOf(room, target, def.className) || 1);
      const roll = rollDice(`1d${die}`);
      mods.extraAc = (mods.extraAc ?? 0) + roll.total;
      ctx.systemMessage(room, `${target.name}: ${def.name} (+${roll.total} к AC)`);
    }
  }
  return mods;
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
    const queue = queueByPending(id);
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

/** Сторона: чужой, если разные стороны (игрок/монстр) или разные фракции. */
function hostile(reactor: Token, mover: Token): boolean {
  if (reactor.isPlayerToken !== mover.isPlayerToken) return true;
  if (reactor.faction === 'neutral' || mover.faction === 'neutral') return false;
  return reactor.faction !== mover.faction;
}

function meleeAttacks(room: Room, token: Token): AttackEntry[] {
  const cid = controllerIdOfToken(room, token);
  const sheet = cid ? room.sheets[cid] : undefined;
  const list = sheet ? sheet.attacks : token.attacks;
  return list.filter((a) => a.hit && (a.rangeType === 'melee' || a.rangeType === 'none'));
}

/** Оружие для атаки по возможности: первая melee-атака, у персонажа — безоружный удар. */
function opportunityAttack(ctx: ConnCtx, room: Room, token: Token): AttackEntry | null {
  const melee = meleeAttacks(room, token);
  if (melee[0]) return melee[0];
  const cid = controllerIdOfToken(room, token);
  const sheet = cid ? room.sheets[cid] : undefined;
  if (!sheet) return null;
  const mod = ctx.manager.abilityModForToken(room, token, 'str');
  return {
    name: 'Безоружный удар',
    hit: mod >= 0 ? `d20+${mod}` : `d20${mod}`,
    damage: `${Math.max(1, 1 + mod)}`,
    damageType: 'bludgeoning',
    rangeType: 'melee',
    rangeNormal: 5,
    rangeLong: 0,
  };
}

function pathLeavesReach(path: { x: number; y: number }[], reactor: Token, mover: Token, gridSize: number): boolean {
  if (path.length < 2) return false;
  const box = (p: { x: number; y: number }) => ({ x: p.x, y: p.y, w: mover.w, h: mover.h });
  for (let i = 0; i < path.length - 1; i++) {
    const before = gridDistanceFeet(box(path[i]), reactor, gridSize);
    const after = gridDistanceFeet(box(path[i + 1]), reactor, gridSize);
    if (before <= 5 && after > 5) return true;
  }
  return false;
}

/** Немедленная атака по возможности (без окна). */
export function executeOpportunityAttack(
  ctx: ConnCtx,
  room: Room,
  mapId: string,
  reactor: Token,
  mover: Token
): void {
  const attack = opportunityAttack(ctx, room, reactor);
  if (!attack) return;
  if (!ctx.manager.spendSlot(room, mapId, reactor, 'reaction')) return;
  ctx.systemMessage(room, `${reactor.name}: атака по возможности по ${mover.name}`);
  const result = resolveWeaponAttack(ctx, {
    attacker: reactor,
    attackerMapId: mapId,
    target: mover,
    targetMapId: mapId,
    attack,
    prefix: reactor.name,
    author: reactor.name,
    ignoreRange: true,
  });
  if (result.error) ctx.systemMessage(room, `${reactor.name}: ${result.error}`);
  ctx.syncCombat(room, mapId);
}

/** Триггер leaveReach: авто-OA или окно, если у реактора есть оплачиваемые спец-реакции. */
export function triggerOpportunityAttacks(
  ctx: ConnCtx,
  room: Room,
  mapId: string,
  mover: Token,
  path: { x: number; y: number }[]
): void {
  if (isReactionPending(room.code)) return;
  const map = ctx.manager.findMap(room, mapId);
  if (!map || path.length < 2) return;
  // «Отход»: движение в этом ходу не провоцирует атаки по возможности.
  if (ctx.manager.turnForToken(room, mapId, mover)?.disengaged) return;
  const size = room.scene.grid.size || 50;

  const offers: ReactionOfferInput[] = [];
  for (const reactor of map.tokens) {
    if (reactor.id === mover.id) continue;
    if (!hostile(reactor, mover)) continue;
    if (isIncapacitated(reactor.conditions)) continue;
    if (!reactionSlotFree(ctx.manager, room, mapId, reactor)) continue;
    if (!pathLeavesReach(path, reactor, mover, size)) continue;
    const attack = opportunityAttack(ctx, room, reactor);
    if (!attack) continue;
    if (!hasPayableSpecial(ctx.manager, room, mapId, reactor)) {
      executeOpportunityAttack(ctx, room, mapId, reactor, mover);
      continue;
    }
    const options: ReactionOption[] = [
      { id: 'opportunity', name: `Атака по возможности: ${attack.name}`, kind: 'opportunity' },
      ...reactionSpellOptions(room, reactor, 'leaveReach'),
    ];
    offers.push({ token: reactor, audience: audienceOf(ctx, room, mapId, reactor), options });
  }
  if (!offers.length) return;

  openReactionWindow(ctx, room, {
    mapId,
    trigger: 'leaveReach',
    sourceName: mover.name,
    offers,
    resume: (choices) => {
      const currentRoom = ctx.getRoom();
      if (!currentRoom) return;
      for (const choice of choices) {
        if (!choice.optionId) continue;
        if (choice.optionId === 'opportunity') {
          const reactor = ctx.manager.findToken(currentRoom, mapId, choice.tokenId);
          const target = ctx.manager.findToken(currentRoom, mapId, mover.id);
          if (reactor && target) executeOpportunityAttack(ctx, currentRoom, mapId, reactor, target);
        } else {
          applyReactionChoice(ctx, currentRoom, choice, []);
        }
      }
      ctx.syncCombat(currentRoom, mapId);
    },
  });
}

const COUNTERSPELL_KEY = 'XPHB:Counterspell';
const COUNTERSPELL_LEVEL = 3;
const COUNTERSPELL_RANGE_FEET = 60;

/** Офферы Counterspell: враги кастера в 60 фт с оплачиваемым заклинанием. */
function counterspellOffers(ctx: ConnCtx, room: Room, input: SpellCastInput): ReactionOfferInput[] {
  const map = ctx.manager.findMap(room, input.mapId);
  if (!map) return [];
  const grid = room.scene.grid.size || 50;
  const offers: ReactionOfferInput[] = [];
  for (const reactor of map.tokens) {
    if (reactor.id === input.caster.id) continue;
    if (!hostile(reactor, input.caster)) continue;
    if (isIncapacitated(reactor.conditions)) continue;
    if (gridDistanceFeet(reactor, input.caster, grid) > COUNTERSPELL_RANGE_FEET) continue;
    if (!reactionSlotFree(ctx.manager, room, map.id, reactor)) continue;
    if (!knownSpellKeys(room, reactor).includes(COUNTERSPELL_KEY)) continue;
    if (!spellPayable(room, reactor, COUNTERSPELL_LEVEL, COUNTERSPELL_KEY)) continue;
    offers.push({
      token: reactor,
      audience: audienceOf(ctx, room, map.id, reactor),
      options: [{ id: `spell:${COUNTERSPELL_KEY}`, name: 'Counterspell', kind: 'spell', spellKey: COUNTERSPELL_KEY }],
    });
  }
  return offers;
}

/** Применяет Counterspell реактора; true — каст отменён. */
function applyCounterspell(ctx: ConnCtx, room: Room, choice: ReactionChoice, input: SpellCastInput): boolean {
  const reactor = ctx.manager.findToken(room, choice.mapId, choice.tokenId);
  if (!reactor) return false;
  const cid = controllerIdOfToken(room, reactor);
  if (cid) {
    if (!ctx.manager.spendSpellSlot(room, cid, COUNTERSPELL_LEVEL)) return false;
    ctx.emitResources(room, cid);
  } else if (!ctx.manager.spendTokenSpellSlot(room, reactor, COUNTERSPELL_LEVEL)) {
    return false;
  }
  if (!ctx.manager.spendSlot(room, choice.mapId, reactor, 'reaction')) return false;

  const targetLevel = Math.max(1, input.spell.level);
  let success = COUNTERSPELL_LEVEL >= targetLevel;
  if (!success) {
    const mod = statsForCaster(room, reactor, COUNTERSPELL_KEY)?.mod ?? 0;
    const roll = rollDice(mod >= 0 ? `d20+${mod}` : `d20${mod}`);
    const dc = 10 + targetLevel;
    success = roll.total >= dc;
    pushRollMessage(ctx, room, {
      author: reactor.name,
      roll,
      kind: 'check',
      params: { subject: `Counterspell: ${input.spell.name} (СЛ ${dc})` },
    });
  }
  ctx.syncCombat(room, choice.mapId);
  return success;
}

/** Каст с окном Counterspell (до резолва); экономика и проверки — на вызывающем. */
export function resolveSpellCastWithReactions(ctx: ConnCtx, input: SpellCastInput): { error?: string } {
  const room = ctx.getRoom();
  if (!room) return resolveSpellCast(ctx, input);
  const offers = counterspellOffers(ctx, room, input);
  if (!offers.length) return resolveSpellCast(ctx, input);
  const opened = openReactionWindow(ctx, room, {
    mapId: input.mapId,
    trigger: 'spellCast',
    sourceName: `${input.caster.name}: накладывает ${input.spell.name}`,
    offers,
    resume: (choices) => {
      const currentRoom = ctx.getRoom();
      if (!currentRoom) return;
      let countered = false;
      for (const choice of choices) {
        if (!choice.optionId || countered) continue;
        countered = applyCounterspell(ctx, currentRoom, choice, input);
      }
      if (countered) {
        ctx.systemMessage(currentRoom, `${input.caster.name}: ${input.spell.name} — отменено Counterspell`);
        return;
      }
      resolveSpellCast(ctx, input);
    },
  });
  return opened ? {} : resolveSpellCast(ctx, input);
}

/** Окно «получен урон»: Hellish Rebuke и подобные (после списания HP). */
function offerDamageReactions(ctx: ConnCtx, room: Room, mapId: string, target: Token, source: Token): void {
  if (isReactionPending(room.code)) return;
  if (isIncapacitated(target.conditions)) return;
  if (!reactionSlotFree(ctx.manager, room, mapId, target)) return;
  const options = reactionSpellOptions(room, target, 'damage');
  if (!options.length) return;
  const audience = audienceOf(ctx, room, mapId, target);
  if (!audience.length) return;
  openReactionWindow(ctx, room, {
    mapId,
    trigger: 'damage',
    sourceName: source.name,
    offers: [{ token: target, audience, options }],
    resume: (choices) => {
      const currentRoom = ctx.getRoom();
      if (!currentRoom) return;
      for (const choice of choices) {
        if (choice.optionId) applyReactionChoice(ctx, currentRoom, choice, [source]);
      }
      ctx.syncCombat(currentRoom, mapId);
    },
  });
}

/** Фазы после броска: промах → attackMiss, попадание → attackHit, затем урон. */
function continueAfterRoll(
  ctx: ConnCtx,
  room: Room,
  input: AttackResolveInput,
  result: AttackResolveResult,
  plan: WeaponAttackPlan
): AttackResolveResult {
  const target = plan.target;
  const targetMapId = plan.targetMapId;

  const applyDamage = (mods: WeaponDamageMods = {}) => {
    const damage = applyWeaponAttackDamage(ctx, plan, mods);
    if (!damage) return;
    result.damageRoll = damage.roll;
    if (damage.applied > 0 && target && targetMapId && plan.attacker && !input.ignoreRange) {
      offerDamageReactions(ctx, room, targetMapId, target, plan.attacker);
    }
  };

  // Атака по возможности сама окон не открывает (нет вложенных пауз).
  if (input.ignoreRange) {
    applyDamage();
    return result;
  }

  // Промах: Ответный удар (Riposte) и подобные.
  if (result.hitSuccess === false && target && targetMapId) {
    const melee = plan.attack.rangeType !== 'ranged';
    const features = availableFeatureReactions(room, target, 'attackMiss');
    if (melee && features.length && reactionSlotFree(ctx.manager, room, targetMapId, target)) {
      const opened = openReactionWindow(ctx, room, {
        mapId: targetMapId,
        trigger: 'attackMiss',
        sourceName: plan.attacker?.name,
        offers: [
          {
            token: target,
            audience: audienceOf(ctx, room, targetMapId, target),
            options: features.map((def) => featureOption(def, room, target)),
          },
        ],
        resume: (choices) => {
          const currentRoom = ctx.getRoom();
          if (!currentRoom) return;
          for (const choice of choices) {
            if (choice.optionId?.startsWith('feature:')) applyRiposte(ctx, currentRoom, choice, plan.attacker);
          }
          ctx.syncCombat(currentRoom, targetMapId);
        },
      });
      if (opened) return result;
    }
    return result;
  }

  // Попадание: Shield/черты цели перед уроном.
  if (target && targetMapId && result.hitSuccess === true && !result.crit) {
    const ac = ctx.manager.acForToken(room, target);
    const total = result.hitRoll ? result.hitRoll.total + plan.penalty : 0;
    const melee = plan.attack.rangeType !== 'ranged';
    const features = availableFeatureReactions(room, target, 'attackHit').filter((def) => {
      if (def.kind === 'halveDamage') return true;
      if (def.kind === 'acBonus') {
        if (!melee) return false;
        return total < ac + superiorityDie(classLevelOf(room, target, def.className) || 1);
      }
      return false;
    });
    const spellOpts = reactionSpellOptions(room, target, 'attackHit').filter((o) => {
      const absorb = absorbTypesOf(o.spellKey ?? '');
      if (absorb.length) return !!plan.attack.damageType && absorb.includes(plan.attack.damageType);
      return total < ac + acBonusOf(o);
    });
    const options: ReactionOption[] = [...spellOpts, ...features.map((def) => featureOption(def, room, target))];
    if (options.length && reactionSlotFree(ctx.manager, room, targetMapId, target)) {
      const opened = openReactionWindow(ctx, room, {
        mapId: targetMapId,
        trigger: 'attackHit',
        sourceName: plan.attacker?.name,
        offers: [{ token: target, audience: audienceOf(ctx, room, targetMapId, target), options }],
        resume: (choices) => {
          const currentRoom = ctx.getRoom();
          if (!currentRoom) {
            applyDamage();
            return;
          }
          const mods = attackWindowMods(ctx, currentRoom, target, choices);
          for (const choice of choices) {
            if (choice.optionId?.startsWith('spell:')) {
              applyReactionChoice(ctx, currentRoom, choice, [target], plan.attack.damageType);
            }
          }
          ctx.syncCombat(currentRoom, targetMapId);
          applyDamage(mods);
        },
      });
      if (opened) return result;
    }
  }

  applyDamage();
  return result;
}

/** Атака с окнами: до броска (Warding Flare), после броска (Shield/черты/промах), затем урон. */
export function resolveWeaponAttackWithReactions(ctx: ConnCtx, input: AttackResolveInput): AttackResolveResult {
  const room = ctx.getRoom();
  const prepared = prepareWeaponAttack(ctx, input);
  if (prepared.error) return { error: prepared.error };
  const prep = prepared.prep;
  if (!room || !prep) return {};

  // Окно до броска (attackRoll): Warding Flare и подобные.
  const preOffers = input.ignoreRange ? [] : preRollOffers(ctx, room, prep);
  if (preOffers.length) {
    const holder: AttackResolveResult = {};
    const mapId = prep.input.targetMapId ?? prep.input.attackerMapId ?? '';
    openReactionWindow(ctx, room, {
      mapId,
      trigger: 'attackRoll',
      sourceName: prep.input.attacker?.name,
      offers: preOffers,
      resume: (choices) => {
        const currentRoom = ctx.getRoom();
        const imposed = currentRoom ? applyAttackRollChoices(ctx, currentRoom, prep, choices, mapId) : false;
        const rolled = rollPreparedAttack(ctx, prep, { extraDisadvantage: imposed });
        Object.assign(holder, rolled.result);
        if (rolled.plan) continueAfterRoll(ctx, currentRoom ?? room, prep.input, holder, rolled.plan);
      },
    });
    return holder;
  }

  const rolled = rollPreparedAttack(ctx, prep);
  if (!rolled.plan) return rolled.result;
  return continueAfterRoll(ctx, room, input, rolled.result, rolled.plan);
}
