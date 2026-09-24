import { useMemo } from 'react';
import {
  attackIsActive,
  attacksPerAction,
  choiceSpellGrants,
  classFeatures,
  druidLevelOf,
  featSpellGrants,
  grantedSpells,
  handOf,
  invocationAtWillSpells,
  isIncapacitated,
  isTriggeredAbility,
  loadoutOf,
  weaponContextOf,
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
  /** Оружие левой руки из производного лоадаута (атака второй рукой). */
  leftHand?: AttackEntry;
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
    // В форме зверя (Wild Shape/Polymorph) оружие и атаки — из статблока формы.
    const inShape = !!token.shape;
    const fromSheet = isCharacter && !inShape && sheet ? sheet : undefined;
    const loadout = loadoutOf({
      attacks: fromSheet ? fromSheet.attacks : token.attacks,
      hands: fromSheet?.hands,
      effects: token.effects,
      ...weaponContextOf(fromSheet),
    });
    const weapons: { entry: AttackEntry; index: number }[] = loadout.attacks
      .map((entry, index) => ({ entry, index }))
      .filter((x) => attackIsActive(x.entry));
    const leftHand = fromSheet ? handOf(loadout, 'left') : undefined;
    // «Выпутаться» (Web и подобные): динамические действия из эффектов токена.
    const escapeActions: ActionDef[] = token.effects
      .filter((e) => e.escape)
      .map((e) => ({
        id: `escape:${e.id}`,
        name: e.escape?.label ?? t('ui.action.escape'),
        source: 'basic' as const,
        costs: ['action' as const],
        ...(e.escape?.iconKey ? { iconKey: e.escape.iconKey } : {}),
        description: e.name,
      }));
    // Действия, выданные эффектами (Expeditious Retreat: Рывок бонусным действием).
    const grantedActions: ActionDef[] = token.effects.flatMap((e) =>
      (e.actions ?? []).map((a) => ({
        id: `spell:${e.id}:${a.id}`,
        name: a.name,
        source: 'spell' as const,
        costs: [a.cost],
        targeting: a.def?.targeting,
        description: e.name,
        iconKey: e.sourceKey ? `${e.sourceKey}:${a.id}` : undefined,
      }))
    );
    // Действия зон (перемещение Moonbeam/Flaming Sphere/Faithful Hound) — от кастера-источника.
    const zoneActions: ActionDef[] = [];
    for (const zone of map.zones ?? []) {
      if (!zone.actions?.length || !zone.sourceId) continue;
      const source = tokenById(map, zone.sourceId);
      if (!source) continue;
      if (!isDm && !canControlTokenWith(control, source, charName)) continue;
      for (const action of zone.actions) {
        zoneActions.push({
          id: `zone:${zone.id}:${action.id}`,
          name: action.name,
          source: 'spell' as const,
          costs: [action.cost],
          targeting: action.def?.targeting,
          zoneId: zone.id,
          description: zone.name,
          iconKey: `${zone.sourceKey}:${action.id}`,
        });
      }
    }
    const features = [
      ...(isCharacter && sheet ? classFeatures(sheet.classes) : []),
      ...escapeActions,
      ...grantedActions,
      ...zoneActions,
    ];
    const attacksPer = isCharacter && !inShape
      ? attacksPerAction(sheet?.classes ?? [])
      : Math.max(1, token.statblock?.multiattack ?? 1);

    const byKey = new Map((spells ?? []).map((s) => [s.key, s]));
    let panelSpells: Spell[] = [];
    // Beast Spells (друид 18+): каст в форме разрешён.
    const sheetSpells = isCharacter && (!inShape || druidLevelOf(sheet?.classes) >= 18);
    if (sheetSpells) {
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
      leftHand,
      features,
      // Триггерные способности («при уроне»/«при смерти») — только авто, в панели не показываем.
      abilities: (token.statblock?.actions ?? []).filter((a) => !isTriggeredAbility(a)),
      attacksPer,
      panelSpells,
      legendarySlot,
      legendaryRemaining: turn?.legendaryRemaining ?? 0,
      legendaryMax: turn?.legendaryMax ?? 0,
    };
  }, [map, selectedTokenId, currentCharacterId, selfId, role, testMode, charName, isDm, sheet, spells]);

  return info;
}
