import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';

const useAppStore = create(
  persist(
    (set, get) => ({
      // ─── Auth ─────────────────────────────────────────
      user: null,
      session: null,
      profile: null,
      authLoading: true,           // true until session is restored
      setUser: (user) => set({ user }),
      setSession: (session) => set({ session }),
      setProfile: (profile) => set({ profile }),
      setAuthLoading: (v) => set({ authLoading: v }),

      // ─── Trips ────────────────────────────────────────
      trips: [],
      activeTrip: null,
      setTrips: (trips) => set({ trips }),
      setActiveTrip: (trip) => set({ activeTrip: trip }),

      // ─── Waypoints ────────────────────────────────────
      waypoints: [],
      setWaypoints: (waypoints) => set({ waypoints }),
      addWaypoint: (wp) => set((s) => ({ waypoints: [...s.waypoints, wp] })),
      removeWaypoint: (id) =>
        set((s) => ({ waypoints: s.waypoints.filter((w) => w.id !== id) })),
      updateWaypointOrder: (waypoints) => set({ waypoints }),

      // ─── Discovery ────────────────────────────────────
      discoveryResults: [],
      savedPlaces: [],
      searchQuery: '',
      setDiscoveryResults: (results) => set({ discoveryResults: results }),
      setSavedPlaces: (places) => set({ savedPlaces: places }),
      setSearchQuery: (q) => set({ searchQuery: q }),
      toggleSavePlace: (place) =>
        set((s) => {
          const exists = s.savedPlaces.find((p) => p.fsq_id === place.fsq_id);
          return {
            savedPlaces: exists
              ? s.savedPlaces.filter((p) => p.fsq_id !== place.fsq_id)
              : [...s.savedPlaces, place],
          };
        }),

      // ─── Navigation ───────────────────────────────────
      currentWaypointIndex: 0,
      navigationActive: false,
      userLocation: null,
      userCity: '',
      setCurrentWaypointIndex: (i) => set({ currentWaypointIndex: i }),
      setNavigationActive: (v) => set({ navigationActive: v }),
      setUserLocation: (loc) => set({ userLocation: loc }),
      setUserCity: (city) => set({ userCity: city }),

      // ─── UI ───────────────────────────────────────────
      sidebarCollapsed: false,
      setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),

      // ─── Async actions ────────────────────────────────
      fetchTrips: async () => {
        const { user } = get();
        if (!user) return;
        const { data } = await supabase
          .from('trips')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        if (data) set({ trips: data });
      },

      signOut: async () => {
        await supabase.auth.signOut();
        set({ user: null, session: null, profile: null, trips: [], activeTrip: null, waypoints: [], savedPlaces: [] });
      },
    }),
    {
      name: 'travel-planner-store',
      partialize: (state) => ({
        user: state.user,
        profile: state.profile,
        savedPlaces: state.savedPlaces,
        activeTrip: state.activeTrip,
        waypoints: state.waypoints,
      }),
    }
  )
);

export default useAppStore;
