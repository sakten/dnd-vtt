import { useEffect } from 'react';
import { useGameStore } from '../store/useGameStore';
import TableTop from '../components/TableTop';
import Toolbar from '../components/Toolbar';
import MapsPanel from '../components/MapsPanel';
import TokenPanel from '../components/TokenPanel';
import ChatPanel from '../components/ChatPanel';
import GridSettingsModal from '../components/GridSettingsModal';
import TokenMenu from '../components/TokenMenu';
import FogPanel from '../components/FogPanel';

export default function TableScreen() {
  const selected = useGameStore((s) => s.selectedTokenId);
  const setSelected = useGameStore((s) => s.setSelected);
  const removeToken = useGameStore((s) => s.removeToken);
  const gridModalOpen = useGameStore((s) => s.gridModalOpen);
  const roomCode = useGameStore((s) => s.roomCode);
  const fogActive = useGameStore((s) => s.fogMode.active);
  const setFogMode = useGameStore((s) => s.setFogMode);
  const shortCode = roomCode && roomCode.length > 8 ? `${roomCode.slice(0, 6)}…` : roomCode;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'Delete' && selected) removeToken(selected);
      if (e.key === 'Escape') {
        setSelected(null);
        if (useGameStore.getState().fogMode.active) setFogMode({ active: false });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, removeToken, setSelected, setFogMode]);

  return (
    <div className="table-screen">
      <TableTop />
      <Toolbar />
      {fogActive && <FogPanel />}
      <MapsPanel />
      <TokenPanel />
      <ChatPanel />
      <div
        className="room-badge"
        title={`${roomCode} — нажмите, чтобы скопировать ссылку для игроков`}
        onClick={() => {
          const url = `${window.location.origin}${window.location.pathname}?room=${roomCode}`;
          navigator.clipboard?.writeText(url).catch(() => void 0);
        }}
      >
        Комната: <strong title={roomCode ?? ''}>{shortCode}</strong>{' '}
        <span className="room-badge-hint">— скопировать ссылку</span>
      </div>
      {gridModalOpen && <GridSettingsModal />}
      <TokenMenu />
    </div>
  );
}
