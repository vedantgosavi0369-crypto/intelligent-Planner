import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Plane, Map, Compass, Navigation2, ArrowRight, Globe2, Zap, Shield } from 'lucide-react';
import './Splash.css';

const features = [
  { icon: Compass, title: 'Smart Discovery', desc: 'Discover hidden gems and popular spots powered by real-time Foursquare data.' },
  { icon: Map, title: 'Intelligent Planning', desc: 'Auto-optimize your itinerary with our route efficiency algorithm.' },
  { icon: Navigation2, title: 'Live Navigation', desc: 'Step-by-step routing with real-time traffic-aware directions.' },
  { icon: Zap, title: 'Instant Reviews', desc: 'Real ratings and tips from millions of travelers worldwide.' },
];

export default function Splash() {
  const navigate = useNavigate();

  return (
    <div className="splash-page">
      {/* Hero */}
      <motion.header
        className="splash-hero"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
      >
        <nav className="splash-nav">
          <div className="splash-logo">
            <div className="logo-icon-lg">
              <Plane size={24} />
            </div>
            <span>Voyager</span>
          </div>
          <div className="splash-nav-actions">
            <button className="btn btn-ghost" onClick={() => navigate('/auth')}>Sign in</button>
            <button className="btn btn-primary" onClick={() => navigate('/auth')}>Get Started</button>
          </div>
        </nav>

        <div className="hero-content">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.7 }}
          >
            <div className="hero-badge">
              <Globe2 size={14} />
              <span>AI-Powered Travel Intelligence</span>
            </div>
            <h1 className="hero-title">
              Plan Smarter.<br />
              <span className="grad-text-teal">Travel Better.</span>
            </h1>
            <p className="hero-desc">
              Voyager unifies place discovery, itinerary optimization, and live navigation
              into one seamless intelligent platform. Say goodbye to switching between 5 apps.
            </p>
            <div className="hero-ctas">
              <motion.button
                className="btn btn-primary btn-lg"
                onClick={() => navigate('/auth')}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.97 }}
              >
                Start Planning Free
                <ArrowRight size={18} />
              </motion.button>
              <button className="btn btn-secondary btn-lg" onClick={() => navigate('/auth')}>
                See How It Works
              </button>
            </div>
            <div className="hero-stats">
              <div className="stat"><span className="stat-num">50K+</span><span>Places indexed</span></div>
              <div className="stat-divider" />
              <div className="stat"><span className="stat-num">Real-time</span><span>Reviews & ratings</span></div>
              <div className="stat-divider" />
              <div className="stat"><span className="stat-num">Free</span><span>No credit card</span></div>
            </div>
          </motion.div>

          {/* Floating map preview */}
          <motion.div
            className="hero-visual"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5, duration: 0.8 }}
          >
            <div className="map-preview glass">
              <div className="map-header">
                <div className="map-dot teal" />
                <div className="map-dot amber" />
                <div className="map-dot violet" />
              </div>
              <div className="map-body">
                <div className="route-line" />
                {[
                  { label: 'Taj Mahal', rating: '9.2', top: '20%', left: '30%' },
                  { label: 'Red Fort', rating: '8.7', top: '50%', left: '60%' },
                  { label: 'India Gate', rating: '9.0', top: '70%', left: '25%' },
                ].map((pin, i) => (
                  <motion.div
                    key={pin.label}
                    className="map-pin glass-card"
                    style={{ top: pin.top, left: pin.left }}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.8 + i * 0.2 }}
                  >
                    <div className="pin-dot" />
                    <div className="pin-info">
                      <span className="pin-name">{pin.label}</span>
                      <span className="pin-rating">⭐ {pin.rating}</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </motion.header>

      {/* Features */}
      <section className="features-section">
        <motion.div
          className="section-header"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2>Everything you need for the perfect trip</h2>
          <p>From discovery to navigation — all in one intelligent platform</p>
        </motion.div>

        <div className="features-grid">
          {features.map(({ icon: Icon, title, desc }, i) => (
            <motion.div
              key={title}
              className="feature-card glass-card"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ y: -4 }}
            >
              <div className="feature-icon">
                <Icon size={22} />
              </div>
              <h3>{title}</h3>
              <p>{desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <motion.div
          className="cta-card glass"
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
        >
          <Shield size={40} style={{ color: 'var(--accent-teal)', marginBottom: 12 }} />
          <h2>Ready to explore the world smarter?</h2>
          <p>Join thousands of travelers who've ditched the spreadsheet</p>
          <motion.button
            className="btn btn-primary btn-lg"
            onClick={() => navigate('/auth')}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
          >
            Get Started — It's Free
            <ArrowRight size={18} />
          </motion.button>
        </motion.div>
      </section>
    </div>
  );
}
