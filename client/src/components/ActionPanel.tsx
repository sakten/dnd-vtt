import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  BASE_ACTIONS,
  actionSlotAvailable,
  attackIsActive,
  attacksPerAction,
  classFeatures,
  grantedSpells,
  isIncapacitated,
  type ActionCost,
  type ActionDef,
  type AttackEntry,
  type Spell,
  type TurnState,
} from 'shared';
import { useGameStore } from '../store/useGameStore';
import { loadSpells } from '../lib/spells';
import ActionIcon from './ActionIcon';
import ConditionChips from './ConditionChips';
import SpellIcon from './SpellIcon';
import SpellPopover from './SpellPopover';
import WeaponIcon from './WeaponIcon';

/** Базовые действия, которые по правилам являются атаками (бейдж-меч). */
const ATTACK_BADGED = new Set(['unarmedStrike', 'grapple', 'shove']);

/** Иконка классовой черты по ключу ресурса (fallback — искра). */
function featureIconId(f: ActionDef): string {
  const k = `${f.resourceKey ?? ''} ${f.id}`.toLowerCase();
  if (k.includes('inspiration')) return 'inspiration';
  if (k.includes('channeldivinity')) return 'channel';
  if (k.includes('focus/')) return 'flurry';
  if (k.includes('wildshape')) return 'beast';
  if (k.includes('rage')) return 'rage';
  if (k.includes('surge')) return 'surge';
  if (k.includes('secondwind') || k.includes('layonhands') || k.includes('healing') || k.includes('balm')) return 'heal';
  if (k.includes('ward') || k.includes('shield') || k.includes('defense') || k.includes('defences')) return 'shield';
  if (k.includes('eye') || k.includes('omen') || k.includes('portent') || k.includes('third')) return 'eye';
  if (k.includes('dice') || k.includes('maneuver') || k.includes('metamagic')) return 'dice';
  return 'spark';
}

function Dots({ total, remaining, tone }: { total: number; remaining: number; tone: string }) {
  return (
    <span className={`ap-dots ${tone}`}>
      {Array.from({ length: Math.max(0, total) }, (_, i) => (
        <span key={i} className={`ap-dot${i < remaining ? ' on' : ''}`} />
      ))}
    </span>
  );
}

