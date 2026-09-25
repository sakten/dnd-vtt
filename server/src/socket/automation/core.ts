import { randomUUID } from 'node:crypto';
import {
  abilityMod,
  bestiaryTokenFields,
  characterLevel,
  gridDistanceFeet,
  isBanished,
  maximizeHealing,
  maximizedRollTotal,
  proficiencyBonus,
  resolveAbilityMods,
  sideMatches,
  type AbilityKey,
  type AreaSpec,
  type AutomationDice,
  type AutomationDef,
  type DiceRollResult,
  type LibraryItem,
  type SpellStats,
  type Token,
} from 'shared';
import bestiaryData from 'shared/bestiaryData';
import type { ConnCtx } from '../context';
import type { Room } from '../../roomTypes';
import { gridSizeOfMap, sheetOfToken } from '../../rooms';
import { actorStats } from '../../room/actor';
import type { WeaponDamageMods } from '../attackResolve';
import { applyDamage } from '../damage';
import { endConcentrationOf } from '../effects';
import { applyEffectTo, removeConditionInstances, type ApplyEffectArgs } from '../effectsApply';
import { resolveLightDispels } from '../zones';

/**
 * Generic-executor автоматизации (R8.1): выполняет `AutomationDef` — атаку,
 * спасбросок, авто-урон/лечение, эффекты и `manual` — без веток по конкретным
 * заклинаниям. Экономика, права и валидация — на вызывающем.
 */
export interface AutomationInput {
  caster: Token;
  mapId: string;
  def: AutomationDef;
  targets: Token[];
  /** Боевые характеристики кастера; null — нет заклинательной характеристики. */
  stats: SpellStats | null;
  author: string;
  advantage?: 'a' | 'd';
  /** Для manual-сообщения: описание и круг источника (у черт может не быть). */
  manual?: { description?: string[]; level?: number; castLevel?: number };
  /** Точка привязки/направление каста — для создания зон (`def.zone`). */
  origin?: { x: number; y: number } | null;
  direction?: { x: number; y: number } | null;
  /** Область применения, если её нет в `def` (заклинания: `spell.areaSpec`). */
  area?: AreaSpec | null;
  /** Выбранная форма призыва (Find Familiar): ключ каталога бестиария. */
  summonKey?: string;
  /** Выбор состояния для снятия (Lesser/Greater Restoration). */
  choice?: string;
  /** Scatter: точки назначения по целям. */
  placements?: { targetId: string; x: number; y: number }[];
  /** Телепорт с пассажиром (Dimension Door, Thunder Step). */
  passengerId?: string;
  /** Зона-источник действия (кнопки зоны): для преимуществ «цель внутри зоны». */
  zoneId?: string;
}

/** Бонус владения кастера по его листу (монстры и токены без листа — 2). */
export function proficiencyFor(ctx: ConnCtx, room: Room, caster: Token): number {
  const { sheet } = sheetOfToken(room, caster);
  return proficiencyBonus(characterLevel(sheet?.classes ?? []) || 1);
}

/**
 * Выражение костей черты: число костей по характеристике (`abilityDice`,
 * Sear Undead) и подстановка токенов характеристик (`1d8+wis`).
 */
export function resolveDiceExpression(
  dice: AutomationDice | undefined,
  abilities: Partial<Record<AbilityKey, number>> | undefined,
  proficiency: number
): string | null {
  if (!dice) return null;
  let expression = dice.dice;
  if (dice.abilityDice) {
    const count = Math.max(dice.abilityDice.min ?? 1, abilityMod(abilities?.[dice.abilityDice.ability] ?? 10));
    expression = expression.replace(/^\d*/, String(count));
  }
  return resolveAbilityMods(expression, abilities, proficiency);
}

/** Бонус лечения Домена жизни: Ученик жизни (2+круг) и Целитель-благословенный (самолечение). */
export function lifeHealing(
  room: Room,
  caster: Token,
  def: AutomationDef,
  castLevel: number | undefined
): { bonus: number; selfHeal: boolean } {
  if (!def.heal || !castLevel || castLevel < 1) return { bonus: 0, selfHeal: false };
  const { sheet } = sheetOfToken(room, caster);
  const life = sheet?.classes.find((c) => c.className === 'cleric' && c.subclass === 'life')?.level ?? 0;
  if (life < 3) return { bonus: 0, selfHeal: false };
  return { bonus: 2 + castLevel, selfHeal: life >= 6 };
}

/** Токены в радиусе от кастера: враждебные (`hostile`), союзные (`ally`) или любые (`any`). */
export function tokensAround(
  ctx: ConnCtx,
  room: Room,
  mapId: string,
  caster: Token,
  feet: number,
  side: 'hostile' | 'ally' | 'any',
  includeSelf = false
): Token[] {
  const map = ctx.manager.findMap(room, mapId);
  if (!map) return includeSelf ? [caster] : [];
  const size = gridSizeOfMap(map);
  return map.tokens.filter((token) => {
    // Изгнанные (Banishment) вне поля: радиус-способности их не задевают.
    if (isBanished(token)) return false;
    if (token.id === caster.id) return includeSelf;
    if (gridDistanceFeet(token, caster, size) > feet) return false;
    return side === 'any' || sideMatches(caster, token, side);
  });
}

