import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import useAppStore from '../store/useAppStore';
import { User, MapPin, Edit2, Save, Plane, Map, Compass, Heart, Calendar, X } from 'lucide-react';
import './Profile.css';

const STYLE_LABELS = {
  adventure: 'Adventure', history: 'History & Culture',
  urban: 'Urban Explorer', nature: 'Nature & Wildlife', food: 'Food & Gastronomy',
};

export default function Profile() {
  const { user, profile, setProfile, trips, savedPlaces } = useAppStore();
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [homeBase, setHomeBase] = useState(profile?.home_base || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDisplayName(profile?.display_name || '');
    setHomeBase(profile?.home_base || '');
  }, [profile]);

  const handleSave = async () => {
    setSaving(true);
    const updated = { id: user.id, display_name: displayName, home_base: homeBase };
    const { data } = await supabase.from('profiles').upsert(updated).select().single();
    if (data) setProfile({ ...profile, ...data });
    setSaving(false);
    setEditing(false);
  };

  const travelStyle = profile?.travel_style || {};
  const activeStyles = Object.entries(STYLE_LABELS).filter(([key]) => travelStyle[key] > 0);

  const stats = [
    { label: 'Total Trips', value: trips.length, icon: Plane },
    { label: 'Total Stops', value: trips.reduce((a, t) => a + (t.waypoints?.length || 0), 0), icon: Map },
    { label: 'Saved Places', value: savedPlaces.length, icon: Heart },
    { label: 'Destinations', value: [...new Set(trips.map(t => t.destination).filter(Boolean))].length, icon: Compass },
  ];

  return (
    <div className="page-container fade-in">
      <div className="page-header">
        <h1>My Profile</h1>
        <p>Your travel identity and history</p>
      </div>

      <div className="profile-layout">
        {/* Profile Card */}
        <motion.div
          className="profile-card glass-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="profile-avatar">
            {(profile?.display_name || user?.email)?.[0]?.toUpperCase() || 'T'}
          </div>

          {editing ? (
            <div className="profile-edit-form">
              <div className="input-group">
                <label>Display Name</label>
                <input className="input" value={displayName} onChange={e => setDisplayName(e.target.value)} />
              </div>
              <div className="input-group">
                <label>Home Base City</label>
                <input className="input" placeholder="e.g., Mumbai, India" value={homeBase} onChange={e => setHomeBase(e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                  <Save size={14} /> {saving ? 'Saving...' : 'Save'}
                </button>
                <button className="btn btn-ghost" onClick={() => setEditing(false)}>
                  <X size={14} /> Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <h2 className="profile-name">{profile?.display_name || 'Traveler'}</h2>
              <p className="profile-email">{user?.email}</p>
              {profile?.home_base && (
                <div className="profile-home">
                  <MapPin size={13} style={{ color: 'var(--accent-teal)' }} />
                  <span>{profile.home_base}</span>
                </div>
              )}
              <button className="btn btn-secondary" style={{ marginTop: 16 }} onClick={() => setEditing(true)}>
                <Edit2 size={14} /> Edit Profile
              </button>
            </>
          )}
        </motion.div>

        <div className="profile-right">
          {/* Stats */}
          <div className="profile-stats">
            {stats.map(({ label, value, icon: Icon }, i) => (
              <motion.div
                key={label}
                className="profile-stat glass-card"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
              >
                <Icon size={18} style={{ color: 'var(--accent-teal)' }} />
                <div className="ps-value">{value}</div>
                <div className="ps-label">{label}</div>
              </motion.div>
            ))}
          </div>

          {/* Travel Style */}
          <div className="glass-card" style={{ padding: 24 }}>
            <h3 style={{ marginBottom: 14, fontSize: 16, fontWeight: 700 }}>Travel Style</h3>
            {activeStyles.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                Complete onboarding to set your travel style
              </p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {activeStyles.map(([key, label]) => (
                  <span key={key} className="badge badge-teal">{label}</span>
                ))}
                {travelStyle.budget && <span className="badge badge-amber">💰 {travelStyle.budget} budget</span>}
                {travelStyle.activity && <span className="badge badge-violet">⚡ {travelStyle.activity} activity</span>}
              </div>
            )}
          </div>

          {/* Saved Places */}
          {savedPlaces.length > 0 && (
            <div className="glass-card" style={{ padding: 24 }}>
              <h3 style={{ marginBottom: 14, fontSize: 16, fontWeight: 700 }}>
                <Heart size={15} style={{ display: 'inline', marginRight: 6, color: 'var(--accent-red)' }} />
                Saved Places ({savedPlaces.length})
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {savedPlaces.map(place => (
                  <div key={place.fsq_id} className="saved-place-row glass-card">
                    <MapPin size={13} style={{ color: 'var(--accent-teal)', flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{place.name}</span>
                    {place.categories?.[0] && (
                      <span className="badge badge-violet" style={{ fontSize: 10 }}>
                        {place.categories[0].name}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Trip History */}
          {trips.length > 0 && (
            <div className="glass-card" style={{ padding: 24 }}>
              <h3 style={{ marginBottom: 14, fontSize: 16, fontWeight: 700 }}>
                <Calendar size={15} style={{ display: 'inline', marginRight: 6 }} />
                Trip History
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {trips.map(trip => (
                  <div key={trip.id} className="saved-place-row glass-card">
                    <Plane size={13} style={{ color: 'var(--accent-amber)', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{trip.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{trip.destination}</div>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {new Date(trip.start_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
