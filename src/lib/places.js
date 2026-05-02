/**
 * Places search — Google Places API with automatic Nominatim fallback.
 * If Google Places is REQUEST_DENIED (not enabled), falls back to
 * OpenStreetMap Nominatim which requires no API key.
 */

const NOMINATIM = 'https://nominatim.openstreetmap.org';

/* ─── Nominatim fallback ──────────────────────────────────────── */
async function nominatimSearch({ query, ll, near, limit = 20 }) {
  // Nominatim is text-based — always prefer city name over coordinates
  const cityText = near || '';
  const searchQ = cityText
    ? `${query || 'places'} in ${cityText}`
    : (query || 'tourist attractions');

  const url = `${NOMINATIM}/search?` +
    new URLSearchParams({
      q: searchQ,
      format: 'json',
      limit,
      addressdetails: 1,
      extratags: 1,
    });

  const res = await fetch(url, {
    headers: { 'User-Agent': 'VoyagerTravelApp/1.0 (contact@voyager.app)' }
  });
  const data = await res.json();

  return data.map(p => ({
    fsq_id: p.place_id?.toString() || p.osm_id?.toString(),
    place_id: p.place_id?.toString(),
    name: p.namedetails?.name || p.display_name?.split(',')[0],
    categories: [{ name: (p.type || p.class || 'place').replace(/_/g, ' ') }],
    location: {
      formatted_address: p.display_name,
      locality: p.address?.city || p.address?.town || p.address?.state || '',
    },
    geocodes: {
      main: { latitude: parseFloat(p.lat), longitude: parseFloat(p.lon) }
    },
    rating: null,
    distance: null,
    _source: 'nominatim',
  }));
}

/* ─── Google Places helpers ───────────────────────────────────── */
const getService = () =>
  new window.google.maps.places.PlacesService(document.createElement('div'));

function normalizeGooglePlace(p) {
  const lat = typeof p.geometry?.location?.lat === 'function'
    ? p.geometry.location.lat() : p.geometry?.location?.lat;
  const lng = typeof p.geometry?.location?.lng === 'function'
    ? p.geometry.location.lng() : p.geometry?.location?.lng;

  return {
    fsq_id: p.place_id,
    place_id: p.place_id,
    name: p.name,
    categories: (p.types || ['place']).slice(0, 2).map(t => ({
      name: t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    })),
    location: {
      formatted_address: p.formatted_address || p.vicinity || '',
      locality: p.vicinity || '',
    },
    geocodes: lat != null ? { main: { latitude: lat, longitude: lng } } : null,
    rating: p.rating ? p.rating * 2 : null,
    distance: null,
    _source: 'google',
  };
}

function googlePlacesSearch({ query, ll, near, radius = 10000, limit = 20, categories }) {
  return new Promise((resolve, reject) => {
    const S = window.google.maps.places.PlacesServiceStatus;
    const service = getService();

    const handleResult = (results, status) => {
      if (status === S.OK) resolve((results || []).slice(0, limit).map(normalizeGooglePlace));
      else if (status === S.ZERO_RESULTS) resolve([]);
      else reject(new Error(`Places API error: ${status}`));
    };

    if (ll) {
      const [lat, lng] = ll.split(',').map(Number);
      const location = new window.google.maps.LatLng(lat, lng);

      if (query && query !== 'tourist attractions') {
        service.textSearch({ query, location, radius }, handleResult);
      } else {
        const typeMap = {
          '16000': 'tourist_attraction', '13000': 'restaurant',
          '16032': 'museum', '16019': 'park', '10000': 'art_gallery',
        };
        service.nearbySearch({
          location, radius,
          type: typeMap[categories] || 'tourist_attraction',
        }, handleResult);
      }
    } else {
      const q = query ? `${query} in ${near || ''}` : `tourist attractions in ${near || ''}`;
      service.textSearch({ query: q }, handleResult);
    }
  });
}

/* ─── Public API ──────────────────────────────────────────────── */

/** Search places — tries Google, falls back to Nominatim automatically */
export async function searchPlaces(params) {
  // If Google Maps not loaded yet, go straight to fallback
  if (!window.google?.maps?.places) {
    return nominatimSearch(params);
  }

  try {
    return await googlePlacesSearch(params);
  } catch (err) {
    // REQUEST_DENIED = Places API not enabled → fall back silently
    if (err.message?.includes('REQUEST_DENIED') || err.message?.includes('DENIED')) {
      console.warn('Google Places API not enabled — using Nominatim fallback');
      return nominatimSearch(params);
    }
    throw err;
  }
}

/** Get place details — Google only (rich data), graceful fail */
export async function getPlaceDetails(placeId) {
  if (!window.google?.maps?.places || placeId?.toString().length > 30 === false) return {};
  // Skip Nominatim IDs (numeric) — they have no rich detail API
  if (!isNaN(placeId)) return {};

  return new Promise((resolve) => {
    getService().getDetails(
      {
        placeId,
        fields: [
          'name', 'rating', 'user_ratings_total', 'formatted_address',
          'formatted_phone_number', 'website', 'opening_hours',
          'price_level', 'editorial_summary',
        ],
      },
      (result, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK) {
          resolve({
            rating: result.rating ? result.rating * 2 : null,
            stats: { total_ratings: result.user_ratings_total || 0 },
            popularity: result.rating ? result.rating / 5 : null,
            hours: { display: result.opening_hours?.weekday_text?.join(' | ') || null },
            tel: result.formatted_phone_number || null,
            website: result.website || null,
            description: result.editorial_summary?.overview || null,
          });
        } else {
          resolve({});
        }
      }
    );
  });
}

/** Get place reviews — Google only, graceful fail */
export async function getPlaceTips(placeId, limit = 10) {
  if (!window.google?.maps?.places || !isNaN(placeId)) return [];

  return new Promise((resolve) => {
    getService().getDetails(
      { placeId, fields: ['reviews'] },
      (result, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK) {
          resolve(
            (result.reviews || []).slice(0, limit).map(r => ({
              id: r.time,
              text: r.text,
              user: { name: r.author_name },
              created_at: new Date(r.time * 1000).toISOString(),
              agree_count: r.rating >= 4 ? r.rating : 0,
            }))
          );
        } else {
          resolve([]);
        }
      }
    );
  });
}
