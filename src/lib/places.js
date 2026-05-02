/**
 * Places search — Google Places API (primary) with Overpass API fallback.
 * Overpass is OpenStreetMap's real POI search engine — it knows restaurants,
 * landmarks, museums, parks, shops, etc. for every city in the world.
 */

const NOMINATIM   = 'https://nominatim.openstreetmap.org';
const OVERPASS    = 'https://overpass-api.de/api/interpreter';
const OSM_HEADERS = { 'User-Agent': 'TravelBuddyApp/1.0 (contact@travelbuddy.app)' };

/* ─── OSM tag filters by category ID ─────────────────────────── */
// Each entry is an array of Overpass node/way filter strings (without location clause)
const OSM_FILTERS = {
  '': [   // All — broad mix of tourism, food, leisure
    `node["tourism"~"attraction|monument|viewpoint|museum|gallery|artwork|castle|ruins"]["name"]`,
    `node["historic"]["name"]`,
    `node["amenity"~"restaurant|cafe|bar|fast_food"]["name"]`,
    `node["leisure"~"park|nature_reserve|garden"]["name"]`,
  ],
  '16000': [ // Landmarks
    `node["tourism"~"attraction|monument|viewpoint|castle|ruins"]["name"]`,
    `node["historic"]["name"]`,
  ],
  '13000': [ // Food & Drink
    `node["amenity"~"restaurant|cafe|bar|fast_food|pub|food_court|ice_cream"]["name"]`,
  ],
  '16032': [ // Museums
    `node["tourism"~"museum|gallery"]["name"]`,
  ],
  '16019': [ // Nature
    `node["leisure"~"park|nature_reserve|garden"]["name"]`,
    `node["natural"~"peak|waterfall|beach|wood"]["name"]`,
  ],
  '10000': [ // Arts
    `node["tourism"~"gallery|artwork"]["name"]`,
    `node["amenity"~"arts_centre|theatre|cinema"]["name"]`,
  ],
  '18000': [ // Shopping
    `node["shop"]["name"]`,
    `node["amenity"~"marketplace|mall"]["name"]`,
  ],
};

/* ─── Geocode a city name → lat/lon via Nominatim ─────────────── */
async function geocodeCity(cityName) {
  const url = `${NOMINATIM}/search?` + new URLSearchParams({
    q: cityName, format: 'json', limit: 1,
  });
  try {
    const res  = await fetch(url, { headers: OSM_HEADERS });
    const data = await res.json();
    if (!data.length) return null;
    return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}

/* ─── Normalize an Overpass element → app shape ───────────────── */
function normalizeOSMPlace(el) {
  const tags = el.tags || {};
  const name = tags.name || tags['name:en'] || 'Unnamed Place';

  // Pick a human-readable category label
  const rawType =
    tags.tourism || tags.amenity || tags.leisure ||
    tags.historic || tags.shop   || tags.natural || 'place';
  const categoryName = rawType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  const street = tags['addr:street']  || '';
  const city   = tags['addr:city']    || tags['addr:town'] || tags['addr:state'] || '';
  const addr   = [street, city].filter(Boolean).join(', ') || city;

  const lat = el.type === 'node' ? el.lat : (el.center?.lat ?? null);
  const lon = el.type === 'node' ? el.lon : (el.center?.lon ?? null);

  return {
    fsq_id:    el.id?.toString(),
    place_id:  el.id?.toString(),
    name,
    categories: [{ name: categoryName }],
    location: {
      formatted_address: addr || name,
      locality: city,
    },
    geocodes: lat != null ? { main: { latitude: lat, longitude: lon } } : null,
    rating:   null,
    distance: null,
    _source:  'osm',
  };
}

/* ─── Overpass POI search ─────────────────────────────────────── */
async function overpassSearch({ ll, near, categories = '', radius = 8000, limit = 20 }) {
  // Resolve coordinates
  let lat, lon;
  if (ll) {
    [lat, lon] = ll.split(',').map(Number);
  } else if (near) {
    const geo = await geocodeCity(near);
    if (!geo) return [];
    lat = geo.lat; lon = geo.lon;
  } else {
    return [];
  }

  const filters = OSM_FILTERS[categories] || OSM_FILTERS[''];
  const around  = `(around:${radius},${lat},${lon})`;

  // Build Overpass QL query — union of all relevant tag filters
  const inner = filters.map(f => `  ${f}${around};`).join('\n');
  const oql   = `[out:json][timeout:20];\n(\n${inner}\n);\nout body ${limit * 2};`;

  const res  = await fetch(OVERPASS, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    `data=${encodeURIComponent(oql)}`,
  });
  const data = await res.json();

  // Filter out unnamed nodes and deduplicate by name
  const seen = new Set();
  const elements = (data.elements || []).filter(el => {
    const n = el.tags?.name;
    if (!n || seen.has(n)) return false;
    seen.add(n);
    return true;
  });

  return elements.slice(0, limit).map(normalizeOSMPlace);
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
    fsq_id:    p.place_id,
    place_id:  p.place_id,
    name:      p.name,
    categories: (p.types || ['place']).slice(0, 2).map(t => ({
      name: t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    })),
    location: {
      formatted_address: p.formatted_address || p.vicinity || '',
      locality: p.vicinity || '',
    },
    geocodes: lat != null ? { main: { latitude: lat, longitude: lng } } : null,
    rating:   p.rating ? p.rating * 2 : null,
    distance: null,
    _source:  'google',
  };
}

