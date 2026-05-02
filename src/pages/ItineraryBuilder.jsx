import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { supabase } from '../lib/supabase';
import useAppStore from '../store/useAppStore';
import { optimizeWaypointOrder } from '../lib/routing';
import {
  Plus, GripVertical, Trash2, MapPin, Clock, Zap,
  Calendar, Save, Navigation2, Car, PersonStanding, Bus,
  CheckCircle, Circle, Loader2, X, Heart
} from 'lucide-react';
import './ItineraryBuilder.css';

const TRANSPORT_MODES = [
  { key: 'driving', icon: Car, label: 'Drive' },
  { key: 'walking', icon: PersonStanding, label: 'Walk' },
  { key: 'transit', icon: Bus, label: 'Transit' },
];

function TripModal({ onClose, onCreated }) {
  const [title, setTitle] = useState('');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, fetchTrips } = useAppStore();

  const handleCreate = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.from('trips').insert({
      user_id: user.id,
      title,
      destination,
      start_date: startDate,
      end_date: endDate,
      is_public: false,
    }).select().single();

    if (!error && data) {
      await fetchTrips();
      onCreated(data);
    }
    setLoading(false);
    onClose();
  };

  return (
    <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div
        className="trip-modal glass"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header" style={{ marginBottom: 24 }}>
          <h2>Create New Trip</h2>
          <button className="btn btn-ghost" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="input-group">
            <label>Trip Title</label>
            <input className="input" placeholder="e.g., Golden Triangle India" value={title} onChange={e => setTitle(e.target.value)} required />
          </div>
          <div className="input-group">
            <label>Destination</label>
            <input className="input" placeholder="e.g., Rajasthan, India" value={destination} onChange={e => setDestination(e.target.value)} required />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="input-group">
              <label>Start Date</label>
              <input className="input" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required />
            </div>
            <div className="input-group">
              <label>End Date</label>
              <input className="input" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} required />
            </div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: 8 }}>
            {loading ? <Loader2 size={16} className="spin-anim" /> : <Plus size={16} />}
            Create Trip
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
}

