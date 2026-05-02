import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapContainer, TileLayer, Marker, Popup,
  Polyline, Circle, useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import useAppStore from '../store/useAppStore';
import {
  Navigation2, MapPin, Clock, Play, Square,
  LocateFixed, Loader2, Search, X, ChevronRight,
  ArrowUp, ArrowUpLeft, ArrowUpRight, ArrowLeft,
  ArrowRight, RotateCcw, Flag, Crosshair,
} from 'lucide-react';
import './Navigation.css';

/* ─── Leaflet icon fix for Vite ─── */
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

/* ─── Custom Icons ─── */
const userIcon = L.divIcon({
  className: '',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  html: `<div style="
    width:24px;height:24px;border-radius:50%;
    background:#00d4ff;border:3px solid #fff;
    box-shadow:0 0 0 6px rgba(0,212,255,0.25),0 0 20px #00d4ff88;
    animation:gps-pulse 1.5s ease infinite;">
  </div>`,
});

const destIcon = L.divIcon({
  className: '',
  iconSize: [36, 44],
  iconAnchor: [18, 44],
  html: `<div style="
    width:36px;height:36px;border-radius:50% 50% 50% 0;
    background:linear-gradient(135deg,#ff6b6b,#ee5a24);
    border:3px solid #fff;
    box-shadow:0 4px 20px rgba(255,107,107,0.6);
    transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;">
    <span style="transform:rotate(45deg);font-size:14px;">📍</span>
  </div>`,
});

/* ─── Auto-pan map ─── */
function MapController({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center, zoom ?? map.getZoom(), { animate: true });
  }, [center?.[0], center?.[1]]);
  return null;
}

/* ─── Click on map to set destination ─── */
function MapClickHandler({ onMapClick, enabled }) {
  const map = useMap();
  useEffect(() => {
    if (!enabled) return;
    const handler = (e) => onMapClick(e.latlng);
    map.on('click', handler);
    return () => map.off('click', handler);
  }, [enabled, onMapClick]);
  return null;
}

/* ─── OSRM routing with step-by-step directions ─── */
async function fetchRoute(from, to) {
  const url = `https://router.project-osrm.org/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}?overview=full&geometries=geojson&steps=true&annotations=false`;
  const r = await fetch(url);
  const data = await r.json();
  if (data.code !== 'Ok' || !data.routes?.length) return null;
  const route = data.routes[0];
  const coords = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
  const dist = route.distance;
  const dur = route.duration;
  const steps = route.legs[0]?.steps?.map(s => ({
    instruction: s.maneuver?.instruction || formatManeuver(s.maneuver),
    type: s.maneuver?.type,
    modifier: s.maneuver?.modifier,
    distance: s.distance,
    duration: s.duration,
    name: s.name,
  })) ?? [];
  return { coords, distance: dist, duration: dur, steps };
}

function formatManeuver(m) {
  if (!m) return 'Continue';
  const type = m.type ?? '';
  const mod = m.modifier ?? '';
  if (type === 'turn') return `Turn ${mod}`;
  if (type === 'depart') return 'Start driving';
  if (type === 'arrive') return 'Arrive at destination';
  if (type === 'roundabout') return 'Enter roundabout';
  if (type === 'fork') return `Keep ${mod}`;
  if (type === 'merge') return `Merge ${mod}`;
  return 'Continue';
}

function fmtDist(m) {
  if (m >= 1000) return `${(m / 1000).toFixed(1)} km`;
  return `${Math.round(m)} m`;
}

function fmtDur(s) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m} min`;
}

/* ─── Turn arrow icon ─── */
function TurnIcon({ type, modifier, size = 18 }) {
  const mod = modifier?.toLowerCase() ?? '';
  if (type === 'arrive') return <Flag size={size} style={{ color: '#ff6b6b' }} />;
  if (type === 'depart') return <ArrowUp size={size} style={{ color: '#00d4ff' }} />;
  if (type === 'roundabout') return <RotateCcw size={size} style={{ color: '#a78bfa' }} />;
  if (mod.includes('left') && mod.includes('slight')) return <ArrowUpLeft size={size} style={{ color: '#fbbf24' }} />;
  if (mod.includes('right') && mod.includes('slight')) return <ArrowUpRight size={size} style={{ color: '#fbbf24' }} />;
  if (mod.includes('sharp left') || mod === 'left') return <ArrowLeft size={size} style={{ color: '#f97316' }} />;
  if (mod.includes('sharp right') || mod === 'right') return <ArrowRight size={size} style={{ color: '#f97316' }} />;
  if (mod.includes('uturn')) return <RotateCcw size={size} style={{ color: '#ef4444' }} />;
  return <ArrowUp size={size} style={{ color: '#00d4ff' }} />;
}

/* ─── Geocode place name → lat/lon using Nominatim ─── */
async function geocode(query) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5`;
  const r = await fetch(url, { headers: { 'Accept-Language': 'en' } });
  return r.json();
}

