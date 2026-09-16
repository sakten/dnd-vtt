import { useCallback, useMemo } from 'react';
import type { Token } from 'shared';
import { useGameStore } from '../store/useGameStore';
import { useActiveMap } from '../store/hooks';
import { canControlTokenWith, characterNameOf, useIsDm } from '../lib/control';
import { useSpellByKey } from '../lib/useSpells';
import { visibleCells, visionViewers } from '../lib/los';
import ConditionChips from './ConditionChips';
import EffectChips from './EffectChips';

/** Чипы состояний и эффектов над токенами (DOM-оверлей поверх Konva-сцены). */
export default function ConditionsOverlay() {
  const view = useGameStore((s) => s.view);
  const isDm = useIsDm();
  const spellByKey = useSpellByKey();
  const map = useActiveMap();
  const hidden = useMemo(() => new Set(map?.fog.hidden ?? []), [map?.fog.hidden]);
  const currentCharacterId = useGameStore((s) => s.currentCharacterId);
  const selfName = useGameStore((s) => (s.currentCharacterId ? characterNameOf(s, s.currentCharacterId) : ''));
  const selfId = useGameStore((s) => s.selfId);
  const role = useGameStore((s) => s.role);
  const testMode = useGameStore((s) => s.testMode);
  const ownToken = useCallback(
    (t: Token) => canControlTokenWith({ role, testMode, selfId, currentCharacterId }, t, selfName),
    [role, testMode, selfId, currentCharacterId, selfName]
  );
  const veil = useMemo(() => {
    if (!map || isDm) return null;
    return visibleCells({
      width: map.width,
      height: map.height,
      cellSize: map.fog.size,
      offsetX: map.fog.offsetX,
      offsetY: map.fog.offsetY,
      walls: map.walls,
      darkness: map.vision.darkness,
      areas: map.lightAreas,
      viewers: visionViewers(map.tokens, map.vision.los, ownToken),
    });
  }, [map, isDm, ownToken]);

  const tokens = (map?.tokens ?? []).filter((t) => t.conditions.length > 0 || t.effects.some((e) => !e.hidden));
  if (!tokens.length) return null;

  return (
    <div className="cond-overlay">
      {tokens.map((t) => {
        const size = map?.fog.size ?? 50;
        const cx = Math.floor((t.x - (map?.fog.offsetX ?? 0)) / size);
        const cy = Math.floor((t.y - (map?.fog.offsetY ?? 0)) / size);
        if (!isDm && (hidden.has(`${cx},${cy}`) || (veil !== null && !veil.has(`${cx},${cy}`)))) return null;
        const left = view.x + t.x * view.scale;
        const top = view.y + (t.y - t.h / 2) * view.scale - 26;
        return (
          <div key={t.id} className="cond-overlay-row" style={{ left, top }}>
            <ConditionChips conditions={t.conditions} spellByKey={spellByKey} />
            <EffectChips effects={t.effects} spellByKey={spellByKey} tokenId={t.id} />
          </div>
        );
      })}
    </div>
  );
}
