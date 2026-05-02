import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LoadScript } from '@react-google-maps/api';
import { supabase } from './lib/supabase';
import useAppStore from './store/useAppStore';

import Splash from './pages/Splash';
import Auth from './pages/Auth';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import Discovery from './pages/Discovery';
import ItineraryBuilder from './pages/ItineraryBuilder';
import Navigation from './pages/Navigation';
import Profile from './pages/Profile';
import AppLayout from './components/AppLayout';

const GOOGLE_LIBRARIES = ['places', 'marker'];
const GMAP_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

function ProtectedRoute({ children }) {
  const { user, authLoading } = useAppStore();
  if (authLoading) return null;
  if (!user) return <Navigate to="/auth" replace />;
  return children;
}

function App() {
  const { setUser, setSession, setProfile, setAuthLoading } = useAppStore();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId) => {
    const { data } = await supabase
      .from('profiles').select('*').eq('id', userId).single();
    if (data) setProfile(data);
  };

  return (
    <LoadScript googleMapsApiKey={GMAP_KEY} libraries={GOOGLE_LIBRARIES} loadingElement={<div />}>
      <BrowserRouter>
        <div className="animated-bg" />
        <div className="star-field" />
        <Routes>
          <Route path="/" element={<Splash />} />
          <Route path="/auth" element={<Auth />} />
          <Route
            path="/onboarding"
            element={<ProtectedRoute><Onboarding /></ProtectedRoute>}
          />
          <Route
            element={<ProtectedRoute><AppLayout /></ProtectedRoute>}
          >
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/discovery" element={<Discovery />} />
            <Route path="/planner" element={<ItineraryBuilder />} />
            <Route path="/navigation" element={<Navigation />} />
            <Route path="/profile" element={<Profile />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </LoadScript>
  );
}

export default App;
