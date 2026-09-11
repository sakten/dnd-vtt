import { useEffect } from 'react';
import { useGameStore } from '../store/useGameStore';
import { canControlWith } from '../lib/control';
import TableTop from '../components/TableTop';
import Toolbar from '../components/Toolbar';
import MapsPanel from '../components/MapsPanel';
import TokenPanel from '../components/TokenPanel';
import ChatPanel from '../components/ChatPanel';
import GridSettingsModal from '../components/GridSettingsModal';
import TokenMenu from '../components/TokenMenu';
import FogPanel from '../components/FogPanel';
import InitiativeBar from '../components/InitiativeBar';
import ResourcesPanel from '../components/ResourcesPanel';
import CritOverlay from '../components/CritOverlay';

export default function TableScreen() {
  const selected = useGameStore((s) => s.selectedTokenId);
  const setSelected = useGameStore((s) => s.setSelected);
  const removeToken = useGameStore((s) => s.removeToken);
  const gridModalOpen = useGameStore((s) => s.gridModalOpen);
  const roomCode = useGameStore((s) => s.roomCode);
  const roomName = useGameStore((s) => s.roomName);
  const targetTokenId = useGameStore((s) => s.targetTokenId);
  const setTargetToken = useGameStore((s) => s.setTargetToken);
  const targetName = useGameStore(
    (s) => s.scene.maps.find((m) => m.id === s.viewMapId)?.tokens.find((t) => t.id === s.targetTokenId)?.name ?? ''
  );
  const fogActive = useGameStore((s) => s.fogMode.active);
  const setFogMode = useGameStore((s) => s.setFogMode);
  const shortCode = roomCode && roomCode.length > 8 ? `${roomCode.slice(0, 6)}…` : roomCode;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'Delete' && selected) {
        const st = useGameStore.getState();
        const map = st.scene.maps.find((m) => m.id === st.viewMapId);
        const token = map?.tokens.find((t) => t.id === selected);
        if (token && canControlWith(st, token)) removeToken(selected);
      }
      if (e.key === 'Escape') {
        setSelected(null);
        setTargetToken(null);
        if (useGameStore.getState().fogMode.active) setFogMode({ active: false });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, removeToken, setSelected, setFogMode, setTargetToken]);

  return (
    <div className="table-screen">
      <TableTop />
      <Toolbar />
      {fogActive && <FogPanel />}
      <MapsPanel />
      <TokenPanel />
      <ChatPanel />
      <InitiativeBar />
      <ResourcesPanel />
      <div
        className="room-badge"
        title={`${roomCode} — нажмите, чтобы скопировать ссылку для игроков`}
        onClick={() => {
          const url = `${window.location.origin}${window.location.pathname}?room=${roomCode}`;
          navigator.clipboard?.writeText(url).catch(() => void 0);
        }}
      >
        Комната: <strong>{roomName || shortCode}</strong>{' '}
        {roomName && <span className="room-badge-code">{shortCode}</span>}{' '}
        <span className="room-badge-hint">— скопировать ссылку</span>
      </div>
      {targetTokenId && (
        <div className="target-badge" title="Выбранная цель для атак">
          Цель: <strong>{targetName || '…'}</strong>
          <button title="Сбросить цель" onClick={() => setTargetToken(null)}>
            ✕
          </button>
        </div>
      )}
      {gridModalOpen && <GridSettingsModal />}
      <TokenMenu />
      <CritOverlay />
    </div>
  );
}
