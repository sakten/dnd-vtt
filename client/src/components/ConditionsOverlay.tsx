import { useMemo } from 'react';
import { canSee, sightContextOf, type Token } from 'shared';
import { useGameStore } from '../store/useGameStore';
import { useActiveGrid, useActiveMap } from '../store/hooks';
import { useIsDm } from '../lib/control';
import { isCellHidden } from '../lib/fog';
import { useMapLight } from '../lib/light';
import { useSpellByKey } from '../lib/useSpells';
import { useVisionViewers } from '../lib/useVision';
import { useInvisibilityView } from '../lib/visibility';
import ConditionChips from './ConditionChips';
import EffectChips from './EffectChips';

/** Чипы состояний и эффектов над токенами (DOM-оверлей поверх Konva-сцены). */
export default function ConditionsOverlay() {
  const view = useGameStore((s) => s.view);
  const isDm = useIsDm();
  const spellByKey = useSpellByKey();
  const map = useActiveMap();
  const grid = useActiveGrid();
  const hidden = useMemo(() => new Set(map?.fog.hidden ?? []), [map?.fog.hidden]);
  const invisibility = useInvisibilityView();
  const viewers = useVisionViewers();
  // Свет заклинаний (Light, Daylight) — как в вуали TableTop: иначе в «Темноте»
  // игрок видит освещённый токен, а его чипы скрывались бы.
  const lightMap = useMapLight();
  const sight = useMemo(
    () =>
      map
        ? {
            ...sightContextOf(map, { size: grid.size || 50, offsetX: grid.offsetX, offsetY: grid.offsetY }),
            light: lightMap,
          }
        : null,
    [map, grid, lightMap]
  );
  const isTokenVisible = (t: Token) =>
    !viewers || (sight !== null && viewers.some((v) => canSee({ x: v.x, y: v.y }, t, v.senses, sight)));

  const tokens = (map?.tokens ?? []).filter((t) => t.conditions.length > 0 || t.effects.some((e) => !e.hidden));
  if (!tokens.length) return null;

  return (
    <div className="cond-overlay">
      {tokens.map((t) => {
        // Общий visibleCell с TableTop: скрытая туманом клетка центра токена + невидимость.
        if (invisibility.hidden.has(t.id)) return null;
        if (!isDm && (isCellHidden(map?.fog, hidden, t.x, t.y) || !isTokenVisible(t))) return null;
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
