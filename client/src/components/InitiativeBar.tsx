import { useRef, useState } from 'react';
import { emptyCombatState } from 'shared';
import { useGameStore } from '../store/useGameStore';

const EMPTY_COMBAT = emptyCombatState();

export default function InitiativeBar() {
  const combat = useGameStore(
    (s) => s.scene.maps.find((m) => m.id === s.viewMapId)?.combat ?? EMPTY_COMBAT
  );
  const role = useGameStore((s) => s.role);
  const hoverTokenId = useGameStore((s) => s.hoverTokenId);
  const setHoverToken = useGameStore((s) => s.setHoverToken);
  const setSelected = useGameStore((s) => s.setSelected);
  const removeCombatant = useGameStore((s) => s.removeCombatant);
  const moveCombatant = useGameStore((s) => s.moveCombatant);
  const rollInitiative = useGameStore((s) => s.rollInitiative);
  const addMapCombatants = useGameStore((s) => s.addMapCombatants);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragIdRef = useRef<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  if (!combat.active) return null;
  const isDm = role === 'dm';

  const scrollBy = (dir: number) => {
    scrollRef.current?.scrollBy({ left: dir * 240, behavior: 'smooth' });
  };

  const dropOn = (targetId: string) => {
    const dragId = dragIdRef.current;
    dragIdRef.current = null;
    setDragOverId(null);
    if (!dragId || dragId === targetId) return;
    const toIndex = combat.entries.findIndex((e) => e.id === targetId);
    if (toIndex >= 0) moveCombatant(dragId, toIndex);
  };

  return (
    <div className="initiative-bar">
      <button className="initiative-scroll" title="Влево" onClick={() => scrollBy(-1)}>
        ◀
      </button>
      <div className="initiative-track" ref={scrollRef}>
        {combat.entries.length === 0 && <span className="initiative-empty">Бой начат — участников нет</span>}
        {combat.entries.map((entry) => (
          <div
            key={entry.id}
            className={`initiative-chip${hoverTokenId && hoverTokenId === entry.tokenId ? ' hovered' : ''}${
              dragOverId === entry.id ? ' drop' : ''
            }`}
            title={`${entry.name} — инициатива ${entry.initiative}${entry.bonus ? ` (${entry.bonus})` : ''}`}
            draggable={isDm}
            onMouseEnter={() => entry.tokenId && setHoverToken(entry.tokenId)}
            onMouseLeave={() => setHoverToken(null)}
            onClick={() => entry.tokenId && setSelected(entry.tokenId)}
            onDoubleClick={() => {
              if (isDm) rollInitiative(entry.id);
            }}
            onDragStart={() => {
              dragIdRef.current = entry.id;
            }}
            onDragOver={(e) => {
              if (isDm && dragIdRef.current) {
                e.preventDefault();
                setDragOverId(entry.id);
              }
            }}
            onDrop={() => dropOn(entry.id)}
            onDragEnd={() => {
              dragIdRef.current = null;
              setDragOverId(null);
            }}
          >
            <img src={entry.imageUrl} alt={entry.name} draggable={false} />
            <span className="initiative-value">{entry.initiative}</span>
            {isDm && (
              <button
                className="initiative-remove"
                title="Убрать из очереди"
                onClick={(e) => {
                  e.stopPropagation();
                  removeCombatant(entry.id);
                }}
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>
      {isDm && (
        <button className="initiative-action" title="Добавить токены текущей карты" onClick={addMapCombatants}>
          +
        </button>
      )}
      <button className="initiative-scroll" title="Вправо" onClick={() => scrollBy(1)}>
        ▶
      </button>
    </div>
  );
}
