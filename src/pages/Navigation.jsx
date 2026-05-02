import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  MapContainer, TileLayer, Marker, Popup,
  Polyline, Circle, useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import useAppStore from '../store/useAppStore';
import {
  Navigation2, MapPin, Clock, CheckCircle, Play,
  Square, ChevronRight, LocateFixed, Loader2,
} from 'lucide-react';
import './Navigation.css';

// Fix Leaflet default icon paths (Vite issue)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Custom colored marker factory
const makeIcon = (color, label) => L.divIcon({
  className: '',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  html: `<div style="
    width:32px;height:32px;border-radius:50%;
    background:${color};border:3px solid #fff;
    display:flex;align-items:center;justify-content:center;
    font-size:13px;font-weight:700;color:#000;
    box-shadow:0 2px 8px rgba(0,0,0,0.5);">
    ${label}
  </div>`,
});

const userIcon = L.divIcon({
  className: '',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
  html: `<div style="
    width:20px;height:20px;border-radius:50%;
    background:#00d4ff;border:3px solid #fff;
    box-shadow:0 0 12px #00d4ff88;">
  </div>`,
});

/** Auto-pan map when location changes */
function MapController({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center, map.getZoom(), { animate: true });
  }, [center]);
  return null;
}

/** Fetch OSRM route between waypoints */
async function fetchRoute(waypoints) {
  if (waypoints.length < 2) return null;
  const coords = waypoints.map(w => `${w.lon},${w.lat}`).join(';');
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;
  const r = await fetch(url);
  const data = await r.json();
  if (data.code !== 'Ok') return null;
  const route = data.routes[0];
  const coords2 = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
  const dist = (route.distance / 1000).toFixed(1);
  const dur = Math.round(route.duration / 60);
  return { coords: coords2, distance: `${dist} km`, duration: `${dur} min` };
}

