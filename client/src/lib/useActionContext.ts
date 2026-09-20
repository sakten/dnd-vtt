import { useMemo } from 'react';
import {
  attackIsActive,
  attacksPerAction,
  choiceSpellGrants,
  classFeatures,
  featSpellGrants,
  grantedSpells,
  invocationAtWillSpells,
  isIncapacitated,
  type ActionDef,
  type AttackEntry,
  type Spell,
  type Token,
  type TurnState,
} from 'shared';
import { useGameStore } from '../store/useGameStore';
import { t } from '../i18n';
import { useActiveMap } from '../store/hooks';
import { characterTokenOf, tokenById } from '../store/selectors';
import { canControlTokenWith, characterNameOf, isCharacterTokenWith, useIsDm } from './control';
import { useSpells } from './useSpells';

/** Модель панели действий: активный/выбранный токен, экономика, оружие, черты, заклинания. */
export interface ActionContext {
  token: Token;
  turn: TurnState | undefined;
  ownTurn: TurnState | undefined;
  isActive: boolean;
  controlled: boolean;
  combatActive: boolean;
  isCharacter: boolean;
  incapacitated: boolean;
  weapons: { entry: AttackEntry; index: number }[];
  features: ActionDef[];
  abilities: ActionDef[];
  attacksPer: number;
  panelSpells: Spell[];
  legendarySlot: boolean;
  legendaryRemaining: number;
  legendaryMax: number;
}

export function useActionContext(): ActionContext | null {
  const map = useActiveMap();
  const selectedTokenId = useGameStore((s) => s.selectedTokenId);
  const currentCharacterId = useGameStore((s) => s.currentCharacterId);
  const selfId = useGameStore((s) => s.selfId);
  const role = useGameStore((s) => s.role);
  const testMode = useGameStore((s) => s.testMode);
  const charName = useGameStore((s) => characterNameOf(s, s.currentCharacterId));
  const isDm = useIsDm();
  const sheet = useGameStore((s) => s.sheet);
  const spells = useSpells();

  const info = useMemo(() => {
    if (!map) return null;
    const combat = map.combat;
    let tokenId: string | null;
    let turn: TurnState | undefined;
    if (combat.active && combat.currentIndex >= 0) {
      const entry = combat.entries[combat.currentIndex];
      tokenId = entry?.tokenId ?? null;
      turn = entry ? combat.turns[entry.legendaryOwnerId ?? entry.id] : undefined;
    } else {
      tokenId = selectedTokenId ?? characterTokenOf(map, currentCharacterId)?.id ?? null;
    }
    const control = { role, testMode, selfId, currentCharacterId };
    // В чужой ход игрок видит свой токен: доступны реакции, действия — нет.
    // Но контролируемый призыв (фамильяр/сумммон по владельцу) остаётся со своим ходом.
    if (combat.active && currentCharacterId !== null && !isDm) {
      const shown = tokenById(map, tokenId);
      const shownMine =
        !!shown &&
        (shown.libraryItemId === currentCharacterId || canControlTokenWith(control, shown, charName));
      if (!shownMine) {
        const mine = characterTokenOf(map, currentCharacterId);
        if (mine) {
          tokenId = mine.id;
          turn = undefined;
        }
      }
    } else if (combat.active && isDm && selectedTokenId) {
      // DM смотрит выбранный токен (например, реакция монстра в чужой ход).
      const activeId = combat.entries[combat.currentIndex]?.tokenId ?? null;
      const selected = tokenById(map, selectedTokenId);
      if (selected && selected.id !== activeId) {
        tokenId = selected.id;
        turn = undefined;
      }
    }
    const token = tokenById(map, tokenId);
    if (!token) return null;
    // Контроль — как у серверного `controlsToken` (контроллер или владелец по имени);
    // лист игрока доступен только при привязке через контроллера (`isCharacter`).
    const controlled = canControlTokenWith(control, token, charName);
    const isCharacter = isCharacterTokenWith(control, token);
    const ownEntry = combat.entries.find((e) => e.tokenId === token.id);
    const ownTurn = ownEntry ? combat.turns[ownEntry.id] : undefined;
    const isActive = !combat.active || combat.entries[combat.currentIndex]?.tokenId === token.id;
    const activeEntry =
      combat.active && combat.currentIndex >= 0 ? combat.entries[combat.currentIndex] : undefined;
    const legendarySlot = !!activeEntry?.legendaryOwnerId && activeEntry.tokenId === token.id;
    const weapons: { entry: AttackEntry; index: number }[] = (isCharacter ? sheet?.attacks ?? [] : token.attacks)
      .map((entry, index) => ({ entry, index }))
      .filter((x) => attackIsActive(x.entry));
    // «Выпутаться» (Web и подобные): динамические действия из эффектов токена.
    const escapeActions: ActionDef[] = token.effects
      .filter((e) => e.escape)
      .map((e) => ({
        id: `escape:${e.id}`,
        name: t('ui.action.escape'),
        source: 'basic' as const,
        costs: ['action' as const],
        description: e.name,
      }));
    const features = [...(isCharacter && sheet ? classFeatures(sheet.classes) : []), ...escapeActions];
    const attacksPer = isCharacter ? attacksPerAction(sheet?.classes ?? []) : Math.max(1, token.statblock?.multiattack ?? 1);

    const byKey = new Map((spells ?? []).map((s) => [s.key, s]));
    let panelSpells: Spell[] = [];
    if (isCharacter) {
      if (sheet) {
        const keys = new Set<string>();
        for (const s of sheet.spells ?? []) keys.add(s.key);
        for (const g of grantedSpells(sheet.classes)) keys.add(g.key);
        for (const g of featSpellGrants(sheet.choices)) keys.add(g.key);
        for (const g of choiceSpellGrants(sheet.choices)) keys.add(g.key);
        for (const key of invocationAtWillSpells(sheet)) keys.add(key);
        panelSpells = [...keys].map((k) => byKey.get(k)).filter((s): s is Spell => !!s);
      }
    } else {
      panelSpells = (token.statblock?.spellcasting?.spells ?? [])
        .map((k) => byKey.get(k))
        .filter((s): s is Spell => !!s);
    }

    return {
      token,
      turn,
      ownTurn,
      isActive,
      controlled,
      combatActive: combat.active,
      isCharacter,
      incapacitated: !isDm && isIncapacitated(token.conditions),
      weapons,
      features,
      abilities: token.statblock?.actions ?? [],
      attacksPer,
      panelSpells,
      legendarySlot,
      legendaryRemaining: turn?.legendaryRemaining ?? 0,
      legendaryMax: turn?.legendaryMax ?? 0,
    };
  }, [map, selectedTokenId, currentCharacterId, selfId, role, testMode, charName, isDm, sheet, spells]);

  return info;
}
