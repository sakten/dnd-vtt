import { useEffect, useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { useActiveMap } from '../store/hooks';
import { useIsDm } from '../lib/control';
import ObjectMenu from './ObjectMenu';

/** Мини-UI двери: открыть/закрыть; DM — «только для ведущего», Сл взлома и удаление. */
export default function DoorMenu() {
  const menuId = useGameStore((s) => s.doorMenuId);
  const mapId = useGameStore((s) => s.viewMapId);
  const wallsActive = useGameStore((s) => s.wallsMode.active);
  const setDoorMenu = useGameStore((s) => s.setDoorMenu);
  const toggleDoor = useGameStore((s) => s.toggleDoor);
  const updateDoor = useGameStore((s) => s.updateDoor);
  const updateWalls = useGameStore((s) => s.updateWalls);
  const isDm = useIsDm();
  const map = useActiveMap();
  const [dcDraft, setDcDraft] = useState('');

  const door = map?.walls.find((w) => w.id === menuId && w.kind === 'door') ?? null;

  useEffect(() => {
    setDcDraft(door?.pickDc ? String(door.pickDc) : '');
  }, [menuId, door?.pickDc]);

  if (!door || !map || !mapId || wallsActive) return null;
  if (!isDm && door.dmOnly) return null;

  const dc = door.pickDc ?? 0;
  const applyDc = () => {
    const value = Number(dcDraft);
    updateDoor(mapId, door.id, { pickDc: Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0 });
  };

  return (
    <ObjectMenu
      title={door.open ? 'Дверь: открыта' : 'Дверь: закрыта'}
      world={{ x: (door.x1 + door.x2) / 2, y: (door.y1 + door.y2) / 2 }}
      onClose={() => setDoorMenu(null)}
    >
      <button className="primary" onClick={() => toggleDoor(door.id)}>
        {door.open ? 'Закрыть' : 'Открыть'}
      </button>
      {isDm ? (
        <>
          <label className="fog-label">
            <input
              type="checkbox"
              checked={door.dmOnly === true}
              onChange={(e) => updateDoor(mapId, door.id, { dmOnly: e.target.checked })}
            />
            Только для ведущего
          </label>
          <label className="fog-label">
            Сл взлома:
            <input
              type="number"
              min={0}
              max={40}
              aria-label="Сл взлома"
              value={dcDraft}
              onChange={(e) => setDcDraft(e.target.value)}
              onBlur={applyDc}
              onKeyDown={(e) => {
                if (e.key === 'Enter') applyDc();
              }}
            />
          </label>
          <button
            className="danger"
            onClick={() => {
              updateWalls(map.id, map.walls.filter((w) => w.id !== door.id));
              setDoorMenu(null);
            }}
          >
            Удалить дверь
          </button>
        </>
      ) : (
        dc > 0 && <span className="fog-label">Взлом: Сл {dc}</span>
      )}
    </ObjectMenu>
  );
}