export default function Navigation() {
  const {
    waypoints, currentWaypointIndex, setCurrentWaypointIndex,
    userLocation, setUserLocation, setNavigationActive, activeTrip,
  } = useAppStore();

  const [route, setRoute] = useState(null);
  const [gpsActive, setGpsActive] = useState(false);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const watchRef = useRef(null);

  const validWaypoints = waypoints.filter(w => w.lat && w.lon);

  // Derive map center: current waypoint → user → India default
  const mapCenter = validWaypoints[currentWaypointIndex]
    ? [validWaypoints[currentWaypointIndex].lat, validWaypoints[currentWaypointIndex].lon]
    : userLocation
      ? [userLocation.lat, userLocation.lon]
      : [20.5937, 78.9629];

  // Calculate OSRM route
  const calcRoute = useCallback(async () => {
    if (validWaypoints.length < 2) return;
    setLoadingRoute(true);
    try {
      const r = await fetchRoute(validWaypoints);
      setRoute(r);
    } catch (e) {
      console.error('Route error:', e);
    } finally {
      setLoadingRoute(false);
    }
  }, [validWaypoints.length]);

  useEffect(() => { calcRoute(); }, [validWaypoints.length]);

  // GPS tracking
  const startGPS = () => {
    if (!navigator.geolocation) return;
    setGpsActive(true);
    setNavigationActive(true);
    watchRef.current = navigator.geolocation.watchPosition(
      pos => setUserLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => setGpsActive(false),
      { enableHighAccuracy: true }
    );
  };

  const stopGPS = () => {
    if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current);
    setGpsActive(false);
    setNavigationActive(false);
  };

  useEffect(() => () => stopGPS(), []);

  const currentWP = validWaypoints[currentWaypointIndex];
  const nextWP = validWaypoints[currentWaypointIndex + 1];

  return (
    <div className="nav-page">
      {/* Map */}
      <div className="nav-map">
        <MapContainer
          center={mapCenter}
          zoom={13}
          style={{ width: '100%', height: '100%' }}
          zoomControl={true}
        >
          {/* Dark OpenStreetMap tile layer — free, no API key */}
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
            subdomains="abcd"
            maxZoom={20}
          />

          <MapController center={mapCenter} />

          {/* Waypoint markers */}
          {validWaypoints.map((wp, i) => (
            <Marker
              key={wp.id}
              position={[wp.lat, wp.lon]}
              icon={makeIcon(i === currentWaypointIndex ? '#00d4ff' : '#1e3a5f', i + 1)}
              eventHandlers={{ click: () => setCurrentWaypointIndex(i) }}
            >
              <Popup>{wp.place_name}</Popup>
            </Marker>
          ))}

          {/* User location */}
          {userLocation && (
            <>
              <Marker position={[userLocation.lat, userLocation.lon]} icon={userIcon}>
                <Popup>📍 You are here</Popup>
              </Marker>
              <Circle
                center={[userLocation.lat, userLocation.lon]}
                radius={100}
                pathOptions={{ color: '#00d4ff', fillColor: '#00d4ff', fillOpacity: 0.15, weight: 1 }}
              />
            </>
          )}

          {/* Route polyline */}
          {route?.coords && (
            <Polyline
              positions={route.coords}
              pathOptions={{ color: '#00d4ff', weight: 4, opacity: 0.85 }}
            />
          )}
        </MapContainer>
      </div>

      {/* Navigation Panel */}
      <div className="nav-panel glass-card">
        <div className="nav-header">
          <div>
            <div className="nav-title">
              <Navigation2 size={18} style={{ color: 'var(--accent-teal)', marginRight: 8 }} />
              {activeTrip?.title || 'Navigation'}
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
        </div>

        {/* Route stats */}
        {route && (
          <div className="route-stats">
            <div className="route-stat">
              <MapPin size={14} style={{ color: 'var(--accent-teal)' }} />{route.distance}
            </div>
            <div className="route-stat">
              <Clock size={14} style={{ color: 'var(--accent-purple)' }} />{route.duration}
            </div>
          </div>
        )}

        {loadingRoute && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 13 }}>
            <Loader2 size={14} className="spin-anim" /> Calculating route...
          </div>
        )}

        {/* Current waypoint */}
        {currentWP ? (
          <div className="current-wp glass-card">
            <div className="wp-nav-num">STOP {currentWaypointIndex + 1}</div>
            <div className="wp-nav-info">
              <div className="wp-nav-label">Current Destination</div>
              <div className="wp-nav-name">{currentWP.place_name}</div>
              {currentWP.estimated_duration && (
                <div className="wp-nav-dur"><Clock size={11} />{currentWP.estimated_duration}</div>
              )}
            </div>
            <button
              className="btn btn-primary"
              style={{ padding: '6px 14px', fontSize: 12 }}
              onClick={() => setCurrentWaypointIndex(Math.min(currentWaypointIndex + 1, validWaypoints.length - 1))}
              disabled={currentWaypointIndex >= validWaypoints.length - 1}
            >
              <CheckCircle size={13} /> Done
            </button>
          </div>
        ) : (
          <div className="glass-card" style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
            No waypoints. Add stops in the Planner first.
          </div>
        )}

        {/* Next stop */}
        {nextWP && (
          <div className="next-wp">
            <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
            <span className="next-label">Next →</span>
            <span className="next-name">{nextWP.place_name}</span>
          </div>
        )}

        {/* All stops */}
        <div className="wp-nav-list">
          {validWaypoints.map((wp, i) => (
            <button
              key={wp.id}
              className={`wp-nav-item ${i === currentWaypointIndex ? 'current' : ''} ${i < currentWaypointIndex ? 'done' : ''}`}
              onClick={() => setCurrentWaypointIndex(i)}
            >
              <span className="wp-nav-dot">{i < currentWaypointIndex ? '✓' : i + 1}</span>
              <span className="wp-nav-item-name">{wp.place_name}</span>
            </button>
          ))}
        </div>

        {/* Controls */}
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
          <button className="btn btn-secondary" onClick={calcRoute} disabled={validWaypoints.length < 2}>
            <LocateFixed size={14} /> Recalculate
          </button>
        </div>
      </div>
    </div>
  );
}