export default function ActionPanel() {
  const map = useGameStore((s) => s.scene.maps.find((m) => m.id === s.viewMapId) ?? null);
  const selectedTokenId = useGameStore((s) => s.selectedTokenId);
  const targetTokenId = useGameStore((s) => s.targetTokenId);
  const currentCharacterId = useGameStore((s) => s.currentCharacterId);
  const role = useGameStore((s) => s.role);
  const sheet = useGameStore((s) => s.sheet);
  const resources = useGameStore((s) => s.resources);
  const runAction = useGameStore((s) => s.runAction);
  const [spells, setSpells] = useState<Spell[] | null>(null);
  const [casting, setCasting] = useState<Spell | null>(null);

  useEffect(() => {
    let alive = true;
    loadSpells().then((list) => {
      if (alive) setSpells(list);
    });
    return () => {
      alive = false;
    };
  }, []);

  const info = useMemo(() => {
    if (!map) return null;
    const combat = map.combat;
    let tokenId: string | null = null;
    let turn: TurnState | undefined;
    if (combat.active && combat.currentIndex >= 0) {
      const entry = combat.entries[combat.currentIndex];
      tokenId = entry?.tokenId ?? null;
      turn = entry ? combat.turns[entry.id] : undefined;
    } else {
      tokenId = selectedTokenId ?? map.tokens.find((t) => t.libraryItemId === currentCharacterId)?.id ?? null;
    }
    const token = tokenId ? map.tokens.find((t) => t.id === tokenId) : null;
    if (!token) return null;
    const controlled = role === 'dm' || (currentCharacterId !== null && token.libraryItemId === currentCharacterId);
    const inTurn = combat.active && combat.currentIndex >= 0 && controlled;
    const isCharacter = currentCharacterId !== null && token.libraryItemId === currentCharacterId;
    const weapons: { entry: AttackEntry; index: number }[] = (isCharacter ? sheet?.attacks ?? [] : token.attacks)
      .map((entry, index) => ({ entry, index }))
      .filter((x) => attackIsActive(x.entry));
    const features = isCharacter && sheet ? classFeatures(sheet.classes) : [];
    const attacksPer = isCharacter ? attacksPerAction(sheet?.classes ?? []) : Math.max(1, token.statblock?.multiattack ?? 1);
    return { token, turn, controlled, inTurn, combatActive: combat.active, weapons, features, attacksPer, isCharacter };
  }, [map, selectedTokenId, currentCharacterId, role, sheet]);

  const characterSpells = useMemo(() => {
    if (!sheet || !info?.isCharacter || !spells) return [];
    const byKey = new Map(spells.map((s) => [s.key, s]));
    const keys = new Set<string>();
    for (const s of sheet.spells ?? []) keys.add(s.key);
    for (const g of grantedSpells(sheet.classes)) keys.add(g.key);
    return [...keys].map((k) => byKey.get(k)).filter((s): s is Spell => !!s);
  }, [sheet, info?.isCharacter, spells]);

  if (!info) return null;
  const { token, turn, controlled, inTurn, combatActive, weapons, features, attacksPer } = info;
  const incap = role !== 'dm' && isIncapacitated(token.conditions);
  const spellByKey = new Map((spells ?? []).map((s) => [s.key, s]));

  const targetName = map?.tokens.find((t) => t.id === targetTokenId)?.name;

  const canSpend = (slot: ActionCost, actionId: string) => {
    if (incap) return false;
    if (!controlled) return false;
    if (!combatActive) return true;
    if (!inTurn || !turn) return false;
    if (actionId === 'attack') return turn.attacksRemaining > 0 || actionSlotAvailable(turn, slot);
    return actionSlotAvailable(turn, slot);
  };

  const actionTotal = turn ? 1 + turn.extraActions : 0;
  const actionRemaining = turn ? (turn.actionUsed ? 0 : 1) + turn.extraActions : 0;
  const bonusTotal = turn ? 1 + turn.extraBonusActions : 0;
  const bonusRemaining = turn ? (turn.bonusActionUsed ? 0 : 1) + turn.extraBonusActions : 0;
  const reactionTotal = turn ? 1 : 0;
  const reactionRemaining = turn ? (turn.reactionUsed ? 0 : 1) : 0;
  const moveLeft = turn ? turn.movementMax - turn.movementUsed : 0;
  const attacksLeft = turn
    ? (turn.attacksRemaining > 0 ? turn.attacksRemaining : turn.actionUsed ? 0 : attacksPer) +
      turn.extraActions * attacksPer
    : attacksPer;
  const attacksTotal = Math.max(attacksPer, attacksLeft);

  const fire = (actionId: string, slot: ActionCost, attackIndex?: number) => {
    runAction(token.id, actionId, {
      targetIds: targetTokenId ? [targetTokenId] : undefined,
      attackIndex,
      slot,
    });
  };

  const resourceLeft = (f: ActionDef): number | null => {
    if (!f.resourceKey) return null;
    return resources?.resources.find((r) => r.key === f.resourceKey)?.current ?? 0;
  };

  const canUseFeature = (f: ActionDef): boolean => {
    if (incap) return false;
    if (!controlled) return false;
    const amount = Math.max(1, f.resourceAmount ?? 1);
    const left = resourceLeft(f);
    if (left !== null && left < amount) return false;
    if (!combatActive) return true;
    if (!inTurn || !turn) return false;
    return f.costs.some((c) => actionSlotAvailable(turn, c));
  };

  const featureSlot = (f: ActionDef): ActionCost => {
    if (!combatActive || !turn) return f.costs[0] ?? 'special';
    return f.costs.find((c) => actionSlotAvailable(turn, c)) ?? f.costs[0] ?? 'special';
  };

  const featuresAction = features.filter((f) => f.costs.includes('action'));
  const featuresBonus = features.filter((f) => f.costs.includes('bonus'));
  const featuresOther = features.filter((f) => !f.costs.includes('action') && !f.costs.includes('bonus'));

  const spellSlotOf = (spell: Spell): 'action' | 'bonus' | 'other' => {
    const unit = spell.time[0]?.unit;
    if (unit === 'action') return 'action';
    if (unit === 'bonus') return 'bonus';
    return 'other';
  };
  const spellsAction = characterSpells.filter((s) => spellSlotOf(s) === 'action');
  const spellsBonus = characterSpells.filter((s) => spellSlotOf(s) === 'bonus');
  const spellsOther = characterSpells.filter((s) => spellSlotOf(s) === 'other');

  const spellButton = (spell: Spell) => {
    const level = spell.level === 0 ? 'фокус' : `${spell.level} круг`;
    return (
      <button
        key={`spell:${spell.key}`}
        className="ap-icon-btn ap-spell-btn"
        data-tip={`${spell.name} · ${level}`}
        aria-label={spell.name}
        disabled={incap}
        onClick={() => setCasting(spell)}
      >
        <SpellIcon spell={spell} className="ap-icon" />
      </button>
    );
  };

  const featureButton = (f: ActionDef) => {
    const left = resourceLeft(f);
    const label = left !== null ? `${f.name} (${left})` : f.name;
    return (
      <button
        key={f.id}
        className="ap-icon-btn"
        data-tip={label}
        aria-label={label}
        disabled={!canUseFeature(f)}
        onClick={() => fire(f.id, featureSlot(f))}
      >
        <ActionIcon id={featureIconId(f)} className="ap-icon" />
      </button>
    );
  };

  const renderButtons = (slot: ActionCost) => {
    const buttons: ReactNode[] = [];
    const hasAttack = BASE_ACTIONS.some((a) => a.id === 'attack' && a.costs.includes(slot));
    if (hasAttack) {
      const enabled = canSpend(slot, 'attack');
      if (weapons.length === 0) {
        buttons.push(
          <button
            key={`${slot}:attack:none`}
            className="ap-icon-btn"
            data-tip="Атака (нет оружия)"
            aria-label="Атака (нет оружия)"
            disabled
          >
            <WeaponIcon name="" className="ap-icon" />
          </button>
        );
      } else {
        for (const { entry, index } of weapons) {
          const label = entry.name.trim() || `Оружие ${index + 1}`;
          buttons.push(
            <button
              key={`${slot}:attack:${index}`}
              className="ap-icon-btn"
              data-tip={`Атака: ${label}`}
              aria-label={`Атака: ${label}`}
              disabled={!enabled}
              onClick={() => fire('attack', slot, index)}
            >
              <WeaponIcon name={entry.name} className="ap-icon" />
              <span className="ap-attack-badge">
                <ActionIcon id="sword" className="ap-badge-icon" />
              </span>
            </button>
          );
        }
      }
    }
    for (const a of BASE_ACTIONS.filter((x) => x.costs.includes(slot) && x.id !== 'attack')) {
      // Безоружный удар, захват и толчок — тоже атаки: меч-бейдж и метка «Атака: …».
      const isAttack = ATTACK_BADGED.has(a.id);
      const label = isAttack ? `Атака: ${a.name}` : a.name;
      buttons.push(
        <button
          key={`${slot}:${a.id}`}
          className="ap-icon-btn"
          data-tip={label}
          aria-label={label}
          disabled={!canSpend(slot, a.id)}
          onClick={() => fire(a.id, slot)}
        >
          <ActionIcon id={a.id} className="ap-icon" />
          {isAttack && (
            <span className="ap-attack-badge">
              <ActionIcon id="sword" className="ap-badge-icon" />
            </span>
          )}
        </button>
      );
    }
    if (slot === 'action' || slot === 'bonus') {
      buttons.push(...(slot === 'action' ? featuresAction : featuresBonus).map(featureButton));
      buttons.push(...(slot === 'action' ? spellsAction : spellsBonus).map(spellButton));
    }
    if (buttons.length === 0) return <span className="ap-empty">Нет</span>;
    return buttons;
  };

  return (
    <div className={`action-panel${!controlled ? ' ap-locked' : ''}`}>
      <div className="ap-head">
        <span className="ap-token">{token.name}</span>
        {token.conditions.length > 0 && <ConditionChips conditions={token.conditions} spellByKey={spellByKey} />}
        {incap && <span className="ap-incap">Недееспособен</span>}
        {targetName && <span className="ap-target">Цель: {targetName}</span>}
        {combatActive && turn ? (
          <span className="ap-counters">
            <span className="ap-counter" title="Реакция">
              Реакция <Dots total={reactionTotal} remaining={reactionRemaining} tone="reaction" />
            </span>
            <span className="ap-counter attack-left" title="Атаки в действии «Атака»">
              {Array.from({ length: attacksTotal }, (_, i) => (
                <ActionIcon key={i} id="sword" className={`ap-sword${i < attacksLeft ? '' : ' spent'}`} />
              ))}
            </span>
            <span className={`ap-counter move${moveLeft < 0 ? ' over' : ''}`} title="Осталось передвижения">
              {moveLeft} фт
            </span>
          </span>
        ) : (
          <span className="ap-count dim">{controlled ? 'Вне боя' : 'Не ваш токен'}</span>
        )}
      </div>
      <div className="ap-body">
        <section className="ap-panel actions">
          <div className="ap-panel-head">
            <span className="ap-panel-title">Действия</span>
            {combatActive && turn && <Dots total={actionTotal} remaining={actionRemaining} tone="action" />}
          </div>
          <div className="ap-icons">{renderButtons('action')}</div>
        </section>
        <section className="ap-panel bonus">
          <div className="ap-panel-head">
            <span className="ap-panel-title">Бонусные действия</span>
            {combatActive && turn && <Dots total={bonusTotal} remaining={bonusRemaining} tone="bonus" />}
          </div>
          <div className="ap-icons">{renderButtons('bonus')}</div>
        </section>
      </div>
      {(featuresOther.length > 0 || spellsOther.length > 0) && (
        <section className="ap-panel other">
          <div className="ap-panel-head">
            <span className="ap-panel-title">Свободные и прочие</span>
          </div>
          <div className="ap-icons">
            {featuresOther.map(featureButton)}
            {spellsOther.map(spellButton)}
          </div>
        </section>
      )}
      {casting && <SpellPopover spell={casting} tokenId={token.id} onClose={() => setCasting(null)} />}
    </div>
  );
}
