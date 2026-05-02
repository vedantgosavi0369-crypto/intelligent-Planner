import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Compass, Map, Navigation2, User,
  ChevronLeft, ChevronRight, LogOut, Plane
} from 'lucide-react';
import useAppStore from '../store/useAppStore';
import './Sidebar.css';

const navItems = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/discovery', icon: Compass, label: 'Discovery' },
  { path: '/planner', icon: Map, label: 'Planner' },
  { path: '/navigation', icon: Navigation2, label: 'Navigate' },
  { path: '/profile', icon: User, label: 'Profile' },
];

export default function Sidebar() {
  const { sidebarCollapsed, setSidebarCollapsed, signOut, profile, user } = useAppStore();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <motion.aside
      className="sidebar glass"
      animate={{ width: sidebarCollapsed ? 72 : 260 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
    >
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="logo-icon">
          <img src="/logo.svg" alt="TravelBuddy Logo" style={{ width: '32px', height: '32px', borderRadius: '4px' }} />
        </div>
        <AnimatePresence>
          {!sidebarCollapsed && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="logo-text"
            >
              <span className="logo-title">TravelBuddy</span>
              <span className="logo-sub">AI Travel Planner</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {navItems.map(({ path, icon: Icon, label }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) =>
              `sidebar-item tooltip ${isActive ? 'active' : ''}`
            }
            data-tip={sidebarCollapsed ? label : ''}
          >
            <div className="sidebar-icon">
              <Icon size={20} />
            </div>
            <AnimatePresence>
              {!sidebarCollapsed && (
                <motion.span
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.2 }}
                  className="sidebar-label"
                >
                  {label}
                </motion.span>
              )}
            </AnimatePresence>
          </NavLink>
        ))}
      </nav>

      {/* Bottom: user + collapse */}
      <div className="sidebar-bottom">
        <div className="sidebar-user">
          <div className="avatar">
            {(profile?.display_name || user?.email)?.[0]?.toUpperCase() || 'U'}
          </div>
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                className="user-info"
              >
                <span className="user-name">{profile?.display_name || 'Traveler'}</span>
                <span className="user-email">{user?.email}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <button
          className="sidebar-item logout-btn tooltip"
          data-tip={sidebarCollapsed ? 'Sign out' : ''}
          onClick={handleSignOut}
        >
          <div className="sidebar-icon"><LogOut size={18} /></div>
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.span
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="sidebar-label"
              >Sign out</motion.span>
            )}
          </AnimatePresence>
        </button>

        <button
          className="collapse-btn"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        >
          {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
    </motion.aside>
  );
}
