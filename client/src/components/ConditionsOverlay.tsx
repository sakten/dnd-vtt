import { useMemo } from 'react';
import type { Spell } from 'shared';
import { useGameStore } from '../store/useGameStore';
import { useSpells } from '../lib/useSpells';
import ConditionChips from './ConditionChips';

/** Чипы состояний над токенами (DOM-оверлей поверх Konva-сцены). */
export default function ConditionsOverlay() {
  const maps = useGameStore((s) => s.scene.maps);
  const viewMapId = useGameStore((s) => s.viewMapId);
  const view = useGameStore((s) => s.view);
  const role = useGameStore((s) => s.role);
  const spells = useSpells();

  const spellByKey = useMemo(() => new Map<string, Spell>(spells.map((s) => [s.key, s])), [spells]);
  const map = maps.find((m) => m.id === viewMapId);
  const hidden = useMemo(() => new Set(map?.fog.hidden ?? []), [map?.fog.hidden]);

  const tokens = (map?.tokens ?? []).filter((t) => t.conditions.length > 0);
  if (!tokens.length) return null;

  return (
    <div className="cond-overlay">
      {tokens.map((t) => {
        const size = map?.fog.size ?? 50;
        const cx = Math.floor((t.x - (map?.fog.offsetX ?? 0)) / size);
        const cy = Math.floor((t.y - (map?.fog.offsetY ?? 0)) / size);
        if (role === 'player' && hidden.has(`${cx},${cy}`)) return null;
        const left = view.x + t.x * view.scale;
        const top = view.y + (t.y - t.h / 2) * view.scale - 26;
        return (
          <div key={t.id} className="cond-overlay-row" style={{ left, top }}>
            <ConditionChips conditions={t.conditions} spellByKey={spellByKey} />
          </div>
        );
      })}
    </div>
  );
}
