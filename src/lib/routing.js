import axios from 'axios';

const OSRM_BASE = 'https://router.project-osrm.org/route/v1';

/**
 * Get route between multiple waypoints
 * @param {Array} waypoints - [{lat, lon}, ...]
 * @param {string} mode - 'driving', 'walking', 'cycling'
 */
export async function getRoute(waypoints, mode = 'driving') {
  const coords = waypoints.map(wp => `${wp.lon},${wp.lat}`).join(';');
  const res = await axios.get(`${OSRM_BASE}/${mode}/${coords}`, {
    params: {
      overview: 'full',
      geometries: 'geojson',
      steps: true,
      annotations: false,
    },
  });
  return res.data;
}

/**
 * Nearest-neighbor TSP approximation for waypoint ordering
 * @param {Array} waypoints - [{id, lat, lon, ...}]
 */
export function optimizeWaypointOrder(waypoints) {
  if (waypoints.length < 2) return waypoints;

  const remaining = [...waypoints];
  const ordered = [remaining.shift()];

  while (remaining.length > 0) {
    const last = ordered[ordered.length - 1];
    let minDist = Infinity;
    let nearestIdx = 0;

    remaining.forEach((wp, idx) => {
      const dist = haversineDistance(last.lat, last.lon, wp.lat, wp.lon);
      if (dist < minDist) {
        minDist = dist;
        nearestIdx = idx;
      }
    });

    ordered.push(remaining.splice(nearestIdx, 1)[0]);
  }
  return ordered;
}

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m} min`;
}

export function formatDistance(meters) {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
}
