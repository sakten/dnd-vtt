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
import DoorMenu from '../components/DoorMenu';
import FogPanel from '../components/FogPanel';
import WallsPanel from '../components/WallsPanel';
import LightPanel from '../components/LightPanel';
import InitiativeBar from '../components/InitiativeBar';
import ResourcesPanel from '../components/ResourcesPanel';
import ActionPanel from '../components/ActionPanel';
import AimPanel from '../components/AimPanel';
import ReactionPrompt from '../components/ReactionPrompt';
import RollOverlay from '../components/RollOverlay';
import CritOverlay from '../components/CritOverlay';
import { wallsEscapeStep } from '../lib/wallDraw';

export default function TableScreen() {
  const selected = useGameStore((s) => s.selectedTokenId);
  const setSelected = useGameStore((s) => s.setSelected);
  const removeToken = useGameStore((s) => s.removeToken);
  const gridModalOpen = useGameStore((s) => s.gridModalOpen);
  const visionModalOpen = useGameStore((s) => s.visionModalOpen);
  const roomSettingsOpen = useGameStore((s) => s.roomSettingsOpen);
  const fogActive = useGameStore((s) => s.fogMode.active);
  const setFogMode = useGameStore((s) => s.setFogMode);
  const wallsActive = useGameStore((s) => s.wallsMode.active);
  const setWallsMode = useGameStore((s) => s.setWallsMode);
  const lightActive = useGameStore((s) => s.lightMode.active);
  const setLightMode = useGameStore((s) => s.setLightMode);

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
      {gridModalOpen && <GridSettingsModal />}
      {visionModalOpen && <VisionSettingsModal />}
      {roomSettingsOpen && <RoomSettingsModal />}
      <TokenMenu />
      <DoorMenu />
      <RollOverlay />
      <CritOverlay />
    </div>
  );
}
