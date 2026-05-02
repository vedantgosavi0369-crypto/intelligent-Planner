/**
 * Geocoding — Google Geocoder with automatic Nominatim fallback.
 * Falls back to Nominatim if Google isn't available (no billing, key issue, etc.)
 */

const NOMINATIM = 'https://nominatim.openstreetmap.org';
const HEADERS = { 'User-Agent': 'VoyagerTravelApp/1.0' };

/* ─── Nominatim implementations ─────────────────────────────── */
async function nominatimGeocode(address) {
  const r = await fetch(
    `${NOMINATIM}/search?q=${encodeURIComponent(address)}&format=json&limit=5&addressdetails=1`,
    { headers: HEADERS }
  );
  const data = await r.json();
  return data.map(p => ({
    lat: parseFloat(p.lat),
    lon: parseFloat(p.lon),
    display_name: p.display_name,
  }));
}

async function nominatimReverse(lat, lon) {
  const r = await fetch(
    `${NOMINATIM}/reverse?lat=${lat}&lon=${lon}&format=json`,
    { headers: HEADERS }
  );
  const data = await r.json();
  const city = data.address?.city || data.address?.town
    || data.address?.state_district || data.address?.state || '';
  return { display_name: data.display_name || '', address: { city } };
}

/* ─── Google implementations ─────────────────────────────────── */
function googleGeocode(address) {
  return new Promise((resolve) => {
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ address }, (results, status) => {
      if (status === 'OK' && results?.length > 0) {
        resolve(results.map(r => ({
          lat: r.geometry.location.lat(),
          lon: r.geometry.location.lng(),
          display_name: r.formatted_address,
        })));
      } else {
        resolve(null); // signal failure
      }
    });
  });
}

function googleReverse(lat, lon) {
  return new Promise((resolve) => {
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ location: { lat, lng: lon } }, (results, status) => {
      if (status === 'OK' && results?.length > 0) {
        const comps = results[0].address_components || [];
        const city =
          comps.find(c => c.types.includes('locality'))?.long_name ||
          comps.find(c => c.types.includes('administrative_area_level_2'))?.long_name ||
          comps.find(c => c.types.includes('administrative_area_level_1'))?.long_name || '';
        resolve({ display_name: results[0].formatted_address, address: { city } });
      } else {
        resolve(null); // signal failure
      }
    });
  });
}

/* ─── Public API ─────────────────────────────────────────────── */
export async function geocodePlace(address) {
  // Try Google first if available
  if (window.google?.maps?.Geocoder) {
    try {
      const result = await googleGeocode(address);
      if (result) return result;
    } catch (_) { /* fall through */ }
  }
  // Nominatim fallback
  return nominatimGeocode(address);
}

export async function reverseGeocode(lat, lon) {
  // Try Google first if available
  if (window.google?.maps?.Geocoder) {
    try {
      const result = await googleReverse(lat, lon);
      if (result) return result;
    } catch (_) { /* fall through */ }
  }
  // Nominatim fallback
  return nominatimReverse(lat, lon);
}
