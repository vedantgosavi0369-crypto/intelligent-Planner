import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { searchPlaces, getPlaceDetails, getPlaceTips } from '../lib/places';
import { geocodePlace } from '../lib/geocoding';
import useAppStore from '../store/useAppStore';
import {
  Search, MapPin, Star, Heart, HeartOff, Clock, Globe,
  Phone, X, Loader2, Filter, LocateFixed,
  Users, MessageSquare, TrendingUp, Info
} from 'lucide-react';
import './Discovery.css';

const CATEGORIES = [
  { id: '', label: 'All', query: '' },
  { id: '16000', label: 'Landmarks', query: 'landmarks' },
  { id: '13000', label: 'Food & Drink', query: 'restaurants' },
  { id: '16032', label: 'Museums', query: 'museums' },
  { id: '16019', label: 'Nature', query: 'parks' },
  { id: '10000', label: 'Arts', query: 'art' },
  { id: '18000', label: 'Shopping', query: 'shopping' },
];

function StarRating({ rating, max = 10 }) {
  const normalized = (rating / max) * 5;
  return (
    <div className="star-rating">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          size={13}
          fill={i <= Math.round(normalized) ? 'var(--accent-amber)' : 'none'}
          stroke={i <= Math.round(normalized) ? 'var(--accent-amber)' : 'var(--text-muted)'}
        />
      ))}
      <span className="rating-text">{(rating / 2).toFixed(1)}</span>
    </div>
  );
}

