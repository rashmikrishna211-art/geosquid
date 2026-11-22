import HostDashboard from './pages/HostDashboard';
import PlayerClient from './pages/PlayerClient';

export default function App() {
  const path = window.location.pathname.toLowerCase();
  if (path.startsWith('/host')) {
    return <HostDashboard />;
  }
  return <PlayerClient />;
}