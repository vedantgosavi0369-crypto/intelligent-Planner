import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import LocationGate from './LocationGate';
import useAppStore from '../store/useAppStore';

export default function AppLayout() {
  const collapsed = useAppStore((s) => s.sidebarCollapsed);
  return (
    <LocationGate>
      <div className="app-layout">
        <Sidebar />
        <main className={`main-content${collapsed ? ' collapsed' : ''}`}>
          <Outlet />
        </main>
      </div>
    </LocationGate>
  );
}
