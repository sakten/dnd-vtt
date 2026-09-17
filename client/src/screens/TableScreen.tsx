import { useEffect } from 'react';
import { useGameStore } from '../store/useGameStore';
import { activeMapOf, tokenById } from '../store/selectors';
import { canControlWith } from '../lib/control';
import TableTop from '../components/TableTop';
import Toolbar from '../components/Toolbar';
import MapsPanel from '../components/MapsPanel';
import TokenPanel from '../components/TokenPanel';
import ChatPanel from '../components/ChatPanel';
import GridSettingsModal from '../components/GridSettingsModal';
import VisionSettingsModal from '../components/VisionSettingsModal';
import RoomSettingsModal from '../components/RoomSettingsModal';
import TokenMenu from '../components/TokenMenu';
import FogPanel from '../components/FogPanel';
import WallsPanel from '../components/WallsPanel';
import LightPanel from '../components/LightPanel';
import InitiativeBar from '../components/InitiativeBar';
import ResourcesPanel from '../components/ResourcesPanel';
import ActionPanel from '../components/ActionPanel';
import AimPanel from '../components/AimPanel';
import ReactionPrompt from '../components/ReactionPrompt';
import CritOverlay from '../components/CritOverlay';
import { wallsEscapeStep } from '../lib/wallDraw';

export default function TableScreen() {
  const selected = useGameStore((s) => s.selectedTokenId);
  const setSelected = useGameStore((s) => s.setSelected);
  const removeToken = useGameStore((s) => s.removeToken);
  const gridModalOpen = useGameStore((s) => s.gridModalOpen);
  const visionModalOpen = useGameStore((s) => s.visionModalOpen);
  const roomSettingsOpen = useGameStore((s) => s.roomSettingsOpen);
  const roomCode = useGameStore((s) => s.roomCode);
  const roomName = useGameStore((s) => s.roomName);
  const fogActive = useGameStore((s) => s.fogMode.active);
  const setFogMode = useGameStore((s) => s.setFogMode);
  const wallsActive = useGameStore((s) => s.wallsMode.active);
  const setWallsMode = useGameStore((s) => s.setWallsMode);
  const lightActive = useGameStore((s) => s.lightMode.active);
  const setLightMode = useGameStore((s) => s.setLightMode);
  const shortCode = roomCode && roomCode.length > 8 ? `${roomCode.slice(0, 6)}…` : roomCode;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'Delete' && selected) {
        const st = useGameStore.getState();
        const token = tokenById(activeMapOf(st), selected);
        if (token && canControlWith(st, token)) removeToken(selected);
      }
      if (e.key === 'Escape') {
        const st = useGameStore.getState();
        if (st.interaction) {
          st.cancelInteraction();
          return;
        }
        if (wallsEscapeStep(st.wallsMode) === 'finish-chain') {
          st.setWallsMode({ start: null });
          return;
        }
        setSelected(null);
        if (st.fogMode.active) setFogMode({ active: false });
        if (st.wallsMode.active) setWallsMode({ active: false });
        if (st.lightMode.active) setLightMode({ active: false });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, removeToken, setSelected, setFogMode, setWallsMode, setLightMode]);

  return (
    <div className="table-screen" data-testid="table-screen">
      <TableTop />
      <Toolbar />
      {fogActive && <FogPanel />}
      {wallsActive && <WallsPanel />}
      {lightActive && <LightPanel />}
      <MapsPanel />
      <TokenPanel />
      <ChatPanel />
      <InitiativeBar />
      <ActionPanel />
      <AimPanel />
      <ResourcesPanel />
      <ReactionPrompt />
      <div
        className="room-badge"
        data-testid="room-badge"
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
      {gridModalOpen && <GridSettingsModal />}
      {visionModalOpen && <VisionSettingsModal />}
      {roomSettingsOpen && <RoomSettingsModal />}
      <TokenMenu />
      <CritOverlay />
    </div>
  );
}
