import { useState, useEffect } from 'react';
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

function AddWaypointModal({ tripId, onClose, onAdded, savedPlaces }) {
  const [name, setName] = useState('');
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [duration, setDuration] = useState(60);
  const [loading, setLoading] = useState(false);
  const [searchLoc, setSearchLoc] = useState('');

  const handleAdd = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.from('waypoints').insert({
      trip_id: tripId,
      place_name: name,
      estimated_duration: `${duration} minutes`,
      status: 'planned',
      visit_order: Date.now(),
      lat: parseFloat(lat) || null,
      lon: parseFloat(lon) || null,
    }).select().single();

    if (error) {
      console.error("Error adding waypoint:", error);
      alert("Failed to add stop: " + error.message);
    }

    if (!error) onAdded(data);
    setLoading(false);
    onClose();
  };

  const fillFromSaved = (place) => {
    setName(place.name);
    const geo = place.geocodes?.main;
    if (geo) { setLat(geo.latitude); setLon(geo.longitude); }
  };

  return (
    <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div
        className="trip-modal glass"
        style={{ maxWidth: 520 }}
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header" style={{ marginBottom: 20 }}>
          <h2>Add Waypoint</h2>
          <button className="btn btn-ghost" onClick={onClose}><X size={18} /></button>
        </div>

        {savedPlaces.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>
              <Heart size={12} style={{ display: 'inline', marginRight: 4 }} />
              Add from saved places:
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {savedPlaces.map(p => (
                <button
                  key={p.fsq_id}
                  className="btn btn-secondary"
                  style={{ fontSize: 12, padding: '5px 12px' }}
                  onClick={() => fillFromSaved(p)}
                >
                  {p.name}
                </button>
              ))}
            </div>
            <div className="divider" style={{ margin: '16px 0' }} />
          </div>
        )}

        <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="input-group">
            <label>Place Name</label>
            <input className="input" placeholder="e.g., Eiffel Tower" value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="input-group">
              <label>Latitude (optional)</label>
              <input className="input" type="number" step="any" placeholder="48.8584" value={lat} onChange={e => setLat(e.target.value)} />
            </div>
            <div className="input-group">
              <label>Longitude (optional)</label>
              <input className="input" type="number" step="any" placeholder="2.2945" value={lon} onChange={e => setLon(e.target.value)} />
            </div>
          </div>
          <div className="input-group">
            <label>Estimated Visit Duration (minutes): {duration}</label>
            <input type="range" min={15} max={480} step={15} value={duration} onChange={e => setDuration(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--accent-teal)' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              <span>15 min</span><span>8 hrs</span>
            </div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? <Loader2 size={16} className="spin-anim" /> : <Plus size={16} />}
            Add Waypoint
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
    if (waypoints.length < 3) return;
    setOptimizing(true);
    const wpsWithCoords = waypoints.filter(w => w.lat && w.lon);
    if (wpsWithCoords.length < 2) { setOptimizing(false); return; }

    const optimized = optimizeWaypointOrder(wpsWithCoords);
    const updatedFull = [
      ...optimized.map((wp, i) => ({ ...wp, visit_order: i + 1 })),
      ...waypoints.filter(w => !w.lat || !w.lon).map((wp, i) => ({ ...wp, visit_order: optimized.length + i + 1 })),
    ];
    setWaypoints(updatedFull);
    await Promise.all(
      updatedFull.map(wp =>
        supabase.from('waypoints').update({ visit_order: wp.visit_order }).eq('id', wp.id)
      )
    );
    setOptimizing(false);
  };

  const handleWaypointAdded = (wp) => {
    setWaypoints([...waypoints, wp]);
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
                    className="btn btn-secondary"
                    onClick={handleOptimize}
                    disabled={optimizing || waypoints.length < 3}
                  >
                    {optimizing ? <Loader2 size={14} className="spin-anim" /> : <Zap size={14} />}
                    Auto-optimize
                  </button>
                  <button className="btn btn-primary" onClick={() => setShowWpModal(true)}>
                    <Plus size={14} /> Add Stop
                  </button>
                </div>
              </div>

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
            savedPlaces={savedPlaces}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