/* ─── Reverse geocode lat/lon → name ─── */
async function reverseGeocode(lat, lon) {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`;
  const r = await fetch(url, { headers: { 'Accept-Language': 'en' } });
  const d = await r.json();
  return d.display_name ?? `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
}

/* ─── Haversine distance (meters) ─── */
function haversine(a, b) {
  const R = 6371000;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLon = (b.lon - a.lon) * Math.PI / 180;
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

/* ═══════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════ */
export default function Navigation() {
  const { userLocation, setUserLocation } = useAppStore();

  /* ─── Destination state ─── */
  const [dest, setDest] = useState(null);         // { lat, lon, name }
  const [destQuery, setDestQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSug, setLoadingSug] = useState(false);

  /* ─── Route state ─── */
  const [route, setRoute] = useState(null);       // { coords, distance, duration, steps }
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [routeError, setRouteError] = useState('');
  const [currentStepIdx, setCurrentStepIdx] = useState(0);

  /* ─── GPS state ─── */
  const [gpsActive, setGpsActive] = useState(false);
  const [locating, setLocating] = useState(false);
  const [clickMode, setClickMode] = useState(false);  // tap map to pick destination

  const watchRef = useRef(null);
  const sugTimeoutRef = useRef(null);

  /* ─── Map center: user → India default ─── */
  const mapCenter = userLocation
    ? [userLocation.lat, userLocation.lon]
    : [18.5204, 73.8567]; // Pune default

  /* ─── Get current location once on mount ─── */
  useEffect(() => {
    if (!userLocation && navigator.geolocation) {
      setLocating(true);
      navigator.geolocation.getCurrentPosition(
        pos => {
          setUserLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude });
          setLocating(false);
        },
        () => setLocating(false),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
    return () => {
      if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current);
    };
  }, []);

  /* ─── Start GPS watch ─── */
  const startGPS = () => {
    if (!navigator.geolocation) return;
    setGpsActive(true);
    watchRef.current = navigator.geolocation.watchPosition(
      pos => setUserLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true }
    );
  };

  const stopGPS = () => {
    if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current);
    setGpsActive(false);
  };

  /* ─── Destination search autocomplete ─── */
  const onQueryChange = (e) => {
    const q = e.target.value;
    setDestQuery(q);
    clearTimeout(sugTimeoutRef.current);
    if (q.length < 3) { setSuggestions([]); return; }
    sugTimeoutRef.current = setTimeout(async () => {
      setLoadingSug(true);
      try {
        const res = await geocode(q);
        setSuggestions(res.slice(0, 5));
      } catch { setSuggestions([]); }
      finally { setLoadingSug(false); }
    }, 400);
  };

  const selectSuggestion = async (s) => {
    const d = { lat: parseFloat(s.lat), lon: parseFloat(s.lon), name: s.display_name };
    setDest(d);
    setDestQuery(s.display_name.split(',').slice(0, 2).join(','));
    setSuggestions([]);
    if (userLocation) await buildRoute(userLocation, d);
  };

  /* ─── Map click picks destination ─── */
  const handleMapClick = useCallback(async ({ lat, lng }) => {
    setClickMode(false);
    setLoadingRoute(true);
    const name = await reverseGeocode(lat, lng).catch(() => `${lat.toFixed(4)},${lng.toFixed(4)}`);
    const d = { lat, lon: lng, name };
    setDest(d);
    setDestQuery(name.split(',').slice(0, 2).join(','));
    if (userLocation) await buildRoute(userLocation, d);
    else setLoadingRoute(false);
  }, [userLocation]);

  /* ─── Build route ─── */
  const buildRoute = async (from, to) => {
    setLoadingRoute(true);
    setRouteError('');
    setCurrentStepIdx(0);
    try {
      const r = await fetchRoute(from, to);
      if (r) setRoute(r);
      else setRouteError('Could not find a route. Try a different destination.');
    } catch {
      setRouteError('Network error. Please try again.');
    } finally {
      setLoadingRoute(false);
    }
  };

  const recalculate = () => {
    if (userLocation && dest) buildRoute(userLocation, dest);
  };

  const clearDest = () => {
    setDest(null);
    setRoute(null);
    setDestQuery('');
    setSuggestions([]);
    setCurrentStepIdx(0);
    setRouteError('');
  };

  /* ─── Auto-advance steps based on proximity ─── */
  useEffect(() => {
    if (!route || !userLocation || !gpsActive) return;
    const steps = route.steps;
    if (currentStepIdx >= steps.length - 1) return;
    // Get coords of current step maneuver location (approx via polyline index)
    const stepFraction = currentStepIdx / steps.length;
    const approxIdx = Math.floor(stepFraction * route.coords.length);
    const stepCoord = route.coords[approxIdx];
    if (!stepCoord) return;
    const dist = haversine(userLocation, { lat: stepCoord[0], lon: stepCoord[1] });
    if (dist < 40) setCurrentStepIdx(i => Math.min(i + 1, steps.length - 1));
  }, [userLocation, gpsActive]);

  const currentStep = route?.steps?.[currentStepIdx];
  const nextStep = route?.steps?.[currentStepIdx + 1];

  return (
    <div className="nav-page">
      {/* ─── Map ─── */}
      <div className="nav-map">
        <MapContainer
          center={mapCenter}
          zoom={15}
          style={{ width: '100%', height: '100%' }}
          zoomControl={false}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
            subdomains="abcd"
            maxZoom={20}
          />

          <MapController center={userLocation ? [userLocation.lat, userLocation.lon] : null} />
          <MapClickHandler onMapClick={handleMapClick} enabled={clickMode} />

          {/* User location */}
          {userLocation && (
            <>
              <Marker position={[userLocation.lat, userLocation.lon]} icon={userIcon}>
                <Popup>📍 You are here</Popup>
              </Marker>
              <Circle
                center={[userLocation.lat, userLocation.lon]}
                radius={80}
                pathOptions={{ color: '#00d4ff', fillColor: '#00d4ff', fillOpacity: 0.1, weight: 1 }}
              />
            </>
          )}

          {/* Destination marker */}
          {dest && (
            <Marker position={[dest.lat, dest.lon]} icon={destIcon}>
              <Popup>{dest.name.split(',').slice(0, 2).join(',')}</Popup>
            </Marker>
          )}

          {/* Route polyline */}
          {route?.coords && (
            <>
              {/* Shadow/glow */}
              <Polyline
                positions={route.coords}
                pathOptions={{ color: '#00d4ff', weight: 10, opacity: 0.15 }}
              />
              {/* Main route */}
              <Polyline
                positions={route.coords}
                pathOptions={{ color: '#00d4ff', weight: 4, opacity: 0.9, dashArray: null }}
              />
            </>
          )}
        </MapContainer>

        {/* ─── Click-mode overlay ─── */}
        <AnimatePresence>
          {clickMode && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="click-mode-overlay"
              onClick={() => setClickMode(false)}
            >
              <div className="click-mode-hint">
                <Crosshair size={20} /> Tap anywhere on the map to set destination
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── Locating spinner ─── */}
        {locating && (
          <div className="locating-badge">
            <Loader2 size={14} className="spin-anim" /> Getting your location…
          </div>
        )}
      </div>

      {/* ─── Navigation Panel ─── */}
      <div className="nav-panel glass-card">

        {/* Header */}
        <div className="nav-header">
          <div className="nav-title">
            <Navigation2 size={18} style={{ color: 'var(--accent-teal)', marginRight: 8 }} />
            GPS Navigation
          </div>
          <div className="nav-status">
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: gpsActive ? '#22c55e' : '#6b7280',
              display: 'inline-block', marginRight: 6,
            }} />
            {gpsActive ? 'GPS Active' : 'GPS Idle'}
          </div>
        </div>

        {/* ─── Destination Search ─── */}
        <div className="dest-search-wrap">
          <div className="dest-input-row">
            <Search size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <input
              className="dest-input"
              type="text"
              placeholder="Search destination…"
              value={destQuery}
              onChange={onQueryChange}
              onFocus={() => destQuery.length >= 3 && setSuggestions(s => s)}
            />
            {loadingSug && <Loader2 size={14} className="spin-anim" style={{ flexShrink: 0 }} />}
            {destQuery && !loadingSug && (
              <button className="icon-btn" onClick={clearDest} title="Clear">
                <X size={14} />
              </button>
            )}
          </div>

          {/* Autocomplete Suggestions */}
          <AnimatePresence>
            {suggestions.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="suggestions-list"
              >
                {suggestions.map((s, i) => (
                  <button key={i} className="suggestion-item" onClick={() => selectSuggestion(s)}>
                    <MapPin size={13} style={{ color: 'var(--accent-teal)', flexShrink: 0 }} />
                    <span>{s.display_name.split(',').slice(0, 3).join(', ')}</span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Pick on map */}
          <button
            className="pick-on-map-btn"
            onClick={() => setClickMode(c => !c)}
            style={{ background: clickMode ? 'rgba(0,212,255,0.15)' : undefined }}
          >
            <Crosshair size={13} />
            {clickMode ? 'Cancel map pick' : 'Pick on map'}
          </button>
        </div>

        {/* ─── Route Stats ─── */}
        <AnimatePresence>
          {route && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="route-stats"
            >
              <div className="route-stat">
                <MapPin size={14} style={{ color: 'var(--accent-teal)' }} />
                {fmtDist(route.distance)}
              </div>
              <div className="route-stat">
                <Clock size={14} style={{ color: 'var(--accent-purple)' }} />
                {fmtDur(route.duration)}
              </div>
              <div className="route-stat" style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                via road
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {loadingRoute && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 13 }}>
            <Loader2 size={14} className="spin-anim" /> Calculating route…
          </div>
        )}

        {routeError && (
          <div className="route-error">{routeError}</div>
        )}

        {/* ─── Current Turn Instruction ─── */}
        <AnimatePresence mode="wait">
          {route && currentStep && (
            <motion.div
              key={currentStepIdx}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="turn-card glass-card"
            >
              <div className="turn-icon-wrap">
                <TurnIcon type={currentStep.type} modifier={currentStep.modifier} size={26} />
              </div>
              <div className="turn-info">
                <div className="turn-instruction">{currentStep.instruction || formatManeuver({ type: currentStep.type, modifier: currentStep.modifier })}</div>
                {currentStep.name && <div className="turn-road">{currentStep.name}</div>}
                <div className="turn-dist">{fmtDist(currentStep.distance)}</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── Next Step Preview ─── */}
        {nextStep && (
          <div className="next-step-row">
            <ChevronRight size={13} style={{ color: 'var(--text-muted)' }} />
            <span className="next-label">Then:</span>
            <TurnIcon type={nextStep.type} modifier={nextStep.modifier} size={13} />
            <span className="next-name">{nextStep.instruction || formatManeuver({ type: nextStep.type, modifier: nextStep.modifier })}</span>
          </div>
        )}

        {/* ─── Step-by-step list ─── */}
        {route?.steps?.length > 0 && (
          <div className="steps-list">
            <div className="steps-title">All Steps</div>
            {route.steps.map((step, i) => (
              <button
                key={i}
                className={`step-item ${i === currentStepIdx ? 'current' : ''} ${i < currentStepIdx ? 'done' : ''}`}
                onClick={() => setCurrentStepIdx(i)}
              >
                <div className="step-num-wrap">
                  {i < currentStepIdx
                    ? <span style={{ color: '#22c55e', fontSize: 12 }}>✓</span>
                    : <TurnIcon type={step.type} modifier={step.modifier} size={13} />
                  }
                </div>
                <div className="step-body">
                  <div className="step-instr">{step.instruction || formatManeuver({ type: step.type, modifier: step.modifier })}</div>
                  {step.name && <div className="step-road">{step.name}</div>}
                </div>
                <div className="step-dist">{fmtDist(step.distance)}</div>
              </button>
            ))}
          </div>
        )}

        {/* ─── No destination prompt ─── */}
        {!dest && !loadingRoute && (
          <div className="no-dest-hint">
            <MapPin size={32} style={{ color: 'var(--accent-teal)', opacity: 0.5 }} />
            <p>Search a destination above<br />or tap <strong>"Pick on map"</strong></p>
          </div>
        )}

        {/* ─── Controls ─── */}
        <div className="nav-controls">
          {!gpsActive ? (
            <button className="btn btn-primary" onClick={startGPS}>
              <Play size={14} /> Start GPS
            </button>
          ) : (
            <button className="btn btn-secondary" onClick={stopGPS}>
              <Square size={14} /> Stop GPS
            </button>
          )}
          <button className="btn btn-secondary" onClick={recalculate} disabled={!dest || loadingRoute}>
            <LocateFixed size={14} /> Recalculate
          </button>
        </div>
      </div>
    </div>
  );
}
