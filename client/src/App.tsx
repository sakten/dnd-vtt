import { useEffect } from 'react';
import { useGameStore } from './store/useGameStore';
import JoinScreen from './screens/JoinScreen';
import AdminScreen from './screens/AdminScreen';
import TableScreen from './screens/TableScreen';

export default function App() {
  const socket = useGameStore((s) => s.socket);
  const connected = useGameStore((s) => s.connected);
  const roomCode = useGameStore((s) => s.roomCode);
  const init = useGameStore((s) => s.init);

  useEffect(() => {
    init();
  }, [init]);

  if (!socket) return null;
  if (roomCode) return <TableScreen />;
  const isAdmin = new URLSearchParams(window.location.search).has('admin');
  if (isAdmin) return <AdminScreen />;
  return <JoinScreen connected={connected} />;
}
