import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import useAppStore from '../store/useAppStore';
import {
  Plus, Map, Compass, Navigation2, TrendingUp,
  Calendar, MapPin, Clock, Star, ChevronRight, Plane
} from 'lucide-react';
import './Dashboard.css';

const quickActions = [
  { icon: Compass, label: 'Discover Places', path: '/discovery', color: 'var(--accent-teal)', bg: 'var(--accent-teal-dim)' },
  { icon: Map, label: 'Plan Itinerary', path: '/planner', color: 'var(--accent-amber)', bg: 'var(--accent-amber-dim)' },
  { icon: Navigation2, label: 'Start Navigation', path: '/navigation', color: '#a78bfa', bg: 'var(--accent-violet-dim)' },
];

export default function Dashboard() {
  const { user, profile, trips, fetchTrips, setActiveTrip, savedPlaces } = useAppStore();
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      await fetchTrips();
      setLoading(false);
    };
    load();
  }, []);

  const activeTrips = trips.filter(t => new Date(t.end_date) >= new Date());
  const pastTrips = trips.filter(t => new Date(t.end_date) < new Date());

  const handleTripClick = (trip) => {
    setActiveTrip(trip);
    navigate('/planner');
  };

  if (loading) return (
    <div className="loading-screen">
      <div className="spinner" />
      <span style={{ color: 'var(--text-secondary)' }}>Loading your dashboard...</span>
    </div>
  );

  return (
    <div className="page-container fade-in">
      {/* Welcome */}
      <div className="dashboard-welcome">
        <div>
          <h1>Welcome back, {profile?.display_name || 'Traveler'} ✈️</h1>
          <p>Ready to plan your next adventure?</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/planner')}>
          <Plus size={16} /> New Trip
        </button>
      </div>

      {/* Stats Row */}
      <div className="stats-row">
        {[
          { label: 'Total Trips', value: trips.length, icon: Plane, color: 'var(--accent-teal)' },
          { label: 'Active Trips', value: activeTrips.length, icon: Map, color: 'var(--accent-amber)' },
          { label: 'Saved Places', value: savedPlaces.length, icon: MapPin, color: '#a78bfa' },
          { label: 'Places Explored', value: trips.reduce((acc, t) => acc + (t.waypoints?.length || 0), 0), icon: Compass, color: 'var(--accent-green)' },
        ].map(({ label, value, icon: Icon, color }, i) => (
          <motion.div
            key={label}
            className="stat-card glass-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
          >
            <div className="stat-icon" style={{ color, background: `${color}18` }}>
              <Icon size={20} />
            </div>
            <div className="stat-value">{value}</div>
            <div className="stat-label">{label}</div>
          </motion.div>
        ))}
      </div>

      {/* Quick Actions */}
      <section className="dashboard-section">
        <h2 className="section-title">Quick Actions</h2>
        <div className="quick-actions">
          {quickActions.map(({ icon: Icon, label, path, color, bg }, i) => (
            <motion.button
              key={label}
              className="quick-action-card glass-card"
              onClick={() => navigate(path)}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.1 }}
              whileHover={{ y: -4, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="qa-icon" style={{ color, background: bg }}>
                <Icon size={24} />
              </div>
              <span className="qa-label">{label}</span>
              <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
            </motion.button>
          ))}
        </div>
      </section>

      {/* Active Trips */}
      <section className="dashboard-section">
        <div className="section-header-row">
          <h2 className="section-title">Active Trips</h2>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/planner')}>
            View all <ChevronRight size={14} />
          </button>
        </div>

        {activeTrips.length === 0 ? (
          <div className="empty-state glass-card">
            <Map size={40} style={{ opacity: 0.3 }} />
            <h3>No active trips</h3>
            <p>Create your first trip to get started!</p>
            <button className="btn btn-primary" onClick={() => navigate('/planner')}>
              <Plus size={16} /> Plan a Trip
            </button>
          </div>
        ) : (
          <div className="trips-grid">
            {activeTrips.slice(0, 3).map((trip, i) => (
              <motion.div
                key={trip.id}
                className="trip-card glass-card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.1 }}
                onClick={() => handleTripClick(trip)}
              >
                <div className="trip-card-header">
                  <div className="trip-destination">
                    <MapPin size={14} style={{ color: 'var(--accent-teal)' }} />
                    <span>{trip.destination}</span>
                  </div>
                  <span className="badge badge-teal">Active</span>
                </div>
                <h3 className="trip-title">{trip.title}</h3>
                <div className="trip-meta">
                  <span><Calendar size={12} /> {new Date(trip.start_date).toLocaleDateString()}</span>
                  <span><Clock size={12} /> {trip.waypoints?.length || 0} stops</span>
                </div>
                <div className="trip-progress">
                  <div className="rating-bar">
                    <div className="rating-fill" style={{ width: `${Math.min(100, (trip.waypoints?.filter(w => w.status === 'visited').length / Math.max(trip.waypoints?.length, 1)) * 100)}%` }} />
                  </div>
                  <span className="progress-label">
                    {trip.waypoints?.filter(w => w.status === 'visited').length || 0}/{trip.waypoints?.length || 0} visited
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      {/* Saved Places */}
      {savedPlaces.length > 0 && (
        <section className="dashboard-section">
          <div className="section-header-row">
            <h2 className="section-title">Saved Places</h2>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/discovery')}>
              Discover more <ChevronRight size={14} />
            </button>
          </div>
          <div className="saved-places-row">
            {savedPlaces.slice(0, 5).map((place, i) => (
              <motion.div
                key={place.fsq_id}
                className="saved-place-chip glass-card"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
              >
                <MapPin size={12} style={{ color: 'var(--accent-teal)' }} />
                <span>{place.name}</span>
                {place.rating && (
                  <span className="chip-rating">
                    <Star size={10} fill="var(--accent-amber)" stroke="none" />
                    {(place.rating / 2).toFixed(1)}
                  </span>
                )}
              </motion.div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
