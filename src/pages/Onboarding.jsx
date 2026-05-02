import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import useAppStore from '../store/useAppStore';
import { Plane, Mountain, Building2, History, Waves, Utensils, ArrowRight, Check } from 'lucide-react';
import './Onboarding.css';

const travelStyles = [
  { key: 'adventure', label: 'Adventure', icon: Mountain, color: '#10b981', desc: 'Hiking, trekking & outdoor thrills' },
  { key: 'history', label: 'History & Culture', icon: History, color: '#f59e0b', desc: 'Museums, monuments & heritage' },
  { key: 'urban', label: 'Urban Explorer', icon: Building2, color: '#00d4ff', desc: 'City life, markets & street art' },
  { key: 'nature', label: 'Nature & Wildlife', icon: Waves, color: '#34d399', desc: 'Parks, beaches & landscapes' },
  { key: 'food', label: 'Food & Gastronomy', icon: Utensils, color: '#f97316', desc: 'Local cuisine & culinary tours' },
];

const budgets = [
  { key: 'budget', label: 'Budget', desc: 'Hostels & street food' },
  { key: 'mid', label: 'Mid-range', desc: 'Hotels & local restaurants' },
  { key: 'luxury', label: 'Luxury', desc: 'Premium stays & fine dining' },
];

const activityLevels = [
  { key: 'low', label: 'Easy', desc: 'Light walking & relaxed pace' },
  { key: 'medium', label: 'Moderate', desc: 'Mix of activities & rest' },
  { key: 'high', label: 'Active', desc: 'Full days & long walks' },
];

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState([]);
  const [budget, setBudget] = useState('mid');
  const [activity, setActivity] = useState('medium');
  const [loading, setLoading] = useState(false);
  const { user, setProfile } = useAppStore();
  const navigate = useNavigate();

  const toggleStyle = (key) => {
    setSelected(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const handleFinish = async () => {
    setLoading(true);
    const travelStyle = {};
    travelStyles.forEach(ts => {
      travelStyle[ts.key] = selected.includes(ts.key) ? 5 : 0;
    });
    travelStyle.budget = budget;
    travelStyle.activity = activity;

    const profileData = {
      id: user.id,
      display_name: user.user_metadata?.display_name || user.email?.split('@')[0],
      travel_style: travelStyle,
      created_at: new Date().toISOString(),
    };

    await supabase.from('profiles').upsert(profileData);
    setProfile(profileData);
    navigate('/dashboard');
  };

  const steps = [
    {
      title: 'What kind of traveler are you?',
      subtitle: 'Select all that apply — this powers your discovery engine',
      content: (
        <div className="style-grid">
          {travelStyles.map(({ key, label, icon: Icon, color, desc }) => (
            <motion.button
              key={key}
              className={`style-card ${selected.includes(key) ? 'selected' : ''}`}
              onClick={() => toggleStyle(key)}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.97 }}
              style={{ '--accent-color': color }}
            >
              <div className="style-icon" style={{ background: `${color}20`, color }}>
                <Icon size={22} />
              </div>
              <div>
                <div className="style-label">{label}</div>
                <div className="style-desc">{desc}</div>
              </div>
              {selected.includes(key) && (
                <motion.div
                  className="style-check"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                >
                  <Check size={12} />
                </motion.div>
              )}
            </motion.button>
          ))}
        </div>
      ),
      canNext: selected.length > 0,
    },
    {
      title: 'What\'s your travel budget?',
      subtitle: 'We\'ll tailor place suggestions to your comfort level',
      content: (
        <div className="option-list">
          {budgets.map(b => (
            <motion.button
              key={b.key}
              className={`option-card ${budget === b.key ? 'selected' : ''}`}
              onClick={() => setBudget(b.key)}
              whileHover={{ x: 4 }}
            >
              <div>
                <div className="option-label">{b.label}</div>
                <div className="option-desc">{b.desc}</div>
              </div>
              {budget === b.key && <Check size={16} className="option-check" />}
            </motion.button>
          ))}
        </div>
      ),
      canNext: true,
    },
    {
      title: 'How active do you want to be?',
      subtitle: 'This helps us schedule realistic daily itineraries',
      content: (
        <div className="option-list">
          {activityLevels.map(al => (
            <motion.button
              key={al.key}
              className={`option-card ${activity === al.key ? 'selected' : ''}`}
              onClick={() => setActivity(al.key)}
              whileHover={{ x: 4 }}
            >
              <div>
                <div className="option-label">{al.label}</div>
                <div className="option-desc">{al.desc}</div>
              </div>
              {activity === al.key && <Check size={16} className="option-check" />}
            </motion.button>
          ))}
        </div>
      ),
      canNext: true,
    },
  ];

  return (
    <div className="onboarding-page">
      <motion.div
        className="onboarding-card glass"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        {/* Header */}
        <div className="onboarding-header">
          <div className="logo-icon">
            <Plane size={18} />
          </div>
          <div className="step-indicators">
            {steps.map((_, i) => (
              <div key={i} className={`step-dot ${i === step ? 'active' : i < step ? 'done' : ''}`} />
            ))}
          </div>
          <span className="step-label">{step + 1} of {steps.length}</span>
        </div>

        {/* Step Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.3 }}
          >
            <h2 className="onboarding-title">{steps[step].title}</h2>
            <p className="onboarding-sub">{steps[step].subtitle}</p>
            <div className="onboarding-content">{steps[step].content}</div>
          </motion.div>
        </AnimatePresence>

        {/* Actions */}
        <div className="onboarding-actions">
          {step > 0 && (
            <button className="btn btn-ghost" onClick={() => setStep(s => s - 1)}>
              Back
            </button>
          )}
          {step < steps.length - 1 ? (
            <button
              className="btn btn-primary"
              onClick={() => setStep(s => s + 1)}
              disabled={!steps[step].canNext}
            >
              Continue <ArrowRight size={16} />
            </button>
          ) : (
            <button
              className="btn btn-amber"
              onClick={handleFinish}
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Start Exploring 🚀'}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