/** Снимает прежнюю концентрацию кастера: эффекты на всех токенах и его зоны. */
export function dropConcentration(ctx: ConnCtx, room: Room, caster: Token): void {
  endConcentrationOf(ctx, room, caster);
}

/** Якорь концентрации на кастере для зон без целевых эффектов (HoH, Spirit Guardians). */
export function anchorConcentration(ctx: ConnCtx, room: Room, caster: Token, mapId: string, def: AutomationDef): void {
  const anchorId = randomUUID();
  ctx.manager.applyEffect(room, caster, {
    id: anchorId,
    name: def.name,
    sourceKey: def.key,
    sourceId: caster.id,
    concentration: true,
    duration: { type: 'concentration' },
    modifiers: [],
  });
  ctx.emitToken(room, 'token:update', mapId, caster);
  ctx.manager.setConcentration(room, mapId, caster, anchorId);
}

/** Накладывает эффект; для светящих эффектов сразу разрешает диспел-пересечения со тьмой. */
export function applyEffectLight(ctx: ConnCtx, room: Room, mapId: string, args: ApplyEffectArgs): string {
  const id = applyEffectTo(ctx, room, args);
  if (args.effectDef.light) resolveLightDispels(ctx, room, mapId);
  return id;
}

/** Данные прогона автоматизации: всё, что нужно резолверам урона/лечения. */
export interface AutomationRun {
  ctx: ConnCtx;
  room: Room;
  caster: Token;
  def: AutomationDef;
  mapId: string;
  targets: Token[];
  author: string;
  abilities: Partial<Record<AbilityKey, number>> | undefined;
  proficiency: number;
  healing: boolean;
  healMods: { bonus: number; selfHeal: boolean };
  expression: string | null;
  subject: string;
  damageType: string | undefined;
  adv: 'a' | 'd' | undefined;
  count: number;
  /** Выбранная форма Polymorph (ключ каталога бестиария). */
  shapeForm?: string;
  /** Steel Wind Strike: точка телепорта, выполняется после резолва всех атак. */
  teleportTo?: { x: number; y: number };
  /** Зона-источник действия: цель внутри неё → преимущество (Storm Sphere). */
  zoneId?: string;
}

/** Лечение с бонусом Ученика жизни. */
function healValue(run: AutomationRun, total: number): number {
  return run.healing ? total + run.healMods.bonus : total;
}

/** Целитель-благословенный: леча других заклинанием с ячейкой, кастер лечится сам. */
function healAfter(run: AutomationRun, target: Token): void {
  if (run.healing && run.healMods.selfHeal && target.id !== run.caster.id) {
    applyDamage(run.ctx, { target: run.caster, mapId: run.mapId, amount: run.healMods.bonus, kind: 'heal' });
  }
}

/** Flame Blade / лечащие заклинания (Cure Wounds): + модификатор заклинательной характеристики кастера. */
export function withSpellAbilityMod(expression: string | null, def: AutomationDef, stats: SpellStats | null): string | null {
  const mod = stats ? Math.round(stats.mod) : 0;
  if (!expression || !(def.damage?.abilityMod || def.heal?.abilityMod) || !mod) return expression;
  return `${expression}${mod > 0 ? '+' : ''}${mod}`;
}

/**
 * Harm: максимум HP цели снижается на фактически полученный урон (не ниже 1).
 * Штраф — постоянный эффект с модификатором maxHp, снимается с эффектом (долгий отдых).
 */
export function applyMaxHpFromDamage(run: AutomationRun, target: Token, amount: number): void {
  const { ctx, room, mapId, caster, def } = run;
  const maxHp = actorStats(room, target).hp.max;
  const penalty = Math.min(Math.round(amount), Math.max(0, maxHp - 1));
  if (penalty <= 0) return;
  ctx.manager.applyEffect(room, target, {
    id: randomUUID(),
    name: def.name,
    sourceKey: def.key,
    sourceId: caster.id,
    duration: { type: 'permanent' },
    modifiers: [{ id: randomUUID(), target: 'maxHp', mode: 'add', value: -penalty }],
  });
  const controllerId = ctx.manager.controllerOfToken(room, target);
  if (controllerId) ctx.emitResources(room, controllerId);
  ctx.emitToken(room, 'token:update', mapId, target);
  ctx.systemMessage(room, {
    code: 'automation.maxHpReduced',
    params: { name: target.name, amount: penalty },
  });
}