// Geocode via Nominatim
async function geocodeName(query) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5`;
  const r = await fetch(url, { headers: { 'Accept-Language': 'en' } });
  return r.json();
}

function AddWaypointModal({ tripId, onClose, onAdded }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [selected, setSelected] = useState(null); // { name, lat, lon }
  const [loadingSug, setLoadingSug] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const sugRef = useRef(null);

  // Debounced autocomplete
  useEffect(() => {
    if (query.length < 3) { setSuggestions([]); return; }
    const timer = setTimeout(async () => {
      setLoadingSug(true);
      try {
        const res = await geocodeName(query);
        setSuggestions(res.slice(0, 5));
      } catch { setSuggestions([]); }
      finally { setLoadingSug(false); }
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  const pickSuggestion = (s) => {
    setSelected({ name: s.display_name.split(',').slice(0, 2).join(', '), lat: parseFloat(s.lat), lon: parseFloat(s.lon) });
    setQuery(s.display_name.split(',').slice(0, 2).join(', '));
    setSuggestions([]);
    setError('');
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!query.trim()) { setError('Please enter a place name.'); return; }
    setLoading(true);
    setError('');

    // If user typed but didn't pick from dropdown, try to geocode first
    let lat = selected?.lat ?? null;
    let lon = selected?.lon ?? null;
    let name = selected?.name ?? query.trim();

    if (!lat || !lon) {
      try {
        const res = await geocodeName(query);
        if (res.length > 0) {
          lat = parseFloat(res[0].lat);
          lon = parseFloat(res[0].lon);
          name = res[0].display_name.split(',').slice(0, 2).join(', ');
        }
      } catch { /* use name without coords */ }
    }

    const { data, error: dbErr } = await supabase.from('waypoints').insert({
      trip_id: tripId,
      place_name: name,
      estimated_duration: null,
      status: 'planned',
      visit_order: Math.floor(Date.now() / 1000),
      lat: lat || null,
      lon: lon || null,
    }).select().single();

    if (dbErr) {
      setError('Failed to add stop: ' + dbErr.message);
      setLoading(false);
      return;
    }

    onAdded(data);
    setLoading(false);
    onClose();
  };

  return (
    <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div
        className="trip-modal glass"
        style={{ maxWidth: 460 }}
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header" style={{ marginBottom: 20 }}>
          <h2>Add Stop</h2>
          <button className="btn btn-ghost" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 14 }} ref={sugRef}>
          <div className="input-group" style={{ position: 'relative' }}>
            <label>Place Name</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <MapPin size={15} style={{ position: 'absolute', left: 12, color: 'var(--accent-teal)', pointerEvents: 'none' }} />
              <input
                className="input"
                style={{ paddingLeft: 34 }}
                placeholder="Search any place — e.g., Shaniwar Wada"
                value={query}
                autoFocus
                onChange={e => { setQuery(e.target.value); setSelected(null); }}
                required
              />
              {loadingSug && <Loader2 size={14} className="spin-anim" style={{ position: 'absolute', right: 12, color: 'var(--text-muted)' }} />}
              {query && !loadingSug && (
                <button type="button" style={{ position: 'absolute', right: 10, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}
                  onClick={() => { setQuery(''); setSelected(null); setSuggestions([]); }}>
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Autocomplete dropdown */}
            <AnimatePresence>
              {suggestions.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    borderRadius: 8, marginTop: 4, overflow: 'hidden',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                  }}
                >
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => pickSuggestion(s)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'flex-start', gap: 8,
                        padding: '10px 14px', background: 'none', border: 'none',
                        borderBottom: i < suggestions.length - 1 ? '1px solid var(--border)' : 'none',
                        color: 'var(--text-secondary)', fontSize: 12, textAlign: 'left',
                        cursor: 'pointer', transition: 'background 0.15s',
                        lineHeight: 1.4,
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,212,255,0.08)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    >
                      <MapPin size={12} style={{ color: 'var(--accent-teal)', flexShrink: 0, marginTop: 2 }} />
                      <span>{s.display_name.split(',').slice(0, 3).join(', ')}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Selected badge */}
          {selected && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
              background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.25)',
              borderRadius: 8, fontSize: 12, color: 'var(--accent-teal)',
            }}>
              <Zap size={13} />
              Geocoded: {selected.lat.toFixed(4)}, {selected.lon.toFixed(4)}
            </div>
          )}

          {error && (
            <div style={{ fontSize: 12, color: '#ef4444', padding: '8px 12px', background: 'rgba(239,68,68,0.1)', borderRadius: 8 }}>{error}</div>
          )}

          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
            background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)',
            borderRadius: 8, fontSize: 12, color: '#22c55e',
          }}>
            <Zap size={13} /> Auto-optimize will run after adding
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: 4 }}>
            {loading ? <Loader2 size={16} className="spin-anim" /> : <Plus size={16} />}
            Add Stop
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
}

export default function ItineraryBuilder() {
  const { user, trips, activeTrip, setActiveTrip, fetchTrips, waypoints, setWaypoints, savedPlaces } = useAppStore();
  const [showTripModal, setShowTripModal] = useState(false);
  const [showWpModal, setShowWpModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [transport, setTransport] = useState('driving');
  const [optimizing, setOptimizing] = useState(false);
  const [optimizeStatus, setOptimizeStatus] = useState('');

  useEffect(() => {
    fetchTrips();
  }, []);

  useEffect(() => {
    if (activeTrip) loadWaypoints(activeTrip.id);
  }, [activeTrip]);

  const loadWaypoints = async (tripId) => {
    setLoading(true);
    const { data } = await supabase
      .from('waypoints')
      .select('*')
      .eq('trip_id', tripId)
      .order('visit_order', { ascending: true });
    setWaypoints(data || []);
    setLoading(false);
  };

  const handleDragEnd = async (result) => {
    if (!result.destination) return;
    const items = Array.from(waypoints);
    const [reordered] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reordered);
    const updated = items.map((wp, i) => ({ ...wp, visit_order: i + 1 }));
    setWaypoints(updated);

    await Promise.all(
      updated.map(wp =>
        supabase.from('waypoints').update({ visit_order: wp.visit_order }).eq('id', wp.id)
      )
    );
  };

  const handleDeleteWp = async (id) => {
    await supabase.from('waypoints').delete().eq('id', id);
    setWaypoints(waypoints.filter(w => w.id !== id));
  };

  const handleToggleVisited = async (wp) => {
    const newStatus = wp.status === 'visited' ? 'planned' : 'visited';
    await supabase.from('waypoints').update({ status: newStatus }).eq('id', wp.id);
    setWaypoints(waypoints.map(w => w.id === wp.id ? { ...w, status: newStatus } : w));
  };

  const handleOptimize = async () => {
    if (waypoints.length < 2) return;
    setOptimizing(true);

    // Helper: delay to respect Nominatim's 1-req/sec rate limit
    const delay = (ms) => new Promise(res => setTimeout(res, ms));

    // Geocode SEQUENTIALLY — parallel requests get rate-limited by Nominatim
    const enriched = [];
    for (const w of waypoints) {
      if (w.lat && w.lon && !isNaN(parseFloat(w.lat)) && !isNaN(parseFloat(w.lon))) {
        enriched.push({ ...w, lat: parseFloat(w.lat), lon: parseFloat(w.lon) });
      } else {
        // Geocode this stop and wait before the next request
        try {
          const res = await geocodeName(w.place_name);
          if (res && res.length > 0) {
            const lat = parseFloat(res[0].lat);
            const lon = parseFloat(res[0].lon);
            // Save coords to DB so next optimize is instant
            await supabase.from('waypoints').update({ lat, lon }).eq('id', w.id);
            enriched.push({ ...w, lat, lon });
          } else {
            enriched.push({ ...w, lat: null, lon: null });
          }
        } catch {
          enriched.push({ ...w, lat: null, lon: null });
        }
        await delay(400); // Respect Nominatim rate-limit
      }
    }

    const wpsWithCoords = enriched.filter(w => w.lat !== null && w.lon !== null && !isNaN(w.lat) && !isNaN(w.lon));
    const noCoords = enriched.filter(w => w.lat === null || w.lon === null || isNaN(w.lat) || isNaN(w.lon));

    if (wpsWithCoords.length < 2) {
      setOptimizing(false);
      setOptimizeStatus('⚠️ Could not resolve enough locations. Try searching by city name.');
      setTimeout(() => setOptimizeStatus(''), 4000);
      return;
    }

    const optimized = optimizeWaypointOrder(wpsWithCoords);
    const updatedFull = [
      ...optimized.map((wp, i) => ({ ...wp, visit_order: i + 1 })),
      ...noCoords.map((wp, i) => ({ ...wp, visit_order: optimized.length + i + 1 })),
    ];
    setWaypoints(updatedFull);
    await Promise.all(
      updatedFull.map(wp =>
        supabase.from('waypoints').update({ visit_order: wp.visit_order }).eq('id', wp.id)
      )
    );
    setOptimizing(false);
    setOptimizeStatus('✅ Route optimized for shortest distance!');
    setTimeout(() => setOptimizeStatus(''), 3000);
  };

  const handleWaypointAdded = async (wp) => {
    const newList = [...waypoints, wp];
    setWaypoints(newList);
    // Auto-optimize whenever there are 2+ stops with coords
    const wpsWithCoords = newList
      .map(w => ({ ...w, lat: parseFloat(w.lat), lon: parseFloat(w.lon) }))
      .filter(w => !isNaN(w.lat) && !isNaN(w.lon));
    if (wpsWithCoords.length >= 2) {
      setOptimizing(true);
      const optimized = optimizeWaypointOrder(wpsWithCoords);
      const noCoords = newList.filter(w => !w.lat || !w.lon);
      const updatedFull = [
        ...optimized.map((w, i) => ({ ...w, visit_order: i + 1 })),
        ...noCoords.map((w, i) => ({ ...w, visit_order: optimized.length + i + 1 })),
      ];
      setWaypoints(updatedFull);
      await Promise.all(
        updatedFull.map(w =>
          supabase.from('waypoints').update({ visit_order: w.visit_order }).eq('id', w.id)
        )
      );
      setOptimizing(false);
    }
  };

  const visited = waypoints.filter(w => w.status === 'visited').length;

  return (
    <div className="page-container fade-in">
      <div className="page-header">
        <h1>Itinerary Builder</h1>
        <p>Build and optimize your travel schedule with drag-and-drop simplicity</p>
      </div>

      <div className="builder-layout">
        {/* Trip Selector */}
        <div className="trip-selector glass-card">
          <div className="selector-header">
            <h3>Your Trips</h3>
            <button className="btn btn-primary btn-xs" onClick={() => setShowTripModal(true)}>
              <Plus size={14} /> New Trip
            </button>
          </div>
          <div className="trip-list">
            {trips.length === 0 ? (
              <div className="empty-state" style={{ padding: 24 }}>
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No trips yet. Create one!</p>
              </div>
            ) : (
              trips.map(trip => (
                <button
                  key={trip.id}
                  className={`trip-select-item ${activeTrip?.id === trip.id ? 'active' : ''}`}
                  onClick={() => setActiveTrip(trip)}
                >
                  <div>
                    <div className="trip-item-name">{trip.title}</div>
                    <div className="trip-item-dest">
                      <MapPin size={11} /> {trip.destination}
                    </div>
                  </div>
                  <div className="trip-item-dates">
                    <Calendar size={11} />
                    {new Date(trip.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Waypoints */}
        <div className="waypoints-panel">
          {!activeTrip ? (
            <div className="empty-state glass-card" style={{ padding: 60 }}>
              <MapPin size={40} opacity={0.3} />
              <h3>Select a trip to build itinerary</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Choose from the left or create a new trip</p>
            </div>
          ) : (
            <>
              <div className="waypoints-header glass-card">
                <div>
                  <h2>{activeTrip.title}</h2>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
                    <span className="badge badge-teal">
                      <MapPin size={10} /> {activeTrip.destination}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {visited}/{waypoints.length} visited
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {/* Transport mode */}
                  <div className="transport-selector">
                    {TRANSPORT_MODES.map(({ key, icon: Icon, label }) => (
                      <button
                        key={key}
                        className={`transport-btn ${transport === key ? 'active' : ''}`}
                        onClick={() => setTransport(key)}
                      >
                        <Icon size={14} /> {label}
                      </button>
                    ))}
                  </div>
                  <button
                    className={`btn ${ !optimizing && waypoints.length >= 2 ? 'btn-optimize-active' : 'btn-secondary' }`}
                    onClick={handleOptimize}
                    disabled={optimizing || waypoints.length < 2}
                    title={waypoints.length < 2 ? 'Add at least 2 stops to optimize' : 'Re-order stops for shortest route'}
                  >
                    {optimizing ? <Loader2 size={14} className="spin-anim" /> : <Zap size={14} />}
                    {optimizing ? 'Optimizing…' : 'Auto-optimize'}
                  </button>
                  <button className="btn btn-primary" onClick={() => setShowWpModal(true)}>
                    <Plus size={14} /> Add Stop
                  </button>
                </div>
              </div>

              {/* Optimize status toast */}
              {optimizeStatus && (
                <div style={{
                  padding: '10px 16px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  marginBottom: 4,
                  background: optimizeStatus.startsWith('✅')
                    ? 'rgba(16,185,129,0.12)'
                    : 'rgba(245,158,11,0.12)',
                  border: `1px solid ${optimizeStatus.startsWith('✅') ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`,
                  color: optimizeStatus.startsWith('✅') ? '#34d399' : '#fbbf24',
                  transition: 'all 0.3s ease',
                }}>
                  {optimizeStatus}
                </div>
              )}

              {/* Progress bar */}
              {waypoints.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div className="rating-bar">
                    <div className="rating-fill" style={{ width: `${(visited / waypoints.length) * 100}%`, background: 'linear-gradient(90deg, var(--accent-green), #34d399)' }} />
                  </div>
                </div>
              )}

              {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                  <Loader2 size={28} className="spin-anim" style={{ color: 'var(--accent-teal)' }} />
                </div>
              ) : waypoints.length === 0 ? (
                <div className="empty-state glass-card" style={{ padding: 48 }}>
                  <Navigation2 size={36} opacity={0.3} />
                  <h3>No stops yet</h3>
                  <p>Add your first waypoint to start building the itinerary</p>
                  <button className="btn btn-primary" onClick={() => setShowWpModal(true)}>
                    <Plus size={16} /> Add First Stop
                  </button>
                </div>
              ) : (
                <DragDropContext onDragEnd={handleDragEnd}>
                  <Droppable droppableId="waypoints">
                    {(provided) => (
                      <div
                        className="waypoints-list"
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                      >
                        {waypoints.map((wp, index) => (
                          <Draggable key={wp.id} draggableId={wp.id} index={index}>
                            {(provided, snapshot) => (
                              <motion.div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={`waypoint-card glass-card ${snapshot.isDragging ? 'is-dragging' : ''} ${wp.status === 'visited' ? 'visited' : ''}`}
                                layout
                              >
                                <div className="wp-order">{index + 1}</div>
                                <div {...provided.dragHandleProps} className="drag-handle">
                                  <GripVertical size={18} />
                                </div>
                                <div className="wp-info">
                                  <div className="wp-name">{wp.place_name}</div>
                                  {wp.estimated_duration && (
                                    <div className="wp-duration">
                                      <Clock size={11} /> {wp.estimated_duration}
                                    </div>
                                  )}
                                </div>
                                <div className="wp-actions">
                                  <button
                                    className={`wp-status-btn ${wp.status === 'visited' ? 'done' : ''}`}
                                    onClick={() => handleToggleVisited(wp)}
                                    title="Mark visited"
                                  >
                                    {wp.status === 'visited'
                                      ? <CheckCircle size={18} style={{ color: 'var(--accent-green)' }} />
                                      : <Circle size={18} style={{ color: 'var(--text-muted)' }} />
                                    }
                                  </button>
                                  <button
                                    className="btn btn-danger"
                                    style={{ padding: '6px 8px' }}
                                    onClick={() => handleDeleteWp(wp.id)}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </motion.div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              )}
            </>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showTripModal && <TripModal onClose={() => setShowTripModal(false)} onCreated={(t) => { setActiveTrip(t); fetchTrips(); }} />}
        {showWpModal && activeTrip && (
          <AddWaypointModal
            tripId={activeTrip.id}
            onClose={() => setShowWpModal(false)}
            onAdded={handleWaypointAdded}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
