-- ─────────────────────────────────────────────────────────
-- Voyager – Smart Travel Planner Database Schema
-- Run this in: Supabase Dashboard → SQL Editor → Run
-- ─────────────────────────────────────────────────────────

-- ─── 1. Profiles (extends auth.users) ────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name    text,
  travel_style    jsonb DEFAULT '{}',
  home_base       text,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- DROP existing policies to avoid "already exists" errors on re-run
DROP POLICY IF EXISTS "Users can view their own profile"    ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile"  ON public.profiles;
DROP POLICY IF EXISTS "Users can upsert their own profile"  ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile"  ON public.profiles;

-- SELECT
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- INSERT  (needed for upsert on first sign-up)
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- UPDATE
CREATE POLICY "Users can upsert their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ─── Auto-create profile on signup ───────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Use EXECUTE FUNCTION (not PROCEDURE — deprecated in PG14+)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── 2. Trips ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.trips (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title         text NOT NULL,
  destination   text,
  start_date    date,
  end_date      date,
  is_public     boolean DEFAULT false,
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can access their own trips" ON public.trips;

-- ALL operations (SELECT / INSERT / UPDATE / DELETE)
-- Both USING and WITH CHECK required for INSERT+UPDATE to work
CREATE POLICY "Users can access their own trips"
  ON public.trips FOR ALL
  USING     (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── 3. Waypoints ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.waypoints (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id             uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  place_name          text NOT NULL,
  lat                 double precision,
  lon                 double precision,
  visit_order         integer DEFAULT 0,
  estimated_duration  text,
  status              text DEFAULT 'planned' CHECK (status IN ('saved', 'planned', 'visited')),
  notes               text,
  created_at          timestamptz DEFAULT now()
);

ALTER TABLE public.waypoints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can access waypoints for their trips" ON public.waypoints;

-- Both USING and WITH CHECK required so INSERT/UPDATE work through RLS
CREATE POLICY "Users can access waypoints for their trips"
  ON public.waypoints FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.trips
      WHERE trips.id = waypoints.trip_id
        AND trips.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.trips
      WHERE trips.id = waypoints.trip_id
        AND trips.user_id = auth.uid()
    )
  );
