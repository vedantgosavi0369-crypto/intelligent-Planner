import { useEffect, useState } from 'react';
import { LocateFixed, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import useAppStore from '../store/useAppStore';

/**
 * LocationGate — requests GPS on app entry.
 * Uses browser Geolocation API directly (no Google dependency).
 * Reverse geocoding uses Nominatim as fallback (free, no API key needed).
 * Fails gracefully within 12s if location is denied or unavailable.
 */
export default function LocationGate({ children }) {
  const { userLocation, setUserLocation, setUserCity } = useAppStore();
  const [status, setStatus] = useState(userLocation ? 'granted' : 'idle');

  useEffect(() => {
    if (userLocation) { setStatus('granted'); return; }
    if (!navigator.geolocation) { setStatus('denied'); return; }

    setStatus('requesting');

    // Hard timeout — never hang more than 12 seconds
    const timeout = setTimeout(() => setStatus('denied'), 12000);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        clearTimeout(timeout);
        const { latitude, longitude } = pos.coords;
        setUserLocation({ lat: latitude, lon: longitude });

        // Reverse geocode using Nominatim (no Google dependency)
        try {
          const r = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
            { headers: { 'User-Agent': 'TravelBuddyApp/1.0' } }
          );
          const data = await r.json();
          const city = data.address?.city || data.address?.town
            || data.address?.state_district || data.address?.state
            || data.display_name?.split(',')[0] || '';
          if (city) setUserCity(city);
        } catch (_) { /* non-fatal */ }

        setStatus('granted');
      },
      () => { clearTimeout(timeout); setStatus('denied'); },
      { enableHighAccuracy: true, timeout: 10000 }
    );

    return () => clearTimeout(timeout);
  }, []);

  if (status === 'granted' || status === 'idle') return children;

  if (status === 'requesting') {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', height: '100vh', gap: 20
      }}>
        <motion.div
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
        >
          <LocateFixed size={48} style={{ color: 'var(--accent-teal)' }} />
        </motion.div>
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>Detecting your location...</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
          Please click <strong>Allow</strong> in the browser prompt
        </p>
      </div>
    );
  }

  // Denied — show warning banner but render the app below
  return (
    <>
      <motion.div
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
          background: 'linear-gradient(135deg, #7c2d12, #92400e)',
          padding: '10px 24px',
          display: 'flex', alignItems: 'center', gap: 12,
          borderBottom: '1px solid rgba(251,146,60,0.3)',
        }}
      >
        <AlertTriangle size={16} style={{ color: '#fbbf24', flexShrink: 0 }} />
        <span style={{ flex: 1, fontSize: 13, color: '#fef3c7' }}>
          Location denied — Navigation & "Near Me" won't work.
          <span style={{ color: '#fcd34d', marginLeft: 6 }}>
            Enable location in browser settings for the full experience.
          </span>
        </span>
        <button
          style={{
            background: '#fbbf24', color: '#000', border: 'none',
            borderRadius: 6, padding: '4px 12px', fontWeight: 700,
            cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap',
          }}
          onClick={() => {
            setStatus('requesting');
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                setUserLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude });
                setStatus('granted');
              },
              () => setStatus('denied'),
              { enableHighAccuracy: true }
            );
          }}
        >
          Try Again
        </button>
      </motion.div>
      <div style={{ paddingTop: 52 }}>{children}</div>
    </>
  );
}
