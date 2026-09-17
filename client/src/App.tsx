import { useEffect } from 'react';
import { t } from './i18n';
import { useGameStore } from './store/useGameStore';
import JoinScreen from './screens/JoinScreen';
import AdminScreen from './screens/AdminScreen';
import TableScreen from './screens/TableScreen';

export default function App() {
  const socket = useGameStore((s) => s.socket);
  const connected = useGameStore((s) => s.connected);
  const roomCode = useGameStore((s) => s.roomCode);
  const init = useGameStore((s) => s.init);
  // Подписка на язык: перерисовывает дерево при переключении RU/EN (компоненты не memo).
  useGameStore((s) => s.lang);

  useEffect(() => {
    init();
  }, [init]);

  if (!socket) return null;
  if (roomCode) {
    return (
      <>
        <TableScreen />
        {!connected && <div className="conn-banner">{t('ui.app.reconnect')}</div>}
      </>
    );
  }
  const isAdmin = new URLSearchParams(window.location.search).has('admin');
  if (isAdmin) return <AdminScreen />;
  return <JoinScreen connected={connected} />;
}
