import { useMemo } from 'react';
import {
  attackIsActive,
  attacksPerAction,
  classFeatures,
  grantedSpells,
  isIncapacitated,
  type ActionDef,
  type AttackEntry,
  type Spell,
  type Token,
  type TurnState,
} from 'shared';
import { useGameStore } from '../store/useGameStore';
import { useActiveMap } from '../store/hooks';
import { characterTokenOf, tokenById } from '../store/selectors';
import { useIsDm } from './control';
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
  attacksPer: number;
  panelSpells: Spell[];
}

export function useActionContext(): ActionContext | null {
  const map = useActiveMap();
  const selectedTokenId = useGameStore((s) => s.selectedTokenId);
  const currentCharacterId = useGameStore((s) => s.currentCharacterId);
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
      turn = entry ? combat.turns[entry.id] : undefined;
    } else {
      tokenId = selectedTokenId ?? characterTokenOf(map, currentCharacterId)?.id ?? null;
    }
    // В чужой ход игрок видит свой токен: доступны реакции, действия — нет.
    if (combat.active && currentCharacterId !== null && !isDm) {
      const shown = tokenById(map, tokenId);
      if (shown?.libraryItemId !== currentCharacterId) {
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
    const controlled = isDm || (currentCharacterId !== null && token.libraryItemId === currentCharacterId);
    const isCharacter = currentCharacterId !== null && token.libraryItemId === currentCharacterId;
    const ownEntry = combat.entries.find((e) => e.tokenId === token.id);
    const ownTurn = ownEntry ? combat.turns[ownEntry.id] : undefined;
    const isActive = !combat.active || combat.entries[combat.currentIndex]?.tokenId === token.id;
    const weapons: { entry: AttackEntry; index: number }[] = (isCharacter ? sheet?.attacks ?? [] : token.attacks)
      .map((entry, index) => ({ entry, index }))
      .filter((x) => attackIsActive(x.entry));
    const features = isCharacter && sheet ? classFeatures(sheet.classes) : [];
    const attacksPer = isCharacter ? attacksPerAction(sheet?.classes ?? []) : Math.max(1, token.statblock?.multiattack ?? 1);

    const byKey = new Map((spells ?? []).map((s) => [s.key, s]));
    let panelSpells: Spell[] = [];
    if (isCharacter) {
      if (sheet) {
        const keys = new Set<string>();
        for (const s of sheet.spells ?? []) keys.add(s.key);
        for (const g of grantedSpells(sheet.classes)) keys.add(g.key);
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
      attacksPer,
      panelSpells,
    };
  }, [map, selectedTokenId, currentCharacterId, isDm, sheet, spells]);

  return info;
}