function googlePlacesSearch({ query, ll, near, radius = 10000, limit = 20 }) {
  return new Promise((resolve, reject) => {
    const S       = window.google.maps.places.PlacesServiceStatus;
    const service = getService();

    const handleResult = (results, status) => {
      if (status === S.OK)           resolve((results || []).slice(0, limit).map(normalizeGooglePlace));
      else if (status === S.ZERO_RESULTS) resolve([]);
      else reject(new Error(`Places API error: ${status}`));
    };

    const searchQuery = query
      ? (near ? `${query} in ${near}` : query)
      : `tourist attractions in ${near || ''}`.trim();

    if (ll) {
      const [lat, lng] = ll.split(',').map(Number);
      const location   = new window.google.maps.LatLng(lat, lng);
      service.textSearch({ query: searchQuery, location, radius }, handleResult);
    } else {
      service.textSearch({ query: searchQuery }, handleResult);
    }
  });
}

/* ─── Public API ──────────────────────────────────────────────── */

/** Search places — tries Google, falls back to Overpass (OSM) automatically */
export async function searchPlaces(params) {
  // If Maps JS not loaded, go straight to Overpass
  if (!window.google?.maps?.places) {
    console.info('Google Maps not loaded — using Overpass (OSM) fallback');
    return overpassSearch(params);
  }

  try {
    return await googlePlacesSearch(params);
  } catch (err) {
    // Billing/key issues → fall back to free Overpass
    if (
      err.message?.includes('REQUEST_DENIED') ||
      err.message?.includes('DENIED')         ||
      err.message?.includes('BillingNotEnabled')
    ) {
      console.warn('Google Places unavailable — using Overpass (OSM) fallback');
      return overpassSearch(params);
    }
    throw err;
  }
}

/** Get place details — Google only (rich data), graceful fail */
export async function getPlaceDetails(placeId) {
  if (!window.google?.maps?.places) return {};
  if (!isNaN(placeId)) return {}; // OSM numeric IDs have no detail API

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
            rating:      result.rating ? result.rating * 2 : null,
            stats:       { total_ratings: result.user_ratings_total || 0 },
            popularity:  result.rating ? result.rating / 5 : null,
            hours:       { display: result.opening_hours?.weekday_text?.join(' | ') || null },
            tel:         result.formatted_phone_number || null,
            website:     result.website || null,
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
              id:          r.time,
              text:        r.text,
              user:        { name: r.author_name },
              created_at:  new Date(r.time * 1000).toISOString(),
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