function PlaceDetailModal({ place, onClose }) {
  const [details, setDetails] = useState(null);
  const [tips, setTips] = useState([]);
  const [loading, setLoading] = useState(true);
  const { toggleSavePlace, savedPlaces } = useAppStore();
  const isSaved = savedPlaces.some(p => p.fsq_id === place.fsq_id);

  useEffect(() => {
    const load = async () => {
      try {
        const [det, tipsData] = await Promise.all([
          getPlaceDetails(place.fsq_id),
          getPlaceTips(place.fsq_id, 8),
        ]);
        setDetails(det);
        setTips(tipsData);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [place.fsq_id]);

  const categories = place.categories?.map(c => c.name).join(', ') || 'Place';
  const addr = place.location?.formatted_address || place.location?.address || '';

  return (
    <motion.div
      className="modal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="place-modal glass"
        initial={{ opacity: 0, y: 40, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.96 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="modal-header">
          <div>
            <h2 className="modal-place-name">{place.name}</h2>
            <span className="badge badge-teal">{categories}</span>
          </div>
          <div className="modal-actions">
            <button
              className={`btn ${isSaved ? 'btn-danger' : 'btn-secondary'}`}
              onClick={() => toggleSavePlace(place)}
            >
              {isSaved ? <HeartOff size={14} /> : <Heart size={14} />}
              {isSaved ? 'Saved' : 'Save'}
            </button>
            <button className="btn btn-ghost modal-close" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Address */}
        {addr && (
          <div className="modal-addr">
            <MapPin size={13} style={{ color: 'var(--accent-teal)', flexShrink: 0 }} />
            <span>{addr}</span>
          </div>
        )}

        {loading ? (
          <div className="modal-loading">
            <Loader2 size={28} className="spin-anim" />
            <span>Loading details & reviews...</span>
          </div>
        ) : (
          <>
            {/* Rating Overview */}
            {details?.rating && (
              <div className="rating-overview glass-card">
                <div className="rating-big">
                  <span className="rating-num">{(details.rating / 2).toFixed(1)}</span>
                  <span className="rating-max">/5</span>
                </div>
                <div className="rating-details">
                  <StarRating rating={details.rating} />
                  <div className="rating-bar" style={{ marginTop: 8 }}>
                    <div className="rating-fill" style={{ width: `${details.rating * 10}%` }} />
                  </div>
                  {details.stats?.total_ratings && (
                    <div className="rating-count">
                      <Users size={12} />
                      {details.stats.total_ratings.toLocaleString()} ratings
                    </div>
                  )}
                  {details.popularity && (
                    <div className="popularity">
                      <TrendingUp size={12} />
                      Popularity: {(details.popularity * 100).toFixed(0)}%
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Info Grid */}
            <div className="info-grid">
              {details?.hours?.display && (
                <div className="info-item">
                  <Clock size={14} style={{ color: 'var(--accent-teal)' }} />
                  <div>
                    <div className="info-label">Hours</div>
                    <div className="info-val">{details.hours.display}</div>
                  </div>
                </div>
              )}
              {details?.tel && (
                <div className="info-item">
                  <Phone size={14} style={{ color: 'var(--accent-amber)' }} />
                  <div>
                    <div className="info-label">Phone</div>
                    <div className="info-val">{details.tel}</div>
                  </div>
                </div>
              )}
              {details?.website && (
                <div className="info-item">
                  <Globe size={14} style={{ color: '#a78bfa' }} />
                  <div>
                    <div className="info-label">Website</div>
                    <a href={details.website} target="_blank" rel="noreferrer" className="info-link">
                      Visit website
                    </a>
                  </div>
                </div>
              )}
              {details?.price && (
                <div className="info-item">
                  <Info size={14} style={{ color: 'var(--accent-green)' }} />
                  <div>
                    <div className="info-label">Price Level</div>
                    <div className="info-val">{'$'.repeat(details.price)}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Description */}
            {details?.description && (
              <div className="place-desc">{details.description}</div>
            )}

            {/* Tips / Reviews */}
            {tips.length > 0 && (
              <div className="tips-section">
                <h3 className="tips-title">
                  <MessageSquare size={16} style={{ color: 'var(--accent-teal)' }} />
                  Traveler Reviews & Tips
                </h3>
                <div className="tips-list">
                  {tips.map((tip, i) => (
                    <motion.div
                      key={tip.id || i}
                      className="tip-card glass-card"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.06 }}
                    >
                      <div className="tip-header">
                        <div className="tip-avatar">
                          {tip.user?.name?.[0] || '?'}
                        </div>
                        <div>
                          <div className="tip-user">{tip.user?.name || 'Anonymous Traveler'}</div>
                          {tip.created_at && (
                            <div className="tip-date">
                              {new Date(tip.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}
                            </div>
                          )}
                        </div>
                        {tip.agree_count > 0 && (
                          <span className="tip-likes">👍 {tip.agree_count}</span>
                        )}
                      </div>
                      <p className="tip-text">{tip.text}</p>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {tips.length === 0 && !loading && (
              <div className="no-tips">
                <MessageSquare size={24} opacity={0.3} />
                <p>No reviews available yet for this place.</p>
              </div>
            )}
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

function PlaceCard({ place, onViewDetails }) {
  const { toggleSavePlace, savedPlaces } = useAppStore();
  const isSaved = savedPlaces.some(p => p.fsq_id === place.fsq_id);
  const category = place.categories?.[0]?.name || 'Place';
  const addr = place.location?.formatted_address || place.location?.locality || '';

  return (
    <motion.div
      className="place-card glass-card"
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -4 }}
    >
      <div className="place-card-header">
        <span className="badge badge-violet">{category}</span>
        <button
          className={`save-btn ${isSaved ? 'saved' : ''}`}
          onClick={() => toggleSavePlace(place)}
        >
          <Heart size={16} fill={isSaved ? 'var(--accent-red)' : 'none'} stroke={isSaved ? 'var(--accent-red)' : 'currentColor'} />
        </button>
      </div>

      <h3 className="place-name">{place.name}</h3>

      {addr && (
        <div className="place-addr">
          <MapPin size={11} />
          <span>{addr}</span>
        </div>
      )}

      <div className="place-card-footer">
        {place.distance && (
          <span className="place-dist">📍 {(place.distance / 1000).toFixed(1)} km</span>
        )}
        <button className="btn btn-primary btn-xs" onClick={() => onViewDetails(place)}>
          Reviews & Details
        </button>
      </div>
    </motion.div>
  );
}

export default function Discovery() {
  const { userLocation, userCity } = useAppStore();
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState(userCity || '');
  const [category, setCategory] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);

  // Auto-trigger search when category changes (if location is filled)
  const handleCategoryChange = useCallback((catId) => {
    setCategory(catId);
    if (location.trim()) {
      // Trigger after state update
      setTimeout(() => document.getElementById('discovery-search-btn')?.click(), 50);
    }
  }, [location]);

  const handleSearch = useCallback(async (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (!location.trim()) { setError('Please enter a location or use "Near Me"'); return; }
    setError(''); setLoading(true); setSearched(true);

    // Pick the category's keyword or fall back to user's typed query
    const activeCat = CATEGORIES.find(c => c.id === category);
    const effectiveQuery = activeCat?.query || query || 'tourist attractions';

    try {
      let ll = null;

      if (userLocation && (location === userCity || !isNaN(parseFloat(location)))) {
        ll = `${userLocation.lat},${userLocation.lon}`;
      } else {
        const geoResults = await geocodePlace(location);
        if (geoResults.length > 0) ll = `${geoResults[0].lat},${geoResults[0].lon}`;
      }

      const searchParams = {
        query: effectiveQuery,
        categories: category || undefined,
        near: location,   // always pass text location for Nominatim fallback
        limit: 20,
        radius: 10000,
      };

      if (ll) searchParams.ll = ll;

      const places = await searchPlaces(searchParams);
      if (places.length === 0) setError('No places found. Try a broader search.');
      setResults(places);
    } catch (err) {
      console.error('Search error:', err);
      setError(`Search failed: ${err.message || 'Please try again.'}`);
    } finally {
      setLoading(false);
    }
  }, [query, location, category, userLocation, userCity]);
  // Auto-populate city when it becomes available
  useEffect(() => {
    if (userCity && !location) setLocation(userCity);
  }, [userCity]);

  const useMyLocation = () => {
    if (userCity) setLocation(userCity);
    else if (userLocation) setLocation(`${userLocation.lat.toFixed(4)}, ${userLocation.lon.toFixed(4)}`);
  };

  return (
    <div className="page-container fade-in">
      <div className="page-header">
        <h1>Discover Places</h1>
        <p>Search any destination to find top-rated places with real reviews from Foursquare</p>
      </div>

      {/* Search Form */}
      <form className="discovery-form glass-card" onSubmit={handleSearch}>
        <div className="search-fields">
          <div className="input-group search-loc">
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>📍 Location / City</span>
              {(userLocation || userCity) && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: 11, padding: '3px 10px', gap: 4 }}
                  onClick={useMyLocation}
                >
                  <LocateFixed size={11} /> Near Me
                </button>
              )}
            </label>
            <input
              className="input"
              placeholder="e.g., Paris, Tokyo, New York..."
              value={location}
              onChange={e => setLocation(e.target.value)}
              required
            />
          </div>
          <div className="input-group search-query">
            <label>🔍 What to find (optional)</label>
            <input
              className="input"
              placeholder="e.g., museums, restaurants, parks..."
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
          <button type="submit" id="discovery-search-btn" className="btn btn-primary search-btn" disabled={loading}>
            {loading ? <Loader2 size={16} className="spin-anim" /> : <Search size={16} />}
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>

        {/* Category Filter */}
        <div className="category-filters">
          <Filter size={14} style={{ color: 'var(--text-muted)' }} />
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              type="button"
              className={`cat-btn ${category === cat.id ? 'active' : ''}`}
              onClick={() => handleCategoryChange(cat.id)}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {error && <div className="search-error">{error}</div>}
      </form>

      {/* Results */}
      <AnimatePresence>
        {loading && (
          <div className="search-loading">
            <Loader2 size={32} className="spin-anim" style={{ color: 'var(--accent-teal)' }} />
            <span>Discovering amazing places...</span>
          </div>
        )}

        {!loading && searched && results.length === 0 && (
          <div className="empty-state">
            <Search size={40} opacity={0.3} />
            <h3>No places found</h3>
            <p>Try a different location or search term</p>
          </div>
        )}

        {!loading && results.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="results-header">
              <h2>{results.length} places found</h2>
              <span className="badge badge-teal">{location}</span>
            </div>
            <div className="places-grid">
              {results.map(place => (
                <PlaceCard
                  key={place.fsq_id}
                  place={place}
                  onViewDetails={setSelectedPlace}
                />
              ))}
            </div>
          </motion.div>
        )}

        {!searched && (
          <div className="discovery-prompt">
            <div className="prompt-icon">🌍</div>
            <h3>Where do you want to go?</h3>
            <p>Enter a city or destination above to discover top-rated places, read real traveler reviews, and save your favorites.</p>
          </div>
        )}
      </AnimatePresence>

      {/* Place Detail Modal */}
      <AnimatePresence>
        {selectedPlace && (
          <PlaceDetailModal
            place={selectedPlace}
            onClose={() => setSelectedPlace(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