/** Negative Energy Flood: убитый поднимается зомби (XMM:Zombie) в своей клетке; ведёт DM. */
function spawnZombie(run: AutomationRun, at: Token): void {
  const { ctx, room, mapId } = run;
  const entry = bestiaryData.entries.find((e) => e.key === 'XMM:Zombie');
  if (!entry) return;
  const item: LibraryItem = { id: randomUUID(), ...bestiaryTokenFields(entry), owner: '' };
  const token = ctx.manager.addToken(room, mapId, item, at.x, at.y, '');
  if (!token) return;
  token.faction = 'enemy';
  ctx.emitToken(room, 'token:add', mapId, token);
  if (ctx.manager.combatOf(room, mapId)?.active) {
    ctx.manager.addTokenToCombat(room, mapId, token);
    ctx.syncCombat(room, mapId);
  }
  ctx.systemMessage(room, { code: 'automation.zombieRises', params: { name: at.name } });
}

/** Единая точка урона/лечения прогона: бонус Ученика жизни, сообщение, самолечение Целителя. */
export function applyResult(
  run: AutomationRun,
  target: Token,
  roll: DiceRollResult,
  opts: {
    subject?: string;
    halve?: boolean;
    kind?: 'damage' | 'heal';
    crit?: boolean;
    silent?: boolean;
    /** Модификаторы реакций (половина/снижение/добавка к урону) из окна попадания. */
    mods?: WeaponDamageMods;
  } = {}
): ReturnType<typeof applyDamage> {
  const mods = run.healing ? undefined : opts.mods;
  const aliveBefore = (target.hpCurrent ?? 0) > 0;
  const parts = roll.damageParts.map((part) => ({ ...part }));
  const bonus = (mods?.extraDamage ?? 0) - (mods?.flatReduction ?? 0);
  if (bonus && parts.length) {
    const main = parts.find((part) => (part.damageType ?? run.damageType) === run.damageType) ?? parts[0]!;
    main.amount += bonus;
  }
  const result = applyDamage(run.ctx, {
    target,
    mapId: run.mapId,
    // Beacon of Hope: лечение цели берёт максимум костей.
    amount: Math.max(0, healValue(run, run.healing && maximizeHealing(target.effects) ? maximizedRollTotal(roll) : roll.total) + bonus),
    damageType: run.damageType,
    ...(run.healing ? {} : { parts }),
    ...(opts.silent ? {} : { roll, author: run.author, params: { subject: opts.subject ?? run.subject, damageType: run.damageType } }),
    kind: opts.kind ?? (run.healing ? 'heal' : 'damage'),
    ...(opts.halve !== undefined ? { halve: opts.halve } : mods?.halveDamage ? { halve: true } : {}),
    ...(opts.crit !== undefined && { crit: opts.crit }),
    // Ближние заклинательные атаки (Shocking Grasp/Vampiric Touch) — триггер ответок цели.
    ...(run.def.attack ? { attacker: run.caster, melee: run.def.attack.rangeType === 'melee' } : {}),
  });
  // Negative Energy Flood: убитый этим уроном сразу поднимается зомби.
  if (!run.healing && aliveBefore && (target.hpCurrent ?? 0) <= 0 && run.def.key === 'XGE:Negative Energy Flood') {
    spawnZombie(run, target);
  }
  // Heal и подобные: состояния снимаются независимо от броска лечения.
  if (run.def.endConditions?.length) {
    removeConditionInstances(run.ctx, run.room, run.mapId, target, run.def.endConditions);
  }
  healAfter(run, target);
  // Vampiric Touch: лечение кастера на половину фактически нанесённого урона.
  if (run.def.lifesteal && !run.healing && result.applied && result.amount > 0) {
    const heal = Math.floor(result.amount / 2);
    if (heal > 0) {
      applyDamage(run.ctx, { target: run.caster, mapId: run.mapId, amount: heal, kind: 'heal' });
      run.ctx.systemMessage(run.room, {
        code: 'automation.lifesteal',
        params: { name: run.caster.name, feature: run.def.name, target: target.name, amount: heal },
      });
    }
  }
  return result;
}

/** Эффекты способности/заклинания цели: при попадании или провале спасброска. */
export function applyTargetEffects(run: AutomationRun, target: Token, stats: SpellStats | null): void {
  const { ctx, room, def, caster, mapId } = run;
  for (const effectDef of def.effects ?? []) {
    // Self-эффекты наложены один раз до резолва (Vampiric Touch, Sunbeam).
    if (effectDef.to === 'self') continue;
    const recipients = effectDef.to === 'targets' ? [target] : [caster];
    for (const recipient of recipients) {
      applyEffectLight(ctx, room, mapId, {
        sourceKey: def.key,
        sourceId: caster.id,
        mapId,
        effectDef,
        target: recipient,
        markedId: effectDef.markTarget ? target.id : undefined,
        maxRounds: def.maxRounds,
        untilSaveDc: stats?.dc,
        escapeDc: stats?.dc,
      });
    }
  }
}
